import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import path from 'path';
import fs from 'fs';

describe('Items - Entity Loading', () => {
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
      'data/mods/items/entities/definitions/letter_to_sheriff.entity.json'
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

  it('should load revolver entity with correct properties', () => {
    const entityPath = path.resolve(
      process.cwd(),
      'data/mods/items/entities/definitions/revolver.entity.json'
    );
    const entityDef = JSON.parse(fs.readFileSync(entityPath, 'utf8'));

    expect(entityDef.id).toBe('items:revolver');
    const weight = entityDef.components['core:weight'];
    expect(weight.weight).toBe(1.2);
  });

  it('should load antiseptic bottle with disinfectant liquid tagging', () => {
    const entityPath = path.resolve(
      process.cwd(),
      'data/mods/items/entities/definitions/antiseptic_bottle.entity.json'
    );
    const entityDef = JSON.parse(fs.readFileSync(entityPath, 'utf8'));

    expect(entityDef.id).toBe('items:antiseptic_bottle');
    const container = entityDef.components['containers-core:liquid_container'];
    expect(container).toBeDefined();
    expect(container.currentVolumeMilliliters).toBeGreaterThan(0);
    expect(container.tags).toContain('disinfectant');
  });

  it('should load gold bar as heavy item', () => {
    const entityPath = path.resolve(
      process.cwd(),
      'data/mods/items/entities/definitions/gold_bar.entity.json'
    );
    const entityDef = JSON.parse(fs.readFileSync(entityPath, 'utf8'));

    expect(entityDef.id).toBe('items:gold_bar');
    const weight = entityDef.components['core:weight'];
    expect(weight.weight).toBe(12.4);
    expect(weight.weight).toBeGreaterThan(10); // Heavy item threshold
  });

  it('should validate all entity files exist and are listed in manifest', () => {
    const manifestPath = path.resolve(
      process.cwd(),
      'data/mods/items/mod-manifest.json'
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    const entityFiles = [
      'antiseptic_bottle.entity.json',
      'letter_to_sheriff.entity.json',
      'revolver.entity.json',
      'gold_bar.entity.json',
    ];

    // Verify all entities are listed in manifest
    entityFiles.forEach((filename) => {
      expect(manifest.content.entities.definitions).toContain(filename);
    });

    // Verify all entity files exist
    entityFiles.forEach((filename) => {
      const entityPath = path.resolve(
        process.cwd(),
        `data/mods/items/entities/definitions/${filename}`
      );
      expect(fs.existsSync(entityPath)).toBe(true);
    });
  });
});
