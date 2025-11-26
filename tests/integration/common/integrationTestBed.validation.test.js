/**
 * @file Tests for useRealSchemas option in IntegrationTestBed
 * Ticket: SCHVALTESINT-004
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('IntegrationTestBed schema validation (SCHVALTESINT-004)', () => {
  let testBed;

  afterEach(async () => {
    if (testBed) {
      await testBed.cleanup();
      testBed = null;
    }
  });

  describe('isUsingRealSchemas()', () => {
    it('should return false by default', async () => {
      testBed = new IntegrationTestBed();
      await testBed.initialize();

      expect(testBed.isUsingRealSchemas()).toBe(false);
    });

    it('should return false when explicitly set to false', async () => {
      testBed = new IntegrationTestBed();
      await testBed.initialize({ useRealSchemas: false });

      expect(testBed.isUsingRealSchemas()).toBe(false);
    });

    it('should return true when useRealSchemas is enabled', async () => {
      testBed = new IntegrationTestBed();
      await testBed.initialize({ useRealSchemas: true });

      expect(testBed.isUsingRealSchemas()).toBe(true);
    });
  });

  describe('default behavior (test schemas)', () => {
    beforeEach(async () => {
      testBed = new IntegrationTestBed();
      await testBed.initialize();
    });

    it('should have schema validator registered', () => {
      const validator = testBed.container.resolve(tokens.ISchemaValidator);

      expect(validator).toBeDefined();
      expect(typeof validator.validate).toBe('function');
    });

    it('should have test component schemas loaded', () => {
      const validator = testBed.container.resolve(tokens.ISchemaValidator);

      // These are the simplified test schemas registered by _registerTestComponentSchemas
      expect(validator.isSchemaLoaded('core:name')).toBe(true);
      expect(validator.isSchemaLoaded('core:position')).toBe(true);
    });

    it('should NOT have production schemas loaded', () => {
      const validator = testBed.container.resolve(tokens.ISchemaValidator);

      // Production schemas like rule.schema.json should NOT be loaded with default behavior
      expect(
        validator.isSchemaLoaded('schema://living-narrative-engine/rule.schema.json')
      ).toBe(false);
    });
  });

  describe('useRealSchemas: true', () => {
    beforeEach(async () => {
      testBed = new IntegrationTestBed();
      await testBed.initialize({ useRealSchemas: true });
    }, 30000); // Increased timeout for schema loading

    it('should have schema validator registered', () => {
      const validator = testBed.container.resolve(tokens.ISchemaValidator);

      expect(validator).toBeDefined();
      expect(typeof validator.validate).toBe('function');
    });

    it('should have production schemas loaded', () => {
      const validator = testBed.container.resolve(tokens.ISchemaValidator);

      // Production schemas should be loaded when useRealSchemas is true
      expect(
        validator.isSchemaLoaded('schema://living-narrative-engine/rule.schema.json')
      ).toBe(true);
      expect(
        validator.isSchemaLoaded('schema://living-narrative-engine/action.schema.json')
      ).toBe(true);
      expect(
        validator.isSchemaLoaded('schema://living-narrative-engine/component.schema.json')
      ).toBe(true);
    });

    it('should validate against real schema definitions', () => {
      const validator = testBed.container.resolve(tokens.ISchemaValidator);

      // Valid minimal rule structure per rule.schema.json
      // Required: event_type (namespaced ID), actions (array with minItems: 1)
      // Optional: rule_id, condition, comment
      const validRule = {
        rule_id: 'test:valid_rule',
        event_type: 'core:action_executed',
        actions: [
          {
            type: 'LOG',
            parameters: { message: 'test' },
          },
        ],
      };

      const result = validator.validate(
        'schema://living-narrative-engine/rule.schema.json',
        validRule
      );

      expect(result.isValid).toBe(true);
    });

    it('should catch schema violations', () => {
      const validator = testBed.container.resolve(tokens.ISchemaValidator);

      // Invalid rule - missing required fields
      const invalidRule = {
        id: 'test:invalid_rule',
        // Missing event_type, conditions, actions
      };

      const result = validator.validate(
        'schema://living-narrative-engine/rule.schema.json',
        invalidRule
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('backward compatibility', () => {
    it('should work with no options argument', async () => {
      testBed = new IntegrationTestBed();
      // Call without any options - should not throw
      await expect(testBed.initialize()).resolves.not.toThrow();

      expect(testBed.isUsingRealSchemas()).toBe(false);
    });

    it('should work with empty options object', async () => {
      testBed = new IntegrationTestBed();
      await expect(testBed.initialize({})).resolves.not.toThrow();

      expect(testBed.isUsingRealSchemas()).toBe(false);
    });

    it('should ignore unknown options gracefully', async () => {
      testBed = new IntegrationTestBed();
      await expect(
        testBed.initialize({ unknownOption: 'value', useRealSchemas: false })
      ).resolves.not.toThrow();

      expect(testBed.isUsingRealSchemas()).toBe(false);
    });
  });
});
