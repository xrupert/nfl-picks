-- ============================================================
-- NFL PREDICTION LEAGUE — COMPLETE SUPABASE SCHEMA  (2026 season)
-- ============================================================
-- Run this entire file in Supabase SQL Editor in one shot.
-- Order matters — do not reorder blocks.
--
-- FIXES vs the original draft:
--   * Removed the duplicate Bears row (it reused abbreviation 'CHI',
--     which is UNIQUE, so the whole 32-row insert failed). 32 teams now.
--   * Completed recalculate_score(): it now derives ACTUAL division
--     winners + conference seeds from completed games and scores them
--     (5 pts / division winner, 2 pts / correct seed) and writes the
--     division_winners_correct / seeds_correct columns.
--   * Defaults set to season 2026.
--   * Added recalculate_all_scores() helper for cron fan-out.
-- ============================================================

-- ── EXTENSIONS ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── ENUMS ───────────────────────────────────────────────────
do $$ begin
  create type conference_type as enum ('AFC', 'NFC');
exception when duplicate_object then null; end $$;

do $$ begin
  create type division_type as enum ('North', 'South', 'East', 'West');
exception when duplicate_object then null; end $$;

do $$ begin
  create type playoff_round_type as enum (
    'Wild Card',
    'Divisional',
    'Conference Championship',
    'Super Bowl'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type pick_lock_status as enum ('open', 'locked');
exception when duplicate_object then null; end $$;

-- ============================================================
-- TEAMS
-- ============================================================
create table if not exists teams (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,           -- e.g. "Bears"
  city            text not null,           -- e.g. "Chicago"
  abbreviation    text not null unique,    -- e.g. "CHI"
  conference      conference_type not null,
  division        division_type not null,
  primary_color   text not null,           -- hex e.g. "#0B162A"
  secondary_color text not null,           -- hex e.g. "#C83803"
  tertiary_color  text,                    -- hex optional
  helmet_style    text not null default 'default', -- for custom SVG variant key
  created_at      timestamptz default now()
);

-- ============================================================
-- USERS (extends Supabase Auth)
-- ============================================================
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique,
  avatar_url  text,
  created_at  timestamptz default now()
);

-- ============================================================
-- LEAGUES
-- ============================================================
create table if not exists leagues (
  id               uuid primary key default uuid_generate_v4(),
  name             text not null,
  season_year      int not null default 2026,
  commissioner_id  uuid not null references profiles(id),
  invite_code      text not null unique default substr(md5(random()::text), 1, 8),
  pick_lock_status pick_lock_status not null default 'open',
  locked_at        timestamptz,
  max_members      int not null default 6,
  created_at       timestamptz default now()
);

