import { createClient } from '@supabase/supabase-js';

// Server-side upload uses the service role key which bypasses storage RLS.
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Verify the caller's session token
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid session' });

  const { base64, contentType, ext } = req.body ?? {};
  if (!base64 || !contentType || !ext) return res.status(400).json({ error: 'Missing fields' });

  if (Buffer.from(base64, 'base64').length > 2 * 1024 * 1024) {
    return res.status(400).json({ error: 'Image must be under 2 MB' });
  }

  const path = `${user.id}/avatar.${ext}`;
  const buffer = Buffer.from(base64, 'base64');

  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, buffer, { contentType, upsert: true });

  if (upErr) return res.status(500).json({ error: upErr.message });

  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
  const url = `${publicUrl}?t=${Date.now()}`;

  await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);

  res.json({ url });
}
