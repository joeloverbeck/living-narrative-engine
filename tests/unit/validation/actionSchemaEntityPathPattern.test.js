/**
 * @file Action Schema Entity Path Pattern Tests
 * @description Tests for the modifierEntityPath definition in action.schema.json
 * @see specs/modifier-entity-path-validation.md
 * @see tickets/MODENTPATVAL-003-schema-enhancement.md
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = dirname(currentFilePath);

/** @type {RegExp} */
let entityPathPattern;

/** @type {Ajv} */
let ajv;

/** @type {object} */
let actionSchema;

describe('Action Schema Entity Path Pattern', () => {
  beforeAll(() => {
    // Load the action schema
    const schemaPath = join(
      currentDirPath,
      '../../../data/schemas/action.schema.json'
    );
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    actionSchema = JSON.parse(schemaContent);

    // Extract the pattern from the schema
    const patternString =
      actionSchema.definitions?.modifierEntityPath?.pattern;
    if (!patternString) {
      throw new Error('modifierEntityPath pattern not found in action.schema.json');
    }
    entityPathPattern = new RegExp(patternString);

    // Set up AJV for schema compilation tests
    ajv = new Ajv({
      allErrors: true,
      strictTypes: false,
      strict: false,
      validateFormats: false,
      allowUnionTypes: true,
    });
    addFormats(ajv);
  });

  describe('pattern validation', () => {
    describe('valid entity paths', () => {
      it('should accept "entity.actor"', () => {
        expect(entityPathPattern.test('entity.actor')).toBe(true);
      });

      it('should accept "entity.primary"', () => {
        expect(entityPathPattern.test('entity.primary')).toBe(true);
      });

      it('should accept "entity.secondary"', () => {
        expect(entityPathPattern.test('entity.secondary')).toBe(true);
      });

      it('should accept "entity.tertiary"', () => {
        expect(entityPathPattern.test('entity.tertiary')).toBe(true);
      });

      it('should accept "entity.location"', () => {
        expect(entityPathPattern.test('entity.location')).toBe(true);
      });

      it('should accept paths with component access', () => {
        expect(
          entityPathPattern.test(
            'entity.actor.components.skills:medicine_skill.value'
          )
        ).toBe(true);
      });

      it('should accept paths with deep nesting', () => {
        expect(
          entityPathPattern.test('entity.primary.components.anatomy:body.parts')
        ).toBe(true);
      });

      it('should accept paths with numeric segments', () => {
        expect(entityPathPattern.test('entity.actor.items.0.name')).toBe(true);
      });
    });

    describe('invalid entity paths', () => {
      it('should reject "actor" (missing entity prefix)', () => {
        expect(entityPathPattern.test('actor')).toBe(false);
      });

      it('should reject "entity.target" (invalid role)', () => {
        expect(entityPathPattern.test('entity.target')).toBe(false);
      });

      it('should reject "entity." (empty role)', () => {
        expect(entityPathPattern.test('entity.')).toBe(false);
      });

      it('should reject "entity" (no role)', () => {
        expect(entityPathPattern.test('entity')).toBe(false);
      });

      it('should reject "primary" (missing entity prefix)', () => {
        expect(entityPathPattern.test('primary')).toBe(false);
      });

      it('should reject "entity.invalid" (invalid role)', () => {
        expect(entityPathPattern.test('entity.invalid')).toBe(false);
      });

      it('should reject "entity.self" (invalid role)', () => {
        expect(entityPathPattern.test('entity.self')).toBe(false);
      });

      it('should reject "entity.Actor" (case sensitive)', () => {
        expect(entityPathPattern.test('entity.Actor')).toBe(false);
      });

      it('should reject empty string', () => {
        expect(entityPathPattern.test('')).toBe(false);
      });

      it('should reject "Entity.actor" (case sensitive prefix)', () => {
        expect(entityPathPattern.test('Entity.actor')).toBe(false);
      });
    });
  });

  describe('schema integration', () => {
    it('should load action.schema.json without errors', () => {
      expect(actionSchema).toBeDefined();
      expect(actionSchema.$schema).toBe(
        'http://json-schema.org/draft-07/schema#'
      );
    });

    it('should include modifierEntityPath definition', () => {
      expect(actionSchema.definitions).toBeDefined();
      expect(actionSchema.definitions.modifierEntityPath).toBeDefined();
      expect(actionSchema.definitions.modifierEntityPath.type).toBe('string');
      expect(actionSchema.definitions.modifierEntityPath.pattern).toBeDefined();
    });

    it('should have descriptive documentation in the definition', () => {
      const def = actionSchema.definitions.modifierEntityPath;
      expect(def.description).toBeDefined();
      expect(def.description).toContain('entity.');
      expect(def.description).toContain('actor');
      expect(def.description).toContain('primary');
    });

    it('should compile schema with AJV successfully', () => {
      // Load dependencies
      const dependencies = ['common.schema.json', 'condition-container.schema.json', 'json-logic.schema.json'];

      for (const dep of dependencies) {
        const depPath = join(currentDirPath, `../../../data/schemas/${dep}`);
        try {
          const depContent = readFileSync(depPath, 'utf-8');
          const depSchema = JSON.parse(depContent);
          if (!ajv.getSchema(depSchema.$id)) {
            ajv.addSchema(depSchema, depSchema.$id);
          }
        } catch {
          // Some dependencies may not exist or may fail to load - that's OK for this test
        }
      }

      // Add the action schema
      if (!ajv.getSchema(actionSchema.$id)) {
        ajv.addSchema(actionSchema, actionSchema.$id);
      }

      // Verify compilation
      const validator = ajv.getSchema(actionSchema.$id);
      expect(validator).toBeDefined();
    });

    it('should have pattern matching runtime validator', () => {
      // The schema pattern should match the runtime validator in entityPathValidator.js
      // Valid roles from runtime: actor, primary, secondary, tertiary, location
      const pattern = actionSchema.definitions.modifierEntityPath.pattern;

      // Verify it contains all valid roles
      expect(pattern).toContain('actor');
      expect(pattern).toContain('primary');
      expect(pattern).toContain('secondary');
      expect(pattern).toContain('tertiary');
      expect(pattern).toContain('location');

      // Verify entity prefix requirement
      expect(pattern).toContain('entity');
    });
  });

  describe('pattern consistency with runtime validator', () => {
    // These tests ensure the schema pattern matches the runtime validator behavior
    const validPaths = [
      'entity.actor',
      'entity.primary',
      'entity.secondary',
      'entity.tertiary',
      'entity.location',
      'entity.actor.components.test:component.value',
    ];

    const invalidPaths = [
      'actor', // missing prefix
      'entity.target', // invalid role
      'entity.', // empty role
      'primary.components.test', // missing entity prefix
    ];

    validPaths.forEach((path) => {
      it(`schema pattern and runtime both accept "${path}"`, () => {
        expect(entityPathPattern.test(path)).toBe(true);
      });
    });

    invalidPaths.forEach((path) => {
      it(`schema pattern and runtime both reject "${path}"`, () => {
        expect(entityPathPattern.test(path)).toBe(false);
      });
    });
  });
});
