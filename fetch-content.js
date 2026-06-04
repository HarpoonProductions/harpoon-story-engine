// fetch-content.js
// Fetches a project from Supabase REST API and writes to projects/<id>/content.json
// Uses raw fetch — no Supabase JS client, no WebSocket dependency.

const fs   = require('fs');
const path = require('path');

const projectId     = process.argv[2];
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_ANON_KEY;

if (!projectId)    { console.error('Usage: node fetch-content.js <project_id>'); process.exit(1); }
if (!SUPABASE_URL) { console.error('SUPABASE_URL not set'); process.exit(1); }
if (!SUPABASE_KEY) { console.error('SUPABASE_ANON_KEY not set'); process.exit(1); }

async function main() {
  const url = `${SUPABASE_URL}/rest/v1/story_engine_projects?project_id=eq.${encodeURIComponent(projectId)}&select=content&limit=1`;

  const res = await fetch(url, {
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Accept':        'application/json',
    }
  });

  if (!res.ok) {
    console.error(`Supabase API error ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  const rows = await res.json();
  if (!rows.length) {
    console.error(`Project not found in Supabase: ${projectId}`);
    process.exit(1);
  }

  const dir = path.join('projects', projectId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'content.json'), JSON.stringify(rows[0].content, null, 2));
  console.log(`✓ Fetched ${projectId} from Supabase`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
