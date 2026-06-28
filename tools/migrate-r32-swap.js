/**
 * migrate-r32-swap.js — One-time migration to fix R32 M85/M87 group-winner swap.
 *
 * BACKGROUND
 *   bracket-structure.js originally had M85 = 1K (Portugal/Colombia) and
 *   M87 = 1B (Canada/Switzerland). FIFA Annex C actually defines:
 *     M85 = 1B (Group B winner) vs 3rd from EFGIJ
 *     M87 = 1K (Group K winner) vs 3rd from DEIJL
 *
 *   Users made their picks under the wrong labels. Their stored
 *   bracketPicks["R32_85"] is the team they intended to advance from the
 *   match featuring the Group K winner — which is actually M87.
 *
 *   Because M85 and M87 both feed M96 (R16), swapping the two stored values
 *   preserves every downstream pick perfectly.
 *
 * MODES
 *   --backup            Write a full Picks-table snapshot to tools/backups/
 *   --dry-run           Report what would change without writing
 *   --execute           Perform the swap (creates a backup first, unconditionally)
 *   --restore <file>    Restore Picks rows from a backup JSON
 *
 * USAGE (run from the functions/ directory so node_modules resolve)
 *   cd C:\repos\world-cup\functions
 *   $env:AZURE_STORAGE_CONNECTION_STRING = "<production connection string>"
 *
 *   # 1) Inspect what would change
 *   node ..\tools\migrate-r32-swap.js --dry-run
 *
 *   # 2) Apply the swap (auto-backs-up first)
 *   node ..\tools\migrate-r32-swap.js --execute
 *
 *   # 3) If anything goes wrong, restore from the printed backup file
 *   node ..\tools\migrate-r32-swap.js --restore tools\backups\picks-2026-06-27T...json
 */

const fs = require('fs');
const path = require('path');

const { TableClient } = require(
  require.resolve('@azure/data-tables', { paths: [path.join(__dirname, '..', 'functions')] })
);

const BACKUP_DIR = path.join(__dirname, 'backups');
const TABLE_NAME = 'Picks';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isExecute = args.includes('--execute');
const isBackup = args.includes('--backup');
const restoreIdx = args.indexOf('--restore');
const restoreFile = restoreIdx >= 0 ? args[restoreIdx + 1] : null;

if (!isDryRun && !isExecute && !isBackup && !restoreFile) {
  console.log(`
migrate-r32-swap.js — Swap R32_85 and R32_87 in every user's bracketPicks.

  --dry-run             Show what would change, write nothing
  --backup              Write a Picks-table snapshot only
  --execute             Back up, then perform the swap
  --restore <file>      Restore Picks rows from a backup JSON

Set AZURE_STORAGE_CONNECTION_STRING to the production connection string first.
`);
  process.exit(0);
}

const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
if (!connStr || connStr === 'UseDevelopmentStorage=true') {
  console.error('ERROR: AZURE_STORAGE_CONNECTION_STRING must be set to the production connection string.');
  process.exit(1);
}

const client = TableClient.fromConnectionString(connStr, TABLE_NAME);

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function listAllPicks() {
  const rows = [];
  for await (const entity of client.listEntities()) {
    rows.push(entity);
  }
  return rows;
}

async function writeBackup(rows) {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `picks-${timestamp()}.json`);
  fs.writeFileSync(file, JSON.stringify(rows, null, 2), 'utf8');
  console.log(`  Backup written: ${file}  (${rows.length} rows)`);
  return file;
}

function swapBracketPicks(rawJson) {
  let obj;
  try { obj = JSON.parse(rawJson || '{}'); }
  catch { return { changed: false, before: rawJson, after: rawJson, reason: 'invalid JSON' }; }

  const has85 = Object.prototype.hasOwnProperty.call(obj, 'R32_85');
  const has87 = Object.prototype.hasOwnProperty.call(obj, 'R32_87');

  if (!has85 && !has87) {
    return { changed: false, before: rawJson, after: rawJson, reason: 'no R32_85 or R32_87' };
  }

  const next = { ...obj };
  const v85 = has85 ? obj.R32_85 : undefined;
  const v87 = has87 ? obj.R32_87 : undefined;

  if (has87) next.R32_85 = v87; else delete next.R32_85;
  if (has85) next.R32_87 = v85; else delete next.R32_87;

  return {
    changed: true,
    before: { R32_85: v85 ?? null, R32_87: v87 ?? null },
    after: { R32_85: next.R32_85 ?? null, R32_87: next.R32_87 ?? null },
    nextJson: JSON.stringify(next),
  };
}

