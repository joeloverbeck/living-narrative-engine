import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionIndex } from '../../../src/actions/actionIndex.js';
import { createMockLogger } from '../../common/mockFactories';

describe('ActionIndex', () => {
  let logger;
  let entityManager;
  let actionIndex;

  beforeEach(() => {
    logger = createMockLogger();
    entityManager = {
      getAllComponentTypesForEntity: jest.fn(),
    };
    actionIndex = new ActionIndex({ logger, entityManager });
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize successfully with valid dependencies', () => {
      const instance = new ActionIndex({ logger, entityManager });
      expect(instance).toBeInstanceOf(ActionIndex);
      expect(logger.debug).toHaveBeenCalledWith('ActionIndex initialised.');
    });

    it('should throw error when logger is missing', () => {
      expect(() => {
        new ActionIndex({ entityManager });
      }).toThrow('ActionIndex requires a logger dependency');
    });

    it('should throw error when entityManager is missing', () => {
      expect(() => {
        new ActionIndex({ logger });
      }).toThrow('ActionIndex requires an entityManager dependency');
    });

    it('should throw error when logger is null', () => {
      expect(() => {
        new ActionIndex({ logger: null, entityManager });
      }).toThrow('ActionIndex requires a logger dependency');
    });

    it('should throw error when entityManager is null', () => {
      expect(() => {
        new ActionIndex({ logger, entityManager: null });
      }).toThrow('ActionIndex requires an entityManager dependency');
    });
  });

  describe('buildIndex', () => {
    it('should build index with valid action definitions', () => {
      const actionDefinitions = [
        {
          id: 'action1',
          name: 'Attack',
          required_components: {
            actor: ['core:stats'],
          },
        },
        {
          id: 'action2',
          name: 'Take Item',
          required_components: {
            actor: ['core:inventory'],
          },
        },
        {
          id: 'action3',
          name: 'Wait',
          // No required_components
        },
      ];

      actionIndex.buildIndex(actionDefinitions);

      expect(logger.debug).toHaveBeenCalledWith(
        'Building action index from 3 definitions...'
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'Action index built. 2 component-to-action maps created.'
      );
    });

    it('should handle actions with multiple required components', () => {
      const actionDefinitions = [
        {
          id: 'action1',
          name: 'Complex Action',
          required_components: {
            actor: ['core:stats', 'core:inventory', 'core:position'],
          },
        },
      ];

      actionIndex.buildIndex(actionDefinitions);

      // Each unique component gets its own map entry
      expect(logger.debug).toHaveBeenCalledWith(
        'Action index built. 3 component-to-action maps created.'
      );
    });

    it('should handle actions without required_components', () => {
      const actionDefinitions = [
        { id: 'action1', name: 'Universal Action' },
        { id: 'action2', name: 'Another Universal', required_components: {} },
        {
          id: 'action3',
          name: 'Empty Actor Array',
          required_components: { actor: [] },
        },
      ];

      actionIndex.buildIndex(actionDefinitions);

      expect(logger.debug).toHaveBeenCalledWith(
        'Action index built. 0 component-to-action maps created.'
      );
    });

    it('should warn and skip when allActionDefinitions is not an array', () => {
      actionIndex.buildIndex(null);

      expect(logger.warn).toHaveBeenCalledWith(
        'ActionIndex.buildIndex: allActionDefinitions must be an array. Skipping index build.'
      );
    });

    it('should warn and skip when allActionDefinitions is undefined', () => {
      actionIndex.buildIndex(undefined);

      expect(logger.warn).toHaveBeenCalledWith(
        'ActionIndex.buildIndex: allActionDefinitions must be an array. Skipping index build.'
      );
    });

    it('should skip invalid action definitions', () => {
      const actionDefinitions = [
        null,
        undefined,
        'invalid-string',
        42,
        {
          id: 'valid',
          name: 'Valid Action',
          required_components: { actor: ['core:stats'] },
        },
      ];

      actionIndex.buildIndex(actionDefinitions);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Skipping invalid action definition:')
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'Action index built. 1 component-to-action maps created.'
      );
    });

    it('should handle invalid component IDs in required_components.actor', () => {
      const actionDefinitions = [
        {
          id: 'action1',
          name: 'Action with invalid components',
          required_components: {
            actor: [
              'valid-component',
              null,
              '',
              '  ',
              42,
              undefined,
              'another-valid',
            ],
          },
        },
      ];

      actionIndex.buildIndex(actionDefinitions);

      // Should only create maps for valid component IDs
      expect(logger.debug).toHaveBeenCalledWith(
        'Action index built. 2 component-to-action maps created.'
      );
    });

    it('should clear existing index when building new one', () => {
      // First build
      actionIndex.buildIndex([
        { id: 'action1', required_components: { actor: ['comp1'] } },
      ]);
      expect(logger.debug).toHaveBeenCalledWith(
        'Action index built. 1 component-to-action maps created.'
      );

      // Second build should clear first
      actionIndex.buildIndex([
        { id: 'action2', required_components: { actor: ['comp2'] } },
      ]);
      expect(logger.debug).toHaveBeenCalledWith(
        'Action index built. 1 component-to-action maps created.'
      );
    });

    it('should handle non-array required_components.actor', () => {
      const actionDefinitions = [
        {
          id: 'action1',
          required_components: {
            actor: 'not-an-array',
          },
        },
        {
          id: 'action2',
          required_components: {
            actor: null,
          },
        },
      ];

      actionIndex.buildIndex(actionDefinitions);

      expect(logger.debug).toHaveBeenCalledWith(
        'Action index built. 0 component-to-action maps created.'
      );
    });
  });

  describe('getCandidateActions', () => {
    beforeEach(() => {
      const actionDefinitions = [
        {
          id: 'attack',
          name: 'Attack',
          required_components: { actor: ['core:combat'] },
        },
        {
          id: 'take',
          name: 'Take',
          required_components: { actor: ['core:inventory'] },
        },
        {
          id: 'move',
          name: 'Move',
          required_components: { actor: ['core:position'] },
        },
        {
          id: 'dual-req',
          name: 'Dual Requirement',
          required_components: { actor: ['core:combat', 'core:inventory'] },
        },
        {
          id: 'wait',
          name: 'Wait',
          // No requirements
        },
        {
          id: 'sleep',
          name: 'Sleep',
          // No requirements
        },
      ];
      actionIndex.buildIndex(actionDefinitions);
    });

    it('should return candidate actions for entity with matching components', () => {
      const actorEntity = { id: 'player1' };
      entityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:combat',
        'core:inventory',
      ]);

      const candidates = actionIndex.getCandidateActions(actorEntity);

      expect(entityManager.getAllComponentTypesForEntity).toHaveBeenCalledWith(
        'player1'
      );
      expect(candidates).toHaveLength(5); // wait, sleep, attack, take, dual-req
      expect(candidates.map((a) => a.id)).toEqual(
        expect.arrayContaining(['wait', 'sleep', 'attack', 'take', 'dual-req'])
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'ActionIndex: Retrieved 5 candidate actions for actor player1.'
      );
    });

    it('should deduplicate actions when actor has multiple components for same action', () => {
      const actorEntity = { id: 'player1' };
      entityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:combat',
        'core:inventory',
      ]);

      const candidates = actionIndex.getCandidateActions(actorEntity);

      // dual-req action requires both components, should only appear once
      const dualReqActions = candidates.filter((a) => a.id === 'dual-req');
      expect(dualReqActions).toHaveLength(1);
    });

    it('should return only no-requirement actions for entity with no matching components', () => {
      const actorEntity = { id: 'npc1' };
      entityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:dialogue',
      ]);

      const candidates = actionIndex.getCandidateActions(actorEntity);

      expect(candidates).toHaveLength(2); // wait, sleep
      expect(candidates.map((a) => a.id)).toEqual(
        expect.arrayContaining(['wait', 'sleep'])
      );
    });

    it('should return only no-requirement actions for entity with no components', () => {
      const actorEntity = { id: 'empty1' };
      entityManager.getAllComponentTypesForEntity.mockReturnValue([]);

      const candidates = actionIndex.getCandidateActions(actorEntity);

      expect(candidates).toHaveLength(2); // wait, sleep
      expect(candidates.map((a) => a.id)).toEqual(
        expect.arrayContaining(['wait', 'sleep'])
      );
    });

    it('should return empty array when entity is null', () => {
      const candidates = actionIndex.getCandidateActions(null);

      expect(candidates).toEqual([]);
      expect(
        entityManager.getAllComponentTypesForEntity
      ).not.toHaveBeenCalled();
    });

    it('should return empty array when entity is undefined', () => {
      const candidates = actionIndex.getCandidateActions(undefined);

      expect(candidates).toEqual([]);
      expect(
        entityManager.getAllComponentTypesForEntity
      ).not.toHaveBeenCalled();
    });

    it('should return empty array when entity has no id', () => {
      const actorEntity = { name: 'no-id-entity' };
      const candidates = actionIndex.getCandidateActions(actorEntity);

      expect(candidates).toEqual([]);
      expect(
        entityManager.getAllComponentTypesForEntity
      ).not.toHaveBeenCalled();
    });

    it('should exclude actions when actor lacks some required components', () => {
      const actorEntity = { id: 'partial1' };
      entityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:combat',
      ]);

      const candidates = actionIndex.getCandidateActions(actorEntity);

      // dual-req is excluded because actor only has core:combat but also needs core:inventory
      // ActionIndex validates that ALL required components are present
      expect(candidates).toHaveLength(3); // wait, sleep, attack
      expect(candidates.map((a) => a.id)).toEqual(
        expect.arrayContaining(['wait', 'sleep', 'attack'])
      );
      expect(candidates.map((a) => a.id)).not.toContain('dual-req');
      expect(candidates.map((a) => a.id)).not.toContain('take');
      expect(candidates.map((a) => a.id)).not.toContain('move');
    });

    it('should handle entity manager returning null component types', () => {
      const actorEntity = { id: 'null-components' };
      entityManager.getAllComponentTypesForEntity.mockReturnValue(null);

      const candidates = actionIndex.getCandidateActions(actorEntity);

      // Should handle gracefully and still return no-requirement actions
      expect(candidates).toHaveLength(2); // wait, sleep
    });

    it('should work with complex component hierarchies', () => {
      const complexActionDefinitions = [
        {
          id: 'basic-action',
          required_components: { actor: ['basic'] },
        },
        {
          id: 'advanced-action',
          required_components: { actor: ['basic', 'advanced'] },
        },
        {
          id: 'expert-action',
          required_components: { actor: ['basic', 'advanced', 'expert'] },
        },
        {
          id: 'universal',
        },
      ];

      const complexIndex = new ActionIndex({ logger, entityManager });
      complexIndex.buildIndex(complexActionDefinitions);

      const actorEntity = { id: 'expert-user' };
      entityManager.getAllComponentTypesForEntity.mockReturnValue([
        'basic',
        'advanced',
        'expert',
      ]);

      const candidates = complexIndex.getCandidateActions(actorEntity);

      expect(candidates).toHaveLength(4); // All actions should be available
      expect(candidates.map((a) => a.id)).toEqual(
        expect.arrayContaining([
          'basic-action',
          'advanced-action',
          'expert-action',
          'universal',
        ])
      );
    });
  });

  describe('integration scenarios', () => {
    it('should work with empty action definitions array', () => {
      actionIndex.buildIndex([]);

      const actorEntity = { id: 'player1' };
      entityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:combat',
      ]);

      const candidates = actionIndex.getCandidateActions(actorEntity);

      expect(candidates).toEqual([]);
      expect(logger.debug).toHaveBeenCalledWith(
        'Building action index from 0 definitions...'
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'Action index built. 0 component-to-action maps created.'
      );
    });

    it('should handle rebuild scenario correctly', () => {
      // Initial build
      actionIndex.buildIndex([
        { id: 'temp-action', required_components: { actor: ['temp'] } },
      ]);

      const actorEntity = { id: 'test-actor' };
      entityManager.getAllComponentTypesForEntity.mockReturnValue(['temp']);

      let candidates = actionIndex.getCandidateActions(actorEntity);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].id).toBe('temp-action');

      // Rebuild with different actions
      actionIndex.buildIndex([
        {
          id: 'permanent-action',
          required_components: { actor: ['permanent'] },
        },
      ]);

      entityManager.getAllComponentTypesForEntity.mockReturnValue([
        'permanent',
      ]);
      candidates = actionIndex.getCandidateActions(actorEntity);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].id).toBe('permanent-action');
    });

    it('should maintain performance with large action sets', () => {
      // Generate a large number of actions
      const largeActionSet = [];
      for (let i = 0; i < 1000; i++) {
        largeActionSet.push({
          id: `action-${i}`,
          name: `Action ${i}`,
          required_components: {
            actor: [`component-${i % 10}`], // Cycle through 10 components
          },
        });
      }

      // Add actions without requirements
      for (let i = 0; i < 100; i++) {
        largeActionSet.push({
          id: `universal-${i}`,
          name: `Universal ${i}`,
        });
      }

      actionIndex.buildIndex(largeActionSet);

      const actorEntity = { id: 'performance-test' };
      entityManager.getAllComponentTypesForEntity.mockReturnValue([
        'component-0',
        'component-5',
      ]);

      const candidates = actionIndex.getCandidateActions(actorEntity);

      // Should get universal actions + actions for component-0 + actions for component-5
      // 100 universal + 100 for component-0 + 100 for component-5 = 300
      expect(candidates).toHaveLength(300);
      expect(logger.debug).toHaveBeenCalledWith(
        'Action index built. 10 component-to-action maps created.'
      );
    });
  });

  describe('multiple required components validation', () => {
    it('should only include actions when actor has ALL required components', () => {
      const actionDefinitions = [
        {
          id: 'dual-requirement',
          name: 'Dual Requirement Action',
          required_components: {
            actor: ['core:combat', 'core:inventory'],
          },
        },
        {
          id: 'single-requirement',
          name: 'Single Requirement Action',
          required_components: {
            actor: ['core:combat'],
          },
        },
      ];

      actionIndex.buildIndex(actionDefinitions);

      // Actor with only one of the two required components
      const actorEntity = { id: 'test-actor' };
      entityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:combat', // Has this
        // Missing 'core:inventory'
      ]);

      const candidates = actionIndex.getCandidateActions(actorEntity);

      // Should NOT include dual-requirement (missing core:inventory)
      // Should include single-requirement (has core:combat)
      expect(candidates).toHaveLength(1);
      expect(candidates[0].id).toBe('single-requirement');
      expect(candidates.map((a) => a.id)).not.toContain('dual-requirement');
    });

    it('should include actions when actor has ALL required components plus extras', () => {
      const actionDefinitions = [
        {
          id: 'dual-requirement',
          name: 'Dual Requirement Action',
          required_components: {
            actor: ['core:combat', 'core:inventory'],
          },
        },
      ];

      actionIndex.buildIndex(actionDefinitions);

      // Actor with all required components plus extra ones
      const actorEntity = { id: 'test-actor' };
      entityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:combat',
        'core:inventory',
        'core:extra', // Extra component shouldn't affect inclusion
      ]);

      const candidates = actionIndex.getCandidateActions(actorEntity);

      // Should include the action since actor has ALL required components
      expect(candidates).toHaveLength(1);
      expect(candidates[0].id).toBe('dual-requirement');
    });
  });

  describe('forbidden components', () => {
    it('should build index with forbidden components', () => {
      const actionDefinitions = [
        {
          id: 'action1',
          name: 'Restricted Action',
          forbidden_components: {
            actor: ['core:paralyzed', 'core:unconscious'],
          },
        },
        {
          id: 'action2',
          name: 'Normal Action',
          required_components: {
            actor: ['core:active'],
          },
        },
      ];

      actionIndex.buildIndex(actionDefinitions);

      expect(logger.debug).toHaveBeenCalledWith(
        'Building action index from 2 definitions...'
      );
      // Should create maps for both required and forbidden components
      expect(logger.debug).toHaveBeenCalledWith(
        'Action index built. 1 component-to-action maps created.'
      );
    });

    it('should exclude actions when actor has forbidden components', () => {
      const actionDefinitions = [
        {
          id: 'action1',
          name: 'Movement Action',
          required_components: {
            actor: ['core:movement'],
          },
          forbidden_components: {
            actor: ['core:paralyzed'],
          },
        },
        {
          id: 'action2',
          name: 'Alert Action',
          required_components: {
            actor: ['core:consciousness'],
          },
          forbidden_components: {
            actor: ['core:unconscious'],
          },
        },
        {
          id: 'action3',
          name: 'Basic Action',
          // No requirements or forbidden components
        },
      ];

      actionIndex.buildIndex(actionDefinitions);

      // Test with actor having paralyzed component
      const actorEntity = { id: 'paralyzed-actor' };
      entityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:movement',
        'core:consciousness',
        'core:paralyzed',
      ]);

      const candidates = actionIndex.getCandidateActions(actorEntity);

      // Should get action2 (alert) and action3 (basic), but NOT action1 (movement)
      expect(candidates).toHaveLength(2);
      expect(candidates.map((a) => a.id)).toEqual(
        expect.arrayContaining(['action2', 'action3'])
      );
      expect(candidates.map((a) => a.id)).not.toContain('action1');
    });

    it('should handle actions with both required and forbidden components', () => {
      const actionDefinitions = [
        {
          id: 'complex-action',
          name: 'Complex Action',
          required_components: {
            actor: ['core:stats', 'core:inventory'],
          },
          forbidden_components: {
            actor: ['core:disabled', 'core:blocked'],
          },
        },
      ];

      actionIndex.buildIndex(actionDefinitions);

      // Test with actor meeting requirements but having forbidden component
      const actorEntity = { id: 'test-actor' };
      entityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:stats',
        'core:inventory',
        'core:blocked',
      ]);

      const candidates = actionIndex.getCandidateActions(actorEntity);

      // Should NOT get the complex-action because actor has forbidden component
      expect(candidates).toHaveLength(0);
    });

    it('should handle multiple forbidden components on same action', () => {
      const actionDefinitions = [
        {
          id: 'sensitive-action',
          name: 'Sensitive Action',
          forbidden_components: {
            actor: ['status:stunned', 'status:sleeping', 'status:confused'],
          },
        },
      ];

      actionIndex.buildIndex(actionDefinitions);

      // Test with actor having one of the forbidden components
      const actorEntity = { id: 'test-actor' };
      entityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:basic',
        'status:sleeping',
      ]);

      const candidates = actionIndex.getCandidateActions(actorEntity);

      // Should NOT include the sensitive-action
      expect(candidates).toHaveLength(0);
    });

    it('should trace forbidden component filtering', () => {
      const actionDefinitions = [
        {
          id: 'action1',
          name: 'Action 1',
          forbidden_components: {
            actor: ['core:forbidden'],
          },
        },
      ];

      actionIndex.buildIndex(actionDefinitions);

      const actorEntity = { id: 'test-actor' };
      entityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:forbidden',
      ]);

      const trace = {
        data: jest.fn(),
        info: jest.fn(),
        success: jest.fn(),
      };

      const candidates = actionIndex.getCandidateActions(actorEntity, trace);

      // Verify trace messages
      expect(trace.info).toHaveBeenCalledWith(
        expect.stringContaining('Found 1 actions forbidden by component'),
        expect.any(String)
      );
      expect(trace.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'Removed 1 actions due to forbidden components'
        ),
        expect.any(String),
        expect.objectContaining({
          removedActionIds: ['action1'],
        })
      );
    });

    it('should handle empty forbidden components gracefully', () => {
      const actionDefinitions = [
        {
          id: 'action1',
          name: 'Action 1',
          forbidden_components: {
            actor: [],
          },
        },
        {
          id: 'action2',
          name: 'Action 2',
          forbidden_components: {}, // No actor field
        },
      ];

      // Should not throw errors
      expect(() => actionIndex.buildIndex(actionDefinitions)).not.toThrow();
    });

    it('should maintain performance with many forbidden components', () => {
      const actionDefinitions = [];

      // Create actions with various forbidden components
      for (let i = 0; i < 100; i++) {
        actionDefinitions.push({
          id: `action-${i}`,
          name: `Action ${i}`,
          forbidden_components: {
            actor: [`status:effect-${i % 10}`],
          },
        });
      }

      actionIndex.buildIndex(actionDefinitions);

      const actorEntity = { id: 'test-actor' };
      entityManager.getAllComponentTypesForEntity.mockReturnValue([
        'status:effect-0',
        'status:effect-5',
      ]);

      const candidates = actionIndex.getCandidateActions(actorEntity);

      // Should exclude 20 actions (10 with effect-0 + 10 with effect-5)
      expect(candidates).toHaveLength(80);
    });
  });
});
