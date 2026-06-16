import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uhkkykmkbdefdtrpmilc.supabase.co',
  'sb_secret_Y5_RfCCbw4JpoTVD-R9grA_dIMsmZtZ',
  { auth: { persistSession: false } }
);

// Find testcoach profile
const { data: profile, error } = await supabase
  .from('profiles')
  .select('id, username')
  .eq('username', 'testcoach')
  .maybeSingle();

if (error || !profile) {
  console.error('Could not find testcoach:', error?.message ?? 'not found');
  process.exit(1);
}

console.log('Found:', profile);

const { error: updateErr } = await supabase
  .from('profiles')
  .update({ username: 'Mr. Roboto' })
  .eq('id', profile.id);

if (updateErr) {
  console.error('Update failed:', updateErr.message);
  process.exit(1);
}

console.log('Done — username updated to "Mr. Roboto"');
console.log('User ID for avatar upload:', profile.id);
