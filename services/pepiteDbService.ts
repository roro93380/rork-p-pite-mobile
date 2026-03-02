import { supabase } from './supabaseClient';
import { Pepite, SupabasePepite } from '@/types';

/* ── Mapping: local Pepite ↔ Supabase row ────────── */

export function toSupabasePepite(
  p: Pepite,
  userId: string,
  scanId?: string
): Omit<SupabasePepite, 'created_at'> {
  let status: SupabasePepite['status'] = 'new';
  if (p.isTrashed) status = 'dismissed';
  else if (p.isFavorite) status = 'favorite';

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
    source: '',
    sourceUrl: row.link,
    category: '',
    description: row.description,
    scanDate: row.created_at,
    isFavorite: row.status === 'favorite',
    isTrashed: row.status === 'dismissed',
    adUrl: row.link,
    adImageUrl: row.image_url,
  };
}

/* ── CRUD operations ─────────────────────────────── */

/** Insert an array of new pepites (after a scan) */
export async function insertPepites(
  pepites: Pepite[],
  userId: string,
  scanId?: string
): Promise<void> {
  if (pepites.length === 0) return;
  const rows = pepites.map((p) => toSupabasePepite(p, userId, scanId));
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
export async function fetchAllPepites(userId: string): Promise<Pepite[]> {
  const { data, error } = await supabase
    .from('pepites')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[pepiteDb] fetchAllPepites error:', error.message);
    return [];
  }
  return (data as SupabasePepite[]).map(fromSupabasePepite);
}
