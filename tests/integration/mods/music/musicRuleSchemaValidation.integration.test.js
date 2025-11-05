/**
 * @file Integration test for music mod rule schema validation.
 * @description Verifies that music mod rule files pass schema validation,
 * particularly rules that use QUERY_LOOKUP operations.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { validateAgainstSchema } from '../../../../src/validation/schemaValidationUtils.js';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Music Mod Rule Schema Validation', () => {
  let validator;

  beforeAll(async () => {
    validator = new AjvSchemaValidator();
    await validator.loadSchemas();
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
          __dirname,
          '../../../../data/mods/music/rules',
          fileName
        );
        const ruleContent = JSON.parse(readFileSync(filePath, 'utf-8'));

        // Act & Assert
        expect(() => {
          validateAgainstSchema(
            ruleContent,
            'schema://living-narrative-engine/rule.schema.json',
            validator
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
          sampleRule,
          'schema://living-narrative-engine/rule.schema.json',
          validator
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
          sampleRule,
          'schema://living-narrative-engine/rule.schema.json',
          validator
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
          invalidRule,
          'schema://living-narrative-engine/rule.schema.json',
          validator
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
          invalidRule,
          'schema://living-narrative-engine/rule.schema.json',
          validator
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
          invalidRule,
          'schema://living-narrative-engine/rule.schema.json',
          validator
        );
      }).toThrow();
    });
  });
});
