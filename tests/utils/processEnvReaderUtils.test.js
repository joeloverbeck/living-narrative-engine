// tests/utils/processEnvReader.test.js
// --- NEW FILE START ---

import { describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { ProcessEnvReader } from '../../src/utils/processEnvReaderUtils.js';

describe('ProcessEnvReader', () => {
  /** @type {ProcessEnvReader} */
  let reader;
  let originalEnv;

  beforeEach(() => {
    // Save the original process.env
    originalEnv = { ...process.env };
    reader = new ProcessEnvReader();
  });

  afterEach(() => {
    // Restore the original process.env to avoid test pollution
    process.env = originalEnv;
  });

  describe('getEnv method', () => {
    test('should retrieve an existing environment variable', () => {
      const varName = 'TEST_EXISTING_VAR';
      const varValue = 'test_value_123';
      process.env[varName] = varValue;

      expect(reader.getEnv(varName)).toBe(varValue);
    });

    test('should return undefined for a non-existent environment variable', () => {
      const varName = 'TEST_NON_EXISTENT_VAR';
      // Ensure it's not set (it shouldn't be from beforeEach, but defensive)
      delete process.env[varName];

      expect(reader.getEnv(varName)).toBeUndefined();
    });

    test('should retrieve an environment variable that has an empty string value', () => {
      const varName = 'TEST_EMPTY_STRING_VAR';
      const varValue = '';
      process.env[varName] = varValue;

      expect(reader.getEnv(varName)).toBe(varValue);
    });

    test('should retrieve an environment variable with special characters in its name (if supported by OS/Node)', () => {
      // Note: Environment variable name restrictions are OS-dependent.
      // This tests if process.env itself can handle it and our reader just passes through.
      const varName = 'TEST_VAR_WITH-SPECIAL$CHARS';
      const varValue = 'special_value';
      process.env[varName] = varValue;

      expect(reader.getEnv(varName)).toBe(varValue);
    });

    test('should be case-sensitive when retrieving environment variables (as process.env is)', () => {
      const varNameUpper = 'TEST_CASE_SENSITIVE_VAR';
      const varNameLower = 'test_case_sensitive_var';
      const varValue = 'case_value';

      process.env[varNameUpper] = varValue;
      // Ensure the lower case version is not accidentally set or already present
      delete process.env[varNameLower];

      expect(reader.getEnv(varNameUpper)).toBe(varValue);
      expect(reader.getEnv(varNameLower)).toBeUndefined();
    });

    test('should return undefined if variableName is an empty string and process.env[""] is undefined', () => {
      // Behavior of process.env[''] might be undefined or platform-specific.
      // We test that our reader reflects what process.env returns.
      delete process.env['']; // Ensure it's not set
      expect(reader.getEnv('')).toBe(process.env['']); // Should both be undefined
    });

    test('should return value if variableName is an empty string and process.env[""] is set', () => {
      process.env[''] = 'value_for_empty_key';
      expect(reader.getEnv('')).toBe('value_for_empty_key');
      delete process.env['']; // Clean up
    });

    test('should correctly handle variable names that are properties of Object.prototype (e.g. "toString")', () => {
      const varName = 'toString';
      const varValue = 'custom_toString_val';

      // Ensure it's not inheriting from Object.prototype
      delete process.env[varName]; // Clean first if it somehow exists
      process.env[varName] = varValue;

      expect(reader.getEnv(varName)).toBe(varValue);

      // Check that a non-existent prototype property still returns undefined
      const nonExistentProtoVar = 'hasOwnProperty';
      delete process.env[nonExistentProtoVar];
      expect(reader.getEnv(nonExistentProtoVar)).toBeUndefined();
    });
  });
});

// --- NEW FILE END ---
