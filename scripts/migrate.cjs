const fs = require('fs');
const path = require('path');

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const DB_ID = '6b652b0c-17dc-4a6e-a73f-44e613cf4320';

async function run(sql) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${DB_ID}/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${CF_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    }
  );
  const data = await res.json();
  if (!data.success) throw new Error(JSON.stringify(data.errors));
  return data;
}

async function main() {
  const sqlFile = process.argv[2];
  if (!sqlFile) { console.error('Usage: node scripts/migrate.cjs <sql-file>'); process.exit(1); }
  const sql = fs.readFileSync(path.resolve(sqlFile), 'utf8');
  const statements = sql.split(';').map(s => s.trim()).filter(s => s && !s.startsWith('--'));
  for (const stmt of statements) {
    console.log('Running:', stmt.slice(0, 80) + '...');
    const result = await run(stmt);
    console.log('OK:', result.result?.meta?.changes || 'done');
  }
  console.log('Migration complete');
}

main().catch(e => { console.error(e); process.exit(1); });
