// @jest-environment node

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const MOD_ID = 'p_erotica_kern';
const MOD_DIR = path.resolve('data/mods', MOD_ID);
const MANIFEST_PATH = path.join(MOD_DIR, 'mod-manifest.json');
const DEFINITIONS_DIR = path.join(MOD_DIR, 'entities', 'definitions');

const readJson = (filePath) =>
  JSON.parse(fs.readFileSync(filePath, { encoding: 'utf8' }));

describe('p_erotica_kern exits component definitions', () => {
  it('uses locations:exits for location definitions', () => {
    const manifest = readJson(MANIFEST_PATH);
    const definitionFiles =
      manifest?.content?.entities?.definitions ?? [];

    const invalidFiles = [];
    const missingFiles = [];

    definitionFiles
      .filter((file) => file.endsWith('.location.json'))
      .forEach((file) => {
        const definition = readJson(path.join(DEFINITIONS_DIR, file));
        const components = definition?.components ?? {};

        if ('movement:exits' in components) {
          invalidFiles.push(file);
        }
        if (!('locations:exits' in components)) {
          missingFiles.push(file);
        }
      });

    expect(invalidFiles).toEqual([]);
    expect(missingFiles).toEqual([]);
  });
});
