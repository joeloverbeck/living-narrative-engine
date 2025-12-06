/**
 * @file Regression test for rule schema validation of additional properties
 * @description Tests that rule files are properly validated against the schema
 * and reject unexpected properties that are not defined in rule.schema.json
 *
 * This test reproduces the runtime error where handle_take_from_container.rule.json
 * contained an invalid "priority" property that violated the schema's
 * "additionalProperties": false constraint.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import StaticConfiguration from '../../../../src/configuration/staticConfiguration.js';
import DefaultPathResolver from '../../../../src/pathing/defaultPathResolver.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import SchemaLoader from '../../../../src/loaders/schemaLoader.js';
import handleTakeFromContainerRule from '../../../../data/mods/items/rules/handle_take_from_container.rule.json' assert { type: 'json' };

describe('Rule Schema Additional Properties Validation', () => {
  let schemaValidator;
  let schemaLoader;
  const ruleSchemaId = 'schema://living-narrative-engine/rule.schema.json';

  beforeAll(async () => {
    // Set up schema loader with all necessary dependencies
    const config = new StaticConfiguration();
    const resolver = new DefaultPathResolver(config);
    const logger = new ConsoleLogger('ERROR');
    schemaValidator = new AjvSchemaValidator({ logger });

    const fetcher = {
      async fetch(path) {
        const data = await readFile(path, { encoding: 'utf-8' });
        return JSON.parse(data);
      },
    };

    schemaLoader = new SchemaLoader(
      config,
      resolver,
      fetcher,
      schemaValidator,
      logger
    );

    // Load all schemas with proper dependency resolution
    await schemaLoader.loadAndCompileAllSchemas();
  });

  describe('Valid Rule Structure', () => {
    it('should accept rule with all allowed properties', () => {
      const validRule = {
        $schema: ruleSchemaId,
        rule_id: 'test_rule',
        event_type: 'core:test_event',
        comment: 'Test comment',
        condition: {
          condition_ref: 'test:condition',
        },
        actions: [
          {
            type: 'LOG',
            parameters: {
              message: 'test',
            },
          },
        ],
      };

      const result = schemaValidator.validate(ruleSchemaId, validRule);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should accept rule with minimal required properties only', () => {
      const minimalRule = {
        event_type: 'core:test_event',
        actions: [
          {
            type: 'LOG',
            parameters: {
              message: 'test',
            },
          },
        ],
      };

      const result = schemaValidator.validate(ruleSchemaId, minimalRule);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });
  });

  describe('Additional Properties Rejection', () => {
    it('should reject rule with "priority" property (regression test)', () => {
      // This reproduces the exact issue from handle_take_from_container.rule.json
      const ruleWithPriority = {
        $schema: ruleSchemaId,
        rule_id: 'handle_take_from_container',
        comment: 'Handles take_from_container action',
        priority: 100, // INVALID: not allowed by schema
        event_type: 'core:attempt_action',
        actions: [
          {
            type: 'LOG',
            parameters: {
              message: 'test',
            },
          },
        ],
      };

      const result = schemaValidator.validate(ruleSchemaId, ruleWithPriority);
      expect(result.isValid).toBe(false);
      expect(result.errors).not.toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);

      // Check that error mentions the unexpected property
      const errorMessage = JSON.stringify(result.errors);
      expect(errorMessage.toLowerCase()).toMatch(
        /priority|additional|unexpected/
      );
    });

    it('should reject rule with multiple unexpected properties', () => {
      const ruleWithMultipleInvalid = {
        event_type: 'core:test_event',
        actions: [
          {
            type: 'LOG',
            parameters: {
              message: 'test',
            },
          },
        ],
        priority: 100, // INVALID
        order: 5, // INVALID
        weight: 10, // INVALID
      };

      const result = schemaValidator.validate(
        ruleSchemaId,
        ruleWithMultipleInvalid
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).not.toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject rule with arbitrary unexpected property', () => {
      const ruleWithArbitraryProperty = {
        event_type: 'core:test_event',
        actions: [
          {
            type: 'LOG',
            parameters: {
              message: 'test',
            },
          },
        ],
        custom_field: 'invalid', // INVALID
      };

      const result = schemaValidator.validate(
        ruleSchemaId,
        ruleWithArbitraryProperty
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).not.toBeNull();
    });
  });

  describe('Error Message Clarity', () => {
    it('should provide clear error message about unexpected property', () => {
      const ruleWithPriority = {
        event_type: 'core:test_event',
        actions: [
          {
            type: 'LOG',
            parameters: {
              message: 'test',
            },
          },
        ],
        priority: 100,
      };

      const result = schemaValidator.validate(ruleSchemaId, ruleWithPriority);
      expect(result.isValid).toBe(false);

      // Convert errors to string for easier inspection
      const errorString = JSON.stringify(result.errors).toLowerCase();

      // Should mention the property name
      expect(errorString).toContain('priority');

      // Should indicate it's not allowed
      expect(errorString).toMatch(
        /additional|unexpected|not allowed|must not have additional/
      );
    });
  });

  describe('Real File Validation', () => {
    it('should validate that actual handle_take_from_container.rule.json has no additional properties', () => {
      // Validate the actual imported rule file against schema
      const result = schemaValidator.validate(
        ruleSchemaId,
        handleTakeFromContainerRule
      );

      // After our fix, this should pass
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();

      // Verify it doesn't have the priority property
      expect(handleTakeFromContainerRule).not.toHaveProperty('priority');
    });
  });
});
