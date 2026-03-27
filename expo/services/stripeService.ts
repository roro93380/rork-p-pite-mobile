import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabaseClient';

export type PlanId = 'gold' | 'platinum';
export type BillingPeriod = 'monthly' | 'annual';

/**
 * Appelle la Supabase Edge Function pour créer une Stripe Checkout Session
 * puis ouvre la page de paiement dans le navigateur.
 */
export async function startCheckout(planId: PlanId, billingPeriod: BillingPeriod = 'monthly'): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.access_token) {
      return { success: false, error: 'Non authentifié. Veuillez vous reconnecter.' };
    }

    // Appeler l'Edge Function
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: {
        planId,
        billingPeriod,
      },
    });

    if (error) {
      console.warn('[Stripe] Edge function error:', error.message);
      return { success: false, error: error.message };
    }

    const checkoutUrl = data?.url;
    if (!checkoutUrl) {
      return { success: false, error: 'Impossible de créer la session de paiement.' };
    }

    // Ouvrir Stripe Checkout dans le navigateur
    await WebBrowser.openBrowserAsync(checkoutUrl, {
      dismissButtonStyle: 'close',
      showTitle: true,
    });

    // Le navigateur a été fermé — on ne sait pas encore si le paiement
    // a réussi → le webhook Stripe met à jour profiles.subscription_tier
    // L'app refresh le profil au retour.
    return { success: true };
  } catch (e: any) {
    console.warn('[Stripe] startCheckout error:', e);
    return { success: false, error: e.message || 'Erreur inconnue.' };
  }
}

/**
 * Appelle la Supabase Edge Function pour ouvrir le Stripe Customer Portal
 * (gestion d'abonnement, annulation).
 */
export async function openCustomerPortal(): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.access_token) {
      return { success: false, error: 'Non authentifié.' };
    }

    const { data, error } = await supabase.functions.invoke('customer-portal', {});

    if (error) {
      return { success: false, error: error.message };
    }

    const portalUrl = data?.url;
    if (!portalUrl) {
      return { success: false, error: 'Impossible d\'ouvrir le portail.' };
    }

    await WebBrowser.openBrowserAsync(portalUrl, {
      dismissButtonStyle: 'close',
      showTitle: true,
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Erreur inconnue.' };
  }
}

/**
 * Get current subscription status from Stripe via manage-subscription edge function.
 */
export async function getSubscriptionStatus(): Promise<{ subscription: any; tier: string; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.access_token) {
      return { subscription: null, tier: 'free', error: 'Non authentifié.' };
    }

    const { data, error } = await supabase.functions.invoke('manage-subscription', {
      body: { action: 'status' },
    });

    if (error) {
      return { subscription: null, tier: 'free', error: error.message };
    }

    return { subscription: data?.subscription, tier: data?.tier || 'free' };
  } catch (e: any) {
    return { subscription: null, tier: 'free', error: e.message || 'Erreur inconnue.' };
  }
}

/**
 * Cancel subscription at end of current billing period.
 */
export async function cancelSubscription(): Promise<{ success: boolean; message?: string; subscription?: any; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.access_token) {
      return { success: false, error: 'Non authentifié.' };
    }

    const { data, error } = await supabase.functions.invoke('manage-subscription', {
      body: { action: 'cancel' },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: data?.success || false, message: data?.message, subscription: data?.subscription };
  } catch (e: any) {
    return { success: false, error: e.message || 'Erreur inconnue.' };
  }
}

/**
 * Reactivate a subscription that was set to cancel at period end.
 */
export async function reactivateSubscription(): Promise<{ success: boolean; message?: string; subscription?: any; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.access_token) {
      return { success: false, error: 'Non authentifié.' };
    }

    const { data, error } = await supabase.functions.invoke('manage-subscription', {
      body: { action: 'reactivate' },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: data?.success || false, message: data?.message, subscription: data?.subscription };
  } catch (e: any) {
    return { success: false, error: e.message || 'Erreur inconnue.' };
  }
}
