/**
 * Database operations for codebases
 */
import { pool } from './connection';
import { Codebase } from '../types';

export async function createCodebase(data: {
  name: string;
  repository_url?: string;
  default_cwd: string;
}): Promise<Codebase> {
  const result = await pool.query<Codebase>(
    'INSERT INTO remote_agent_codebases (name, repository_url, default_cwd) VALUES ($1, $2, $3) RETURNING *',
    [data.name, data.repository_url || null, data.default_cwd]
  );
  return result.rows[0];
}

export async function getCodebase(id: string): Promise<Codebase | null> {
  const result = await pool.query<Codebase>(
    'SELECT * FROM remote_agent_codebases WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}
