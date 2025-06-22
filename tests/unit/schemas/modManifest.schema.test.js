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
      'http://example.com/schemas/common.schema.json'
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
          ui: [],
          worlds: [],
        },
      };
      const ok = validate(manifestWithEmptyContent);
      if (!ok) console.error(validate.errors);
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

    test('✗ should NOT validate file paths that contain ".."', () => {
      const invalidManifest = {
        ...validIsekaiManifest,
        content: {
          ...validIsekaiManifest.content,
          ui: ['../another_mod/data.json'], // Contains ".."
        },
      };
      expect(validate(invalidManifest)).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/content/ui/0',
          message: 'must match pattern "^(?!/)(?!.*\\.\\.)[^\\s]+\\.json$"',
        })
      );
    });
  });
});
