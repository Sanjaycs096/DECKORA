const LOCAL_FILE_HEADER_SIG = 0x04034b50;
const CENTRAL_DIR_HEADER_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;

const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;
const UTF8_FLAG = 0x0800;

export interface ZipWriteEntry {
  path: string;
  data: Uint8Array;
  compress?: boolean;
}

export interface ZipReadEntry {
  path: string;
  data: Uint8Array;
  compressionMethod: number;
  uncompressedSize: number;
  crc32: number;
}

export interface ZipReadLimits {
  maxArchiveBytes?: number;
  maxTotalUncompressedBytes?: number;
  maxEntryCount?: number;
  maxEntryBytes?: number;
}

export const DEFAULT_ZIP_LIMITS: Required<ZipReadLimits> = {
  maxArchiveBytes: 100 * 1024 * 1024, // 100 MB
  maxTotalUncompressedBytes: 120 * 1024 * 1024, // 120 MB
  maxEntryCount: 250,
  maxEntryBytes: 25 * 1024 * 1024, // 25 MB per file
};

export class ZipArchiveError extends Error {
  readonly code:
    | 'ABORTED'
    | 'INVALID_ARCHIVE'
    | 'UNSAFE_PATH'
    | 'DUPLICATE_PATH'
    | 'SIZE_LIMIT_EXCEEDED'
    | 'UNSUPPORTED_COMPRESSION'
    | 'CORRUPT_ENTRY';

  constructor(code: ZipArchiveError['code'], message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'ZipArchiveError';
    this.code = code;
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function normalizeSafeZipPath(rawPath: string): string {
  if (!rawPath || typeof rawPath !== 'string') {
    throw new ZipArchiveError('UNSAFE_PATH', 'Archive contains an empty entry path.');
  }
  if (rawPath.includes('\0') || rawPath.includes('\\') || /^[a-zA-Z]:/.test(rawPath)) {
    throw new ZipArchiveError('UNSAFE_PATH', `Unsafe archive entry path "${rawPath}".`);
  }
  if (rawPath.startsWith('/')) {
    throw new ZipArchiveError(
      'UNSAFE_PATH',
      `Absolute archive paths are forbidden ("${rawPath}").`,
    );
  }

  for (let i = 0; i < rawPath.length; i += 1) {
    if (rawPath.charCodeAt(i) < 32) {
      throw new ZipArchiveError('UNSAFE_PATH', `Control characters found in entry path.`);
    }
  }

  const segments = rawPath.split('/').filter((seg) => seg.length > 0 && seg !== '.');
  if (segments.length === 0 || segments.some((seg) => seg === '..')) {
    throw new ZipArchiveError('UNSAFE_PATH', `Directory traversal rejected in path "${rawPath}".`);
  }

  return segments.join('/');
}

async function tryDeflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream !== 'function') {
    return null;
  }
  try {
    const stream = new Blob([new Uint8Array(data).buffer])
      .stream()
      .pipeThrough(new CompressionStream('deflate-raw'));
    const compressedBuffer = await new Response(stream).arrayBuffer();
    const out = new Uint8Array(compressedBuffer);
    return out.byteLength < data.byteLength ? out : null;
  } catch {
    return null;
  }
}

async function inflateRawBounded(
  compressed: Uint8Array,
  maxBytes: number,
  entryPath: string,
): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'function') {
    throw new ZipArchiveError(
      'UNSUPPORTED_COMPRESSION',
      `DEFLATE decompression is unavailable in this environment for "${entryPath}".`,
    );
  }

  const stream = new Blob([new Uint8Array(compressed).buffer])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalRead = 0;

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalRead += value.byteLength;
      if (totalRead > maxBytes) {
        await reader.cancel();
        throw new ZipArchiveError(
          'SIZE_LIMIT_EXCEEDED',
          `Decompressed size for "${entryPath}" exceeds maximum allowed limit (${maxBytes} bytes).`,
        );
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof ZipArchiveError) throw error;
    throw new ZipArchiveError(
      'CORRUPT_ENTRY',
      `Failed to decompress archive entry "${entryPath}".`,
      error,
    );
  }

  const out = new Uint8Array(totalRead);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new ZipArchiveError('ABORTED', 'Archive operation was cancelled.');
  }
}

