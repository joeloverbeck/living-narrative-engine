/**
 * @file Integration test for music mod rule schema validation.
 * @description Verifies that music mod rule files pass schema validation,
 * particularly rules that use QUERY_LOOKUP operations.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { join } from 'path';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'fs';
import { validateAgainstSchema } from '../../../../src/utils/schemaValidationUtils.js';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import SchemaLoader from '../../../../src/loaders/schemaLoader.js';
import StaticConfiguration from '../../../../src/configuration/staticConfiguration.js';
import DefaultPathResolver from '../../../../src/pathing/defaultPathResolver.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('Music Mod Rule Schema Validation', () => {
  let validator;
  let logger;

  beforeAll(async () => {
    const config = new StaticConfiguration();
    const resolver = new DefaultPathResolver(config);

    // Use console logger to see actual errors
    logger = {
      debug: (...args) => console.log('[DEBUG]', ...args),
      info: (...args) => console.log('[INFO]', ...args),
      warn: (...args) => console.warn('[WARN]', ...args),
      error: (...args) => console.error('[ERROR]', ...args),
    };

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
    await schemaLoader.loadAndCompileAllSchemas();

    // Verify rule schema is loaded
    const ruleSchemaId = 'schema://living-narrative-engine/rule.schema.json';
    const isLoaded = validator.isSchemaLoaded(ruleSchemaId);
    if (!isLoaded) {
      throw new Error(`Rule schema not loaded: ${ruleSchemaId}`);
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
        const filePath = join(
          process.cwd(),
          'data/mods/music/rules',
          fileName
        );
        const ruleContent = JSON.parse(readFileSync(filePath, 'utf-8'));

        // Act & Assert
        expect(() => {
          validateAgainstSchema(
            validator,
            'schema://living-narrative-engine/rule.schema.json',
            ruleContent,
            logger
          );
        }).not.toThrow();

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

      // Act & Assert
      expect(() => {
        validateAgainstSchema(
          validator,
          'schema://living-narrative-engine/rule.schema.json',
          sampleRule,
          logger
        );
      }).not.toThrow();
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

      // Act & Assert
      expect(() => {
        validateAgainstSchema(
          validator,
          'schema://living-narrative-engine/rule.schema.json',
          sampleRule,
          logger
        );
      }).not.toThrow();
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

      // Act & Assert
      expect(() => {
        validateAgainstSchema(
          validator,
          'schema://living-narrative-engine/rule.schema.json',
          invalidRule,
          logger
        );
      }).toThrow();
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

      // Act & Assert
      expect(() => {
        validateAgainstSchema(
          validator,
          'schema://living-narrative-engine/rule.schema.json',
          invalidRule,
          logger
        );
      }).toThrow();
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

      // Act & Assert
      expect(() => {
        validateAgainstSchema(
          validator,
          'schema://living-narrative-engine/rule.schema.json',
          invalidRule,
          logger
        );
      }).toThrow();
    });
  });
});
