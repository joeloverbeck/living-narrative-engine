import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import path from 'path';
import fs from 'fs';

describe('Intoxicants - Entity Loading', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('jug_of_ale entity', () => {
    it('should load jug_of_ale with all required components', () => {
      const entityPath = path.resolve(
        process.cwd(),
        'data/mods/intoxicants/entities/definitions/jug_of_ale.entity.json'
      );
      const entityDef = JSON.parse(fs.readFileSync(entityPath, 'utf8'));

      expect(entityDef.id).toBe('intoxicants:jug_of_ale');
      expect(entityDef.components['core:name']).toBeDefined();
      expect(entityDef.components['core:description']).toBeDefined();
      expect(entityDef.components['items:item']).toBeDefined();
      expect(entityDef.components['items:portable']).toBeDefined();
      expect(entityDef.components['core:weight']).toBeDefined();
      expect(entityDef.components['items:drinkable']).toBeDefined();
      expect(entityDef.components['containers-core:liquid_container']).toBeDefined();
    });

    it('should have correct weight and liquid container properties', () => {
      const entityPath = path.resolve(
        process.cwd(),
        'data/mods/intoxicants/entities/definitions/jug_of_ale.entity.json'
      );
      const entityDef = JSON.parse(fs.readFileSync(entityPath, 'utf8'));

      const weight = entityDef.components['core:weight'];
      expect(weight.weight).toBe(1.2);

      const container = entityDef.components['containers-core:liquid_container'];
      expect(container.currentVolumeMilliliters).toBe(1000);
      expect(container.maxCapacityMilliliters).toBe(1000);
      expect(container.servingSizeMilliliters).toBe(200);
      expect(container.isRefillable).toBe(true);
    });

  });

  describe('jug_of_cider entity', () => {
    it('should load jug_of_cider with all required components', () => {
      const entityPath = path.resolve(
        process.cwd(),
        'data/mods/intoxicants/entities/definitions/jug_of_cider.entity.json'
      );
      const entityDef = JSON.parse(fs.readFileSync(entityPath, 'utf8'));

      expect(entityDef.id).toBe('intoxicants:jug_of_cider');
      expect(entityDef.components['core:name']).toBeDefined();
      expect(entityDef.components['core:description']).toBeDefined();
      expect(entityDef.components['items:item']).toBeDefined();
      expect(entityDef.components['items:portable']).toBeDefined();
      expect(entityDef.components['core:weight']).toBeDefined();
      expect(entityDef.components['items:drinkable']).toBeDefined();
      expect(entityDef.components['containers-core:liquid_container']).toBeDefined();
    });
  });

  describe('jug_of_mead entity', () => {
    it('should load jug_of_mead with all required components', () => {
      const entityPath = path.resolve(
        process.cwd(),
        'data/mods/intoxicants/entities/definitions/jug_of_mead.entity.json'
      );
      const entityDef = JSON.parse(fs.readFileSync(entityPath, 'utf8'));

      expect(entityDef.id).toBe('intoxicants:jug_of_mead');
      expect(entityDef.components['core:name']).toBeDefined();
      expect(entityDef.components['core:description']).toBeDefined();
      expect(entityDef.components['items:item']).toBeDefined();
      expect(entityDef.components['items:portable']).toBeDefined();
      expect(entityDef.components['core:weight']).toBeDefined();
      expect(entityDef.components['items:drinkable']).toBeDefined();
      expect(entityDef.components['containers-core:liquid_container']).toBeDefined();
    });

    it('should be slightly heavier than other jugs', () => {
      const entityPath = path.resolve(
        process.cwd(),
        'data/mods/intoxicants/entities/definitions/jug_of_mead.entity.json'
      );
      const entityDef = JSON.parse(fs.readFileSync(entityPath, 'utf8'));

      const weight = entityDef.components['core:weight'];
      expect(weight.weight).toBe(1.3);
    });
  });

  describe('mod manifest validation', () => {
    it('should have all entity files listed in manifest', () => {
      const manifestPath = path.resolve(
        process.cwd(),
        'data/mods/intoxicants/mod-manifest.json'
      );
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      const expectedEntities = [
        'jug_of_ale.entity.json',
        'jug_of_cider.entity.json',
        'jug_of_mead.entity.json',
      ];

      expectedEntities.forEach((filename) => {
        expect(manifest.content.entities.definitions).toContain(filename);
      });
    });

    it('should have all entity files exist on disk', () => {
      const entityFiles = [
        'jug_of_ale.entity.json',
        'jug_of_cider.entity.json',
        'jug_of_mead.entity.json',
      ];

      entityFiles.forEach((filename) => {
        const entityPath = path.resolve(
          process.cwd(),
          `data/mods/intoxicants/entities/definitions/${filename}`
        );
        expect(fs.existsSync(entityPath)).toBe(true);
      });
    });

    it('should have valid mod dependencies', () => {
      const manifestPath = path.resolve(
        process.cwd(),
        'data/mods/intoxicants/mod-manifest.json'
      );
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      const depIds = manifest.dependencies.map((dep) => dep.id);
      expect(depIds).toContain('core');
      expect(depIds).toContain('items');
    });
  });
});
