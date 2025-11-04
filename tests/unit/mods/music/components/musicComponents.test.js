/**
 * @file Unit tests for music mod component schemas
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const testFilePath = fileURLToPath(import.meta.url);
const testDir = path.dirname(testFilePath);

describe('Music Mod Components - Schema Validation', () => {
  let ajv;
  let componentSchema;

  beforeAll(() => {
    ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);

    // Load the component schema
    const componentSchemaPath = path.resolve(
      testDir,
      '../../../../../data/schemas/component.schema.json'
    );
    componentSchema = JSON.parse(readFileSync(componentSchemaPath, 'utf8'));
    ajv.addSchema(componentSchema, 'schema://living-narrative-engine/component.schema.json');
  });

  describe('is_musician.component.json', () => {
    let component;

    beforeAll(() => {
      const componentPath = path.resolve(
        testDir,
        '../../../../../data/mods/music/components/is_musician.component.json'
      );
      component = JSON.parse(readFileSync(componentPath, 'utf8'));
    });

    it('should be a valid component schema', () => {
      const validate = ajv.getSchema('schema://living-narrative-engine/component.schema.json');
      const valid = validate(component);
      expect(valid).toBe(true);
    });

    it('should have correct id', () => {
      expect(component.id).toBe('music:is_musician');
    });

    it('should have a description', () => {
      expect(component.description).toBeDefined();
      expect(typeof component.description).toBe('string');
      expect(component.description.length).toBeGreaterThan(0);
    });

    it('should be a marker component with no properties', () => {
      expect(component.dataSchema.type).toBe('object');
      expect(component.dataSchema.properties).toEqual({});
      expect(component.dataSchema.additionalProperties).toBe(false);
    });
  });

  describe('is_instrument.component.json', () => {
    let component;

    beforeAll(() => {
      const componentPath = path.resolve(
        testDir,
        '../../../../../data/mods/music/components/is_instrument.component.json'
      );
      component = JSON.parse(readFileSync(componentPath, 'utf8'));
    });

    it('should be a valid component schema', () => {
      const validate = ajv.getSchema('schema://living-narrative-engine/component.schema.json');
      const valid = validate(component);
      expect(valid).toBe(true);
    });

    it('should have correct id', () => {
      expect(component.id).toBe('music:is_instrument');
    });

    it('should have a description', () => {
      expect(component.description).toBeDefined();
      expect(typeof component.description).toBe('string');
      expect(component.description.length).toBeGreaterThan(0);
    });

    it('should be a marker component with no properties', () => {
      expect(component.dataSchema.type).toBe('object');
      expect(component.dataSchema.properties).toEqual({});
      expect(component.dataSchema.additionalProperties).toBe(false);
    });
  });

  describe('playing_music.component.json', () => {
    let component;
    let dataValidator;

    beforeAll(() => {
      const componentPath = path.resolve(
        testDir,
        '../../../../../data/mods/music/components/playing_music.component.json'
      );
      component = JSON.parse(readFileSync(componentPath, 'utf8'));
      dataValidator = ajv.compile(component.dataSchema);
    });

    it('should be a valid component schema', () => {
      const validate = ajv.getSchema('schema://living-narrative-engine/component.schema.json');
      const valid = validate(component);
      expect(valid).toBe(true);
    });

    it('should have correct id', () => {
      expect(component.id).toBe('music:playing_music');
    });

    it('should have a description', () => {
      expect(component.description).toBeDefined();
      expect(typeof component.description).toBe('string');
      expect(component.description.length).toBeGreaterThan(0);
    });

    it('should require playing_on property', () => {
      expect(component.dataSchema.required).toContain('playing_on');
    });

    it('should validate correct playing_on entity ID', () => {
      const validData = {
        playing_on: 'instrument:guitar_001',
      };
      const valid = dataValidator(validData);
      expect(valid).toBe(true);
    });

    it('should validate simple entity IDs without namespace', () => {
      const validData = {
        playing_on: 'guitar001',
      };
      const valid = dataValidator(validData);
      expect(valid).toBe(true);
    });

    it('should reject invalid entity ID format', () => {
      const invalidData = {
        playing_on: 'invalid@entity#id',
      };
      const valid = dataValidator(invalidData);
      expect(valid).toBe(false);
    });

    it('should reject missing playing_on property', () => {
      const invalidData = {};
      const valid = dataValidator(invalidData);
      expect(valid).toBe(false);
    });

    it('should have activityMetadata property', () => {
      expect(component.dataSchema.properties.activityMetadata).toBeDefined();
      expect(component.dataSchema.properties.activityMetadata.type).toBe('object');
    });

    it('should have correct activityMetadata structure', () => {
      const metadata = component.dataSchema.properties.activityMetadata.properties;
      expect(metadata.shouldDescribeInActivity).toBeDefined();
      expect(metadata.template).toBeDefined();
      expect(metadata.targetRole).toBeDefined();
      expect(metadata.priority).toBeDefined();
    });

    it('should have priority value of 70', () => {
      const priority = component.dataSchema.properties.activityMetadata.properties.priority;
      expect(priority.default).toBe(70);
      expect(priority.minimum).toBe(0);
      expect(priority.maximum).toBe(100);
    });

    it('should accept valid data with activityMetadata', () => {
      const validData = {
        playing_on: 'instrument:guitar_001',
        activityMetadata: {
          shouldDescribeInActivity: true,
          template: '{actor} is playing {target}',
          targetRole: 'playing_on',
          priority: 70,
        },
      };
      const valid = dataValidator(validData);
      expect(valid).toBe(true);
    });

    it('should reject additional properties', () => {
      const invalidData = {
        playing_on: 'instrument:guitar_001',
        extraProperty: 'not allowed',
      };
      const valid = dataValidator(invalidData);
      expect(valid).toBe(false);
    });
  });

  describe('performance_mood.component.json', () => {
    let component;
    let dataValidator;

    beforeAll(() => {
      const componentPath = path.resolve(
        testDir,
        '../../../../../data/mods/music/components/performance_mood.component.json'
      );
      component = JSON.parse(readFileSync(componentPath, 'utf8'));
      dataValidator = ajv.compile(component.dataSchema);
    });

    it('should be a valid component schema', () => {
      const validate = ajv.getSchema('schema://living-narrative-engine/component.schema.json');
      const valid = validate(component);
      expect(valid).toBe(true);
    });

    it('should have correct id', () => {
      expect(component.id).toBe('music:performance_mood');
    });

    it('should have a description', () => {
      expect(component.description).toBeDefined();
      expect(typeof component.description).toBe('string');
      expect(component.description.length).toBeGreaterThan(0);
    });

    it('should require mood property', () => {
      expect(component.dataSchema.required).toContain('mood');
    });

    it('should have mood enum with 10 values', () => {
      const moodProperty = component.dataSchema.properties.mood;
      expect(moodProperty.enum).toBeDefined();
      expect(moodProperty.enum.length).toBe(10);
    });

    it('should validate all valid mood values', () => {
      const validMoods = [
        'cheerful',
        'solemn',
        'mournful',
        'eerie',
        'tense',
        'triumphant',
        'tender',
        'playful',
        'aggressive',
        'meditative',
      ];

      validMoods.forEach((mood) => {
        const validData = { mood };
        const valid = dataValidator(validData);
        expect(valid).toBe(true);
      });
    });

    it('should reject invalid mood value', () => {
      const invalidData = {
        mood: 'invalid_mood',
      };
      const valid = dataValidator(invalidData);
      expect(valid).toBe(false);
    });

    it('should reject missing mood property', () => {
      const invalidData = {};
      const valid = dataValidator(invalidData);
      expect(valid).toBe(false);
    });

    it('should have activityMetadata property', () => {
      expect(component.dataSchema.properties.activityMetadata).toBeDefined();
      expect(component.dataSchema.properties.activityMetadata.type).toBe('object');
    });

    it('should have correct activityMetadata structure', () => {
      const metadata = component.dataSchema.properties.activityMetadata.properties;
      expect(metadata.shouldDescribeInActivity).toBeDefined();
      expect(metadata.template).toBeDefined();
      expect(metadata.priority).toBeDefined();
    });

    it('should have priority value of 65', () => {
      const priority = component.dataSchema.properties.activityMetadata.properties.priority;
      expect(priority.default).toBe(65);
      expect(priority.minimum).toBe(0);
      expect(priority.maximum).toBe(100);
    });

    it('should accept valid data with activityMetadata', () => {
      const validData = {
        mood: 'cheerful',
        activityMetadata: {
          shouldDescribeInActivity: true,
          template: '{actor} performs with {mood} mood',
          priority: 65,
        },
      };
      const valid = dataValidator(validData);
      expect(valid).toBe(true);
    });

    it('should reject additional properties', () => {
      const invalidData = {
        mood: 'cheerful',
        extraProperty: 'not allowed',
      };
      const valid = dataValidator(invalidData);
      expect(valid).toBe(false);
    });
  });
});
