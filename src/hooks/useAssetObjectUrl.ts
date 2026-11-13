import { useEffect, useState } from 'react';
import { acquireAssetUrl, releaseAssetUrl } from '@/services/assets/assetUrlManager';
import type { AssetMetadata } from '@/types/workspace';

export type AssetLoadStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

export interface UseAssetObjectUrlResult {
  url: string | null;
  metadata: AssetMetadata | null;
  status: AssetLoadStatus;
  errorMessage: string | null;
}

interface InternalAssetState {
  resolvedForId: string | null;
  url: string | null;
  metadata: AssetMetadata | null;
  status: AssetLoadStatus;
  errorMessage: string | null;
}

export function useAssetObjectUrl(assetId: string | null | undefined): UseAssetObjectUrlResult {
  const [state, setState] = useState<InternalAssetState>({
    resolvedForId: null,
    url: null,
    metadata: null,
    status: assetId ? 'loading' : 'idle',
    errorMessage: null,
  });

  useEffect(() => {
    if (!assetId) {
      return;
    }

    let cancelled = false;
    let acquired = false;

    void acquireAssetUrl(assetId)
      .then((res) => {
        if (cancelled) {
          if (res) {
            releaseAssetUrl(assetId);
          }
          return;
        }
        if (!res) {
          setState({
            resolvedForId: assetId,
            url: null,
            metadata: null,
            status: 'missing',
            errorMessage: 'Media asset was not found in local IndexedDB storage.',
          });
          return;
        }
        acquired = true;
        setState({
          resolvedForId: assetId,
          url: res.url,
          metadata: res.metadata,
          status: 'ready',
          errorMessage: null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          resolvedForId: assetId,
          url: null,
          metadata: null,
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Unable to decode media asset.',
        });
      });

    return () => {
      cancelled = true;
      if (acquired) {
        releaseAssetUrl(assetId);
      }
    };
  }, [assetId]);

  if (!assetId) {
    return {
      url: null,
      metadata: null,
      status: 'idle',
      errorMessage: null,
    };
  }

  if (state.resolvedForId !== assetId) {
    return {
      url: null,
      metadata: null,
      status: 'loading',
      errorMessage: null,
    };
  }

  return {
    url: state.url,
    metadata: state.metadata,
    status: state.status,
    errorMessage: state.errorMessage,
  };
}
