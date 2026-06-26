#!/usr/bin/env node
/**
 * extract-frames.js
 *
 * Extracts evenly-spaced JPEG frames from a video and optionally uploads
 * them to S3, ready to use in a Harpoon Story Engine frame-scrubber section.
 *
 * Usage:
 *   node scripts/extract-frames.js <video-file> [options]
 *
 * Options:
 *   --frames   <n>      Number of frames to extract          (default: 120)
 *   --prefix   <str>    Filename prefix                      (default: frame-)
 *   --digits   <n>      Zero-padding width                   (default: 3)
 *   --quality  <n>      JPEG quality 1–31 (lower = better)   (default: 3)
 *   --out      <dir>    Local output directory               (default: ./frames-output)
 *   --project  <str>    S3 folder name (project ID or slug)  (required for upload)
 *   --no-upload         Skip S3 upload, keep local files only
 *   --keep              Keep local files after uploading
 *
 * Examples:
 *   node scripts/extract-frames.js clip.mp4 --frames 90 --project ocean-survey
 *   node scripts/extract-frames.js clip.mp4 --no-upload --out ./my-frames
 *
 * Output:
 *   Prints the S3 base URL to paste into the frame-scrubber editor.
 */

'use strict';

const path    = require('path');
const fs      = require('fs');
const os      = require('os');
const { execSync, spawnSync } = require('child_process');

// ── Deps ──────────────────────────────────────────────────────────────────────

const ffmpegPath = require('ffmpeg-static');
const ffmpeg     = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
// ffprobe ships alongside ffmpeg-static as a separate package; fall back to
// using ffmpeg itself to read metadata if ffprobe isn't available.
try {
  const ffprobePath = require('ffprobe-static').path;
  ffmpeg.setFfprobePath(ffprobePath);
} catch (_) {
  // ffprobe-static not installed — fluent-ffmpeg falls back gracefully
}

// ── Arg parsing ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    input:    null,
    frames:   120,
    prefix:   'frame-',
    digits:   3,
    quality:  3,
    out:      path.join(process.cwd(), 'frames-output'),
    project:  null,
    upload:   true,
    keep:     false,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--no-upload') { opts.upload = false; continue; }
    if (a === '--keep')      { opts.keep   = true;  continue; }
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = args[++i];
      if (key === 'frames')  { opts.frames  = parseInt(val); continue; }
      if (key === 'digits')  { opts.digits  = parseInt(val); continue; }
      if (key === 'quality') { opts.quality = parseInt(val); continue; }
      if (key === 'prefix')  { opts.prefix  = val; continue; }
      if (key === 'out')     { opts.out     = path.resolve(val); continue; }
      if (key === 'project') { opts.project = val; continue; }
      console.warn(`Unknown option: --${key}`);
    } else if (!opts.input) {
      opts.input = path.resolve(a);
    }
  }
  return opts;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pad(n, digits) {
  return String(n).padStart(digits, '0');
}

function log(msg)  { process.stdout.write(msg); }
function logln(msg){ console.log(msg); }

function clearLine() {
  process.stdout.clearLine?.(0);
  process.stdout.cursorTo?.(0);
}

function bar(done, total, width = 30) {
  const pct   = done / total;
  const fill  = Math.round(pct * width);
  const empty = width - fill;
  return '[' + '█'.repeat(fill) + '░'.repeat(empty) + '] ' +
         String(done).padStart(String(total).length) + '/' + total;
}

// ── Video duration via ffprobe ────────────────────────────────────────────────

function getDuration(inputFile) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputFile, (err, meta) => {
      if (err) return reject(err);
      resolve(meta.format.duration);
    });
  });
}

// ── Frame extraction ──────────────────────────────────────────────────────────

function extractFrames(opts, duration, outDir) {
  return new Promise((resolve, reject) => {
    // fps filter: extract exactly `frames` evenly-spaced frames over the duration
    const fps    = opts.frames / duration;
    const outPat = path.join(outDir, `${opts.prefix}%0${opts.digits}d.jpg`);

    logln(`\n  Source:   ${opts.input}`);
    logln(`  Duration: ${duration.toFixed(2)}s`);
    logln(`  Frames:   ${opts.frames} (1 every ${(duration / opts.frames).toFixed(2)}s)`);
    logln(`  Quality:  JPEG q${opts.quality}`);
    logln(`  Output:   ${outDir}\n`);

    let extracted = 0;

    ffmpeg(opts.input)
      .videoFilter(`fps=${fps}`)
      .frames(opts.frames)
      .outputOptions([`-q:v ${opts.quality}`])
      .output(outPat)
      .on('progress', (info) => {
        extracted = info.frames || extracted;
        clearLine();
        log('  Extracting ' + bar(Math.min(extracted, opts.frames), opts.frames));
      })
      .on('end', () => {
        clearLine();
        logln('  Extracting ' + bar(opts.frames, opts.frames) + '  ✓');
        resolve();
      })
      .on('error', reject)
      .run();
  });
}

