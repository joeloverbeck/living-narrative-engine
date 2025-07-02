/**
 * @file Tests for anatomy entity consistency and structure
 */

import {
  describe,
  it,
  expect,
  beforeAll,
} from '@jest/globals';
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
    const entityFiles = files.filter(f => f.endsWith('.entity.json'));
    
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
      anatomyEntities.forEach(({ filename, data }) => {
        expect(data.components).toHaveProperty('core:name');
        expect(data.components['core:name']).toHaveProperty('text');
        expect(typeof data.components['core:name'].text).toBe('string');
      });
    });

    it('all anatomy part entities should have anatomy:part component', () => {
      const partEntities = anatomyEntities.filter(({ data }) => 
        data.components['anatomy:part']
      );
      
      expect(partEntities.length).toBeGreaterThan(0);
      
      partEntities.forEach(({ filename, data }) => {
        expect(data.components['anatomy:part']).toHaveProperty('subType');
        expect(typeof data.components['anatomy:part'].subType).toBe('string');
      });
    });
  });

  describe('Shape validation consistency', () => {
    const validShapes = ['round', 'square', 'oval', 'elongated', 'angular', 'curved'];
    
    it('all entities with shape_general should use valid shapes', () => {
      const entitiesWithShape = anatomyEntities.filter(({ data }) =>
        data.components['descriptors:shape_general']
      );
      
      expect(entitiesWithShape.length).toBeGreaterThan(0);
      
      entitiesWithShape.forEach(({ filename, data }) => {
        const shape = data.components['descriptors:shape_general'].shape;
        expect(validShapes).toContain(shape);
      });
    });

    it('human_hand should have square shape', () => {
      const humanHand = anatomyEntities.find(({ filename }) => 
        filename === 'human_hand.entity.json'
      );
      
      expect(humanHand).toBeDefined();
      expect(humanHand.data.components['descriptors:shape_general']).toEqual({
        shape: 'square',
      });
    });
  });

  describe('Entity ID consistency', () => {
    it('all entities should have properly formatted IDs', () => {
      anatomyEntities.forEach(({ filename, data }) => {
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

  describe('Size category validation', () => {
    const validSizes = ['tiny', 'small', 'medium', 'large', 'huge'];
    
    it('entities with size_category should use valid sizes', () => {
      const entitiesWithSize = anatomyEntities.filter(({ data }) =>
        data.components['descriptors:size_category']
      );
      
      entitiesWithSize.forEach(({ filename, data }) => {
        const size = data.components['descriptors:size_category'].size;
        expect(validSizes).toContain(size);
      });
    });
  });

  describe('Schema compliance', () => {
    it('all entities should reference the correct schema', () => {
      anatomyEntities.forEach(({ filename, data }) => {
        expect(data.$schema).toBe(
          'http://example.com/schemas/entity-definition.schema.json'
        );
      });
    });

    it('all entities should have required fields', () => {
      anatomyEntities.forEach(({ filename, data }) => {
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('components');
        expect(Object.keys(data.components).length).toBeGreaterThan(0);
      });
    });
  });
});