// fetch-content.js
// Called by the GitHub Action to pull content from Supabase before rendering.
// Usage: node fetch-content.js <project_id>
// Writes to projects/<project_id>/content.json

const { createClient } = require('@supabase/supabase-js');
const fs   = require('fs');
const path = require('path');

const projectId = process.argv[2];
if (!projectId) { console.error('Usage: node fetch-content.js <project_id>'); process.exit(1); }

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function main() {
  const { data, error } = await supabase
    .from('story_engine_projects')
    .select('content')
    .eq('project_id', projectId)
    .single();

  if (error) { console.error('Supabase error:', error.message); process.exit(1); }

  const dir = path.join('projects', projectId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'content.json'), JSON.stringify(data.content, null, 2));
  console.log(`✓ Fetched ${projectId} from Supabase`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
