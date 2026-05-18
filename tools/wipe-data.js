/**
 * wipe-data.js — One-time data wipe script for pre-launch reset.
 *
 * Deletes ALL rows from: Users, Picks, Results, Leagues, LeagueMembers
 * Preserves: Teams table (team definitions are permanent)
 *
 * ADMIN NOTE:
 *   The admin role for scott@kurtzeborn.org is managed via Azure SWA Role
 *   Management in the Azure portal — it is NOT stored in the database.
 *   This wipe does NOT affect admin access. After wiping, scott@kurtzeborn.org
 *   will simply be prompted to set a display name on next login, same as all
 *   other users.
 *
 * Usage (run from the functions/ directory so node_modules are available):
 *
 *   cd C:\repos\world-cup\functions
 *   $env:AZURE_STORAGE_CONNECTION_STRING = "<connection string>"
 *   node ..\tools\wipe-data.js --confirm
 */

const path = require('path');
// Resolve @azure/data-tables from functions/node_modules (where it's installed)
const { TableClient } = require(
  require.resolve('@azure/data-tables', { paths: [path.join(__dirname, '..', 'functions')] })
);

if (!process.argv.includes('--confirm')) {
  console.log('');
  console.log('⚠️  DATA WIPE SCRIPT — production Azure Table Storage ⚠️');
  console.log('');
  console.log('  This will permanently delete ALL rows from:');
  console.log('    • Users        (all user profiles — they will re-register)');
  console.log('    • Picks        (all picks, including locked picks)');
  console.log('    • Results      (all entered match results)');
  console.log('    • Leagues      (all created leagues)');
  console.log('    • LeagueMembers (all league memberships)');
  console.log('');
  console.log('  Preserved: Teams table (team definitions are permanent)');
  console.log('');
  console.log('  Admin role for scott@kurtzeborn.org is managed via Azure SWA');
  console.log('  Role Management (portal) and is NOT affected by this wipe.');
  console.log('');
  console.log('  Run with --confirm to proceed:');
  console.log('    $env:AZURE_STORAGE_CONNECTION_STRING = "<connection string>"');
  console.log('    node ..\\tools\\wipe-data.js --confirm');
  console.log('');
  process.exit(0);
}

const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;

if (!connStr || connStr === 'UseDevelopmentStorage=true') {
  console.error('ERROR: AZURE_STORAGE_CONNECTION_STRING must be set to the production connection string.');
  console.error('       Do NOT run this against local Azurite storage.');
  process.exit(1);
}

async function deleteAllEntities(tableName) {
  const client = TableClient.fromConnectionString(connStr, tableName);
  let count = 0;

  try {
    for await (const entity of client.listEntities()) {
      await client.deleteEntity(entity.partitionKey, entity.rowKey);
      count++;
      process.stdout.write(`\r  [${tableName}] Deleted ${count} rows...`);
    }
  } catch (err) {
    if (err.statusCode === 404) {
      console.log(`\r  [${tableName}] Table does not exist — skipping.`);
      return 0;
    }
    throw err;
  }

  if (count === 0) {
    console.log(`  [${tableName}] Already empty.`);
  } else {
    console.log(`\r  [${tableName}] ✓ Deleted ${count} row${count === 1 ? '' : 's'}.          `);
  }
  return count;
}

async function main() {
  console.log('');
  console.log('Starting wipe...');
  console.log('');

  await deleteAllEntities('Users');
  await deleteAllEntities('Picks');
  await deleteAllEntities('Results');
  await deleteAllEntities('Leagues');
  await deleteAllEntities('LeagueMembers');

  console.log('');
  console.log('✓ Wipe complete.');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Verify scott@kurtzeborn.org still has admin role in Azure portal');
  console.log('     (SWA → Role Management — should show admin role unaffected)');
  console.log('  2. Sign in to wc.k61.dev to confirm the display-name prompt appears');
  console.log('  3. Share the site with friends — they can now register fresh');
  console.log('');
}

main().catch(err => {
  console.error('\nERROR:', err.message);
  process.exit(1);
});
