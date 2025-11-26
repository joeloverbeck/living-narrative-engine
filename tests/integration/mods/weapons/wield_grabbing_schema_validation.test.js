/**
 * @file Tests for LOCK_GRABBING and UNLOCK_GRABBING operation schema validation
 * Validates that template strings for count parameter pass schema validation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../../common/integrationTestBed.js';
import { readFile } from 'fs/promises';

describe('Grabbing Operation Schema Validation', () => {
  let testBed;
  let schemaValidator;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();
    schemaValidator = testBed.container.resolve('ISchemaValidator');
  });

  afterEach(() => {
    testBed?.cleanup();
  });

  describe('LOCK_GRABBING Operation', () => {
    it('should validate handle_wield_threateningly.rule.json with LOCK_GRABBING using template string for count', async () => {
      // Arrange
      const ruleDataContent = await readFile(
        'data/mods/weapons/rules/handle_wield_threateningly.rule.json',
        'utf8'
      );
      const ruleData = JSON.parse(ruleDataContent);

      // Act & Assert - This should pass now that schema accepts template strings
      expect(() => {
        schemaValidator.validateAgainstSchema(
          ruleData,
          'schema://living-narrative-engine/rule.schema.json'
        );
      }).not.toThrow();
    });

    it('should accept integer values for count parameter', () => {
      // Arrange
      const operation = {
        type: 'LOCK_GRABBING',
        parameters: {
          actor_id: 'test-actor',
          count: 2,
          item_id: 'test-item'
        }
      };

      // Act & Assert
      expect(() => {
        schemaValidator.validateAgainstSchema(
          operation,
          'schema://living-narrative-engine/operations/lockGrabbing.schema.json'
        );
      }).not.toThrow();
    });

    it('should accept template string values for count parameter', () => {
      // Arrange
      const operation = {
        type: 'LOCK_GRABBING',
        parameters: {
          actor_id: '{event.payload.actorId}',
          count: '{context.targetGrabbingReqs.handsRequired}',
          item_id: '{event.payload.targetId}'
        }
      };

      // Act & Assert
      expect(() => {
        schemaValidator.validateAgainstSchema(
          operation,
          'schema://living-narrative-engine/operations/lockGrabbing.schema.json'
        );
      }).not.toThrow();
    });

  });

  describe('UNLOCK_GRABBING Operation', () => {
    it('should validate handle_unwield_item.rule.json with UNLOCK_GRABBING using template string for count', async () => {
      // Arrange
      const ruleDataContent = await readFile(
        'data/mods/weapons/rules/handle_unwield_item.rule.json',
        'utf8'
      );
      const ruleData = JSON.parse(ruleDataContent);

      // Act & Assert - This should pass now that schema accepts template strings
      expect(() => {
        schemaValidator.validateAgainstSchema(
          ruleData,
          'schema://living-narrative-engine/rule.schema.json'
        );
      }).not.toThrow();
    });

    it('should accept integer values for count parameter', () => {
      // Arrange
      const operation = {
        type: 'UNLOCK_GRABBING',
        parameters: {
          actor_id: 'test-actor',
          count: 1,
          item_id: 'test-item'
        }
      };

      // Act & Assert
      expect(() => {
        schemaValidator.validateAgainstSchema(
          operation,
          'schema://living-narrative-engine/operations/unlockGrabbing.schema.json'
        );
      }).not.toThrow();
    });

    it('should accept template string values for count parameter', () => {
      // Arrange
      const operation = {
        type: 'UNLOCK_GRABBING',
        parameters: {
          actor_id: '{event.payload.actorId}',
          count: '{context.targetGrabbingReqs.handsRequired}',
          item_id: '{event.payload.targetId}'
        }
      };

      // Act & Assert
      expect(() => {
        schemaValidator.validateAgainstSchema(
          operation,
          'schema://living-narrative-engine/operations/unlockGrabbing.schema.json'
        );
      }).not.toThrow();
    });

  });
});
