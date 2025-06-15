import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import StaticConfiguration from '../src/configuration/staticConfiguration.js';

/**
 * Creates a new mod directory with a starter manifest file.
 *
 * @param {string} modId - The ID of the mod to create.
 * @param {object} [options] - Optional settings.
 * @param {string} [options.baseDir] - Override base data directory.
 * @returns {Promise<void>} Resolves when creation is complete.
 */
export async function createMod(modId, options = {}) {
  if (typeof modId !== 'string' || !(modId = modId.trim())) {
    throw new Error('modId must be a non-empty string');
  }

  const config = new StaticConfiguration();
  if (options.baseDir) {
    config.getBaseDataPath = () => options.baseDir;
  }

  const modsDir = path.join(config.getBaseDataPath(), config.getModsBasePath());
  const modDir = path.join(modsDir, modId);
  await fs.mkdir(modDir, { recursive: true });

  const manifestPath = path.join(modDir, config.getModManifestFilename());
  const manifest = {
    $schema: 'http://example.com/schemas/mod.manifest.schema.json',
    id: modId,
    version: '1.0.0',
    name: modId,
    content: {},
  };
  await fs.writeFile(
    manifestPath,
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8'
  );
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: node scripts/createMod.mjs <modId>');
    process.exitCode = 1;
  } else {
    createMod(id, { baseDir: process.env.BASE_DATA_PATH }).catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    });
  }
}
