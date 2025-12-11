import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import path from 'path';
import fs from 'fs';

describe('Anatomy Creatures (dredgers dependency) - Toad Tympanum Entity Loading', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('toad_tympanum entity', () => {
    const loadEntity = () => {
      const entityPath = path.resolve(
        process.cwd(),
        'data/mods/anatomy-creatures/entities/definitions/toad_tympanum.entity.json'
      );
      return JSON.parse(fs.readFileSync(entityPath, 'utf8'));
    };

    it('should load with all required components', () => {
      const entityDef = loadEntity();

      expect(entityDef.id).toBe('anatomy-creatures:toad_tympanum');
      expect(entityDef.components['anatomy:part']).toBeDefined();
      expect(entityDef.components['anatomy:part_health']).toBeDefined();
      expect(entityDef.components['core:name']).toBeDefined();
      expect(entityDef.components['core:weight']).toBeDefined();
      expect(entityDef.components['descriptors:size_category']).toBeDefined();
      expect(entityDef.components['descriptors:shape_general']).toBeDefined();
      expect(entityDef.components['descriptors:texture']).toBeDefined();
    });

    it('should set ear subType weights for anatomy:part', () => {
      const { components } = loadEntity();
      const part = components['anatomy:part'];

      expect(part.subType).toBe('ear');
      expect(part.hit_probability_weight).toBe(1);
      expect(part.health_calculation_weight).toBe(1);
    });

    it('should have healthy initial state with correct health values', () => {
      const { components } = loadEntity();
      const health = components['anatomy:part_health'];

      expect(health.currentHealth).toBe(3);
      expect(health.maxHealth).toBe(3);
      expect(health.state).toBe('healthy');
    });

    it('should have amphibian tympanum descriptors (medium, circular, smooth)', () => {
      const { components } = loadEntity();

      expect(components['descriptors:size_category'].size).toBe('medium');
      expect(components['descriptors:shape_general'].shape).toBe('circular');
      expect(components['descriptors:texture'].texture).toBe('smooth');
    });

    it('should have descriptive name and weight', () => {
      const { components } = loadEntity();

      expect(components['core:name'].text).toBe('tympanum');
      expect(components['core:weight'].weight).toBe(0.005);
    });

    it('should have valid JSON schema reference', () => {
      const entityDef = loadEntity();

      expect(entityDef.$schema).toBe(
        'schema://living-narrative-engine/entity-definition.schema.json'
      );
    });
  });

  describe('shape_general component enum', () => {
    it('should include \"circular\" as a valid general shape', () => {
      const componentPath = path.resolve(
        process.cwd(),
        'data/mods/descriptors/components/shape_general.component.json'
      );
      const component = JSON.parse(fs.readFileSync(componentPath, 'utf8'));

      const shapes = component.dataSchema.properties.shape.enum;
      expect(shapes).toContain('circular');
    });
  });
});