-- ============================================================
-- LEAGUE MEMBERS
-- ============================================================
create table if not exists league_members (
  id         uuid primary key default uuid_generate_v4(),
  league_id  uuid not null references leagues(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  joined_at  timestamptz default now(),
  unique(league_id, user_id)
);

-- ============================================================
-- NFL SCHEDULE (regular season)
-- ============================================================
create table if not exists schedule (
  id                  uuid primary key default uuid_generate_v4(),
  league_season_year  int not null default 2026,
  week                int not null,             -- 1-18
  game_date           timestamptz not null,
  home_team_id        uuid not null references teams(id),
  away_team_id        uuid not null references teams(id),
  espn_game_id        text unique,              -- ESPN API game ID for live sync
  -- Actuals (null until game is played)
  actual_home_score   int,
  actual_away_score   int,
  actual_winner_id    uuid references teams(id),  -- null = tie or not played
  game_completed      boolean not null default false,
  created_at          timestamptz default now(),
  check (home_team_id != away_team_id)
);

-- ============================================================
-- USER PICKS — REGULAR SEASON
-- One row per user per game. Never updated after lock.
-- Actuals live in schedule table only.
-- ============================================================
create table if not exists user_picks_regular (
  id               uuid primary key default uuid_generate_v4(),
  league_id        uuid not null references leagues(id) on delete cascade,
  user_id          uuid not null references profiles(id) on delete cascade,
  game_id          uuid not null references schedule(id) on delete cascade,
  picked_winner_id uuid not null references teams(id),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique(league_id, user_id, game_id)
);

-- ============================================================
-- PREDICTED STANDINGS (derived + cached after all picks submitted)
-- ============================================================
create table if not exists predicted_standings (
  id              uuid primary key default uuid_generate_v4(),
  league_id       uuid not null references leagues(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  team_id         uuid not null references teams(id),
  predicted_wins  int not null default 0,
  predicted_losses int not null default 0,
  predicted_ties  int not null default 0,
  -- Derived seeding
  division_rank   int,   -- 1-4 within division
  conference_seed int,   -- 1-7 per conference (1-4 division winners, 5-7 wildcards)
  is_division_winner boolean not null default false,
  is_playoff_team    boolean not null default false,
  updated_at      timestamptz default now(),
  unique(league_id, user_id, team_id)
);

-- ============================================================
-- PLAYOFF BRACKET TEMPLATE (actual structure, auto-generated)
-- ============================================================
create table if not exists playoff_bracket (
  id            uuid primary key default uuid_generate_v4(),
  league_id     uuid not null references leagues(id) on delete cascade,
  user_id       uuid references profiles(id) on delete cascade, -- bracket is per user (their predicted seeding)
  season_year   int not null default 2026,
  round         playoff_round_type not null,
  game_number   int not null,       -- 1-3 Wild Card, 1-2 Divisional, 1 Conf Champ, 1 SB
  conference    conference_type,    -- null for Super Bowl
  -- Seed slots that feed this game (for display / progression)
  team1_seed    int,
  team2_seed    int,
  -- Populated as bracket advances
  team1_id      uuid references teams(id),
  team2_id      uuid references teams(id),
  actual_winner_id uuid references teams(id),
  game_date     timestamptz,
  espn_game_id  text,
  game_completed boolean not null default false,
  created_at    timestamptz default now()
);

-- ============================================================
-- USER PICKS — PLAYOFFS
-- ============================================================
create table if not exists user_picks_playoff (
  id                 uuid primary key default uuid_generate_v4(),
  league_id          uuid not null references leagues(id) on delete cascade,
  user_id            uuid not null references profiles(id) on delete cascade,
  playoff_game_id    uuid not null references playoff_bracket(id) on delete cascade,
  picked_winner_id   uuid not null references teams(id),
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),
  unique(league_id, user_id, playoff_game_id)
);

-- ============================================================
-- SCORING (recalculated after each game result comes in)
-- ============================================================
create table if not exists scoring (
  id                        uuid primary key default uuid_generate_v4(),
  league_id                 uuid not null references leagues(id) on delete cascade,
  user_id                   uuid not null references profiles(id) on delete cascade,
  -- Regular season
  regular_picks_correct     int not null default 0,
  regular_picks_total       int not null default 0,
  regular_picks_remaining   int not null default 0,
  -- Division/seeding
  division_winners_correct  int not null default 0,  -- max 8
  seeds_correct             int not null default 0,  -- max 14 playoff teams
  -- Playoffs
  wildcard_correct          int not null default 0,
  divisional_correct        int not null default 0,
  conf_championship_correct int not null default 0,
  superbowl_correct         int not null default 0,
  -- Point totals (weighted)
  -- Regular: 1pt each | Division winner: 5pt | Correct seed: 2pt
  -- Wild Card: 3pt | Divisional: 5pt | Conf Champ: 8pt | Super Bowl: 15pt
  total_points              int not null default 0,
  last_calculated_at        timestamptz default now(),
  unique(league_id, user_id)
);

-- ============================================================
-- SEED: 32 NFL TEAMS
-- Colors are official team colors (public facts, not trademarks).
-- helmet_style is a key for the custom SVG renderer.
-- (Duplicate Bears row from the original draft removed.)
-- ============================================================
insert into teams (name, city, abbreviation, conference, division, primary_color, secondary_color, tertiary_color, helmet_style) values
-- AFC NORTH
('Ravens',    'Baltimore',   'BAL', 'AFC', 'North', '#241773', '#9E7C0C', '#000000', 'angular_crown'),
('Bengals',   'Cincinnati',  'CIN', 'AFC', 'North', '#FB4F14', '#000000', '#FFFFFF', 'tiger_stripe'),
('Browns',    'Cleveland',   'CLE', 'AFC', 'North', '#311D00', '#FF3C00', '#FFFFFF', 'industrial_bolt'),
('Steelers',  'Pittsburgh',  'PIT', 'AFC', 'North', '#101820', '#FFB612', '#FFFFFF', 'forge_diamond'),
-- AFC SOUTH
('Texans',    'Houston',     'HOU', 'AFC', 'South', '#03202F', '#A71930', '#FFFFFF', 'lone_star_cut'),
('Colts',     'Indianapolis','IND', 'AFC', 'South', '#002C5F', '#A2AAAD', '#FFFFFF', 'arc_horseshoe'),
('Jaguars',   'Jacksonville','JAX', 'AFC', 'South', '#006778', '#9F792C', '#000000', 'predator_jaw'),
('Titans',    'Tennessee',   'TEN', 'AFC', 'South', '#0C2340', '#4B92DB', '#C8102E', 'flaming_comet'),
-- AFC EAST
('Bills',     'Buffalo',     'BUF', 'AFC', 'East',  '#00338D', '#C60C30', '#FFFFFF', 'charging_horn'),
('Dolphins',  'Miami',       'MIA', 'AFC', 'East',  '#008E97', '#FC4C02', '#005778', 'wave_crest'),
('Patriots',  'New England', 'NE',  'AFC', 'East',  '#002244', '#C60C30', '#B0B7BC', 'patriot_tri'),
('Jets',      'New York',    'NYJ', 'AFC', 'East',  '#125740', '#000000', '#FFFFFF', 'velocity_fin'),
-- AFC WEST
('Broncos',   'Denver',      'DEN', 'AFC', 'West',  '#FB4F14', '#002244', '#FFFFFF', 'altitude_peak'),
('Chiefs',    'Kansas City', 'KC',  'AFC', 'West',  '#E31837', '#FFB81C', '#FFFFFF', 'arrowhead_blade'),
('Raiders',   'Las Vegas',   'LV',  'AFC', 'West',  '#000000', '#A5ACAF', '#FFFFFF', 'outlaw_skull'),
('Chargers',  'Los Angeles', 'LAC', 'AFC', 'West',  '#0080C6', '#FFC20E', '#FFFFFF', 'lightning_split'),
-- NFC NORTH
('Bears',     'Chicago',     'CHI', 'NFC', 'North', '#0B162A', '#C83803', '#FFFFFF', 'iron_claw'),
('Lions',     'Detroit',     'DET', 'NFC', 'North', '#0076B6', '#B0B7BC', '#000000', 'prowl_fang'),
('Packers',   'Green Bay',   'GB',  'NFC', 'North', '#203731', '#FFB612', '#FFFFFF', 'tundra_block'),
('Vikings',   'Minnesota',   'MIN', 'NFC', 'North', '#4F2683', '#FFC62F', '#FFFFFF', 'nordic_axe'),
-- NFC SOUTH
('Falcons',   'Atlanta',     'ATL', 'NFC', 'South', '#A71930', '#000000', '#A5ACAF', 'dive_talon'),
('Panthers',  'Carolina',    'CAR', 'NFC', 'South', '#0085CA', '#101820', '#BFC0BF', 'slash_claw'),
('Saints',    'New Orleans', 'NO',  'NFC', 'South', '#D3BC8D', '#101820', '#FFFFFF', 'crescent_veil'),
('Buccaneers','Tampa Bay',   'TB',  'NFC', 'South', '#D50A0A', '#FF7900', '#000000', 'corsair_wheel'),
-- NFC EAST
('Cowboys',   'Dallas',      'DAL', 'NFC', 'East',  '#003594', '#041E42', '#869397', 'lone_star_cut'),
('Giants',    'New York',    'NYG', 'NFC', 'East',  '#0B2265', '#A71930', '#A5ACAF', 'granite_ridge'),
('Eagles',    'Philadelphia','PHI', 'NFC', 'East',  '#004C54', '#A5ACAF', '#ACC0C6', 'midnight_wing'),
('Commanders','Washington',  'WSH', 'NFC', 'East',  '#5A1414', '#FFB612', '#FFFFFF', 'shield_split'),
-- NFC WEST
('Cardinals', 'Arizona',     'ARI', 'NFC', 'West',  '#97233F', '#000000', '#FFB612', 'cardinal_spike'),
('Rams',      'Los Angeles', 'LAR', 'NFC', 'West',  '#003594', '#FFA300', '#FFFFFF', 'horn_curve'),
('49ers',     'San Francisco','SF', 'NFC', 'West',  '#AA0000', '#B3995D', '#FFFFFF', 'gold_rush'),
('Seahawks',  'Seattle',     'SEA', 'NFC', 'West',  '#002244', '#69BE28', '#A5ACAF', 'talon_strike')
on conflict (abbreviation) do nothing;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table leagues enable row level security;
alter table league_members enable row level security;
alter table schedule enable row level security;
alter table teams enable row level security;
alter table user_picks_regular enable row level security;
alter table predicted_standings enable row level security;
alter table playoff_bracket enable row level security;
alter table user_picks_playoff enable row level security;
alter table scoring enable row level security;

-- Teams: readable by everyone (public reference data)
drop policy if exists "teams_select_all" on teams;
create policy "teams_select_all" on teams for select using (true);

-- Profiles: users see all, edit only own
drop policy if exists "profiles_select_all" on profiles;
create policy "profiles_select_all" on profiles for select using (true);
drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- Leagues: members can read their leagues; anyone authenticated can look up by invite (for join page)
drop policy if exists "leagues_select_member" on leagues;
create policy "leagues_select_member" on leagues for select
  using (auth.role() = 'authenticated');
drop policy if exists "leagues_insert_auth" on leagues;
create policy "leagues_insert_auth" on leagues for insert with check (auth.uid() = commissioner_id);
drop policy if exists "leagues_update_commissioner" on leagues;
create policy "leagues_update_commissioner" on leagues for update using (auth.uid() = commissioner_id);

-- League members
drop policy if exists "members_select" on league_members;
create policy "members_select" on league_members for select
  using (auth.role() = 'authenticated');
drop policy if exists "members_insert" on league_members;
create policy "members_insert" on league_members for insert with check (auth.uid() = user_id);

-- Schedule: readable by all authenticated
drop policy if exists "schedule_select" on schedule;
create policy "schedule_select" on schedule for select using (auth.role() = 'authenticated');

-- Picks: users read all in their league, write only own (and only while open)
drop policy if exists "picks_regular_select" on user_picks_regular;
create policy "picks_regular_select" on user_picks_regular for select
  using (league_id in (select league_id from league_members where user_id = auth.uid()));
drop policy if exists "picks_regular_insert" on user_picks_regular;
create policy "picks_regular_insert" on user_picks_regular for insert
  with check (auth.uid() = user_id and
    (select pick_lock_status from leagues where id = league_id) = 'open');
drop policy if exists "picks_regular_update" on user_picks_regular;
create policy "picks_regular_update" on user_picks_regular for update
  using (auth.uid() = user_id and
    (select pick_lock_status from leagues where id = league_id) = 'open');

-- Playoff picks: same pattern
drop policy if exists "picks_playoff_select" on user_picks_playoff;
create policy "picks_playoff_select" on user_picks_playoff for select
  using (league_id in (select league_id from league_members where user_id = auth.uid()));
drop policy if exists "picks_playoff_insert" on user_picks_playoff;
create policy "picks_playoff_insert" on user_picks_playoff for insert
  with check (auth.uid() = user_id and
    (select pick_lock_status from leagues where id = league_id) = 'open');
drop policy if exists "picks_playoff_update" on user_picks_playoff;
create policy "picks_playoff_update" on user_picks_playoff for update
  using (auth.uid() = user_id and
    (select pick_lock_status from leagues where id = league_id) = 'open');

-- Predicted standings: read by league members, write own
drop policy if exists "standings_select" on predicted_standings;
create policy "standings_select" on predicted_standings for select
  using (league_id in (select league_id from league_members where user_id = auth.uid()));
drop policy if exists "standings_write" on predicted_standings;
create policy "standings_write" on predicted_standings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Playoff bracket: read by league members, write own
drop policy if exists "bracket_select" on playoff_bracket;
create policy "bracket_select" on playoff_bracket for select
  using (league_id in (select league_id from league_members where user_id = auth.uid()));
drop policy if exists "bracket_write" on playoff_bracket;
create policy "bracket_write" on playoff_bracket for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Scoring: readable by all league members
drop policy if exists "scoring_select" on scoring;
create policy "scoring_select" on scoring for select
  using (league_id in (select league_id from league_members where user_id = auth.uid()));

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-create profile on signup.
-- NOTE: SECURITY DEFINER functions need an explicit search_path in Supabase,
-- otherwise `profiles` isn't resolved and signups fail with
-- "Database error creating new user". Fully-qualify the table too.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Keep updated_at fresh on pick edits
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_picks_regular on user_picks_regular;
create trigger touch_picks_regular before update on user_picks_regular
  for each row execute function touch_updated_at();

drop trigger if exists touch_picks_playoff on user_picks_playoff;
create trigger touch_picks_playoff before update on user_picks_playoff
  for each row execute function touch_updated_at();

-- Recalculate predicted win/loss counts for one user in one league
create or replace function recalculate_standings(p_league_id uuid, p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  delete from predicted_standings where league_id = p_league_id and user_id = p_user_id;

  insert into predicted_standings (league_id, user_id, team_id, predicted_wins, predicted_losses)
  select
    p_league_id,
    p_user_id,
    t.id as team_id,
    count(*) filter (where upr.picked_winner_id = t.id) as predicted_wins,
    count(*) filter (where upr.picked_winner_id <> t.id) as predicted_losses
  from teams t
  join schedule s on (s.home_team_id = t.id or s.away_team_id = t.id)
  join user_picks_regular upr
    on upr.game_id = s.id
   and upr.league_id = p_league_id
   and upr.user_id = p_user_id
  group by t.id;
end;
$$;

-- Calculate total score for a user in a league.
-- Regular + playoff picks are scored against completed games.
-- Division winners + conference seeds are scored against ACTUAL standings
-- derived from completed regular-season results (simplified tiebreak: wins,
-- then deterministic team id). These converge to correct values once the
-- regular season is complete.
create or replace function recalculate_score(p_league_id uuid, p_user_id uuid)
returns void language plpgsql security definer as $$
declare
  v_year            int;
  v_regular_correct int := 0;
  v_regular_total   int := 0;
  v_div_correct     int := 0;
  v_seeds_correct   int := 0;
  v_wc_correct      int := 0;
  v_div_round       int := 0;
  v_conf_correct    int := 0;
  v_sb_correct      int := 0;
  v_total           int := 0;
begin
  select season_year into v_year from leagues where id = p_league_id;

  -- Regular season correct picks
  select count(*) into v_regular_correct
  from user_picks_regular upr
  join schedule s on s.id = upr.game_id
  where upr.league_id = p_league_id and upr.user_id = p_user_id
    and s.game_completed = true
    and s.actual_winner_id is not null
    and upr.picked_winner_id = s.actual_winner_id;

  select count(*) into v_regular_total
  from user_picks_regular upr
  join schedule s on s.id = upr.game_id
  where upr.league_id = p_league_id and upr.user_id = p_user_id
    and s.game_completed = true;

  -- Actual division winners + seeds from completed games
  with actual_wins as (
    select t.id as team_id, t.conference, t.division,
      count(*) filter (where s.game_completed and s.actual_winner_id = t.id) as w
    from teams t
    left join schedule s
      on (s.home_team_id = t.id or s.away_team_id = t.id)
     and s.league_season_year = v_year
    group by t.id, t.conference, t.division
  ),
  div_rank as (
    select team_id, conference, division, w,
      row_number() over (partition by conference, division order by w desc, team_id) as drank
    from actual_wins
  ),
  div_winners as (
    select team_id, conference, w from div_rank where drank = 1
  ),
  dw_seed as (
    select team_id, conference,
      row_number() over (partition by conference order by w desc, team_id) as seed
    from div_winners
  ),
  wc_seed as (
    select team_id, conference,
      4 + row_number() over (partition by conference order by w desc, team_id) as seed
    from div_rank where drank > 1
  ),
  actual_seeds as (
    select team_id, conference, seed from dw_seed
    union all
    select team_id, conference, seed from wc_seed where seed <= 7
  )
  select
    count(*) filter (where ps.is_division_winner and ps.team_id in (select team_id from div_winners)),
    count(*) filter (where ps.conference_seed is not null and ps.conference_seed = a.seed)
  into v_div_correct, v_seeds_correct
  from predicted_standings ps
  left join actual_seeds a on a.team_id = ps.team_id
  where ps.league_id = p_league_id and ps.user_id = p_user_id;

  -- Playoff round correct picks
  select count(*) into v_wc_correct
  from user_picks_playoff upp
  join playoff_bracket pb on pb.id = upp.playoff_game_id
  where upp.league_id = p_league_id and upp.user_id = p_user_id
    and pb.round = 'Wild Card' and pb.game_completed = true
    and upp.picked_winner_id = pb.actual_winner_id;

  select count(*) into v_div_round
  from user_picks_playoff upp
  join playoff_bracket pb on pb.id = upp.playoff_game_id
  where upp.league_id = p_league_id and upp.user_id = p_user_id
    and pb.round = 'Divisional' and pb.game_completed = true
    and upp.picked_winner_id = pb.actual_winner_id;

  select count(*) into v_conf_correct
  from user_picks_playoff upp
  join playoff_bracket pb on pb.id = upp.playoff_game_id
  where upp.league_id = p_league_id and upp.user_id = p_user_id
    and pb.round = 'Conference Championship' and pb.game_completed = true
    and upp.picked_winner_id = pb.actual_winner_id;

  select count(*) into v_sb_correct
  from user_picks_playoff upp
  join playoff_bracket pb on pb.id = upp.playoff_game_id
  where upp.league_id = p_league_id and upp.user_id = p_user_id
    and pb.round = 'Super Bowl' and pb.game_completed = true
    and upp.picked_winner_id = pb.actual_winner_id;

  -- Weighted total (1/5/2/3/5/8/15)
  v_total := (v_regular_correct * 1)
           + (v_div_correct * 5)
           + (v_seeds_correct * 2)
           + (v_wc_correct * 3)
           + (v_div_round * 5)
           + (v_conf_correct * 8)
           + (v_sb_correct * 15);

  insert into scoring (
    league_id, user_id,
    regular_picks_correct, regular_picks_total, regular_picks_remaining,
    division_winners_correct, seeds_correct,
    wildcard_correct, divisional_correct,
    conf_championship_correct, superbowl_correct,
    total_points, last_calculated_at
  ) values (
    p_league_id, p_user_id,
    v_regular_correct, v_regular_total, greatest(272 - v_regular_total, 0),
    v_div_correct, v_seeds_correct,
    v_wc_correct, v_div_round,
    v_conf_correct, v_sb_correct,
    v_total, now()
  )
  on conflict (league_id, user_id) do update set
    regular_picks_correct     = excluded.regular_picks_correct,
    regular_picks_total       = excluded.regular_picks_total,
    regular_picks_remaining   = excluded.regular_picks_remaining,
    division_winners_correct  = excluded.division_winners_correct,
    seeds_correct             = excluded.seeds_correct,
    wildcard_correct          = excluded.wildcard_correct,
    divisional_correct        = excluded.divisional_correct,
    conf_championship_correct = excluded.conf_championship_correct,
    superbowl_correct         = excluded.superbowl_correct,
    total_points              = excluded.total_points,
    last_calculated_at        = now();
end;
$$;

-- Fan-out helper: recalc every member's score in a league (used by cron)
create or replace function recalculate_all_scores(p_league_id uuid)
returns void language plpgsql security definer as $$
declare m record;
begin
  for m in select user_id from league_members where league_id = p_league_id loop
    perform recalculate_score(p_league_id, m.user_id);
  end loop;
end;
$$;

-- ============================================================
-- REALTIME: enable for live leaderboard + result overlays
-- ============================================================
do $$ begin
  alter publication supabase_realtime add table scoring;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table schedule;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table playoff_bracket;
exception when duplicate_object then null; end $$;
