// Creates the league_messages table via the Supabase Management API.
const PROJECT_REF = 'uhkkykmkbdefdtrpmilc';
const SERVICE_KEY = 'sb_secret_Y5_RfCCbw4JpoTVD-R9grA_dIMsmZtZ';

const SQL = `
CREATE TABLE IF NOT EXISTS league_messages (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id   uuid        NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     text        NOT NULL CHECK (char_length(content) <= 500),
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS league_messages_league_created
  ON league_messages (league_id, created_at ASC);

ALTER TABLE league_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'league_messages' AND policyname = 'Members can read messages'
  ) THEN
    CREATE POLICY "Members can read messages"
    ON league_messages FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM league_members
        WHERE league_members.league_id = league_messages.league_id
          AND league_members.user_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'league_messages' AND policyname = 'Members can send messages'
  ) THEN
    CREATE POLICY "Members can send messages"
    ON league_messages FOR INSERT TO authenticated
    WITH CHECK (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM league_members
        WHERE league_members.league_id = league_messages.league_id
          AND league_members.user_id = auth.uid()
      )
    );
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE league_messages;
`;

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: SQL }),
  }
);

const body = await res.text();
if (res.ok) {
  console.log('Table created successfully.');
} else {
  console.error(`Management API rejected (${res.status}):`, body);
  console.log('\nRun this SQL manually in Supabase → SQL Editor:\n');
  console.log(SQL);
}
