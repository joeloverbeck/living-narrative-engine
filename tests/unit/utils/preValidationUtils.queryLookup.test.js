/**
 * @file preValidationUtils.queryLookup.test.js
 * @description Unit tests for QUERY_LOOKUP operation type validation
 * Reproduces issue: https://github.com/joeloverbeck/living-narrative-engine/issues/XXXX
 * QUERY_LOOKUP handler exists and is registered at runtime but missing from KNOWN_OPERATION_TYPES
 */

import { describe, it, expect } from '@jest/globals';

import {
  validateOperationStructure,
  validateAllOperations,
  validateRuleStructure,
  performPreValidation,
} from '../../../src/utils/preValidationUtils.js';

describe('preValidationUtils - QUERY_LOOKUP operation type', () => {
  describe('validateOperationStructure', () => {
    it('should validate QUERY_LOOKUP operation with all required parameters', () => {
      const operation = {
        type: 'QUERY_LOOKUP',
        parameters: {
          lookup_id: 'music:mood_lexicon',
          entry_key: 'aggressive',
          result_variable: 'moodData',
          missing_value: {
            adj: 'aggressive',
            adjectives: 'aggressive',
            noun: 'aggressive',
          },
        },
      };

      const result = validateOperationStructure(operation);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
      expect(result.path).toBeNull();
      expect(result.suggestions).toBeNull();
    });

    it('should validate QUERY_LOOKUP operation without optional missing_value', () => {
      const operation = {
        type: 'QUERY_LOOKUP',
        parameters: {
          lookup_id: 'music:mood_lexicon',
          entry_key: 'cheerful',
          result_variable: 'moodData',
        },
      };

      const result = validateOperationStructure(operation);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe('validateAllOperations', () => {
    it('should validate rule with QUERY_LOOKUP operation in actions array', () => {
      const ruleData = {
        actions: [
          {
            type: 'GET_NAME',
            parameters: {
              entity_ref: 'actor',
              result_variable: 'actorName',
            },
          },
          {
            type: 'QUERY_LOOKUP',
            parameters: {
              lookup_id: 'music:mood_lexicon',
              entry_key: 'triumphant',
              result_variable: 'moodData',
              missing_value: {
                adj: 'triumphant',
                adjectives: 'triumphant',
                noun: 'triumph',
              },
            },
          },
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entity_ref: 'actor',
              component_type: 'music:performance_mood',
              value: {
                mood: 'triumphant',
              },
            },
          },
        ],
      };

      const result = validateAllOperations(ruleData, 'root');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should validate QUERY_LOOKUP at various positions in actions array', () => {
      // Test with QUERY_LOOKUP at different indices
      const positions = [0, 3, 5];

      positions.forEach((position) => {
        const actions = [];

        // Add other operations before
        for (let i = 0; i < position; i++) {
          actions.push({
            type: 'SET_VARIABLE',
            parameters: {
              variable_name: `var${i}`,
              value: `value${i}`,
            },
          });
        }

        // Add QUERY_LOOKUP at target position
        actions.push({
          type: 'QUERY_LOOKUP',
          parameters: {
            lookup_id: 'music:mood_lexicon',
            entry_key: 'solemn',
            result_variable: 'moodData',
          },
        });

        // Add operations after
        actions.push({
          type: 'END_TURN',
        });

        const ruleData = { actions };
        const result = validateAllOperations(ruleData, 'root');
        expect(result.isValid).toBe(true);
        expect(result.error).toBeNull();
      });
    });
  });

  describe('validateRuleStructure', () => {
    it('should validate complete music mod rule with QUERY_LOOKUP', () => {
      // This is a real-world example from music mod
      const ruleData = {
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: 'handle_set_aggressive_mood_on_instrument',
        comment:
          "Handles the 'music:set_aggressive_mood_on_instrument' action.",
        event_type: 'core:attempt_action',
        condition: {
          condition_ref:
            'music:event-is-action-set-aggressive-mood-on-instrument',
        },
        actions: [
          {
            type: 'GET_NAME',
            parameters: {
              entity_ref: 'actor',
              result_variable: 'actorName',
            },
          },
          {
            type: 'GET_NAME',
            parameters: {
              entity_ref: 'primary',
              result_variable: 'instrumentName',
            },
          },
          {
            type: 'QUERY_COMPONENT',
            parameters: {
              entity_ref: 'actor',
              component_type: 'core:position',
              result_variable: 'actorPosition',
            },
          },
          {
            type: 'QUERY_LOOKUP',
            parameters: {
              lookup_id: 'music:mood_lexicon',
              entry_key: 'aggressive',
              result_variable: 'moodData',
              missing_value: {
                adj: 'aggressive',
                adjectives: 'aggressive',
                noun: 'aggressive',
              },
            },
          },
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entity_ref: 'actor',
              component_type: 'music:performance_mood',
              value: {
                mood: 'aggressive',
              },
            },
          },
        ],
      };

      const result = validateRuleStructure(ruleData);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should validate all music mod mood rules with QUERY_LOOKUP', () => {
      // Test all mood variations used in music mod
      const moods = [
        'aggressive',
        'cheerful',
        'eerie',
        'meditative',
        'mournful',
        'playful',
        'solemn',
        'tender',
        'tense',
        'triumphant',
      ];

      moods.forEach((mood) => {
        const ruleData = {
          $schema: 'schema://living-narrative-engine/rule.schema.json',
          rule_id: `handle_set_${mood}_mood_on_instrument`,
          event_type: 'core:attempt_action',
          condition: {
            condition_ref: `music:event-is-action-set-${mood}-mood-on-instrument`,
          },
          actions: [
            {
              type: 'QUERY_LOOKUP',
              parameters: {
                lookup_id: 'music:mood_lexicon',
                entry_key: mood,
                result_variable: 'moodData',
                missing_value: {
                  adj: mood,
                },
              },
            },
            {
              type: 'END_TURN',
            },
          ],
        };

        const result = validateRuleStructure(
          ruleData,
          `handle_set_${mood}_mood_on_instrument.rule.json`
        );
        expect(result.isValid).toBe(true);
        expect(result.error).toBeNull();
      });
    });
  });

  describe('performPreValidation', () => {
    it('should pass pre-validation for rule with QUERY_LOOKUP operation', () => {
      const ruleData = {
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: 'test_query_lookup_rule',
        event_type: 'core:test_event',
        condition: {
          condition_ref: 'test:condition',
        },
        actions: [
          {
            type: 'QUERY_LOOKUP',
            parameters: {
              lookup_id: 'test:lookup_table',
              entry_key: 'test_key',
              result_variable: 'testVar',
            },
          },
          {
            type: 'END_TURN',
          },
        ],
      };

      const result = performPreValidation(
        ruleData,
        'schema://living-narrative-engine/rule.schema.json',
        'test_query_lookup_rule.rule.json'
      );

      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should pass pre-validation for complex rule with multiple QUERY_LOOKUP operations', () => {
      const ruleData = {
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: 'complex_query_lookup_rule',
        event_type: 'core:test_event',
        condition: {
          condition_ref: 'test:condition',
        },
        actions: [
          {
            type: 'QUERY_LOOKUP',
            parameters: {
              lookup_id: 'music:mood_lexicon',
              entry_key: 'cheerful',
              result_variable: 'mood1',
            },
          },
          {
            type: 'SET_VARIABLE',
            parameters: {
              variable_name: 'test',
              value: 'value',
            },
          },
          {
            type: 'QUERY_LOOKUP',
            parameters: {
              lookup_id: 'music:tempo_lexicon',
              entry_key: 'fast',
              result_variable: 'tempo',
            },
          },
          {
            type: 'QUERY_LOOKUP',
            parameters: {
              lookup_id: 'music:volume_lexicon',
              entry_key: 'loud',
              result_variable: 'volume',
              missing_value: 'default',
            },
          },
          {
            type: 'END_TURN',
          },
        ],
      };

      const result = performPreValidation(
        ruleData,
        'schema://living-narrative-engine/rule.schema.json',
        'complex_query_lookup_rule.rule.json'
      );

      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe('error cases', () => {
    it('should provide helpful suggestions if QUERY_LOOKUP were missing (regression test)', () => {
      // This test ensures that if QUERY_LOOKUP is accidentally removed from KNOWN_OPERATION_TYPES,
      // we get clear error messages
      const operation = {
        type: 'NONEXISTENT_OPERATION',
        parameters: {},
      };

      const result = validateOperationStructure(operation);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unknown operation type');
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });
});
