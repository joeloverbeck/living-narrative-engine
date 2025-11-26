// tests/unit/schemas/modManifest.schema.test.js
// -----------------------------------------------------------------------------
// Contract tests for the mod-manifest.schema.json.
// Ensures that mod manifest files conform to the defined schema structure.
// -----------------------------------------------------------------------------

import { describe, test, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Import the schemas and a valid fixture
import modManifestSchema from '../../../data/schemas/mod-manifest.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import validIsekaiManifest from '../../../data/mods/isekai/mod-manifest.json'; // Assuming the corrected isekai manifest is here

describe('JSON-Schema – Mod Manifest', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv); // For formats like 'uri'

    // Add dependent schemas so AJV can resolve $ref pointers
    ajv.addSchema(
      commonSchema,
      'schema://living-narrative-engine/common.schema.json'
    );

    // Compile the main schema to be tested
    validate = ajv.compile(modManifestSchema);
  });

  /* ── VALID CASES ──────────────────────────────────────────────────────── */

  describe('Valid Manifests', () => {
    test('✓ should validate the complete and correct "isekai" mod manifest', () => {
      const ok = validate(validIsekaiManifest);
      if (!ok) {
        console.error('Validation Errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('✓ should validate a minimal manifest with only required properties', () => {
      const minimalManifest = {
        id: 'minimal_mod',
        version: '0.1.0',
        name: 'Minimal Mod',
      };
      const ok = validate(minimalManifest);
      if (!ok) {
        console.error('Validation Errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('✓ should validate with empty content categories', () => {
      const manifestWithEmptyContent = {
        ...validIsekaiManifest,
        content: {
          actions: [],
          components: [],
          conditions: [],
          entities: {
            definitions: [],
            instances: [],
          },
          events: [],
          macros: [],
          portraits: [],
          rules: [],
          worlds: [],
        },
      };
      const ok = validate(manifestWithEmptyContent);
      if (!ok) console.error(validate.errors);
      expect(ok).toBe(true);
    });

    test('✓ should validate with goals content type', () => {
      const manifestWithGoals = {
        id: 'test_mod',
        version: '1.0.0',
        name: 'Test Mod',
        content: {
          goals: [
            'goals/find_food.goal.json',
            'goals/rest_safely.goal.json',
            'goals/defeat_enemy.goal.json',
          ],
        },
      };
      const ok = validate(manifestWithGoals);
      if (!ok) {
        console.error('Validation Errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('✓ should validate with refinement-methods content type', () => {
      const manifestWithRefinementMethods = {
        id: 'tasks_mod',
        version: '2.0.0',
        name: 'Tasks Mod',
        content: {
          'refinement-methods': [
            'refinement-methods/consume_nourishing_item.simple_consume.refinement.json',
            'refinement-methods/arm_self.draw_from_inventory.refinement.json',
          ],
        },
      };
      const ok = validate(manifestWithRefinementMethods);
      if (!ok) {
        console.error('Validation Errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('✓ should validate with actionPurpose and actionConsiderWhen properties', () => {
      const manifestWithActionMetadata = {
        id: 'positioning_mod',
        version: '1.0.0',
        name: 'Positioning Mod',
        actionPurpose: 'Actions for character positioning and movement in physical space.',
        actionConsiderWhen: 'When characters need to move, sit, stand, or change positions.',
      };
      const ok = validate(manifestWithActionMetadata);
      if (!ok) {
        console.error('Validation Errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('✓ should validate without actionPurpose and actionConsiderWhen (optional properties)', () => {
      const manifestWithoutActionMetadata = {
        id: 'simple_mod',
        version: '1.0.0',
        name: 'Simple Mod',
      };
      const ok = validate(manifestWithoutActionMetadata);
      if (!ok) {
        console.error('Validation Errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });
  });

  /* ── INVALID CASES ────────────────────────────────────────────────────── */

  describe('Invalid Manifests', () => {
    test('✗ should NOT validate if required "id" property is missing', () => {
      const invalidManifest = { ...validIsekaiManifest };
      delete invalidManifest.id;
      expect(validate(invalidManifest)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: "must have required property 'id'",
        })
      );
    });

    test('✗ should NOT validate if required "version" property is missing', () => {
      const invalidManifest = { ...validIsekaiManifest };
      delete invalidManifest.version;
      expect(validate(invalidManifest)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: "must have required property 'version'",
        })
      );
    });

    test('✗ should NOT validate an unknown property at the root level', () => {
      const invalidManifest = {
        ...validIsekaiManifest,
        unknownProperty: 'should_fail',
      };
      expect(validate(invalidManifest)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: 'must NOT have additional properties',
          params: { additionalProperty: 'unknownProperty' },
        })
      );
    });

    test('✗ should NOT validate an unknown property in the "content" object', () => {
      const invalidManifest = {
        ...validIsekaiManifest,
        content: {
          ...validIsekaiManifest.content,
          sounds: ['sound/theme.mp3'], // Not a valid content category
        },
      };
      expect(validate(invalidManifest)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/content',
          message: 'must NOT have additional properties',
          params: { additionalProperty: 'sounds' },
        })
      );
    });

    test('✗ should NOT validate an unknown property in the "content.entities" object', () => {
      const invalidManifest = {
        ...validIsekaiManifest,
        content: {
          ...validIsekaiManifest.content,
          entities: {
            definitions: [],
            instances: [],
            models: ['3d/hero.glb'], // Not a valid entities sub-category
          },
        },
      };
      expect(validate(invalidManifest)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/content/entities',
          message: 'must NOT have additional properties',
          params: { additionalProperty: 'models' },
        })
      );
    });

    test('✗ should NOT validate file paths that are not valid relative paths', () => {
      const invalidManifest = {
        ...validIsekaiManifest,
        content: {
          ...validIsekaiManifest.content,
          worlds: ['/absolute/path/world.json'], // Starts with a slash
        },
      };
      expect(validate(invalidManifest)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/content/worlds/0',
          message: 'must match pattern "^(?!/)(?!.*\\.\\.)[^\\s]+\\.json$"',
        })
      );
    });

    test('✗ should NOT validate refinement-method entries without .refinement.json extension', () => {
      const invalidManifest = {
        id: 'broken_mod',
        version: '0.0.1',
        name: 'Broken Mod',
        content: {
          'refinement-methods': ['refinement-methods/invalid_file.json'],
        },
      };
      expect(validate(invalidManifest)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/content/refinement-methods/0',
          message: 'must match pattern "^(?!/)(?!.*\\.\\.)[^\\s]+\\.refinement\\.json$"',
        })
      );
    });

    test('✗ should NOT validate file paths that contain ".."', () => {
      const invalidManifest = {
        ...validIsekaiManifest,
        content: {
          ...validIsekaiManifest.content,
          portraits: ['../another_mod/portrait.png'], // Contains ".."
        },
      };
      expect(validate(invalidManifest)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/content/portraits/0',
          message: 'must match pattern "^(?!/)(?!.*\\.\\.)[^\\s]+\\.(png|jpg|jpeg|gif|webp|svg|bmp)$"',
        })
      );
    });

    test('✗ should NOT validate actionPurpose that is too short (< 10 chars)', () => {
      const invalidManifest = {
        id: 'test_mod',
        version: '1.0.0',
        name: 'Test Mod',
        actionPurpose: 'Too short', // Only 9 characters
      };
      expect(validate(invalidManifest)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/actionPurpose',
          message: 'must NOT have fewer than 10 characters',
        })
      );
    });

    test('✗ should NOT validate actionConsiderWhen that is too short (< 10 chars)', () => {
      const invalidManifest = {
        id: 'test_mod',
        version: '1.0.0',
        name: 'Test Mod',
        actionConsiderWhen: 'Short', // Only 5 characters
      };
      expect(validate(invalidManifest)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/actionConsiderWhen',
          message: 'must NOT have fewer than 10 characters',
        })
      );
    });

    test('✗ should NOT validate actionPurpose that is too long (> 200 chars)', () => {
      const invalidManifest = {
        id: 'test_mod',
        version: '1.0.0',
        name: 'Test Mod',
        actionPurpose: 'A'.repeat(201), // 201 characters
      };
      expect(validate(invalidManifest)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/actionPurpose',
          message: 'must NOT have more than 200 characters',
        })
      );
    });

    test('✗ should NOT validate actionConsiderWhen that is too long (> 200 chars)', () => {
      const invalidManifest = {
        id: 'test_mod',
        version: '1.0.0',
        name: 'Test Mod',
        actionConsiderWhen: 'B'.repeat(201), // 201 characters
      };
      expect(validate(invalidManifest)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/actionConsiderWhen',
          message: 'must NOT have more than 200 characters',
        })
      );
    });

    test('✗ should NOT validate actionPurpose with wrong type', () => {
      const invalidManifest = {
        id: 'test_mod',
        version: '1.0.0',
        name: 'Test Mod',
        actionPurpose: 12345, // Not a string
      };
      expect(validate(invalidManifest)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/actionPurpose',
          message: 'must be string',
        })
      );
    });
  });
});
