'use strict';

/**
 * Harpoon Story Engine — Audio Generator
 *
 * Reads a content.json file, builds an SSML script, submits it to
 * AWS Polly's async synthesis task, then polls until the MP3 is ready.
 * Polly writes directly to S3 — no intermediate local file needed.
 *
 * Usage (CI):
 *   node scripts/generate-audio.js <project-id> \
 *     --content <path/to/content.json> \
 *     --bucket  <s3-bucket-name> \
 *     --prefix  <optional/key/prefix/>
 *
 * Requires env vars: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 * (or any standard AWS credential chain — IAM role, profile, etc.)
 */

const fs   = require('fs');
const path = require('path');
const { PollyClient, StartSpeechSynthesisTaskCommand,
        GetSpeechSynthesisTaskCommand } = require('@aws-sdk/client-polly');

const { buildAudioScript } = require('../renderer/audio-script');

// ── Args ──────────────────────────────────────────────────────────

const args      = process.argv.slice(2);
const projectId = args[0];

if (!projectId || projectId.startsWith('--')) {
  console.error('Usage: node scripts/generate-audio.js <project-id> --content <path> --bucket <name> [--prefix <prefix>]');
  process.exit(1);
}

const contentPath = getArg('--content');
const bucket      = getArg('--bucket');
const prefix      = getArg('--prefix', `${projectId}/`);

if (!contentPath || !bucket) {
  console.error('--content and --bucket are required');
  process.exit(1);
}

function getArg(flag, fallback = null) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

// ── Main ──────────────────────────────────────────────────────────

async function generate() {
  // Load content
  const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
  const meta    = content.meta || {};

  const voice = meta.audio_voice || 'Amy';
  // Neural async synthesis is only available in specific regions.
  // eu-west-1 (Ireland) is the nearest region that supports it.
  const region = process.env.POLLY_REGION || 'eu-west-1';

  console.log(`[audio] Project: ${projectId}`);
  console.log(`[audio] Voice:   ${voice} (neural)`);
  console.log(`[audio] Bucket:  s3://${bucket}/${prefix}`);

  // Build SSML
  const ssml = buildAudioScript(content);
  console.log(`[audio] Script:  ${ssml.length} characters`);

  if (ssml.length > 200000) {
    console.error('[audio] SSML exceeds Polly 200,000 character limit — story may be too long');
    process.exit(1);
  }

  const polly = new PollyClient({ region });

  // Submit async synthesis task — Polly writes MP3 directly to S3
  const taskRes = await polly.send(new StartSpeechSynthesisTaskCommand({
    Engine:            'neural',
    VoiceId:           voice,
    OutputFormat:      'mp3',
    TextType:          'ssml',
    Text:              ssml,
    OutputS3BucketName: bucket,
    OutputS3KeyPrefix:  prefix,
  }));

  const taskId = taskRes.SynthesisTask?.TaskId;
  if (!taskId) throw new Error('Polly did not return a TaskId');
  console.log(`[audio] Task submitted: ${taskId}`);

  // Poll until complete (Polly async tasks typically take 10–60s)
  const outputUri = await poll(polly, taskId);
  console.log(`[audio] Done — ${outputUri}`);

  // Polly names the file <taskId>.mp3 — print the S3 key for CI to rename/move
  const pollyKey = outputUri.replace(`s3://${bucket}/`, '');
  console.log(`[audio] S3 key: ${pollyKey}`);

  // Emit a machine-readable line for the CI shell to capture
  console.log(`AUDIO_S3_KEY=${pollyKey}`);
}

async function poll(polly, taskId, maxWaitMs = 180000) {
  const start    = Date.now();
  const interval = 5000;

  while (Date.now() - start < maxWaitMs) {
    await sleep(interval);
    const res    = await polly.send(new GetSpeechSynthesisTaskCommand({ TaskId: taskId }));
    const status = res.SynthesisTask?.TaskStatus;
    const uri    = res.SynthesisTask?.OutputUri;

    console.log(`[audio] Status: ${status}`);

    if (status === 'completed') return uri;
    if (status === 'failed') {
      throw new Error(`Polly task failed: ${res.SynthesisTask?.TaskStatusReason || 'unknown reason'}`);
    }
    // 'scheduled' or 'inProgress' — keep waiting
  }
  throw new Error(`Polly task timed out after ${maxWaitMs / 1000}s`);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

generate().catch(err => {
  console.error('[audio] Failed:', err.message);
  process.exit(1);
});
