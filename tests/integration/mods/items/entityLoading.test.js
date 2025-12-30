import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import path from 'path';
import fs from 'fs';

describe('Reading - Entity Loading', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should load letter entity with all required components', () => {
    // Load the entity definition file directly
    const entityPath = path.resolve(
      process.cwd(),
      'data/mods/reading/entities/definitions/letter_to_sheriff.entity.json'
    );
    const entityDef = JSON.parse(fs.readFileSync(entityPath, 'utf8'));

    // Verify entity structure
    expect(entityDef.id).toBe('items:letter_to_sheriff');
    expect(entityDef.components['core:name']).toBeDefined();
    expect(entityDef.components['core:description']).toBeDefined();
    expect(entityDef.components['items-core:item']).toBeDefined();
    expect(entityDef.components['items-core:portable']).toBeDefined();
    expect(entityDef.components['core:weight']).toBeDefined();

    // Verify component data
    const weight = entityDef.components['core:weight'];
    expect(weight.weight).toBe(0.05);
  });

  it('should validate reading entities are listed in manifest', () => {
    const manifestPath = path.resolve(
      process.cwd(),
      'data/mods/reading/mod-manifest.json'
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    const entityFiles = ['letter_to_sheriff.entity.json'];

    entityFiles.forEach((filename) => {
      expect(manifest.content.entities.definitions).toContain(filename);
    });

    entityFiles.forEach((filename) => {
      const entityPath = path.resolve(
        process.cwd(),
        `data/mods/reading/entities/definitions/${filename}`
      );
      expect(fs.existsSync(entityPath)).toBe(true);
    });
  });
});
