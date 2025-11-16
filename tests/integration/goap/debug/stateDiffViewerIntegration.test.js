/**
 * @file Integration tests for StateDiffViewer with PlanningEffectsSimulator
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';
import StateDiffViewer from '../../../../src/goap/debug/stateDiffViewer.js';
import PlanningEffectsSimulator from '../../../../src/goap/planner/planningEffectsSimulator.js';
import ContextAssemblyService from '../../../../src/goap/services/contextAssemblyService.js';
import ParameterResolutionService from '../../../../src/goap/services/parameterResolutionService.js';

describe('StateDiffViewer Integration', () => {
  let testBed;
  let viewer;
  let simulator;
  let entityManager;
  let contextAssembly;
  let parameterResolution;

  beforeEach(() => {
    testBed = createTestBed();
    entityManager = new SimpleEntityManager();

    // Set up services required by PlanningEffectsSimulator
    contextAssembly = new ContextAssemblyService({
      entityManager,
      logger: testBed.createMockLogger(),
    });

    parameterResolution = new ParameterResolutionService({
      entityManager,
      logger: testBed.createMockLogger(),
    });

    simulator = new PlanningEffectsSimulator({
      parameterResolutionService: parameterResolution,
      contextAssemblyService: contextAssembly,
      logger: testBed.createMockLogger(),
    });

    viewer = new StateDiffViewer({
      logger: testBed.createMockLogger(),
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Integration with PlanningEffectsSimulator', () => {
    it('should detect state changes from REMOVE_COMPONENT effect', () => {
      // Create initial state
      const beforeState = {
        'actor-1:core:hungry': { level: 50 },
        'actor-1:core:exists': true,
      };

      // Define effect to remove hungry component
      const effects = [
        {
          type: 'REMOVE_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'core:hungry',
          },
        },
      ];

      // Create context for parameter resolution
      const context = {
        actor: 'actor-1',
      };

      // Simulate effects
      const result = simulator.simulateEffects(beforeState, effects, context);

      // Verify simulation succeeded
      expect(result.success).toBe(true);

      // Use viewer to analyze the change
      const diff = viewer.diff(beforeState, result.state);

      expect(diff.removed).toEqual({ 'actor-1:core:hungry': { level: 50 } });
      expect(diff.added).toEqual({});
      expect(diff.modified).toEqual([]);
    });

    it('should detect state changes from ADD_COMPONENT effect', () => {
      const beforeState = {
        'actor-1:core:exists': true,
      };

      const effects = [
        {
          type: 'ADD_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'core:satiated',
            component_data: {},
          },
        },
      ];

      const context = {
        actor: 'actor-1',
      };

      const result = simulator.simulateEffects(beforeState, effects, context);

      expect(result.success).toBe(true);

      const diff = viewer.diff(beforeState, result.state);

      expect(diff.added).toEqual({ 'actor-1:core:satiated': {} });
      expect(diff.removed).toEqual({});
      expect(diff.modified).toEqual([]);
    });

    it('should detect state changes from MODIFY_COMPONENT effect', () => {
      const beforeState = {
        'actor-1:core:actor:health': 100,
      };

      const effects = [
        {
          type: 'MODIFY_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'core:actor',
            field: 'health',
            value: 75,
          },
        },
      ];

      const context = {
        actor: 'actor-1',
      };

      const result = simulator.simulateEffects(beforeState, effects, context);

      expect(result.success).toBe(true);

      const diff = viewer.diff(beforeState, result.state);

      expect(diff.modified).toEqual([
        {
          key: 'actor-1:core:actor:health',
          before: 100,
          after: 75,
        },
      ]);
      expect(diff.added).toEqual({});
      expect(diff.removed).toEqual({});
    });

    it('should handle complex multi-effect scenario', () => {
      const beforeState = {
        'actor-1:core:hungry': { level: 50 },
        'actor-1:core:actor:health': 100,
        'food-1:core:exists': true,
      };

      // Simulate eating: remove hungry, add satiated, increase health, remove food
      const effects = [
        {
          type: 'REMOVE_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'core:hungry',
          },
        },
        {
          type: 'ADD_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'core:satiated',
            component_data: {},
          },
        },
        {
          type: 'MODIFY_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'core:actor',
            field: 'health',
            value: 110,
          },
        },
        {
          type: 'REMOVE_COMPONENT',
          parameters: {
            entity_ref: 'food',
            component_type: 'core:exists',
          },
        },
      ];

      const context = {
        actor: 'actor-1',
        food: 'food-1',
      };

      const result = simulator.simulateEffects(beforeState, effects, context);

      expect(result.success).toBe(true);

      const diff = viewer.diff(beforeState, result.state);

      // Verify all changes detected
      expect(diff.added).toEqual({ 'actor-1:core:satiated': {} });
      expect(diff.removed).toEqual({
        'actor-1:core:hungry': { level: 50 },
        'food-1:core:exists': true,
      });
      expect(diff.modified).toEqual([
        {
          key: 'actor-1:core:actor:health',
          before: 100,
          after: 110,
        },
      ]);

      // Verify summary
      const json = viewer.diffJSON(beforeState, result.state);
      expect(json.summary.totalChanges).toBe(4);
      expect(json.summary.added).toBe(1);
      expect(json.summary.modified).toBe(1);
      expect(json.summary.removed).toBe(2);
    });

    it('should generate readable visualization for simulated effects', () => {
      const beforeState = {
        'actor-1:core:hungry': { level: 50 },
        'actor-1:core:exists': true,
      };

      const effects = [
        {
          type: 'REMOVE_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'core:hungry',
          },
        },
        {
          type: 'ADD_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'core:satiated',
            component_data: {},
          },
        },
      ];

      const context = {
        actor: 'actor-1',
      };

      const result = simulator.simulateEffects(beforeState, effects, context);
      const diff = viewer.diff(beforeState, result.state);

      const output = viewer.visualize(diff, {
        taskName: 'eat_food',
        stepNumber: 1,
      });

      // Verify output contains expected sections
      expect(output).toContain('=== Step 1 - Task: eat_food ===');
      expect(output).toContain('Changes: 2 total');
      expect(output).toContain('ADDED:');
      expect(output).toContain('+ actor-1:core:satiated');
      expect(output).toContain('REMOVED:');
      expect(output).toContain('- actor-1:core:hungry');
    });

    it('should handle no changes when effects have no impact', () => {
      const beforeState = {
        'actor-1:core:exists': true,
      };

      // Try to remove a component that doesn't exist
      const effects = [
        {
          type: 'REMOVE_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'core:hungry',
          },
        },
      ];

      const context = {
        actor: 'actor-1',
      };

      const result = simulator.simulateEffects(beforeState, effects, context);

      // Simulation still succeeds even if component doesn't exist
      expect(result.success).toBe(true);

      const diff = viewer.diff(beforeState, result.state);

      // No changes should be detected
      expect(diff.added).toEqual({});
      expect(diff.modified).toEqual([]);
      expect(diff.removed).toEqual({});

      const output = viewer.visualize(diff);
      expect(output).toContain('No state changes detected.');
    });

    it('should handle component with nested data modification', () => {
      const beforeState = {
        'actor-1:core:inventory': { items: ['sword'], weight: 5 },
      };

      const effects = [
        {
          type: 'MODIFY_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'core:inventory',
            field: 'items',
            value: ['sword', 'shield'],
          },
        },
      ];

      const context = {
        actor: 'actor-1',
      };

      const result = simulator.simulateEffects(beforeState, effects, context);

      expect(result.success).toBe(true);

      const diff = viewer.diff(beforeState, result.state);

      // Should detect the modification of the component (entire object changed)
      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].key).toBe('actor-1:core:inventory');
    });
  });

  describe('Planning State Format Validation', () => {
    it('should correctly handle entity:component format', () => {
      const beforeState = {
        'actor-1:core:hungry': {},
        'actor-1:core:exists': true,
      };

      const effects = [
        {
          type: 'REMOVE_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'core:hungry',
          },
        },
      ];

      const context = {
        actor: 'actor-1',
      };

      const result = simulator.simulateEffects(beforeState, effects, context);
      const diff = viewer.diff(beforeState, result.state);

      // Verify the key format is preserved
      expect(Object.keys(diff.removed)[0]).toBe('actor-1:core:hungry');
    });

    it('should correctly handle entity:component:field format', () => {
      const beforeState = {
        'actor-1:core:actor:health': 100,
        'actor-1:core:actor:stamina': 50,
      };

      const effects = [
        {
          type: 'MODIFY_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'core:actor',
            field: 'health',
            value: 75,
          },
        },
      ];

      const context = {
        actor: 'actor-1',
      };

      const result = simulator.simulateEffects(beforeState, effects, context);
      const diff = viewer.diff(beforeState, result.state);

      // Verify field-level changes are detected
      expect(diff.modified[0].key).toBe('actor-1:core:actor:health');
      expect(diff.modified[0].before).toBe(100);
      expect(diff.modified[0].after).toBe(75);
    });
  });
});
