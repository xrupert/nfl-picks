// Quick read-only query runner: prints rows as JSON.
// node scripts/q.js "select ..."
import pg from 'pg';
const sql = process.argv[2];
const client = new pg.Client({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'postgres',
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const res = await client.query(sql);
console.log(JSON.stringify(res.rows, null, 2));
await client.end();
