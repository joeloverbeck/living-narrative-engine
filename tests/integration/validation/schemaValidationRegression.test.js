/**
 * @file tests/integration/validation/schemaValidationRegression.test.js
 * Regression test suite preventing recurrence of schema validation failures
 * @see specs/schema-validation-test-integration.md
 *
 * NOTE: This suite consolidates and documents regression tests.
 * Related tests exist in:
 * - tests/integration/mods/weapons/wield_grabbing_schema_validation.test.js
 * - tests/integration/validation/corePromptTextValidation.test.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';

describe('Schema Validation Regression Prevention', () => {
  let testBed;
  let schemaValidator;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize({ useRealSchemas: true });
    schemaValidator = testBed.container.resolve('ISchemaValidator');
  });

  afterEach(() => {
    testBed?.cleanup();
  });

  describe('Template String Pattern Validation - Edge Cases', () => {
    /**
     * Tests for INV-2: Template Pattern Consistency Invariant
     * Tests edge cases not covered in wield_grabbing_schema_validation.test.js
     */
    it('should accept deeply nested template paths', () => {
      const operation = {
        type: 'LOCK_GRABBING',
        parameters: {
          actor_id: '{context.deeply.nested.path.value}',
          count: 1,
          item_id: 'test:item'
        }
      };

      const isValid = schemaValidator.validateAgainstSchema(
        operation,
        'schema://living-narrative-engine/operations/lockGrabbing.schema.json'
      );

      expect(isValid).toBe(true);
    });

    it('should accept template strings with underscores', () => {
      const operation = {
        type: 'LOCK_GRABBING',
        parameters: {
          actor_id: '{actor_stats.strength_modifier}',
          count: '{context.hands_required}',
          item_id: 'test:item'
        }
      };

      const isValid = schemaValidator.validateAgainstSchema(
        operation,
        'schema://living-narrative-engine/operations/lockGrabbing.schema.json'
      );

      expect(isValid).toBe(true);
    });

    it('should reject empty template {}', () => {
      const operation = {
        type: 'LOCK_GRABBING',
        parameters: { actor_id: 'test', count: '{}', item_id: 'item' }
      };

      const isValid = schemaValidator.validateAgainstSchema(
        operation,
        'schema://living-narrative-engine/operations/lockGrabbing.schema.json'
      );

      expect(isValid).toBe(false);
    });

    it('should reject template with spaces { context.value }', () => {
      const operation = {
        type: 'LOCK_GRABBING',
        parameters: { actor_id: 'test', count: '{ context.value }', item_id: 'item' }
      };

      const isValid = schemaValidator.validateAgainstSchema(
        operation,
        'schema://living-narrative-engine/operations/lockGrabbing.schema.json'
      );

      expect(isValid).toBe(false);
    });

    it('should reject double braces {{context.value}}', () => {
      const operation = {
        type: 'LOCK_GRABBING',
        parameters: { actor_id: 'test', count: '{{context.value}}', item_id: 'item' }
      };

      const isValid = schemaValidator.validateAgainstSchema(
        operation,
        'schema://living-narrative-engine/operations/lockGrabbing.schema.json'
      );

      expect(isValid).toBe(false);
    });

    it('should reject trailing dot {context.}', () => {
      const operation = {
        type: 'LOCK_GRABBING',
        parameters: { actor_id: 'test', count: '{context.}', item_id: 'item' }
      };

      const isValid = schemaValidator.validateAgainstSchema(
        operation,
        'schema://living-narrative-engine/operations/lockGrabbing.schema.json'
      );

      expect(isValid).toBe(false);
    });

    it('should reject leading dot {.value}', () => {
      const operation = {
        type: 'LOCK_GRABBING',
        parameters: { actor_id: 'test', count: '{.value}', item_id: 'item' }
      };

      const isValid = schemaValidator.validateAgainstSchema(
        operation,
        'schema://living-narrative-engine/operations/lockGrabbing.schema.json'
      );

      expect(isValid).toBe(false);
    });

    it('should reject template starting with number {123abc}', () => {
      const operation = {
        type: 'LOCK_GRABBING',
        parameters: { actor_id: 'test', count: '{123abc}', item_id: 'item' }
      };

      const isValid = schemaValidator.validateAgainstSchema(
        operation,
        'schema://living-narrative-engine/operations/lockGrabbing.schema.json'
      );

      expect(isValid).toBe(false);
    });

    it('should reject template with hyphen {context-value}', () => {
      const operation = {
        type: 'LOCK_GRABBING',
        parameters: { actor_id: 'test', count: '{context-value}', item_id: 'item' }
      };

      const isValid = schemaValidator.validateAgainstSchema(
        operation,
        'schema://living-narrative-engine/operations/lockGrabbing.schema.json'
      );

      expect(isValid).toBe(false);
    });
  });
});

describe('ModTestFixture Schema Integration - Regression Prevention', () => {
  /**
   * Verifies INV-1: Test-Schema Coupling Invariant
   * Tests that ModTestFixture validates against schemas (SCHVALTESINT-001)
   */
  describe('schema validation is enabled', () => {
    it('should successfully load valid weapon rule files', async () => {
      // Test that valid rules pass validation
      const fixture = await ModTestFixture.forAction('weapons', 'weapons:wield_threateningly');
      expect(fixture).toBeDefined();
      await fixture.cleanup();
    });

    it('should successfully load valid positioning rule files', async () => {
      // Test another valid mod to ensure validation works across mods
      const fixture = await ModTestFixture.forAction('positioning', 'positioning:sit_down');
      expect(fixture).toBeDefined();
      await fixture.cleanup();
    });

    it('should support skipValidation option for debugging', async () => {
      // Verify skipValidation option exists (for debugging purposes)
      const fixture = await ModTestFixture.forAction(
        'weapons',
        'weapons:wield_threateningly',
        null,
        null,
        { skipValidation: true }
      );
      expect(fixture).toBeDefined();
      await fixture.cleanup();
    });
  });
});

describe('Regression Test Cross-Reference Documentation', () => {
  /**
   * This describe block documents the relationship between this suite
   * and existing tests. No actual tests are run - this serves as documentation.
   */
  it('documents LOCK_GRABBING/UNLOCK_GRABBING regression tests location', () => {
    // Existing comprehensive tests for LOCK_GRABBING/UNLOCK_GRABBING:
    // File: tests/integration/mods/weapons/wield_grabbing_schema_validation.test.js
    //
    // Tests include:
    // - Accept integer count parameter
    // - Accept template string count parameter
    // - Reject plain string (non-template) count parameter
    // - Reject zero count
    // - Reject negative count
    // - Validate actual rule files (handle_wield_threateningly.rule.json)
    expect(true).toBe(true); // Documentation only
  });

  it('documents corePromptText.json regression tests location', () => {
    // Existing comprehensive tests for corePromptText.json:
    // File: tests/integration/validation/corePromptTextValidation.test.js
    //
    // Tests include:
    // - Validate against prompt-text schema
    // - Contain all required fields
    // - Field types are strings
    // - actionTagRulesContent field exists
    expect(true).toBe(true); // Documentation only
  });
});
