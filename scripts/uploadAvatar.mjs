import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  'https://uhkkykmkbdefdtrpmilc.supabase.co',
  'sb_secret_Y5_RfCCbw4JpoTVD-R9grA_dIMsmZtZ',
  { auth: { persistSession: false } }
);

const USER_ID = 'b3702103-f0ff-4d8a-b0a7-cda8b1195ac1'; // Mr. Roboto
const FILE_PATH = 'C:\\Users\\Chris Rupert\\Downloads\\ralph.jpg';

const buffer = readFileSync(FILE_PATH);
const ext = 'jpg';
const path = `${USER_ID}/avatar.${ext}`;

const { error: upErr } = await supabase.storage
  .from('avatars')
  .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });

if (upErr) { console.error('Upload failed:', upErr.message); process.exit(1); }

const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
const url = `${publicUrl}?t=${Date.now()}`;

const { error: dbErr } = await supabase
  .from('profiles')
  .update({ avatar_url: url })
  .eq('id', USER_ID);

if (dbErr) { console.error('DB update failed:', dbErr.message); process.exit(1); }

console.log('Done! Avatar set to:', url);
