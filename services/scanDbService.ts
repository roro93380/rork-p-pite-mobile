import { supabase } from './supabaseClient';
import { ScanSession, ScanRecord } from '@/types';

/* ── Mapping: local ScanSession ↔ Supabase scans row ── */

export function toScanRecord(
  s: ScanSession,
  userId: string,
  url?: string
): Omit<ScanRecord, 'id'> & { id: string } {
  return {
    id: s.id,
    user_id: userId,
    source: s.source,
    url: url ?? '',
    status: 'completed',
    pepites_count: s.pepitesFound,
    scan_date: s.date,
  };
}

export function fromScanRecord(row: ScanRecord): ScanSession {
  return {
    id: row.id,
    date: row.scan_date,
    duration: 0,
    pepitesFound: row.pepites_count,
    totalProfit: 0,
    source: row.source,
  };
}

/* ── CRUD ─────────────────────────────────────────── */

export async function insertScanRecord(
  session: ScanSession,
  userId: string,
  url?: string
): Promise<string | null> {
  const row = toScanRecord(session, userId, url);
  const { data, error } = await supabase
    .from('scans')
    .upsert(row, { onConflict: 'id' })
    .select('id')
    .single();

  if (error) {
    console.warn('[scanDb] insertScanRecord error:', error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function fetchAllScans(userId: string): Promise<ScanSession[]> {
  const { data, error } = await supabase
    .from('scans')
    .select('*')
    .eq('user_id', userId)
    .order('scan_date', { ascending: false });

  if (error) {
    console.warn('[scanDb] fetchAllScans error:', error.message);
    return [];
  }
  return (data as ScanRecord[]).map(fromScanRecord);
}
