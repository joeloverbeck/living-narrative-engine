import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import path from 'path';
import fs from 'fs';

describe('Anatomy Creatures (dredgers dependency) - Toad Eye Entity Loading', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('toad_eye entity', () => {
    const toadEyePath = path.resolve(
      process.cwd(),
      'data/mods/anatomy-creatures/entities/definitions/toad_eye.entity.json'
    );

    it('should load toad_eye with all required components', () => {
      const entityDef = JSON.parse(fs.readFileSync(toadEyePath, 'utf8'));

      expect(entityDef.id).toBe('anatomy-creatures:toad_eye');
      expect(entityDef.components['anatomy:part']).toBeDefined();
      expect(entityDef.components['anatomy:part_health']).toBeDefined();
      expect(entityDef.components['core:name']).toBeDefined();
      expect(entityDef.components['core:weight']).toBeDefined();
      expect(entityDef.components['descriptors:size_category']).toBeDefined();
      expect(entityDef.components['descriptors:shape_eye']).toBeDefined();
      expect(entityDef.components['descriptors:texture']).toBeDefined();
    });

    it('should have correct anatomy:part properties for eye subType', () => {
      const entityDef = JSON.parse(fs.readFileSync(toadEyePath, 'utf8'));

      const part = entityDef.components['anatomy:part'];
      expect(part.subType).toBe('eye');
      expect(part.hit_probability_weight).toBe(2);
      expect(part.health_calculation_weight).toBe(3);
    });

    it('should have healthy initial state with correct health values', () => {
      const entityDef = JSON.parse(fs.readFileSync(toadEyePath, 'utf8'));

      const health = entityDef.components['anatomy:part_health'];
      expect(health.currentHealth).toBe(5);
      expect(health.maxHealth).toBe(5);
      expect(health.state).toBe('healthy');
    });

    it('should have toad-specific descriptors (large, bulging, smooth)', () => {
      const entityDef = JSON.parse(fs.readFileSync(toadEyePath, 'utf8'));

      expect(entityDef.components['descriptors:size_category'].size).toBe(
        'large'
      );
      expect(entityDef.components['descriptors:shape_eye'].shape).toBe(
        'bulging'
      );
      expect(entityDef.components['descriptors:texture'].texture).toBe(
        'smooth'
      );
    });

    it('should have descriptive name "bulging eye"', () => {
      const entityDef = JSON.parse(fs.readFileSync(toadEyePath, 'utf8'));

      expect(entityDef.components['core:name'].text).toBe('bulging eye');
    });

    it('should have appropriate weight for an eye (0.02 kg)', () => {
      const entityDef = JSON.parse(fs.readFileSync(toadEyePath, 'utf8'));

      expect(entityDef.components['core:weight'].weight).toBe(0.02);
    });

    it('should have valid JSON schema reference', () => {
      const entityDef = JSON.parse(fs.readFileSync(toadEyePath, 'utf8'));

      expect(entityDef.$schema).toBe(
        'schema://living-narrative-engine/entity-definition.schema.json'
      );
    });
  });

  describe('shape_eye component enum', () => {
    it('should include "bulging" as a valid eye shape', () => {
      const componentPath = path.resolve(
        process.cwd(),
        'data/mods/descriptors/components/shape_eye.component.json'
      );
      const component = JSON.parse(fs.readFileSync(componentPath, 'utf8'));

      const validShapes = component.dataSchema.properties.shape.enum;
      expect(validShapes).toContain('bulging');
    });

    it('should maintain alphabetical order in eye shape enum', () => {
      const componentPath = path.resolve(
        process.cwd(),
        'data/mods/descriptors/components/shape_eye.component.json'
      );
      const component = JSON.parse(fs.readFileSync(componentPath, 'utf8'));

      const shapes = component.dataSchema.properties.shape.enum;
      const sortedShapes = [...shapes].sort();
      expect(shapes).toEqual(sortedShapes);
    });
  });
});
