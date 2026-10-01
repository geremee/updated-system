import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cnieulqfqvfkkeymcnwj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuaWV1bHFmcXZma2tleW1jbndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MDA5NzgsImV4cCI6MjEwNDA3Njk3OH0.CRnRNGBvSlbpb_3GELyBAsbHZo2j88qBetFBSL1A-3k';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

export async function fetchSongs() {
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .order('title', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function insertSong(song) {
  const { data, error } = await supabase.from('songs').insert([song]).select().single();
  if (error) throw error;
  return data;
}

export async function updateSong(id, patch) {
  const { data, error } = await supabase.from('songs').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteSong(id) {
  const { error } = await supabase.from('songs').delete().eq('id', id);
  if (error) throw error;
}