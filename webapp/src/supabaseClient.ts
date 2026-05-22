import { createClient } from '@supabase/supabase-js';

// Pre-configured to the live ArtVault Supabase instance
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://exaaahqhnesijbdixjzc.supabase.co';

// Public Anon Key (Protected by RLS)
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4YWFhaHFobmVzaWpiZGl4anpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTQ2NDAsImV4cCI6MjA5NDk5MDY0MH0.iMa2_OTxIcfzpXtjfkCAKORkST5EZdngtMoeEPlF40k';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
