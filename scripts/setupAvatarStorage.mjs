import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uhkkykmkbdefdtrpmilc.supabase.co';
const SERVICE_ROLE_KEY = 'sb_secret_Y5_RfCCbw4JpoTVD-R9grA_dIMsmZtZ';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const policies = [
  {
    name: 'Users can upload own avatar',
    sql: `
      CREATE POLICY "Users can upload own avatar"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
    `,
  },
  {
    name: 'Users can update own avatar',
    sql: `
      CREATE POLICY "Users can update own avatar"
      ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
    `,
  },
  {
    name: 'Public read avatars',
    sql: `
      CREATE POLICY "Public read avatars"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'avatars');
    `,
  },
];

for (const policy of policies) {
  const { error } = await supabase.rpc('exec_sql', { sql: policy.sql }).catch(() => ({ error: { message: 'rpc not available' } }));
  // exec_sql RPC may not exist — fall back to raw REST
  if (error) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql: policy.sql }),
    });
    if (!res.ok) {
      // Try the management API
      const mgmtRes = await fetch(
        `${SUPABASE_URL.replace('https://', 'https://api.supabase.com/v1/projects/').split('.')[0]}/database/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: policy.sql }),
        }
      );
      console.log(`${policy.name}:`, mgmtRes.ok ? 'OK' : `failed (${mgmtRes.status})`);
      continue;
    }
  }
  console.log(`${policy.name}: OK`);
}
