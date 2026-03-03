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

/* ── Supabase types ─────────────────────────────────── */

export type SubscriptionTier = 'free' | 'gold' | 'platinum';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  subscription_tier: SubscriptionTier;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
  gemini_api_key: string | null;
}

export interface SupabasePepite {
  id: string;
  scan_id: string | null;
  user_id: string;
  title: string;
  price_displayed: number;
  price_estimated: number;
  margin: number;
  confidence_score: number;
  image_url: string;
  link: string;
  description: string;
  status: 'new' | 'favorite' | 'dismissed' | 'VALIDATED' | 'PEPITE' | 'CORRECT';
  created_at: string;
}

export interface ScanRecord {
  id: string;
  user_id: string;
  source: string;
  url: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  pepites_count: number;
  scan_date: string;
}
