export interface Pepite {
  id: string;
  title: string;
  image: string;
  sellerPrice: number;
  estimatedValue: number;
  profit: number;
  source: string;
  sourceUrl: string;
  category: string;
  description: string;
  scanDate: string;
  isFavorite: boolean;
  isTrashed: boolean;
  adUrl?: string;
  adImageUrl?: string;
}

export interface ScanSession {
  id: string;
  date: string;
  duration: number;
  pepitesFound: number;
  totalProfit: number;
  source: string;
}

export type OnboardingStep = 0 | 1 | 2;

export interface AppSettings {
  geminiApiKey: string;
  notificationsEnabled: boolean;
  hasCompletedOnboarding: boolean;
}
