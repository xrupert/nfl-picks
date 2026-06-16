import { createClient } from '@supabase/supabase-js';
import { syncPlayoffResultsToSupabase } from '../../src/lib/espn.js';

const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Playoff week map: ESPN week → round label
const PLAYOFF_WEEKS = [1, 2, 3, 5]; // 4 = Pro Bowl, 5 = Super Bowl

export default async function handler(req, res) {
  const auth = req.headers.authorization ?? '';
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const year = 2026;
  let totalUpdated = 0;
  const log = [];

  for (const week of PLAYOFF_WEEKS) {
    try {
      const updated = await syncPlayoffResultsToSupabase(sb, week, year);
      if (updated > 0) {
        totalUpdated += updated;
        log.push(`Playoff week ${week}: ${updated} games updated`);
      }
    } catch (err) {
      log.push(`Playoff week ${week}: error — ${err.message}`);
    }
  }

  if (totalUpdated > 0) {
    const { data: leagues } = await sb.from('leagues').select('id').eq('season_year', year);
    for (const league of leagues ?? []) {
      await sb.rpc('recalculate_all_scores', { p_league_id: league.id });
    }
    log.push(`Recalculated scores for ${leagues?.length ?? 0} leagues`);
  }

  return res.status(200).json({ ok: true, updated: totalUpdated, log });
}
