export type GoogleAppCategory = 'Core' | 'Productivity' | 'Media & Discovery' | 'Learning & Tools';

export interface GoogleAppShortcut {
  id: string;
  label: string;
  category: GoogleAppCategory;
  keywords: string;
  url: string;
  icon: string;
  accentTint: string;
}

export const GOOGLE_APP_CATEGORY_ORDER: readonly GoogleAppCategory[] = [
  'Core',
  'Productivity',
  'Media & Discovery',
  'Learning & Tools',
] as const;

export const NAV_DESTINATIONS = {
  bookmarks: 'chrome://bookmarks/',
  gmail: 'https://mail.google.com/',
  images: 'https://images.google.com/',
  account: 'https://myaccount.google.com/',
} as const;

export const GOOGLE_APPS: readonly GoogleAppShortcut[] = [
  // Core
  {
    id: 'app-search',
    label: 'Search',
    category: 'Core',
    keywords: 'web find google',
    url: 'https://www.google.com/',
    icon: 'search',
    accentTint: '#7FD3F7',
  },
  {
    id: 'app-gmail',
    label: 'Gmail',
    category: 'Core',
    keywords: 'email mail inbox',
    url: 'https://mail.google.com/',
    icon: 'mail',
    accentTint: '#F87171',
  },
  {
    id: 'app-account',
    label: 'Account',
    category: 'Core',
    keywords: 'profile security privacy google',
    url: 'https://myaccount.google.com/',
    icon: 'account_circle',
    accentTint: '#7FD3F7',
  },
  {
    id: 'app-drive',
    label: 'Drive',
    category: 'Core',
    keywords: 'cloud files storage',
    url: 'https://drive.google.com/',
    icon: 'add_to_drive',
    accentTint: '#FBBF24',
  },
  {
    id: 'app-calendar',
    label: 'Calendar',
    category: 'Core',
    keywords: 'schedule events dates',
    url: 'https://calendar.google.com/',
    icon: 'calendar_today',
    accentTint: '#60A5FA',
  },
  {
    id: 'app-contacts',
    label: 'Contacts',
    category: 'Core',
    keywords: 'people address book',
    url: 'https://contacts.google.com/',
    icon: 'contacts',
    accentTint: '#38BDF8',
  },
  {
    id: 'app-keep',
    label: 'Keep',
    category: 'Core',
    keywords: 'notes lists reminders',
    url: 'https://keep.google.com/',
    icon: 'lightbulb',
    accentTint: '#FACC15',
  },
  {
    id: 'app-tasks',
    label: 'Tasks',
    category: 'Core',
    keywords: 'todo checklist',
    url: 'https://tasks.google.com/',
    icon: 'task_alt',
    accentTint: '#34D399',
  },

  // Productivity
  {
    id: 'app-docs',
    label: 'Docs',
    category: 'Productivity',
    keywords: 'documents writer text',
    url: 'https://docs.google.com/',
    icon: 'description',
    accentTint: '#60A5FA',
  },
  {
    id: 'app-sheets',
    label: 'Sheets',
    category: 'Productivity',
    keywords: 'spreadsheets tables data',
    url: 'https://sheets.google.com/',
    icon: 'table_chart',
    accentTint: '#34D399',
  },
  {
    id: 'app-slides',
    label: 'Slides',
    category: 'Productivity',
    keywords: 'presentations decks',
    url: 'https://slides.google.com/',
    icon: 'slideshow',
    accentTint: '#FBBF24',
  },
  {
    id: 'app-forms',
    label: 'Forms',
    category: 'Productivity',
    keywords: 'surveys quizzes',
    url: 'https://forms.google.com/',
    icon: 'assignment',
    accentTint: '#8B7CF6',
  },
  {
    id: 'app-sites',
    label: 'Sites',
    category: 'Productivity',
    keywords: 'websites pages',
    url: 'https://sites.google.com/',
    icon: 'web',
    accentTint: '#7FD3F7',
  },
  {
    id: 'app-meet',
    label: 'Meet',
    category: 'Productivity',
    keywords: 'video call conference',
    url: 'https://meet.google.com/',
    icon: 'videocam',
    accentTint: '#34D399',
  },
  {
    id: 'app-chat',
    label: 'Chat',
    category: 'Productivity',
    keywords: 'messaging teams',
    url: 'https://chat.google.com/',
    icon: 'chat',
    accentTint: '#10B981',
  },

  // Media & Discovery
  {
    id: 'app-youtube',
    label: 'YouTube',
    category: 'Media & Discovery',
    keywords: 'video streaming watch',
    url: 'https://www.youtube.com/',
    icon: 'smart_display',
    accentTint: '#EF4444',
  },
  {
    id: 'app-photos',
    label: 'Photos',
    category: 'Media & Discovery',
    keywords: 'images pictures albums',
    url: 'https://photos.google.com/',
    icon: 'photo_library',
    accentTint: '#8B7CF6',
  },
  {
    id: 'app-maps',
    label: 'Maps',
    category: 'Media & Discovery',
    keywords: 'directions navigation travel',
    url: 'https://maps.google.com/',
    icon: 'map',
    accentTint: '#34D399',
  },
  {
    id: 'app-news',
    label: 'News',
    category: 'Media & Discovery',
    keywords: 'headlines stories articles',
    url: 'https://news.google.com/',
    icon: 'newspaper',
    accentTint: '#60A5FA',
  },
  {
    id: 'app-play',
    label: 'Play',
    category: 'Media & Discovery',
    keywords: 'store apps games',
    url: 'https://play.google.com/',
    icon: 'play_arrow',
    accentTint: '#34D399',
  },
  {
    id: 'app-books',
    label: 'Books',
    category: 'Media & Discovery',
    keywords: 'ebooks reading library',
    url: 'https://books.google.com/',
    icon: 'menu_book',
    accentTint: '#7FD3F7',
  },
  {
    id: 'app-arts-culture',
    label: 'Arts & Culture',
    category: 'Media & Discovery',
    keywords: 'museums art history',
    url: 'https://artsandculture.google.com/',
    icon: 'palette',
    accentTint: '#F472B6',
  },

  // Learning & Tools
  {
    id: 'app-classroom',
    label: 'Classroom',
    category: 'Learning & Tools',
    keywords: 'courses school assignments',
    url: 'https://classroom.google.com/',
    icon: 'school',
    accentTint: '#34D399',
  },
  {
    id: 'app-earth',
    label: 'Earth',
    category: 'Learning & Tools',
    keywords: 'globe satellite geography',
    url: 'https://earth.google.com/',
    icon: 'public',
    accentTint: '#7FD3F7',
  },
  {
    id: 'app-translate',
    label: 'Translate',
    category: 'Learning & Tools',
    keywords: 'languages dictionary',
    url: 'https://translate.google.com/',
    icon: 'translate',
    accentTint: '#38BDF8',
  },
  {
    id: 'app-scholar',
    label: 'Scholar',
    category: 'Learning & Tools',
    keywords: 'papers research citations academic',
    url: 'https://scholar.google.com/',
    icon: 'science',
    accentTint: '#8B7CF6',
  },
  {
    id: 'app-finance',
    label: 'Finance',
    category: 'Learning & Tools',
    keywords: 'stocks markets portfolio',
    url: 'https://www.google.com/finance/',
    icon: 'trending_up',
    accentTint: '#34D399',
  },
  {
    id: 'app-flights',
    label: 'Flights',
    category: 'Learning & Tools',
    keywords: 'travel airlines tickets',
    url: 'https://www.google.com/travel/flights',
    icon: 'flight',
    accentTint: '#60A5FA',
  },
  {
    id: 'app-shopping',
    label: 'Shopping',
    category: 'Learning & Tools',
    keywords: 'products prices deals',
    url: 'https://shopping.google.com/',
    icon: 'shopping_bag',
    accentTint: '#FBBF24',
  },
] as const;

export function openBookmarksManager(): boolean {
  if (typeof chrome !== 'undefined' && chrome.tabs?.update) {
    void chrome.tabs.update({ url: NAV_DESTINATIONS.bookmarks });
    return true;
  }
  return false;
}
