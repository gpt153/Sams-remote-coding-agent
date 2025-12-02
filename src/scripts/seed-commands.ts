/**
 * Seed default command templates from .claude/commands/exp-piv-loop
 */
import { readFile, readdir } from 'fs/promises';
import { join, basename } from 'path';
import { upsertTemplate } from '../db/command-templates';

const SEED_COMMANDS_PATH = '.claude/commands/exp-piv-loop';

/**
 * Extract description from markdown frontmatter
 * ---
 * description: Some description
 * ---
 */
function extractDescription(content: string): string | undefined {
  const frontmatterMatch = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!frontmatterMatch) return undefined;

  const frontmatter = frontmatterMatch[1];
  const descMatch = /description:\s*(.+)/.exec(frontmatter);
  return descMatch?.[1]?.trim();
}

export async function seedDefaultCommands(): Promise<void> {
  console.log('[Seed] Checking for default command templates...');

  try {
    const files = await readdir(SEED_COMMANDS_PATH);
    const mdFiles = files.filter((f) => f.endsWith('.md'));

    for (const file of mdFiles) {
      const name = basename(file, '.md');
      const filePath = join(SEED_COMMANDS_PATH, file);
      const content = await readFile(filePath, 'utf-8');
      const description = extractDescription(content);

      await upsertTemplate({
        name,
        description: description ?? `From ${SEED_COMMANDS_PATH}`,
        content,
      });

      console.log(`[Seed] Loaded template: ${name}`);
    }

    console.log(`[Seed] Seeded ${String(mdFiles.length)} default command templates`);
  } catch {
    // Don't fail startup if seed commands don't exist
    console.log('[Seed] No default commands to seed (this is OK)');
  }
}
