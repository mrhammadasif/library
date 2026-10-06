import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Relative to the server/ folder (where the API, tests and the Docker image start), not to the compiled file.
const MIGRATIONS = join(process.cwd(), 'prisma/migrations')

interface ISql {
  exec: (sql: string) => Promise<unknown>
  query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>
}

/** The bit of PGlite we use, typed structurally (its CJS and ESM type declarations don't unify). */
interface IPglite extends ISql {
  transaction: <T>(fn: (tx: ISql) => Promise<T>) => Promise<T>
}

/** Migration folders in order (the same SQL `prisma migrate deploy` runs in production). */
export function migrationFiles(dir = MIGRATIONS): { name: string, sql: string }[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()
    .map(name => ({ name, sql: readFileSync(join(dir, name, 'migration.sql'), 'utf8') }))
}

/** `prisma migrate deploy` can't target PGlite, so apply pending migrations ourselves and remember them. */
export async function migratePglite(pglite: IPglite, dir = MIGRATIONS): Promise<void> {
  await pglite.exec('CREATE TABLE IF NOT EXISTS _local_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
  const applied = new Set((await pglite.query<{ name: string }>('SELECT name FROM _local_migrations')).rows.map(r => r.name))
  for (const { name, sql } of migrationFiles(dir)) {
    if (!applied.has(name)) {
      await pglite.transaction(async (tx) => {
        await tx.exec(sql)
        await tx.query('INSERT INTO _local_migrations (name) VALUES ($1)', [name])
      })
    }
  }
}
