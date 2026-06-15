-- TEST HELPER: fill all 272 regular-season picks for the first league's
-- commissioner, picking the HOME team in every game. Used to exercise the
-- standings/seeding/bracket flow without clicking 272 times.
insert into user_picks_regular (league_id, user_id, game_id, picked_winner_id)
select l.id, l.commissioner_id, s.id, s.home_team_id
from schedule s
cross join (select id, commissioner_id from leagues order by created_at limit 1) l
on conflict (league_id, user_id, game_id)
  do update set picked_winner_id = excluded.picked_winner_id;
