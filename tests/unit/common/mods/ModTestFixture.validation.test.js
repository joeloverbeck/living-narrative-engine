/**
 * @file Schema validation tests for ModTestFixture.forAction()
 *
 * Tests the schema validation integration added in SCHVALTESINT-001
 * @see tickets/SCHVALTESINT-001-modtestfixture-forAction-validation.md
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('ModTestFixture.forAction() Schema Validation', () => {
  // Valid rule file that conforms to rule.schema.json
  const validRuleFile = {
    rule_id: 'test_handle_action',
    event_type: 'core:attempt_action',
    condition: { condition_ref: 'test:event-is-action-test' },
    actions: [
      {
        type: 'LOG',
        parameters: {
          message: 'Test action executed',
          level: 'info',
        },
      },
    ],
  };

  // Valid condition file that conforms to condition.schema.json
  const validConditionFile = {
    id: 'test:event-is-action-test',
    description: 'Checks if the triggering event is for the test action.',
    logic: {
      '==': [{ var: 'event.payload.actionId' }, 'test:test_action'],
    },
  };

  beforeEach(() => {
    // Reset the validator to ensure clean state between tests
    ModTestFixture.resetSchemaValidator();
  });

  afterEach(() => {
    ModTestFixture.resetSchemaValidator();
  });

  describe('valid files', () => {
    it('should succeed for valid rule and condition files', async () => {
      // Arrange & Act
      const fixture = await ModTestFixture.forAction(
        'test',
        'test:test_action',
        validRuleFile,
        validConditionFile
      );

      // Assert
      expect(fixture).toBeDefined();
      expect(fixture.modId).toBe('test');
      expect(fixture.actionId).toBe('test:test_action');

      // Cleanup
      fixture.cleanup();
    });
  });

  describe('invalid rule files', () => {
    it('should throw ValidationError when rule file is missing required event_type', async () => {
      // Arrange
      const invalidRuleFile = {
        rule_id: 'test_handle_action',
        // Missing required: event_type
        actions: [{ type: 'LOG', parameters: { message: 'Test' } }],
      };

      // Act & Assert
      await expect(
        ModTestFixture.forAction(
          'test',
          'test:test_action',
          invalidRuleFile,
          validConditionFile
        )
      ).rejects.toThrow(/Schema validation failed for rule file/);
    });

    it('should throw ValidationError when rule file is missing required actions', async () => {
      // Arrange
      const invalidRuleFile = {
        rule_id: 'test_handle_action',
        event_type: 'core:attempt_action',
        // Missing required: actions
      };

      // Act & Assert
      await expect(
        ModTestFixture.forAction(
          'test',
          'test:test_action',
          invalidRuleFile,
          validConditionFile
        )
      ).rejects.toThrow(/Schema validation failed for rule file/);
    });

    it('should throw ValidationError when rule file has empty actions array', async () => {
      // Arrange
      const invalidRuleFile = {
        rule_id: 'test_handle_action',
        event_type: 'core:attempt_action',
        actions: [], // Must have minItems: 1
      };

      // Act & Assert
      await expect(
        ModTestFixture.forAction(
          'test',
          'test:test_action',
          invalidRuleFile,
          validConditionFile
        )
      ).rejects.toThrow(/Schema validation failed for rule file/);
    });

    it('should throw ValidationError when rule file has additional properties', async () => {
      // Arrange
      const invalidRuleFile = {
        rule_id: 'test_handle_action',
        event_type: 'core:attempt_action',
        actions: [{ type: 'LOG', parameters: { message: 'Test' } }],
        unknownProperty: 'this should not be here', // additionalProperties: false
      };

      // Act & Assert
      await expect(
        ModTestFixture.forAction(
          'test',
          'test:test_action',
          invalidRuleFile,
          validConditionFile
        )
      ).rejects.toThrow(/Schema validation failed for rule file/);
    });
  });

  describe('invalid condition files', () => {
    it('should throw ValidationError when condition file is missing required id', async () => {
      // Arrange
      const invalidConditionFile = {
        // Missing required: id
        description: 'Test condition',
        logic: { '==': [1, 1] },
      };

      // Act & Assert
      await expect(
        ModTestFixture.forAction(
          'test',
          'test:test_action',
          validRuleFile,
          invalidConditionFile
        )
      ).rejects.toThrow(/Schema validation failed for condition file/);
    });

    it('should throw ValidationError when condition file is missing required description', async () => {
      // Arrange
      const invalidConditionFile = {
        id: 'test:event-is-action-test',
        // Missing required: description
        logic: { '==': [1, 1] },
      };

      // Act & Assert
      await expect(
        ModTestFixture.forAction(
          'test',
          'test:test_action',
          validRuleFile,
          invalidConditionFile
        )
      ).rejects.toThrow(/Schema validation failed for condition file/);
    });

    it('should throw ValidationError when condition file is missing required logic', async () => {
      // Arrange
      const invalidConditionFile = {
        id: 'test:event-is-action-test',
        description: 'Test condition',
        // Missing required: logic
      };

      // Act & Assert
      await expect(
        ModTestFixture.forAction(
          'test',
          'test:test_action',
          validRuleFile,
          invalidConditionFile
        )
      ).rejects.toThrow(/Schema validation failed for condition file/);
    });

    it('should throw ValidationError when condition file has additional properties', async () => {
      // Arrange
      const invalidConditionFile = {
        id: 'test:event-is-action-test',
        description: 'Test condition',
        logic: { '==': [1, 1] },
        unknownProperty: 'this should not be here', // additionalProperties: false
      };

      // Act & Assert
      await expect(
        ModTestFixture.forAction(
          'test',
          'test:test_action',
          validRuleFile,
          invalidConditionFile
        )
      ).rejects.toThrow(/Schema validation failed for condition file/);
    });
  });

  describe('error message content', () => {
    it('should include action ID in error message', async () => {
      // Arrange
      const invalidRuleFile = {
        rule_id: 'test_handle_action',
        // Missing event_type
        actions: [{ type: 'LOG', parameters: { message: 'Test' } }],
      };

      // Act & Assert
      // Note: The action ID is formatted as ${modId}:${actionId} in the error message,
      // so with modId='mymod' and actionId='mymod:my_action', it becomes 'mymod:mymod:my_action'
      await expect(
        ModTestFixture.forAction(
          'mymod',
          'mymod:my_action',
          invalidRuleFile,
          validConditionFile
        )
      ).rejects.toThrow(/mymod:my_action/);
    });

    it('should include schema reference in error message', async () => {
      // Arrange
      const invalidRuleFile = {
        rule_id: 'test_handle_action',
        // Missing event_type
        actions: [{ type: 'LOG', parameters: { message: 'Test' } }],
      };

      // Act & Assert
      await expect(
        ModTestFixture.forAction(
          'test',
          'test:test_action',
          invalidRuleFile,
          validConditionFile
        )
      ).rejects.toThrow(/Schema: schema:\/\/living-narrative-engine\/rule\.schema\.json/);
    });

    it('should include specific validation errors in error message', async () => {
      // Arrange
      const invalidRuleFile = {
        rule_id: 'test_handle_action',
        // Missing event_type
        actions: [{ type: 'LOG', parameters: { message: 'Test' } }],
      };

      // Act & Assert
      await expect(
        ModTestFixture.forAction(
          'test',
          'test:test_action',
          invalidRuleFile,
          validConditionFile
        )
      ).rejects.toThrow(/Validation errors:/);
    });
  });

  describe('skipValidation option', () => {
    it('should skip validation when skipValidation: true', async () => {
      // Arrange - invalid rule file that would normally fail validation
      const invalidRuleFile = {
        rule_id: 'test_handle_action',
        // Missing event_type and actions - should fail validation
      };

      // Note: This test validates that skipValidation bypasses schema validation.
      // The constructor may still fail for other reasons, but schema validation is skipped.
      // We wrap in try/catch to distinguish schema validation errors from other errors.

      let caughtError = null;
      try {
        await ModTestFixture.forAction(
          'test',
          'test:test_action',
          invalidRuleFile,
          validConditionFile,
          { skipValidation: true }
        );
      } catch (error) {
        caughtError = error;
      }

      // Assert - verify that any error thrown is NOT a schema validation error
      // Using a null-safe approach that works with or without an error
      const errorMessage = caughtError?.message ?? '';
      expect(errorMessage).not.toContain('Schema validation failed');
    });

    it('should validate skipValidation option type', async () => {
      // Arrange
      const invalidOptions = { skipValidation: 'not-a-boolean' };

      // Act & Assert
      await expect(
        ModTestFixture.forAction(
          'test',
          'test:test_action',
          validRuleFile,
          validConditionFile,
          invalidOptions
        )
      ).rejects.toThrow(/skipValidation must be a boolean/);
    });

    it('should perform validation when skipValidation is not set (default false)', async () => {
      // Arrange
      const invalidRuleFile = {
        rule_id: 'test_handle_action',
        // Missing event_type - invalid
        actions: [{ type: 'LOG', parameters: { message: 'Test' } }],
      };

      // Act & Assert - should throw because validation is on by default
      await expect(
        ModTestFixture.forAction(
          'test',
          'test:test_action',
          invalidRuleFile,
          validConditionFile
          // No options - skipValidation defaults to false
        )
      ).rejects.toThrow(/Schema validation failed for rule file/);
    });

    it('should perform validation when skipValidation is explicitly false', async () => {
      // Arrange
      const invalidRuleFile = {
        rule_id: 'test_handle_action',
        // Missing event_type - invalid
        actions: [{ type: 'LOG', parameters: { message: 'Test' } }],
      };

      // Act & Assert
      await expect(
        ModTestFixture.forAction(
          'test',
          'test:test_action',
          invalidRuleFile,
          validConditionFile,
          { skipValidation: false }
        )
      ).rejects.toThrow(/Schema validation failed for rule file/);
    });
  });

  describe('schema validator caching', () => {
    it('should reuse schema validator across multiple forAction calls', async () => {
      // First call - validator gets initialized
      const fixture1 = await ModTestFixture.forAction(
        'test',
        'test:test_action_1',
        validRuleFile,
        validConditionFile
      );

      // Second call - should reuse cached validator
      const fixture2 = await ModTestFixture.forAction(
        'test',
        'test:test_action_2',
        validRuleFile,
        validConditionFile
      );

      // Both should succeed
      expect(fixture1).toBeDefined();
      expect(fixture2).toBeDefined();

      // Cleanup
      fixture1.cleanup();
      fixture2.cleanup();
    });

    it('should reinitialize validator after resetSchemaValidator is called', async () => {
      // First call - validator gets initialized
      const fixture1 = await ModTestFixture.forAction(
        'test',
        'test:test_action_1',
        validRuleFile,
        validConditionFile
      );
      fixture1.cleanup();

      // Reset validator
      ModTestFixture.resetSchemaValidator();

      // Next call - should reinitialize validator
      const fixture2 = await ModTestFixture.forAction(
        'test',
        'test:test_action_2',
        validRuleFile,
        validConditionFile
      );
      fixture2.cleanup();

      // Both should succeed (demonstrates reset and reinit work)
      expect(fixture1).toBeDefined();
      expect(fixture2).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle rule file with only required fields', async () => {
      // Arrange - minimal valid rule file
      const minimalRuleFile = {
        event_type: 'core:attempt_action',
        actions: [
          {
            type: 'LOG',
            parameters: { message: 'Minimal test' },
          },
        ],
      };

      // Act
      const fixture = await ModTestFixture.forAction(
        'test',
        'test:minimal_action',
        minimalRuleFile,
        validConditionFile
      );

      // Assert
      expect(fixture).toBeDefined();
      fixture.cleanup();
    });

    it('should handle condition file with only required fields', async () => {
      // Arrange - minimal valid condition file
      const minimalConditionFile = {
        id: 'test:minimal-condition',
        description: 'Minimal condition',
        logic: { '==': [1, 1] },
      };

      // Act
      const fixture = await ModTestFixture.forAction(
        'test',
        'test:test_action',
        validRuleFile,
        minimalConditionFile
      );

      // Assert
      expect(fixture).toBeDefined();
      fixture.cleanup();
    });

    it('should handle rule file with optional comment field', async () => {
      // Arrange
      const ruleWithComment = {
        ...validRuleFile,
        comment: 'This is a developer comment',
      };

      // Act
      const fixture = await ModTestFixture.forAction(
        'test',
        'test:test_action',
        ruleWithComment,
        validConditionFile
      );

      // Assert
      expect(fixture).toBeDefined();
      fixture.cleanup();
    });

    it('should handle rule file with optional $schema field', async () => {
      // Arrange
      const ruleWithSchema = {
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        ...validRuleFile,
      };

      // Act
      const fixture = await ModTestFixture.forAction(
        'test',
        'test:test_action',
        ruleWithSchema,
        validConditionFile
      );

      // Assert
      expect(fixture).toBeDefined();
      fixture.cleanup();
    });
  });
});