export async function writeZipArchive(
  entries: ZipWriteEntry[],
  options?: { signal?: AbortSignal },
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const seenPaths = new Set<string>();
  const prepared: Array<{
    nameBytes: Uint8Array;
    data: Uint8Array;
    payload: Uint8Array;
    method: number;
    crc: number;
  }> = [];

  for (const entry of entries) {
    throwIfAborted(options?.signal);
    const safePath = normalizeSafeZipPath(entry.path);
    if (seenPaths.has(safePath)) {
      throw new ZipArchiveError('DUPLICATE_PATH', `Duplicate archive entry "${safePath}".`);
    }
    seenPaths.add(safePath);

    const nameBytes = encoder.encode(safePath);
    const crc = computeCrc32(entry.data);
    let payload = entry.data;
    let method = METHOD_STORE;

    if (entry.compress !== false && entry.data.byteLength > 64) {
      const deflated = await tryDeflateRaw(entry.data);
      if (deflated) {
        payload = deflated;
        method = METHOD_DEFLATE;
      }
    }

    prepared.push({
      nameBytes,
      data: entry.data,
      payload,
      method,
      crc,
    });
  }

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  let centralSize = 0;

  for (const item of prepared) {
    const localHeader = new ArrayBuffer(30 + item.nameBytes.byteLength);
    const lv = new DataView(localHeader);
    lv.setUint32(0, LOCAL_FILE_HEADER_SIG, true);
    lv.setUint16(4, 20, true); // version needed 2.0
    lv.setUint16(6, UTF8_FLAG, true);
    lv.setUint16(8, item.method, true);
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0x5421, true); // deterministic DOS date
    lv.setUint32(14, item.crc, true);
    lv.setUint32(18, item.payload.byteLength, true);
    lv.setUint32(22, item.data.byteLength, true);
    lv.setUint16(26, item.nameBytes.byteLength, true);
    lv.setUint16(28, 0, true); // extra length
    new Uint8Array(localHeader, 30).set(item.nameBytes);

    localParts.push(new Uint8Array(localHeader), item.payload);

    const centralHeader = new ArrayBuffer(46 + item.nameBytes.byteLength);
    const cv = new DataView(centralHeader);
    cv.setUint32(0, CENTRAL_DIR_HEADER_SIG, true);
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, UTF8_FLAG, true);
    cv.setUint16(10, item.method, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x5421, true);
    cv.setUint32(16, item.crc, true);
    cv.setUint32(20, item.payload.byteLength, true);
    cv.setUint32(24, item.data.byteLength, true);
    cv.setUint16(28, item.nameBytes.byteLength, true);
    cv.setUint16(30, 0, true); // extra
    cv.setUint16(32, 0, true); // comment
    cv.setUint16(34, 0, true); // disk start
    cv.setUint16(36, 0, true); // internal attrs
    cv.setUint32(38, 0, true); // external attrs
    cv.setUint32(42, localOffset, true);
    new Uint8Array(centralHeader, 46).set(item.nameBytes);

    const centralBytes = new Uint8Array(centralHeader);
    centralParts.push(centralBytes);
    centralSize += centralBytes.byteLength;
    localOffset += 30 + item.nameBytes.byteLength + item.payload.byteLength;
  }

  const eocd = new ArrayBuffer(22);
  const ev = new DataView(eocd);
  ev.setUint32(0, EOCD_SIG, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, prepared.length, true);
  ev.setUint16(10, prepared.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, localOffset, true);
  ev.setUint16(20, 0, true);

  const totalLength = localOffset + centralSize + 22;
  const output = new Uint8Array(totalLength);
  let cursor = 0;

  for (const part of localParts) {
    output.set(part, cursor);
    cursor += part.byteLength;
  }
  for (const part of centralParts) {
    output.set(part, cursor);
    cursor += part.byteLength;
  }
  output.set(new Uint8Array(eocd), cursor);
  return output;
}

