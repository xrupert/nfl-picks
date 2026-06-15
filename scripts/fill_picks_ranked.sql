-- TEST HELPER: pick the "stronger" team in every game, where strength is a
-- fixed rank by abbreviation. Produces varied win totals (a near-total order)
-- so the seeding board and bracket generation can be exercised realistically.
with ranked as (
  select id, row_number() over (order by abbreviation) as strength from teams
),
lg as (select id, commissioner_id from leagues order by created_at limit 1)
insert into user_picks_regular (league_id, user_id, game_id, picked_winner_id)
select lg.id, lg.commissioner_id, s.id,
  case when rh.strength <= ra.strength then s.home_team_id else s.away_team_id end
from schedule s
join ranked rh on rh.id = s.home_team_id
join ranked ra on ra.id = s.away_team_id
cross join lg
on conflict (league_id, user_id, game_id)
  do update set picked_winner_id = excluded.picked_winner_id;
