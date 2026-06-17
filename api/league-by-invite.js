import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { code, userId } = req.query;
  if (!code) return res.status(400).json({ error: 'Missing invite code' });

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const { data: league, error } = await supabase
    .from('leagues')
    .select('id, name, season_year, max_members, pick_lock_status, invite_code')
    .eq('invite_code', code)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!league) return res.status(404).json({ error: 'No league found for this invite code.' });

  const { data: members } = await supabase
    .from('league_members')
    .select('user_id')
    .eq('league_id', league.id);

  const memberCount = members?.length ?? 0;
  const alreadyMember = userId ? (members ?? []).some((m) => m.user_id === userId) : false;

  return res.status(200).json({ ...league, memberCount, alreadyMember });
}
