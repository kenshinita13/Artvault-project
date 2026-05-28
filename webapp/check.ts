import { supabase } from './src/supabaseClient';

async function check() {
  const { data, error } = await supabase.from('profiles').select('*').eq('username', 'thirmizi111').single();
  console.log('Thirmizi profile:', data);
  console.log('Error:', error);
}

check();
