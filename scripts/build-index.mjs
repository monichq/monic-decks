#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DECKS_DIR = path.join(REPO_ROOT, 'decks');
const INDEX_PATH = path.join(REPO_ROOT, 'index.json');

const VALID_CATEGORIES = new Set([
  'languages',
  'science',
  'exams',
  'math',
  'humanities',
  'other',
]);
const VALID_TYPES = new Set(['text', 'image', 'audio', 'video']);
const VALID_ROLES = new Set(['subject', 'target', 'none']);
const ALLOWED_MEDIA_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.mp3', '.m4a']);
const MAX_MEDIA_BYTES = 1024 * 1024; // 1 MB hard ceiling

function parseCsv(text) {
  const input = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

function validateDeck(slug) {
  const deckDir = path.join(DECKS_DIR, slug);
  const manifestPath = path.join(deckDir, 'deck.json');
  const csvPath = path.join(deckDir, 'cards.csv');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`[${slug}] Missing deck.json`);
  }
  if (!fs.existsSync(csvPath)) {
    throw new Error(`[${slug}] Missing cards.csv`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const id = manifest.id || slug;

  if (!/^[a-z0-9-]+$/.test(id)) {
    throw new Error(`[${slug}] Deck id "${id}" must match ^[a-z0-9-]+$`);
  }
  if (!manifest.title || typeof manifest.title !== 'string') {
    throw new Error(`[${slug}] Missing valid "title"`);
  }
  if (!VALID_CATEGORIES.has(manifest.category)) {
    throw new Error(
      `[${slug}] Invalid category "${manifest.category}". Must be one of: ${Array.from(VALID_CATEGORIES).join(', ')}`
    );
  }
  if (!Array.isArray(manifest.fields) || manifest.fields.length < 2) {
    throw new Error(`[${slug}] "fields" must have at least 2 columns`);
  }

  for (const f of manifest.fields) {
    if (!f.column || !f.label) {
      throw new Error(`[${slug}] Every field requires "column" and "label"`);
    }
    const fType = f.type || 'text';
    const fRole = f.role || 'none';
    if (!VALID_TYPES.has(fType)) {
      throw new Error(`[${slug}] Invalid field type "${fType}"`);
    }
    if (!VALID_ROLES.has(fRole)) {
      throw new Error(`[${slug}] Invalid field role "${fRole}"`);
    }
  }

  const csvRaw = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(csvRaw);
  if (rows.length < 2) {
    throw new Error(`[${slug}] cards.csv must contain a header row and at least 1 card`);
  }

  const headers = rows[0].map((h) => h.trim());
  const missingCols = manifest.fields
    .map((f) => f.column)
    .filter((col) => !headers.includes(col));
  if (missingCols.length > 0) {
    throw new Error(`[${slug}] cards.csv missing columns: ${missingCols.join(', ')}`);
  }

  let hasMedia = false;
  for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
    const r = rows[rowIdx];
    if (r.length !== headers.length) {
      throw new Error(
        `[${slug}] cards.csv row ${rowIdx + 1} has ${r.length} columns; expected ${headers.length}`
      );
    }

    for (let c = 0; c < headers.length; c++) {
      const val = r[c].trim();
      if (!val.startsWith('media/')) continue;

      if (val.includes('..') || val.startsWith('media//')) {
        throw new Error(`[${slug}] Unsafe media path "${val}" at row ${rowIdx + 1}`);
      }
      const ext = path.extname(val).toLowerCase();
      if (!ALLOWED_MEDIA_EXTS.has(ext)) {
        throw new Error(`[${slug}] Disallowed media extension "${ext}" at row ${rowIdx + 1}`);
      }
      const absMedia = path.join(deckDir, val);
      if (!fs.existsSync(absMedia)) {
        throw new Error(`[${slug}] Referenced media file missing: ${val}`);
      }
      const stat = fs.statSync(absMedia);
      if (stat.size > MAX_MEDIA_BYTES) {
        throw new Error(`[${slug}] Media file "${val}" exceeds 1 MB (${stat.size} bytes)`);
      }
      hasMedia = true;
    }
  }

  return {
    id,
    title: manifest.title,
    description: manifest.description || '',
    icon: manifest.icon || '📚',
    color: manifest.color || '#FF7060',
    category: manifest.category,
    subject: manifest.subject || manifest.category,
    tags: Array.isArray(manifest.tags) ? manifest.tags : [manifest.category],
    cardCount: rows.length - 1,
    path: `decks/${slug}`,
    fields: manifest.fields.map((f) => ({
      column: f.column,
      label: f.label,
      type: f.type || 'text',
      lang: f.lang || 'en-US',
      role: f.role || 'none',
    })),
    hasMedia,
  };
}

function main() {
  const checkOnly = process.argv.includes('--check');

  if (!fs.existsSync(DECKS_DIR)) {
    throw new Error('decks/ directory does not exist');
  }

  const slugs = fs
    .readdirSync(DECKS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();

  const decks = slugs.map(validateDeck);
  const nextJson = JSON.stringify(
    {
      version: 1,
      decks,
    },
    null,
    2
  ) + '\n';

  if (checkOnly) {
    const current = fs.existsSync(INDEX_PATH) ? fs.readFileSync(INDEX_PATH, 'utf8') : '';
    if (current !== nextJson) {
      console.error('index.json is out of date. Run: node scripts/build-index.mjs');
      process.exit(1);
    }
    console.log(`Validated ${decks.length} decks cleanly.`);
    return;
  }

  fs.writeFileSync(INDEX_PATH, nextJson, 'utf8');
  console.log(`Built index.json with ${decks.length} decks (${decks.reduce((a, d) => a + d.cardCount, 0)} cards).`);
}

main();
