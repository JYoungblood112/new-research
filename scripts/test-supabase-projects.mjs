import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import WebSocket from 'ws';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    transport: WebSocket,
  },
});
const { data, error } = await supabase
  .from('projects')
  .select('id,title,overview,status,created_at,updated_at')
  .limit(1);

if (error) {
  console.error(`Supabase projects query failed: ${error.message}`);
  process.exit(1);
}

console.log(`Supabase projects query succeeded. Rows returned: ${data?.length ?? 0}`);
