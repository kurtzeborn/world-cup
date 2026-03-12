import { TableClient, TableServiceClient, TableEntity } from '@azure/data-tables';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';

function getTableClient(tableName: string): TableClient {
  return TableClient.fromConnectionString(connectionString, tableName);
}

async function ensureTable(tableName: string): Promise<TableClient> {
  const client = getTableClient(tableName);
  try {
    await client.createTable();
  } catch (err: unknown) {
    // Table already exists — ignore
    if ((err as { statusCode?: number }).statusCode !== 409) throw err;
  }
  return client;
}

export const teamsTable = () => ensureTable('Teams');
export const usersTable = () => ensureTable('Users');
export const picksTable = () => ensureTable('Picks');
export const resultsTable = () => ensureTable('Results');
export const leaguesTable = () => ensureTable('Leagues');
export const leagueMembersTable = () => ensureTable('LeagueMembers');
export const scoresTable = () => ensureTable('Scores');

// Generic helpers
export async function upsertEntity<T extends object>(
  tableName: string,
  partitionKey: string,
  rowKey: string,
  data: T
): Promise<void> {
  const client = await ensureTable(tableName);
  await client.upsertEntity({ partitionKey, rowKey, ...data }, 'Replace');
}

export async function getEntity<T extends object>(
  tableName: string,
  partitionKey: string,
  rowKey: string
): Promise<(TableEntity & T) | null> {
  try {
    const client = await ensureTable(tableName);
    const result = await client.getEntity<T>(partitionKey, rowKey);
    return result as unknown as TableEntity & T;
  } catch (err: unknown) {
    if ((err as { statusCode?: number }).statusCode === 404) return null;
    throw err;
  }
}

export async function listEntitiesByPartition<T extends object>(
  tableName: string,
  partitionKey: string
): Promise<(TableEntity & T)[]> {
  const client = await ensureTable(tableName);
  const results: (TableEntity & T)[] = [];
  const iter = client.listEntities<T>({
    queryOptions: { filter: `PartitionKey eq '${partitionKey}'` },
  });
  for await (const entity of iter) {
    results.push(entity as unknown as TableEntity & T);
  }
  return results;
}

export async function deleteEntity(
  tableName: string,
  partitionKey: string,
  rowKey: string
): Promise<boolean> {
  try {
    const client = await ensureTable(tableName);
    await client.deleteEntity(partitionKey, rowKey);
    return true;
  } catch (err: unknown) {
    if ((err as { statusCode?: number }).statusCode === 404) return false;
    throw err;
  }
}
