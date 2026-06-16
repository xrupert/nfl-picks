import { createClient } from '@supabase/supabase-js';
import { syncCompletedGamesToSupabase } from '../../src/lib/espn.js';

const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req, res) {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.authorization ?? '';
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const year = 2026;
  let totalUpdated = 0;
  const log = [];

  // Sync all 18 weeks — only completed games come back so this is efficient
  for (let week = 1; week <= 18; week++) {
    try {
      const { updated } = await syncCompletedGamesToSupabase(sb, week, year);
      if (updated > 0) {
        totalUpdated += updated;
        log.push(`Week ${week}: ${updated} games updated`);
      }
    } catch (err) {
      log.push(`Week ${week}: error — ${err.message}`);
    }
  }

  // Recalculate scores for all leagues
  if (totalUpdated > 0) {
    const { data: leagues } = await sb.from('leagues').select('id').eq('season_year', year);
    for (const league of leagues ?? []) {
      await sb.rpc('recalculate_all_scores', { p_league_id: league.id });
    }
    log.push(`Recalculated scores for ${leagues?.length ?? 0} leagues`);
  }

  return res.status(200).json({ ok: true, updated: totalUpdated, log });
}
