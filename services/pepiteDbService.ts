import { supabase } from './supabaseClient';
import { Pepite, SupabasePepite } from '@/types';

/* ── Mapping: local Pepite ↔ Supabase row ────────── */

/** Derive a human-readable source name from a URL */
function sourceFromUrl(url: string): string {
  if (!url) return '';
  try {
    const host = new URL(url).hostname.replace('www.', '').toLowerCase();
    if (host.includes('leboncoin')) return 'Leboncoin';
    if (host.includes('vinted')) return 'Vinted';
    if (host.includes('ebay')) return 'eBay';
    if (host.includes('rakuten') || host.includes('priceminister')) return 'Rakuten';
    if (host.includes('backmarket')) return 'Back Market';
    if (host.includes('vestiairecollective')) return 'Vestiaire Collective';
    if (host.includes('selency')) return 'Selency';
    if (host.includes('autoscout24')) return 'AutoScout24';
    if (host.includes('kleinanzeigen')) return 'Kleinanzeigen';
    if (host.includes('agorastore')) return 'Agorastore';
    if (host.includes('label-emmaus')) return 'Label Emmaüs';
    if (host.includes('temu')) return 'Temu';
    if (host.includes('stocklear')) return 'Stocklear';
    if (host.includes('catawiki')) return 'Catawiki';
    if (host.includes('wallapop')) return 'Wallapop';
    if (host.includes('subito')) return 'Subito';
    if (host.includes('2ememain') || host.includes('2dehands')) return '2ememain';
    if (host.includes('olx')) return 'OLX';
    if (host.includes('rebuy')) return 'Rebuy';
    if (host.includes('depop')) return 'Depop';
    if (host.includes('milanuncios')) return 'Milanuncios';
    if (host.includes('amazon')) return 'Amazon';
    if (host.includes('aliexpress')) return 'AliExpress';
    if (host.includes('allegro')) return 'Allegro';
    if (host.includes('perfumesclub') || host.includes('perfumes')) return "Perfume's Club";
    if (host.includes('decathlon')) return 'Decathlon';
    if (host.includes('micolet')) return 'Micolet';
    // Fallback: capitalize first part of hostname
    const parts = host.split('.');
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } catch {
    return '';
  }
}

export function toSupabasePepite(
  p: Pepite,
  userId: string,
  scanId?: string
): Omit<SupabasePepite, 'created_at'> {
  let status: SupabasePepite['status'] = 'new';
  if (p.isTrashed) status = 'dismissed';
  else if (p.isFavorite) status = 'VALIDATED';

  return {
    id: p.id,
    scan_id: scanId ?? null,
    user_id: userId,
    title: p.title ?? '',
    price_displayed: p.sellerPrice ?? 0,
    price_estimated: p.estimatedValue ?? 0,
    margin: p.profit ?? 0,
    confidence_score: 0,
    image_url: p.image ?? '',
    link: p.sourceUrl ?? p.adUrl ?? '',
    description: p.description ?? '',
    status,
  };
}

export function fromSupabasePepite(row: SupabasePepite): Pepite {
  return {
    id: row.id,
    title: row.title,
    image: row.image_url,
    sellerPrice: Number(row.price_displayed) || 0,
    estimatedValue: Number(row.price_estimated) || 0,
    profit: Number(row.margin) || 0,
    source: sourceFromUrl(row.link),
    sourceUrl: row.link,
    category: '',
    description: row.description,
    scanDate: row.created_at,
    isFavorite: row.status === 'favorite' || row.status === 'VALIDATED',
    isTrashed: row.status === 'dismissed',
    adUrl: row.link,
    adImageUrl: row.image_url,
  };
}

/* ── CRUD operations ─────────────────────────────── */

/** Check if a string is a valid UUID */
function isValidUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/** Generate a UUID v4 */
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Insert an array of new pepites (after a scan) */
export async function insertPepites(
  pepites: Pepite[],
  userId: string,
  scanId?: string
): Promise<void> {
  if (pepites.length === 0) return;
  // Ensure all IDs are valid UUIDs (old pepites may have gemini_xxx or fallback_xxx IDs)
  const rows = pepites.map((p) => {
    const safePepite = isValidUuid(p.id) ? p : { ...p, id: generateUuid() };
    return toSupabasePepite(safePepite, userId, scanId);
  });
  const { error } = await supabase.from('pepites').upsert(rows, { onConflict: 'id' });
  if (error) {
    console.warn('[pepiteDb] insertPepites error:', error.message);
  }
}

/** Update the status of a single pepite */
export async function updatePepiteStatus(
  pepiteId: string,
  status: SupabasePepite['status']
): Promise<void> {
  const { error } = await supabase
    .from('pepites')
    .update({ status })
    .eq('id', pepiteId);
  if (error) {
    console.warn('[pepiteDb] updatePepiteStatus error:', error.message);
  }
}

/** Delete a single pepite permanently */
export async function deletePepiteRemote(pepiteId: string): Promise<void> {
  const { error } = await supabase.from('pepites').delete().eq('id', pepiteId);
  if (error) {
    console.warn('[pepiteDb] deletePepite error:', error.message);
  }
}

/** Delete all dismissed (trashed) pepites for the user */
export async function emptyTrashRemote(userId: string): Promise<void> {
  const { error } = await supabase
    .from('pepites')
    .delete()
    .eq('user_id', userId)
    .eq('status', 'dismissed');
  if (error) {
    console.warn('[pepiteDb] emptyTrash error:', error.message);
  }
}

/** Fetch all pepites for a user from Supabase */
export async function fetchAllPepites(userId: string, tier: string = 'free'): Promise<Pepite[]> {
  let query = supabase
    .from('pepites')
    .select('*')
    .eq('user_id', userId);
  // Historique 7 jours pour Free, illimité pour Gold/Platinum
  if (tier === 'free') {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    query = query.gte('created_at', sevenDaysAgo.toISOString());
  }
  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.warn('[pepiteDb] fetchAllPepites error:', error.message);
    return [];
  }
  return (data as SupabasePepite[]).map(fromSupabasePepite);
}
