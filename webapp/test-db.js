import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://exaaahqhnesijbdixjzc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4YWFhaHFobmVzaWpiZGl4anpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTQ2NDAsImV4cCI6MjA5NDk5MDY0MH0.iMa2_OTxIcfzpXtjfkCAKORkST5EZdngtMoeEPlF40k';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDb() {
  console.log("Checking Supabase tables...");
  
  // Check categories
  const { data: catData, error: catError } = await supabase.from('categories').select('*').limit(3);
  if (catError) {
    console.error("❌ Categories table error:", catError.message);
  } else {
    console.log(`✅ Categories table exists. Found ${catData.length} rows. Example:`, catData[0]?.name);
  }

  // Check exact query
  const { data: artworksData, error: artworksError } = await supabase
    .from('artworks')
    .select('*, profiles (username, name)')
    .order('created_at', { ascending: false });
    
  if (artworksError) {
    console.error("❌ Artworks query error:", artworksError.message);
  } else {
    console.log("✅ Artworks query succeeded. Count:", artworksData?.length);
    console.log("Data:", JSON.stringify(artworksData, null, 2));
  }
}

checkDb();
