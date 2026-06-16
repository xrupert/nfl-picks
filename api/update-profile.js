import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid session' });

  const { username } = req.body ?? {};
  if (!username || username.trim().length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters.' });
  }

  const uname = username.trim();

  // Uniqueness check (exclude current user)
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', uname)
    .neq('id', user.id)
    .maybeSingle();

  if (existing) return res.status(409).json({ error: 'That username is already taken.' });

  const { error } = await supabase
    .from('profiles')
    .update({ username: uname })
    .eq('id', user.id);

  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true });
}
