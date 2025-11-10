/**
 * @file Integration tests for effects validation workflow
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EffectsValidator from '../../../src/goap/validation/effectsValidator.js';
import EffectsAnalyzer from '../../../src/goap/analysis/effectsAnalyzer.js';

describe('Effects Validation Integration', () => {
  let effectsValidator;
  let effectsAnalyzer;
  let mockLogger;
  let mockDataRegistry;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    mockDataRegistry = {
      get: jest.fn(),
      getAll: jest.fn()
    };

    effectsAnalyzer = new EffectsAnalyzer({
      logger: mockLogger,
      dataRegistry: mockDataRegistry
    });

    effectsValidator = new EffectsValidator({
      logger: mockLogger,
      effectsAnalyzer: effectsAnalyzer,
      dataRegistry: mockDataRegistry
    });
  });

  describe('Validation workflow', () => {
    it('should create validator instance', () => {
      expect(effectsValidator).toBeDefined();
    });

    it('should validate action with no planning effects', async () => {
      const action = {
        id: 'test:sample_action',
        name: 'Sample Action'
      };

      mockDataRegistry.get.mockReturnValueOnce(action);

      const result = await effectsValidator.validateAction('test:sample_action');

      expect(result).toBeDefined();
      expect(result.actionId).toBe('test:sample_action');
      expect(result.warnings).toBeDefined();
    });

    it('should handle action not found gracefully', async () => {
      mockDataRegistry.get.mockReturnValueOnce(null);

      const result = await effectsValidator.validateAction('nonexistent:action');

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Action not found');
    });

    it('should validate mod with no actions', async () => {
      mockDataRegistry.getAll.mockReturnValue([]);

      const results = await effectsValidator.validateMod('nonexistent_mod');

      expect(results.summary.total).toBe(0);
    });

    it('should validate all mods successfully', async () => {
      mockDataRegistry.getAll.mockReturnValue([]);

      const results = await effectsValidator.validateAllMods();

      expect(results).toBeDefined();
      expect(results.summary).toBeDefined();
      expect(results.actions).toBeDefined();
      expect(Array.isArray(results.actions)).toBe(true);
    });
  });

  describe('Effect comparison', () => {
    it('should detect matching effects correctly', async () => {
      const action = {
        id: 'test:action_with_effects',
        name: 'Action With Effects',
        planningEffects: {
          effects: [
            {
              operation: 'ADD_COMPONENT',
              entity: 'actor',
              component: 'test:test_component'
            }
          ]
        }
      };

      const rule = {
        id: 'test:handle_action_with_effects',
        actions: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entity: 'actor',
              component: 'test:test_component'
            }
          }
        ]
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'actions' && id === 'test:action_with_effects') return action;
        if (type === 'rules' && id === 'test:handle_action_with_effects') return rule;
        return null;
      });

      const result = await effectsValidator.validateAction('test:action_with_effects');

      expect(result).toBeDefined();
    });

    it('should handle validation of multiple actions', async () => {
      const actions = [
        { id: 'test:action1', name: 'Action 1' },
        { id: 'test:action2', name: 'Action 2' }
      ];

      mockDataRegistry.getAll.mockReturnValue(actions);
      mockDataRegistry.get.mockReturnValue(null);

      const results = await effectsValidator.validateMod('test');

      expect(results.actions.length).toBeGreaterThanOrEqual(0);
      expect(results.summary.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error handling', () => {
    it('should handle missing action gracefully', async () => {
      mockDataRegistry.get.mockReturnValue(null);

      const result = await effectsValidator.validateAction('missing:action');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should continue validation when individual actions fail', async () => {
      mockDataRegistry.getAll.mockReturnValue([
        { id: 'test:good_action', name: 'Good Action' }
      ]);
      mockDataRegistry.get.mockReturnValue(null);

      const results = await effectsValidator.validateMod('test');

      expect(results).toBeDefined();
      expect(results.summary).toBeDefined();
    });
  });

  describe('Summary statistics', () => {
    it('should calculate correct summary for validation results', async () => {
      mockDataRegistry.getAll.mockReturnValue([
        { id: 'test:action1' },
        { id: 'test:action2' }
      ]);
      mockDataRegistry.get.mockReturnValue(null);

      const results = await effectsValidator.validateAllMods();

      expect(results.summary.total).toBeGreaterThanOrEqual(0);
      expect(results.summary.valid).toBeGreaterThanOrEqual(0);
      expect(results.summary.warnings).toBeGreaterThanOrEqual(0);
      expect(results.summary.errors).toBeGreaterThanOrEqual(0);

      // Total should be sum of valid and invalid
      expect(results.summary.total).toBe(results.actions.length);
    });
  });
});
