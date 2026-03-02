import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabaseClient';

export type PlanId = 'gold' | 'platinum';

/**
 * Appelle la Supabase Edge Function pour créer une Stripe Checkout Session
 * puis ouvre la page de paiement dans le navigateur.
 */
export async function startCheckout(planId: PlanId): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.access_token) {
      return { success: false, error: 'Non authentifié. Veuillez vous reconnecter.' };
    }

    // Appeler l'Edge Function
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: {
        planId,
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
