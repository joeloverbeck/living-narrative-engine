/**
 * @file Integration test for music mod rule schema validation.
 * @description Verifies that music mod rule files pass schema validation,
 * particularly rules that use QUERY_LOOKUP operations.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { join } from 'path';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'fs';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import SchemaLoader from '../../../../src/loaders/schemaLoader.js';
import StaticConfiguration from '../../../../src/configuration/staticConfiguration.js';
import DefaultPathResolver from '../../../../src/pathing/defaultPathResolver.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';

describe('Music Mod Rule Schema Validation', () => {
  let validator;
  let logger;

  beforeAll(async () => {
    const config = new StaticConfiguration();
    const resolver = new DefaultPathResolver(config);
    logger = new ConsoleLogger('ERROR'); // Use ERROR level to suppress debug logs

    validator = new AjvSchemaValidator({ logger });

    const fetcher = {
      async fetch(path) {
        const data = await readFile(path, { encoding: 'utf-8' });
        return JSON.parse(data);
      },
    };

    const schemaLoader = new SchemaLoader(
      config,
      resolver,
      fetcher,
      validator,
      logger
    );

    // Load all schemas including dependencies
    try {
      await schemaLoader.loadAndCompileAllSchemas();
    } catch (error) {
      throw new Error(
        `Schema loading failed: ${error.message}\n${error.stack}`
      );
    }

    // Verify the rule schema was loaded successfully
    const ruleSchemaId = 'schema://living-narrative-engine/rule.schema.json';
    const ruleValidator = validator.getValidator(ruleSchemaId);
    if (!ruleValidator) {
      // List what schemas ARE loaded for debugging
      const ajvSchemas = Object.keys(validator._ajv?.schemas || {});
      throw new Error(
        `Rule schema not loaded. Available schemas: ${ajvSchemas.join(', ')}`
      );
    }
  });

  const musicRuleFiles = [
    'handle_set_aggressive_mood_on_instrument.rule.json',
    'handle_set_cheerful_mood_on_instrument.rule.json',
    'handle_set_eerie_mood_on_instrument.rule.json',
    'handle_set_meditative_mood_on_instrument.rule.json',
    'handle_set_mournful_mood_on_instrument.rule.json',
    'handle_set_playful_mood_on_instrument.rule.json',
    'handle_set_solemn_mood_on_instrument.rule.json',
    'handle_set_tender_mood_on_instrument.rule.json',
    'handle_set_tense_mood_on_instrument.rule.json',
    'handle_set_triumphant_mood_on_instrument.rule.json',
  ];

  describe('QUERY_LOOKUP Operation Support', () => {
    musicRuleFiles.forEach((fileName) => {
      it(`should validate ${fileName} with QUERY_LOOKUP operations`, () => {
        // Arrange
        const filePath = join(process.cwd(), 'data/mods/music/rules', fileName);
        const ruleContent = JSON.parse(readFileSync(filePath, 'utf-8'));

        // Act
        const result = validator.validate(
          'schema://living-narrative-engine/rule.schema.json',
          ruleContent
        );

        // Assert
        if (!result.isValid) {
          // Log validation errors for debugging
          const errorDetails = result.errors
            ?.map((err) => `  - ${err.instancePath}: ${err.message}`)
            .join('\n');
          throw new Error(
            `Validation failed for ${fileName}:\n${errorDetails || JSON.stringify(result.errors, null, 2)}`
          );
        }
        expect(result.isValid).toBe(true);

        // Verify the rule has at least one QUERY_LOOKUP operation
        const hasQueryLookup = ruleContent.actions.some(
          (action) => action.type === 'QUERY_LOOKUP'
        );
        expect(hasQueryLookup).toBe(true);
      });
    });
  });

  describe('QUERY_LOOKUP Operation Parameters', () => {
    it('should validate QUERY_LOOKUP parameters structure', () => {
      // Arrange
      const sampleRule = {
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: 'test_query_lookup',
        event_type: 'core:test_event',
        actions: [
          {
            type: 'QUERY_LOOKUP',
            parameters: {
              lookup_id: 'music:mood_lexicon',
              entry_key: 'aggressive',
              result_variable: 'moodData',
              missing_value: {
                adj: 'default',
                adjectives: 'default',
                noun: 'default',
              },
            },
          },
        ],
      };

      // Act
      const result = validator.validate(
        'schema://living-narrative-engine/rule.schema.json',
        sampleRule
      );

      // Assert
      expect(result.isValid).toBe(true);
    });

    it('should validate QUERY_LOOKUP with minimal parameters', () => {
      // Arrange
      const sampleRule = {
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: 'test_query_lookup_minimal',
        event_type: 'core:test_event',
        actions: [
          {
            type: 'QUERY_LOOKUP',
            parameters: {
              lookup_id: 'music:mood_lexicon',
              entry_key: 'aggressive',
              result_variable: 'moodData',
            },
          },
        ],
      };

      // Act
      const result = validator.validate(
        'schema://living-narrative-engine/rule.schema.json',
        sampleRule
      );

      // Assert
      expect(result.isValid).toBe(true);
    });
  });

  describe('QUERY_LOOKUP Validation Failures', () => {
    it('should reject QUERY_LOOKUP with missing lookup_id', () => {
      // Arrange
      const invalidRule = {
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: 'test_invalid',
        event_type: 'core:test_event',
        actions: [
          {
            type: 'QUERY_LOOKUP',
            parameters: {
              entry_key: 'aggressive',
              result_variable: 'moodData',
            },
          },
        ],
      };

      // Act
      const result = validator.validate(
        'schema://living-narrative-engine/rule.schema.json',
        invalidRule
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject QUERY_LOOKUP with missing entry_key', () => {
      // Arrange
      const invalidRule = {
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: 'test_invalid',
        event_type: 'core:test_event',
        actions: [
          {
            type: 'QUERY_LOOKUP',
            parameters: {
              lookup_id: 'music:mood_lexicon',
              result_variable: 'moodData',
            },
          },
        ],
      };

      // Act
      const result = validator.validate(
        'schema://living-narrative-engine/rule.schema.json',
        invalidRule
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject QUERY_LOOKUP with missing result_variable', () => {
      // Arrange
      const invalidRule = {
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: 'test_invalid',
        event_type: 'core:test_event',
        actions: [
          {
            type: 'QUERY_LOOKUP',
            parameters: {
              lookup_id: 'music:mood_lexicon',
              entry_key: 'aggressive',
            },
          },
        ],
      };

      // Act
      const result = validator.validate(
        'schema://living-narrative-engine/rule.schema.json',
        invalidRule
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });
});
