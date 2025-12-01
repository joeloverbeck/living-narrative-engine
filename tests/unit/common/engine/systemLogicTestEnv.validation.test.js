/**
 * @file Tests for schema validation capabilities in systemLogicTestEnv
 * @ticket SCHVALTESINT-003
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFile, readdir } from 'fs/promises';
import { resolve } from 'path';
import {
  createBaseRuleEnvironment,
  createRuleTestEnvironment,
} from '../../../common/engine/systemLogicTestEnv.js';
import { jest } from '@jest/globals';

describe('systemLogicTestEnv schema validation (SCHVALTESINT-003)', () => {
  let schemaValidator;

  const minimalHandlers = () => ({
    LOG: { execute: jest.fn() },
  });

  /**
   * Helper to load required schemas for rule validation.
   * Must load schemas in dependency order and include common.schema.json.
   *
   * @param ajv
   */
  async function loadRequiredSchemas(ajv) {
    const schemasDir = resolve(process.cwd(), 'data/schemas');

    // Load common.schema.json first (other schemas reference it)
    const commonSchemaPath = resolve(schemasDir, 'common.schema.json');
    try {
      const content = await readFile(commonSchemaPath, 'utf8');
      const schema = JSON.parse(content);
      if (schema.$id && !ajv.getSchema(schema.$id)) {
        ajv.addSchema(schema, schema.$id);
      }
    } catch (err) {
      // Common schema is required - log warning if missing
      console.warn('Could not load common.schema.json:', err.message);
    }

    // Core schemas in dependency order (matching ModTestFixture.js pattern)
    const schemaFiles = [
      'json-logic.schema.json',
      'condition-container.schema.json',
      'condition.schema.json',
      'base-operation.schema.json',
      'nested-operation.schema.json',
      'component-ref.schema.json',
    ];

    for (const filename of schemaFiles) {
      const schemaPath = resolve(schemasDir, filename);
      try {
        const content = await readFile(schemaPath, 'utf8');
        const schema = JSON.parse(content);
        if (schema.$id && !ajv.getSchema(schema.$id)) {
          ajv.addSchema(schema, schema.$id);
        }
      } catch {
        // Schema load failure is non-fatal for some optional schemas
      }
    }

    // Load operation schemas from operations subdirectory (before operation.schema.json)
    const operationsDir = resolve(schemasDir, 'operations');
    try {
      const operationFiles = await readdir(operationsDir);
      for (const file of operationFiles) {
        if (file.endsWith('.schema.json')) {
          const schemaPath = resolve(operationsDir, file);
          try {
            const content = await readFile(schemaPath, 'utf8');
            const schema = JSON.parse(content);
            if (schema.$id && !ajv.getSchema(schema.$id)) {
              ajv.addSchema(schema, schema.$id);
            }
          } catch {
            // Individual operation schema load failure is non-fatal
          }
        }
      }
    } catch {
      // Operations directory may not exist in all environments
    }

    // Load operation.schema.json (depends on operation schemas)
    const operationSchemaPath = resolve(schemasDir, 'operation.schema.json');
    try {
      const content = await readFile(operationSchemaPath, 'utf8');
      const schema = JSON.parse(content);
      if (schema.$id && !ajv.getSchema(schema.$id)) {
        ajv.addSchema(schema, schema.$id);
      }
    } catch {
      // Non-fatal
    }

    // Load rule.schema.json (depends on operation.schema.json)
    const ruleSchemaPath = resolve(schemasDir, 'rule.schema.json');
    try {
      const content = await readFile(ruleSchemaPath, 'utf8');
      const schema = JSON.parse(content);
      if (schema.$id && !ajv.getSchema(schema.$id)) {
        ajv.addSchema(schema, schema.$id);
      }
    } catch {
      // Non-fatal
    }
  }

  beforeAll(async () => {
    const ajv = new Ajv({
      allErrors: true,
      strict: false,
      strictTypes: false,
      verbose: true,
    });
    addFormats(ajv);
    await loadRequiredSchemas(ajv);
    schemaValidator = ajv;
  });

  describe('createBaseRuleEnvironment', () => {
    describe('hasValidation()', () => {
      it('should return false when schemaValidator not provided', () => {
        const env = createBaseRuleEnvironment({
          createHandlers: () => ({}),
        });

        expect(env.hasValidation()).toBe(false);
        env.cleanup();
      });

      it('should return true when schemaValidator is provided', () => {
        const env = createBaseRuleEnvironment({
          createHandlers: () => ({}),
          schemaValidator,
        });

        expect(env.hasValidation()).toBe(true);
        env.cleanup();
      });
    });

    describe('validateRule()', () => {
      // Helper: create a valid rule structure according to rule.schema.json
      const createValidRule = (overrides = {}) => ({
        rule_id: 'test:valid_rule',
        event_type: 'test:some_event',
        actions: [
          {
            type: 'LOG',
            parameters: { message: 'test' },
          },
        ],
        ...overrides,
      });

      it('should throw error when called without schemaValidator', () => {
        const env = createBaseRuleEnvironment({
          createHandlers: () => ({}),
        });

        expect(() => env.validateRule(createValidRule())).toThrow(
          'Schema validator not provided to test environment'
        );
        env.cleanup();
      });

      it('should throw error when rule schema not found', () => {
        // Create a validator without the rule schema loaded
        const emptyValidator = new Ajv({ strict: false });

        const env = createBaseRuleEnvironment({
          createHandlers: () => ({}),
          schemaValidator: emptyValidator,
        });

        expect(() => env.validateRule(createValidRule())).toThrow(
          'Rule schema not found'
        );
        env.cleanup();
      });

      it('should not throw for valid rule data', () => {
        const env = createBaseRuleEnvironment({
          createHandlers: () => ({}),
          schemaValidator,
        });

        expect(() => env.validateRule(createValidRule())).not.toThrow();
        env.cleanup();
      });

      it('should throw with detailed error for invalid rule data', () => {
        const env = createBaseRuleEnvironment({
          createHandlers: () => ({}),
          schemaValidator,
        });

        // Missing required 'event_type' property
        const invalidRule = {
          rule_id: 'test:invalid_rule',
          actions: [{ type: 'LOG', parameters: { message: 'test' } }],
        };

        expect(() => env.validateRule(invalidRule)).toThrow(
          /Schema validation failed for rule/
        );
        expect(() => env.validateRule(invalidRule)).toThrow(
          /Rule ID: test:invalid_rule/
        );
        env.cleanup();
      });
    });

    describe('validateOnSetup behavior', () => {
      // Helper: create a valid rule structure
      const createValidRuleForSetup = (ruleId) => ({
        rule_id: ruleId,
        event_type: 'test:some_event',
        actions: [{ type: 'LOG', parameters: { message: 'test' } }],
      });

      it('should validate rules on setup when schemaValidator provided and validateOnSetup=true (default)', () => {
        const invalidRule = {
          rule_id: 'test:invalid_setup_rule',
          // Missing 'event_type' property
          actions: [{ type: 'LOG', parameters: { message: 'test' } }],
        };

        expect(() =>
          createBaseRuleEnvironment({
            createHandlers: minimalHandlers,
            schemaValidator,
            rules: [invalidRule],
            validateOnSetup: true,
          })
        ).toThrow(/Schema validation failed for rule/);
      });

      it('should skip validation when validateOnSetup=false', () => {
        const invalidRule = {
          rule_id: 'test:invalid_skip_rule',
          // Missing 'event_type' property - would fail validation
          actions: [{ type: 'LOG', parameters: { message: 'test' } }],
        };

        // Should not throw because validateOnSetup is false
        const env = createBaseRuleEnvironment({
          createHandlers: minimalHandlers,
          schemaValidator,
          rules: [invalidRule],
          validateOnSetup: false,
        });

        // Environment should be created successfully
        expect(env).toBeDefined();
        expect(env.hasValidation()).toBe(true);
        env.cleanup();
      });

      it('should skip validation when schemaValidator not provided', () => {
        const invalidRule = {
          rule_id: 'test:invalid_no_validator_rule',
          // Missing 'event_type' property - would fail validation
          actions: [{ type: 'LOG', parameters: { message: 'test' } }],
        };

        // Should not throw because no validator is provided
        const env = createBaseRuleEnvironment({
          createHandlers: minimalHandlers,
          rules: [invalidRule],
        });

        expect(env).toBeDefined();
        expect(env.hasValidation()).toBe(false);
        env.cleanup();
      });

      it('should not throw when rules array is empty', () => {
        const env = createBaseRuleEnvironment({
          createHandlers: () => ({}),
          schemaValidator,
          rules: [],
          validateOnSetup: true,
        });

        expect(env).toBeDefined();
        env.cleanup();
      });

      it('should validate multiple rules and fail on first invalid one', () => {
        const validRule = createValidRuleForSetup('test:valid_multi_rule');

        const invalidRule = {
          rule_id: 'test:invalid_multi_rule',
          // Missing 'event_type'
          actions: [{ type: 'LOG', parameters: { message: 'test' } }],
        };

        expect(() =>
          createBaseRuleEnvironment({
            createHandlers: () => ({}),
            schemaValidator,
            rules: [validRule, invalidRule],
            validateOnSetup: true,
          })
        ).toThrow(/Rule ID: test:invalid_multi_rule/);
      });
    });
  });

  describe('createRuleTestEnvironment', () => {
    it('should inherit validation capabilities from createBaseRuleEnvironment', () => {
      const env = createRuleTestEnvironment({
        createHandlers: () => ({}),
        schemaValidator,
      });

      expect(env.hasValidation()).toBe(true);
      expect(typeof env.validateRule).toBe('function');
      env.cleanup();
    });

    it('should validate rules on setup when schemaValidator provided', () => {
      const invalidRule = {
        rule_id: 'test:invalid_rte_rule',
        // Missing 'event_type'
        actions: [{ type: 'LOG', parameters: { message: 'test' } }],
      };

      expect(() =>
        createRuleTestEnvironment({
          createHandlers: () => ({}),
          schemaValidator,
          rules: [invalidRule],
        })
      ).toThrow(/Schema validation failed for rule/);
    });
  });

  describe('backward compatibility', () => {
    it('should work without any schema-related parameters', () => {
      const env = createBaseRuleEnvironment({
        createHandlers: () => ({}),
      });

      expect(env.eventBus).toBeDefined();
      expect(env.cleanup).toBeDefined();
      expect(env.hasValidation()).toBe(false);
      env.cleanup();
    });

    it('should work with all original parameters except schema validation', () => {
      const customLogger = {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      };

      // Note: This rule structure is intentionally NOT schema-valid to test
      // backward compatibility when no schemaValidator is provided
      const legacyRule = {
        id: 'test:compat_rule',
        trigger: { event: 'test_event' },
        actions: [],
      };

      const env = createBaseRuleEnvironment({
        createHandlers: () => ({}),
        entities: [],
        rules: [legacyRule],
        actions: [],
        conditions: {},
        macros: {},
        logger: customLogger,
      });

      expect(env.logger).toBe(customLogger);
      expect(env.hasValidation()).toBe(false);
      env.cleanup();
    });
  });
});
