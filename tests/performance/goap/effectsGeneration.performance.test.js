/**
 * @file Performance tests for GOAP effects generation
 */

import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import EffectsGenerator from '../../../src/goap/generation/effectsGenerator.js';
import EffectsAnalyzer from '../../../src/goap/analysis/effectsAnalyzer.js';

describe('Effects Generation Performance', () => {
  let effectsGenerator;
  let effectsAnalyzer;
  let dataRegistry;
  let mockLogger;
  let mockSchemaValidator;

  beforeAll(async () => {
    // Create mock services following integration test pattern
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({ isValid: true })
    };

    // Create mock data registry with test actions and rules
    const testActions = createTestActions();
    const testRules = createTestRules();

    dataRegistry = {
      get: jest.fn((type, id) => {
        if (type === 'actions') return testActions.find(a => a.id === id);
        if (type === 'rules') return testRules.find(r => r.id === id);
        return undefined;
      }),
      getAll: jest.fn((type) => {
        if (type === 'actions') {
          const actionsMap = new Map();
          testActions.forEach(action => actionsMap.set(action.id, action));
          return actionsMap;
        }
        return new Map();
      })
    };

    effectsAnalyzer = new EffectsAnalyzer({
      logger: mockLogger,
      dataRegistry
    });

    effectsGenerator = new EffectsGenerator({
      logger: mockLogger,
      effectsAnalyzer,
      dataRegistry,
      schemaValidator: mockSchemaValidator
    });
  });

  describe('Batch Generation Performance', () => {
    it('should generate effects for 200 actions in under 5 seconds', () => {
      // Get action IDs from all loaded mods, limited to 200 for consistent benchmarking
      const allActions = dataRegistry.getAll('actions');
      const actionIds = Array.from(allActions.keys()).slice(0, 200);

      // Ensure we have enough actions to test (should have at least 200)
      expect(actionIds.length).toBe(200);

      const startTime = Date.now();
      const effectsMap = new Map();

      for (const actionId of actionIds) {
        try {
          const effects = effectsGenerator.generateForAction(actionId);
          if (effects) {
            effectsMap.set(actionId, effects);
          }
        } catch {
          // Skip actions that can't be generated (expected for some actions)
          continue;
        }
      }

      const duration = Date.now() - startTime;

      expect(effectsMap.size).toBeGreaterThan(50);
      expect(duration).toBeLessThan(5000); // < 5 seconds

      // Log performance metrics
      console.log(`\nPerformance Metrics:`);
      console.log(`  Actions tested: ${actionIds.length} (capped for consistent benchmarking)`);
      console.log(`  Generated effects: ${effectsMap.size}`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Average: ${Math.round(duration / effectsMap.size)}ms per action`);
    });

    it('should maintain performance with repeated generations', () => {
      // Use more actions per iteration to get more stable measurements
      const allActions = dataRegistry.getAll('actions');
      const actionIds = Array.from(allActions.keys()).slice(0, 20);

      const iterations = 10;
      const durations = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        for (const actionId of actionIds) {
          try {
            effectsGenerator.generateForAction(actionId);
          } catch {
            // Skip if action not found
            continue;
          }
        }

        durations.push(Date.now() - startTime);
      }

      // Calculate average duration
      const avgDuration =
        durations.reduce((sum, d) => sum + d, 0) / durations.length;

      // Standard deviation should be low (consistent performance)
      const variance =
        durations
          .map(d => Math.pow(d - avgDuration, 2))
          .reduce((sum, v) => sum + v, 0) / durations.length;
      const stdDev = Math.sqrt(variance);

      // Performance should be reasonably consistent
      // Use absolute threshold since micro-benchmarks have natural variance
      expect(stdDev).toBeLessThan(10); // < 10ms variation is acceptable

      console.log(`\nRepeated Generation Metrics:`);
      console.log(`  Iterations: ${iterations}`);
      console.log(`  Actions per iteration: ${actionIds.length}`);
      console.log(`  Average duration: ${avgDuration.toFixed(2)}ms`);
      console.log(`  Standard deviation: ${stdDev.toFixed(2)}ms`);
    });
  });

  describe('Single Action Analysis Performance', () => {
    it('should analyze complex rule in under 100ms', () => {
      // Use a generated test action with conditionals (complexity > 0.6)
      const allActions = dataRegistry.getAll('actions');
      const actionIds = Array.from(allActions.keys());

      // Find an action that should have a complex rule
      const complexActionId = actionIds.find(id => {
        const ruleId = convertActionIdToRuleId(id);
        const rule = dataRegistry.get('rules', ruleId);
        return rule?.actions?.some(op => op.type === 'IF');
      }) || actionIds[0];

      const startTime = Date.now();
      const effects = effectsGenerator.generateForAction(complexActionId);
      const duration = Date.now() - startTime;

      expect(effects).toBeDefined();
      expect(duration).toBeLessThan(100); // < 100ms

      console.log(`\nComplex Rule Analysis:`);
      console.log(`  Action: ${complexActionId}`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Effects count: ${effects?.effects?.length || 0}`);
    });

    it('should analyze simple rule in under 10ms', () => {
      // Use a generated test action with simple operations
      const allActions = dataRegistry.getAll('actions');
      const actionIds = Array.from(allActions.keys());

      // Find an action that should have a simple rule (no conditionals)
      const simpleActionId = actionIds.find(id => {
        const ruleId = convertActionIdToRuleId(id);
        const rule = dataRegistry.get('rules', ruleId);
        return rule?.actions?.length === 1 && rule.actions[0].type === 'ADD_COMPONENT';
      }) || actionIds[0];

      const startTime = Date.now();
      const effects = effectsGenerator.generateForAction(simpleActionId);
      const duration = Date.now() - startTime;

      expect(effects).toBeDefined();
      expect(duration).toBeLessThan(10); // < 10ms

      console.log(`\nSimple Rule Analysis:`);
      console.log(`  Action: ${simpleActionId}`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Effects count: ${effects?.effects?.length || 0}`);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during batch generation', () => {
      const actionIds = Array.from(dataRegistry.getAll('actions').keys()).slice(
        0,
        50
      );

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      // Generate effects multiple times
      for (let i = 0; i < 5; i++) {
        for (const actionId of actionIds) {
          try {
            effectsGenerator.generateForAction(actionId);
          } catch {
            // Skip
            continue;
          }
        }

        // Force garbage collection between iterations
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      // Memory increase should be reasonable (< 10MB)
      expect(memoryIncrease).toBeLessThan(10);

      console.log(`\nMemory Usage:`);
      console.log(`  Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Increase: ${memoryIncrease.toFixed(2)}MB`);
    });
  });

  describe('Validation Performance', () => {
    it('should validate effects quickly', () => {
      const actionIds = Array.from(dataRegistry.getAll('actions').keys()).slice(
        0,
        20
      );

      const startTime = Date.now();

      for (const actionId of actionIds) {
        try {
          const effects = effectsGenerator.generateForAction(actionId);
          if (effects) {
            effectsGenerator.validateEffects(actionId, effects);
          }
        } catch {
          // Skip
          continue;
        }
      }

      const duration = Date.now() - startTime;

      // Should validate 20 actions in under 500ms
      expect(duration).toBeLessThan(500);

      console.log(`\nValidation Performance:`);
      console.log(`  Actions validated: 20`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Average: ${Math.round(duration / 20)}ms per action`);
    });
  });
});