async function runDryRun() {
  console.log('DRY RUN — no writes will be made.\n');
  const rows = await listAllPicks();
  let total = 0, changed = 0, skipped = 0;

  for (const row of rows) {
    if (row.rowKey !== 'picks') continue;
    total++;
    const result = swapBracketPicks(row.bracketPicks);
    if (!result.changed) {
      skipped++;
      console.log(`  [skip] ${row.partitionKey} — ${result.reason}`);
      continue;
    }
    changed++;
    console.log(`  [swap] ${row.partitionKey}`);
    console.log(`         before: R32_85=${result.before.R32_85}  R32_87=${result.before.R32_87}`);
    console.log(`         after:  R32_85=${result.after.R32_85}  R32_87=${result.after.R32_87}`);
  }

  console.log(`\nSummary: ${total} picks rows · would swap ${changed} · skip ${skipped}`);
}

async function runExecute() {
  console.log('EXECUTE — backing up, then performing swap.\n');
  const rows = await listAllPicks();
  const backupFile = await writeBackup(rows);
  console.log('');

  let total = 0, changed = 0, skipped = 0, failed = 0;

  for (const row of rows) {
    if (row.rowKey !== 'picks') continue;
    total++;
    const result = swapBracketPicks(row.bracketPicks);
    if (!result.changed) {
      skipped++;
      continue;
    }

    try {
      await client.updateEntity(
        {
          partitionKey: row.partitionKey,
          rowKey: row.rowKey,
          bracketPicks: result.nextJson,
        },
        'Merge',
      );
      changed++;
      console.log(`  [ok]  ${row.partitionKey}`);
    } catch (err) {
      failed++;
      console.error(`  [ERR] ${row.partitionKey} — ${err.message}`);
    }
  }

  console.log(`\nSummary: ${total} picks rows · swapped ${changed} · skipped ${skipped} · failed ${failed}`);
  console.log(`Backup: ${backupFile}`);
  if (failed > 0) {
    console.log('\nSome rows failed. To restore the pre-migration state:');
    console.log(`  node ${path.relative(process.cwd(), __filename)} --restore ${path.relative(process.cwd(), backupFile)}`);
    process.exit(2);
  }
}

async function runBackupOnly() {
  console.log('BACKUP — snapshot only, no writes to Picks.\n');
  const rows = await listAllPicks();
  await writeBackup(rows);
}

async function runRestore(file) {
  console.log(`RESTORE — writing rows from ${file}\n`);
  if (!fs.existsSync(file)) {
    console.error(`ERROR: backup file not found: ${file}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let restored = 0, failed = 0;

  for (const row of data) {
    const payload = { ...row };
    // Azure Table SDK adds timestamp/etag; strip before write
    delete payload.timestamp;
    delete payload.etag;
    delete payload['odata.etag'];

    try {
      await client.upsertEntity(payload, 'Replace');
      restored++;
      console.log(`  [ok] ${row.partitionKey} / ${row.rowKey}`);
    } catch (err) {
      failed++;
      console.error(`  [ERR] ${row.partitionKey} / ${row.rowKey} — ${err.message}`);
    }
  }

  console.log(`\nSummary: restored ${restored} · failed ${failed}`);
  if (failed > 0) process.exit(2);
}

(async () => {
  try {
    if (restoreFile) await runRestore(restoreFile);
    else if (isExecute) await runExecute();
    else if (isBackup) await runBackupOnly();
    else if (isDryRun) await runDryRun();
  } catch (err) {
    console.error('\nFATAL:', err.message);
    process.exit(1);
  }
})();
