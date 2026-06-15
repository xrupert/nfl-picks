// One-shot SQL runner over a direct Postgres connection.
// Connection details come from env so secrets never hit argv/logs:
//   PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
// Usage: node scripts/runSql.js path/to/file.sql
import { readFileSync } from 'node:fs';
import pg from 'pg';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/runSql.js <file.sql>');
  process.exit(1);
}

const sql = readFileSync(file, 'utf8');

const client = new pg.Client({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'postgres',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

try {
  await client.connect();
  console.log(`Connected to ${process.env.PGHOST}. Running ${file}…`);
  await client.query(sql); // simple-query protocol → supports multi-statement + dollar-quoting
  console.log('✓ SQL executed successfully.');
  await client.end();
  process.exit(0);
} catch (err) {
  console.error('✗ SQL run failed:', err.message);
  try { await client.end(); } catch { /* ignore */ }
  process.exit(2);
}
