// tests/schemas/core-manifest.test.js
// -----------------------------------------------------------------------------
// Contract test to certify that the 'core' mod's manifest is always valid.
// This test acts as a safeguard against accidental schema violations in the
// game's most critical mod definition file.
// -----------------------------------------------------------------------------

import { describe, test, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// --- Schemas & Manifest to be tested ---

// The schema that the manifest must adhere to.
import modManifestSchema from '../../../data/schemas/mod-manifest.schema.json';

// Schemas that modManifestSchema depends on ($ref).
import commonSchema from '../../../data/schemas/common.schema.json';

// The specific file we are certifying.
import coreManifest from '../../../data/mods/core/mod-manifest.json';

describe('Schema Certification – Core Mod Manifest', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv); // For formats like 'uri'

    // It's crucial to add all schemas that are referenced via '$ref'
    // so that the validator can resolve them.
    ajv.addSchema(
      commonSchema,
      'http://example.com/schemas/common.schema.json'
    );

    // Compile the main schema we want to test against.
    validate = ajv.compile(modManifestSchema);
  });

  /**
   * This test ensures that the foundational 'core' mod manifest strictly
   * adheres to the official schema. Any failure here indicates a critical
   * issue that must be fixed before proceeding.
   */
  test('✓ core/mod-manifest.json must be valid', () => {
    const isManifestValid = validate(coreManifest);

    // Provide detailed error output upon failure to simplify debugging.
    if (!isManifestValid) {
      console.error(
        'CRITICAL: The core mod manifest failed schema validation. Errors:',
        JSON.stringify(validate.errors, null, 2)
      );
    }

    expect(isManifestValid).toBe(true);
  });
});