export async function readZipArchive(
  input: ArrayBuffer | Uint8Array,
  limitsInput?: ZipReadLimits,
): Promise<ZipReadEntry[]> {
  const limits: Required<ZipReadLimits> = {
    ...DEFAULT_ZIP_LIMITS,
    ...limitsInput,
  };

  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength < 22) {
    throw new ZipArchiveError('INVALID_ARCHIVE', 'File is too small to be a valid ZIP archive.');
  }
  if (bytes.byteLength > limits.maxArchiveBytes) {
    throw new ZipArchiveError(
      'SIZE_LIMIT_EXCEEDED',
      `Archive exceeds the maximum supported size (${Math.round(limits.maxArchiveBytes / (1024 * 1024))} MB).`,
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minOffset = Math.max(0, bytes.byteLength - (22 + 0xffff));
  let eocdOffset = -1;

  for (let pos = bytes.byteLength - 22; pos >= minOffset; pos -= 1) {
    if (view.getUint32(pos, true) === EOCD_SIG) {
      const commentLen = view.getUint16(pos + 20, true);
      if (pos + 22 + commentLen === bytes.byteLength) {
        eocdOffset = pos;
        break;
      }
    }
  }

  if (eocdOffset < 0) {
    throw new ZipArchiveError('INVALID_ARCHIVE', 'Missing or corrupted ZIP directory footer.');
  }

  const diskNo = view.getUint16(eocdOffset + 4, true);
  const cdDisk = view.getUint16(eocdOffset + 6, true);
  const entriesOnDisk = view.getUint16(eocdOffset + 8, true);
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdSize = view.getUint32(eocdOffset + 12, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  if (diskNo !== 0 || cdDisk !== 0 || entriesOnDisk !== totalEntries) {
    throw new ZipArchiveError('INVALID_ARCHIVE', 'Multi-disk ZIP archives are not supported.');
  }
  if (totalEntries === 0 || totalEntries > limits.maxEntryCount) {
    throw new ZipArchiveError(
      totalEntries === 0 ? 'INVALID_ARCHIVE' : 'SIZE_LIMIT_EXCEEDED',
      totalEntries === 0
        ? 'Archive contains no files.'
        : `Archive exceeds maximum entry limit (${limits.maxEntryCount} entries).`,
    );
  }
  if (cdOffset + cdSize > eocdOffset) {
    throw new ZipArchiveError('INVALID_ARCHIVE', 'ZIP central directory bounds are corrupted.');
  }

  const decoder = new TextDecoder('utf-8', { fatal: true });
  const seenPaths = new Set<string>();
  const results: ZipReadEntry[] = [];
  let runningUncompressedTotal = 0;
  let cdCursor = cdOffset;

  for (let i = 0; i < totalEntries; i += 1) {
    if (cdCursor + 46 > eocdOffset || view.getUint32(cdCursor, true) !== CENTRAL_DIR_HEADER_SIG) {
      throw new ZipArchiveError('INVALID_ARCHIVE', 'Corrupted ZIP central directory entry.');
    }

    const flags = view.getUint16(cdCursor + 8, true);
    const method = view.getUint16(cdCursor + 10, true);
    const expectedCrc = view.getUint32(cdCursor + 16, true);
    const compressedSize = view.getUint32(cdCursor + 20, true);
    const declaredUncompressedSize = view.getUint32(cdCursor + 24, true);
    const nameLen = view.getUint16(cdCursor + 28, true);
    const extraLen = view.getUint16(cdCursor + 30, true);
    const commentLen = view.getUint16(cdCursor + 32, true);
    const localHeaderOffset = view.getUint32(cdCursor + 42, true);

    if ((flags & 0x0001) !== 0) {
      throw new ZipArchiveError('INVALID_ARCHIVE', 'Encrypted ZIP entries are not supported.');
    }
    if (compressedSize === 0xffffffff || declaredUncompressedSize === 0xffffffff) {
      throw new ZipArchiveError(
        'SIZE_LIMIT_EXCEEDED',
        'ZIP64 archives exceed supported bundle size.',
      );
    }
    if (method !== METHOD_STORE && method !== METHOD_DEFLATE) {
      throw new ZipArchiveError(
        'UNSUPPORTED_COMPRESSION',
        `Unsupported ZIP compression method (${method}).`,
      );
    }

    if (declaredUncompressedSize > limits.maxEntryBytes) {
      throw new ZipArchiveError(
        'SIZE_LIMIT_EXCEEDED',
        'An entry inside the archive exceeds the maximum allowed per-file limit.',
      );
    }

    const nameStart = cdCursor + 46;
    const nameEnd = nameStart + nameLen;
    if (nameEnd + extraLen + commentLen > cdOffset + cdSize) {
      throw new ZipArchiveError(
        'INVALID_ARCHIVE',
        'ZIP entry metadata overflows directory bounds.',
      );
    }

    let rawName: string;
    try {
      rawName = decoder.decode(bytes.subarray(nameStart, nameEnd));
    } catch (error) {
      throw new ZipArchiveError(
        'INVALID_ARCHIVE',
        'Invalid UTF-8 entry filename in archive.',
        error,
      );
    }

    const safePath = normalizeSafeZipPath(rawName);
    if (seenPaths.has(safePath)) {
      throw new ZipArchiveError(
        'DUPLICATE_PATH',
        `Archive contains duplicate entry "${safePath}".`,
      );
    }
    seenPaths.add(safePath);

    // Directory placeholder entries ending in '/' (note normalizeSafeZipPath trimmed trailing '/')
    if (rawName.endsWith('/')) {
      cdCursor = nameEnd + extraLen + commentLen;
      continue;
    }

    if (
      localHeaderOffset + 30 > cdOffset ||
      view.getUint32(localHeaderOffset, true) !== LOCAL_FILE_HEADER_SIG
    ) {
      throw new ZipArchiveError('INVALID_ARCHIVE', `Corrupted local header for "${safePath}".`);
    }

    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compressedSize;

    if (dataEnd > cdOffset) {
      throw new ZipArchiveError('INVALID_ARCHIVE', `Payload out of bounds for "${safePath}".`);
    }

    const compressedPayload = bytes.subarray(dataStart, dataEnd);
    const remainingBudget = limits.maxTotalUncompressedBytes - runningUncompressedTotal;
    const entryBudget = Math.min(limits.maxEntryBytes, remainingBudget);

    let extractedData: Uint8Array;
    if (method === METHOD_STORE) {
      if (compressedPayload.byteLength > entryBudget) {
        throw new ZipArchiveError(
          'SIZE_LIMIT_EXCEEDED',
          'Archive total uncompressed size exceeds maximum limit.',
        );
      }
      extractedData = new Uint8Array(compressedPayload);
    } else {
      extractedData = await inflateRawBounded(compressedPayload, entryBudget, safePath);
    }

    runningUncompressedTotal += extractedData.byteLength;
    if (extractedData.byteLength !== declaredUncompressedSize) {
      throw new ZipArchiveError(
        'CORRUPT_ENTRY',
        `Declared size mismatch for "${safePath}" inside archive.`,
      );
    }

    const actualCrc = computeCrc32(extractedData);
    if (actualCrc !== expectedCrc) {
      throw new ZipArchiveError(
        'CORRUPT_ENTRY',
        `Checksum mismatch (CRC-32) for "${safePath}". Archive may be corrupted or modified.`,
      );
    }

    results.push({
      path: safePath,
      data: extractedData,
      compressionMethod: method,
      uncompressedSize: extractedData.byteLength,
      crc32: actualCrc,
    });

    cdCursor = nameEnd + extraLen + commentLen;
  }

  return results;
}