/**
 * Creates test actions for performance benchmarking
 * @returns {Array} Array of test action definitions
 */
function createTestActions() {
  const actions = [];

  // Create 200 test actions with various patterns
  const actionTypes = [
    { prefix: 'positioning', operations: ['sit_down', 'stand_up', 'lie_down', 'kneel_down'] },
    { prefix: 'items', operations: ['pick_up_item', 'drop_item', 'give_item', 'open_container'] },
    { prefix: 'movement', operations: ['go', 'teleport'] },
    { prefix: 'affection', operations: ['hug', 'kiss', 'hold_hand'] }
  ];

  let actionCount = 0;
  while (actionCount < 200) {
    for (const type of actionTypes) {
      for (const operation of type.operations) {
        if (actionCount >= 200) break;

        const actionId = `${type.prefix}:${operation}_${actionCount}`;
        actions.push({
          id: actionId,
          name: `${operation} ${actionCount}`,
          description: `Test action ${actionCount}`
        });
        actionCount++;
      }
      if (actionCount >= 200) break;
    }
  }

  return actions;
}

/**
 * Creates test rules for performance benchmarking
 * @returns {Array} Array of test rule definitions
 */
function createTestRules() {
  const rules = [];
  const testActions = createTestActions();

  testActions.forEach(action => {
    const ruleId = `${action.id.split(':')[0]}:handle_${action.id.split(':')[1]}`;

    // Create rules with varying complexity
    const complexity = Math.random();

    if (complexity < 0.3) {
      // Simple rule - single component operation
      rules.push({
        id: ruleId,
        event: { type: 'ACTION_DECIDED' },
        actions: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entity: 'actor',
              component: `${action.id.split(':')[0]}:test_component`,
              data: {}
            }
          }
        ]
      });
    } else if (complexity < 0.6) {
      // Medium complexity - multiple operations
      rules.push({
        id: ruleId,
        event: { type: 'ACTION_DECIDED' },
        actions: [
          {
            type: 'REMOVE_COMPONENT',
            parameters: {
              entity: 'actor',
              component: `${action.id.split(':')[0]}:old_state`
            }
          },
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entity: 'actor',
              component: `${action.id.split(':')[0]}:new_state`,
              data: { value: 42 }
            }
          }
        ]
      });
    } else {
      // Complex rule - conditional operations
      rules.push({
        id: ruleId,
        event: { type: 'ACTION_DECIDED' },
        actions: [
          {
            type: 'IF',
            parameters: {
              condition: { var: 'someCondition' },
              then_actions: [
                {
                  type: 'ADD_COMPONENT',
                  parameters: {
                    entity: 'actor',
                    component: `${action.id.split(':')[0]}:conditional_state`,
                    data: {}
                  }
                }
              ],
              else_actions: [
                {
                  type: 'ADD_COMPONENT',
                  parameters: {
                    entity: 'actor',
                    component: `${action.id.split(':')[0]}:fallback_state`,
                    data: {}
                  }
                }
              ]
            }
          }
        ]
      });
    }
  });

  return rules;
}

/**
 * Converts an action ID to the corresponding rule ID
 * @param {string} actionId - Action ID (e.g., 'positioning:sit_down_0')
 * @returns {string} Rule ID (e.g., 'positioning:handle_sit_down_0')
 */
function convertActionIdToRuleId(actionId) {
  const parts = actionId.split(':');
  if (parts.length === 2) {
    return `${parts[0]}:handle_${parts[1]}`;
  }
  return actionId;
}
