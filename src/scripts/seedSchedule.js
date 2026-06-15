// ============================================================
// SEED SCRIPT — populate the schedule table from ESPN
// ============================================================
// Run with Node 24+ (loads .env.local via --env-file):
//
//   npm run seed
//
// which expands to:
//   node --env-file=.env.local src/scripts/seedSchedule.js
//
// Requires in .env.local:
//   VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (admin key — bypasses RLS for inserts)
//
// The season defaults to 2026. Pass a different year as the first arg:
//   node --env-file=.env.local src/scripts/seedSchedule.js 2025
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { seedScheduleToSupabase, DEFAULT_SEASON } from '../lib/espn.js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    '\n✗ Missing env vars. Ensure .env.local contains:\n' +
      '    VITE_SUPABASE_URL=...\n' +
      '    SUPABASE_SERVICE_ROLE_KEY=...\n'
  );
  process.exit(1);
}

const year = parseInt(process.argv[2], 10) || DEFAULT_SEASON;

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

console.log(`\n→ Seeding ${year} NFL regular season schedule from ESPN...`);
console.log('  (this hits ESPN week-by-week with a polite delay; ~10s)\n');

try {
  // Sanity check: teams must be seeded first (run schema.sql).
  const { data: teams, error: teamErr } = await supabase
    .from('teams')
    .select('id', { count: 'exact', head: false });
  if (teamErr) throw teamErr;
  if (!teams || teams.length < 32) {
    console.error(
      `✗ Found ${teams?.length ?? 0} teams. Run schema.sql in Supabase first ` +
        '(should be exactly 32).'
    );
    process.exit(1);
  }

  const count = await seedScheduleToSupabase(supabase, year);

  if (count === 0) {
    console.warn(
      `\n⚠ ESPN returned 0 games for ${year}.\n` +
        '  If the season schedule has not been published yet, re-run this\n' +
        '  script closer to the season (NFL usually releases it in May).\n'
    );
  } else {
    console.log(`\n✓ Seeded ${count} games into the schedule table.`);
    if (count !== 272) {
      console.warn(
        `  Note: expected 272 regular-season games, got ${count}. ` +
          'ESPN may not have the full schedule yet, or a team abbreviation ' +
          'did not map.'
      );
    }
  }
  process.exit(0);
} catch (err) {
  console.error('\n✗ Seed failed:', err.message ?? err);
  process.exit(1);
}
