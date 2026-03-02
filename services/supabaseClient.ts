import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://didkwpenayulngybldkc.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpZGt3cGVuYXl1bG5neWJsZGtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NjkzNjEsImV4cCI6MjA4NjM0NTM2MX0.4IxU0pkaG9sLKR9Y-4AsxLnNOli0bQf6TDSKgEDVFvI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
