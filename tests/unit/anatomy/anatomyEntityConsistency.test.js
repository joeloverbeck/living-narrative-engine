/**
 * @file Tests for anatomy entity consistency and structure
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';

describe('Anatomy Entity Consistency', () => {
  let anatomyEntities = [];
  const anatomyEntitiesPath = path.join(
    process.cwd(),
    'data/mods/anatomy/entities/definitions'
  );

  beforeAll(async () => {
    // Load all anatomy entity files
    const files = await fs.readdir(anatomyEntitiesPath);
    const entityFiles = files.filter((f) => f.endsWith('.entity.json'));

    for (const file of entityFiles) {
      const content = await fs.readFile(
        path.join(anatomyEntitiesPath, file),
        'utf-8'
      );
      anatomyEntities.push({
        filename: file,
        data: JSON.parse(content),
      });
    }
  });

  describe('Required components', () => {
    it('should have all anatomy entities loaded', () => {
      expect(anatomyEntities.length).toBeGreaterThan(0);
    });

    it('all anatomy entities should have core:name component', () => {
      anatomyEntities.forEach(({ data }) => {
        expect(data.components).toHaveProperty('core:name');
        expect(data.components['core:name']).toHaveProperty('text');
        expect(typeof data.components['core:name'].text).toBe('string');
      });
    });

    it('all anatomy part entities should have anatomy:part component', () => {
      const partEntities = anatomyEntities.filter(
        ({ data }) => data.components['anatomy:part']
      );

      expect(partEntities.length).toBeGreaterThan(0);

      partEntities.forEach(({ data }) => {
        expect(data.components['anatomy:part']).toHaveProperty('subType');
        expect(typeof data.components['anatomy:part'].subType).toBe('string');
      });
    });
  });

  describe('Entity ID consistency', () => {
    it('all entities should have properly formatted IDs', () => {
      anatomyEntities.forEach(({ data }) => {
        expect(data.id).toMatch(/^anatomy:[a-zA-Z][a-zA-Z0-9_]*$/);
        expect(data.id.startsWith('anatomy:')).toBe(true);
      });
    });

    it('entity IDs should match their filenames', () => {
      anatomyEntities.forEach(({ filename, data }) => {
        const expectedId = 'anatomy:' + filename.replace('.entity.json', '');
        expect(data.id).toBe(expectedId);
      });
    });
  });

  describe('Schema compliance', () => {
    it('all entities should reference the correct schema', () => {
      anatomyEntities.forEach(({ data }) => {
        expect(data.$schema).toBe(
          'http://example.com/schemas/entity-definition.schema.json'
        );
      });
    });

    it('all entities should have required fields', () => {
      anatomyEntities.forEach(({ data }) => {
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('components');
        expect(Object.keys(data.components).length).toBeGreaterThan(0);
      });
    });
  });
});