// ── S3 upload ─────────────────────────────────────────────────────────────────

async function uploadFrames(opts, outDir) {
  // Load env
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath });

  const bucket  = process.env.S3_BUCKET;
  const region  = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'eu-west-2';
  const delivery = process.env.DELIVERY_DOMAIN || '';

  if (!bucket) {
    throw new Error('S3_BUCKET not set in .env — cannot upload.');
  }
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('AWS credentials not set in .env — cannot upload.');
  }

  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
  const s3 = new S3Client({ region });

  const s3Folder  = `${opts.project}/frames`;
  const files     = fs.readdirSync(outDir)
    .filter(f => f.endsWith('.jpg'))
    .sort();

  logln(`\n  Uploading ${files.length} frames to s3://${bucket}/${s3Folder}/\n`);

  let uploaded = 0;
  for (const file of files) {
    const filePath = path.join(outDir, file);
    const s3Key    = `${s3Folder}/${file}`;
    const body     = fs.readFileSync(filePath);

    await s3.send(new PutObjectCommand({
      Bucket:      bucket,
      Key:         s3Key,
      Body:        body,
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    uploaded++;
    clearLine();
    log('  Uploading ' + bar(uploaded, files.length));
  }

  clearLine();
  logln('  Uploading ' + bar(files.length, files.length) + '  ✓');

  const baseUrl = delivery
    ? `https://${delivery}/${s3Folder}/`
    : `https://${bucket}.s3.${region}.amazonaws.com/${s3Folder}/`;

  return baseUrl;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv);

  if (!opts.input) {
    console.error([
      '',
      '  Usage: node scripts/extract-frames.js <video-file> [options]',
      '',
      '  Options:',
      '    --frames   <n>    Frames to extract          (default: 120)',
      '    --prefix   <str>  Filename prefix            (default: frame-)',
      '    --digits   <n>    Zero-padding width         (default: 3)',
      '    --quality  <n>    JPEG quality 1–31          (default: 3)',
      '    --out      <dir>  Local output directory     (default: ./frames-output)',
      '    --project  <str>  S3 project folder          (required for upload)',
      '    --no-upload       Skip S3 upload',
      '    --keep            Keep local files after uploading',
      '',
    ].join('\n'));
    process.exit(1);
  }

  if (!fs.existsSync(opts.input)) {
    console.error(`\n  ✗ File not found: ${opts.input}\n`);
    process.exit(1);
  }

  if (opts.upload && !opts.project) {
    console.error('\n  ✗ --project <name> is required for S3 upload. Use --no-upload to skip.\n');
    process.exit(1);
  }

  logln('');
  logln('  ── Harpoon Frame Extractor ─────────────────────────────────');

  // Temp dir if uploading and not keeping, otherwise use --out
  const outDir = (!opts.upload || opts.keep) ? opts.out : fs.mkdtempSync(path.join(os.tmpdir(), 'hse-frames-'));
  fs.mkdirSync(outDir, { recursive: true });

  try {
    // 1. Get duration
    log('  Probing video…');
    const duration = await getDuration(opts.input);
    clearLine();

    // 2. Extract frames
    await extractFrames(opts, duration, outDir);

    // 3. Upload
    let baseUrl = null;
    if (opts.upload) {
      baseUrl = await uploadFrames(opts, outDir);

      // Clean up temp files unless --keep
      if (!opts.keep) {
        fs.rmSync(outDir, { recursive: true, force: true });
      }
    }

    // 4. Summary
    logln('');
    logln('  ── Done ────────────────────────────────────────────────────');
    if (baseUrl) {
      logln('');
      logln('  Paste these values into the Frame Scrubber editor:');
      logln('');
      logln(`    Base URL:    ${baseUrl}`);
      logln(`    Frame count: ${opts.frames}`);
      logln(`    Prefix:      ${opts.prefix}`);
      logln(`    Digits:      ${opts.digits}`);
    } else {
      logln('');
      logln(`  Frames saved to: ${outDir}`);
      logln(`  Frame count: ${opts.frames}  |  Prefix: ${opts.prefix}  |  Digits: ${opts.digits}`);
    }
    logln('');

  } catch (err) {
    logln('');
    console.error(`  ✗ ${err.message}`);
    process.exit(1);
  }
}

main();
