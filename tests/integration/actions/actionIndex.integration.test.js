/**
 * @file Integration tests for ActionIndex
 * @description Tests ActionIndex behavior within complete system ecosystem,
 * focusing on real-world usage patterns and system integration scenarios
 */

import {
  jest,
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
} from '@jest/globals';
import { ActionIndex } from '../../../src/actions/actionIndex.js';
import { TraceContext } from '../../../src/actions/tracing/traceContext.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { TestDataFactory } from '../../common/actions/testDataFactory.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

describe('ActionIndex Integration Tests', () => {
  let logger;
  let entityManager;
  let actionIndex;
  let schemaValidator;
  let testData;

  beforeEach(() => {
    // Create logger
    logger = createMockLogger();

    // Create realistic entity manager that mimics production behavior
    const entities = new Map();
    entityManager = {
      entities,
      createEntity: (id) => {
        const entity = {
          id,
          components: {},
          hasComponent: (componentId) => componentId in entity.components,
          getComponentData: (componentId) =>
            entity.components[componentId] || null,
        };
        entities.set(id, entity);
        return entity;
      },
      getEntityById: (id) => entities.get(id),
      getEntityInstance: (id) => entities.get(id),
      addComponent: (entityId, componentId, data) => {
        const entity = entities.get(entityId);
        if (entity) {
          entity.components[componentId] = data;
        }
      },
      removeComponent: (entityId, componentId) => {
        const entity = entities.get(entityId);
        if (entity && entity.components[componentId]) {
          delete entity.components[componentId];
        }
      },
      getAllComponentTypesForEntity: (entityId) => {
        const entity =
          typeof entityId === 'string' ? entities.get(entityId) : entityId;
        return entity ? Object.keys(entity.components || {}) : [];
      },
      hasComponent: (entityId, componentId) => {
        const entity = entities.get(entityId);
        return entity ? componentId in entity.components : false;
      },
      clear: () => entities.clear(),
    };

    // Create ActionIndex instance
    actionIndex = new ActionIndex({ logger, entityManager });

    // Create schema validator for integration tests
    schemaValidator = new AjvSchemaValidator({ logger });

    // Load test data
    testData = TestDataFactory.createCompleteTestDataset();
  });

  afterEach(() => {
    entityManager.clear();
    jest.clearAllMocks();
  });

  describe('Real EntityManager Integration', () => {
    it('should work with real entity creation and component management', () => {
      // NOTE: ActionIndex requires entities to have ALL required components for an action,
      // not just ANY of the required components. This is the correct behavior for action validation.
      // Create real entities with components
      const player = entityManager.createEntity('player-1');
      entityManager.addComponent(player.id, 'core:position', {
        locationId: 'town-square',
      });
      entityManager.addComponent(player.id, 'core:inventory', { items: [] });
      entityManager.addComponent(player.id, 'core:movement', { locked: false });

      const npc = entityManager.createEntity('guard-1');
      entityManager.addComponent(npc.id, 'core:position', {
        locationId: 'town-square',
      });
      entityManager.addComponent(npc.id, 'core:health', {
        current: 100,
        max: 100,
      });
      // NOTE: NPC deliberately does not have movement component

      // Build index with realistic action set
      const actionDefinitions = [
        {
          id: 'core:walk',
          name: 'Walk',
          required_components: { actor: ['core:position', 'core:movement'] },
        },
        {
          id: 'core:interact',
          name: 'Interact',
          required_components: { actor: ['core:position'] },
        },
        {
          id: 'core:inventory_check',
          name: 'Check Inventory',
          required_components: { actor: ['core:inventory'] },
        },
        {
          id: 'core:universal',
          name: 'Universal Action',
          // No requirements
        },
      ];

      actionIndex.buildIndex(actionDefinitions);

      // Test player actions
      const playerCandidates = actionIndex.getCandidateActions(player);
      expect(playerCandidates).toHaveLength(4); // All actions available
      expect(playerCandidates.map((a) => a.id)).toEqual(
        expect.arrayContaining([
          'core:walk',
          'core:interact',
          'core:inventory_check',
          'core:universal',
        ])
      );

      // Test NPC actions
      const npcCandidates = actionIndex.getCandidateActions(npc);
      expect(npcCandidates).toHaveLength(2); // universal (no requirements), interact (has position)
      expect(npcCandidates.map((a) => a.id)).toEqual(
        expect.arrayContaining(['core:interact', 'core:universal'])
      );
      // walk is NOT included because NPC lacks core:movement (requires ALL components)

      // Test component removal impact
      entityManager.removeComponent(player.id, 'core:movement');
      const playerCandidatesAfterRemoval =
        actionIndex.getCandidateActions(player);
      expect(playerCandidatesAfterRemoval).toHaveLength(3); // Walk NOT available because player lacks core:movement (requires ALL components)
      // Verify walk is NOT included because movement component was removed
      const walkAction = playerCandidatesAfterRemoval.find(
        (a) => a.id === 'core:walk'
      );
      expect(walkAction).toBeUndefined(); // Walk is NOT a candidate (requires ALL components: position AND movement)
    });

    it('should handle entity lifecycle changes correctly', () => {
      // Build index first
      actionIndex.buildIndex([
        {
          id: 'test:lifecycle',
          name: 'Lifecycle Test',
          required_components: { actor: ['test:component'] },
        },
      ]);

      // Create entity without required component
      const entity = entityManager.createEntity('lifecycle-test');
      let candidates = actionIndex.getCandidateActions(entity);
      expect(candidates).toHaveLength(0);

      // Add required component
      entityManager.addComponent(entity.id, 'test:component', { value: 1 });
      candidates = actionIndex.getCandidateActions(entity);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].id).toBe('test:lifecycle');

      // Remove component
      entityManager.removeComponent(entity.id, 'test:component');
      candidates = actionIndex.getCandidateActions(entity);
      expect(candidates).toHaveLength(0);
    });

    it('should handle constructor validation with null/undefined dependencies', () => {
      // Test constructor error paths (covers lines 46, 49)
      expect(() => {
        new ActionIndex({ logger: null, entityManager });
      }).toThrow('ActionIndex requires a logger dependency');

      expect(() => {
        new ActionIndex({ logger, entityManager: null });
      }).toThrow('ActionIndex requires an entityManager dependency');

      expect(() => {
        new ActionIndex({ entityManager });
      }).toThrow('ActionIndex requires a logger dependency');

      expect(() => {
        new ActionIndex({ logger });
      }).toThrow('ActionIndex requires an entityManager dependency');
    });
  });

  describe('Action Discovery Workflows', () => {
    it('should work with complex real-world action catalogs', () => {
      // Create a large, realistic action catalog
      const realWorldActions = [
        // Movement actions
        {
          id: 'core:walk',
          name: 'Walk',
          required_components: { actor: ['core:position', 'core:movement'] },
          forbidden_components: { actor: ['status:paralyzed'] },
        },
        {
          id: 'core:run',
          name: 'Run',
          required_components: {
            actor: ['core:position', 'core:movement', 'core:stamina'],
          },
          forbidden_components: {
            actor: ['status:exhausted', 'status:injured'],
          },
        },
        // Combat actions
        {
          id: 'combat:attack',
          name: 'Attack',
          required_components: { actor: ['core:position', 'core:combat'] },
          forbidden_components: { actor: ['status:pacified'] },
        },
        {
          id: 'combat:defend',
          name: 'Defend',
          required_components: { actor: ['core:combat'] },
        },
        // Social actions
        {
          id: 'social:talk',
          name: 'Talk',
          required_components: { actor: ['core:dialogue'] },
          forbidden_components: { actor: ['status:muted'] },
        },
        {
          id: 'social:trade',
          name: 'Trade',
          required_components: { actor: ['core:inventory', 'core:dialogue'] },
        },
        // Universal actions
        {
          id: 'universal:wait',
          name: 'Wait',
          // No requirements
        },
        {
          id: 'universal:observe',
          name: 'Observe',
          // No requirements
        },
      ];

      actionIndex.buildIndex(realWorldActions);

      // Create fully-featured character
      const hero = entityManager.createEntity('hero');
      entityManager.addComponent(hero.id, 'core:position', {
        locationId: 'battlefield',
      });
      entityManager.addComponent(hero.id, 'core:movement', { speed: 5 });
      entityManager.addComponent(hero.id, 'core:stamina', { current: 80 });
      entityManager.addComponent(hero.id, 'core:combat', { skill: 7 });
      entityManager.addComponent(hero.id, 'core:dialogue', { charisma: 6 });
      entityManager.addComponent(hero.id, 'core:inventory', { items: [] });

      const heroCandidates = actionIndex.getCandidateActions(hero);
      expect(heroCandidates).toHaveLength(8); // All actions available

      // Create injured character (with forbidden component)
      const injuredSoldier = entityManager.createEntity('injured-soldier');
      entityManager.addComponent(injuredSoldier.id, 'core:position', {
        locationId: 'battlefield',
      });
      entityManager.addComponent(injuredSoldier.id, 'core:movement', {
        speed: 2,
      });
      entityManager.addComponent(injuredSoldier.id, 'core:combat', {
        skill: 5,
      });
      entityManager.addComponent(injuredSoldier.id, 'status:injured', {
        severity: 'moderate',
      });

      const soldierCandidates = actionIndex.getCandidateActions(injuredSoldier);
      expect(soldierCandidates).toHaveLength(5); // Run forbidden due to injury
      expect(soldierCandidates.map((a) => a.id)).not.toContain('core:run');
      expect(soldierCandidates.map((a) => a.id)).toContain('core:walk');
      expect(soldierCandidates.map((a) => a.id)).toContain('combat:attack');

      // Create civilian (limited components)
      const civilian = entityManager.createEntity('civilian');
      entityManager.addComponent(civilian.id, 'core:position', {
        locationId: 'town',
      });
      entityManager.addComponent(civilian.id, 'core:dialogue', { charisma: 4 });

      const civilianCandidates = actionIndex.getCandidateActions(civilian);
      // ActionIndex requires ALL required components for each action
      // Civilian has: core:position, core:dialogue
      // Gets: talk (requires dialogue - has it), wait (no requirements), observe (no requirements)
      // Does NOT get: walk (requires position+movement), run (requires position+movement+stamina),
      // attack (requires position+combat), defend (requires combat), trade (requires inventory+dialogue)
      expect(civilianCandidates).toHaveLength(3);
      expect(civilianCandidates.map((a) => a.id)).toEqual(
        expect.arrayContaining([
          'social:talk',
          'universal:wait',
          'universal:observe',
        ])
      );
    });

    it('should handle buildIndex validation edge cases', () => {
      // Test buildIndex validation paths (covers lines 65-68, 81-84)

      // Test with non-array input
      actionIndex.buildIndex(null);
      expect(logger.warn).toHaveBeenCalledWith(
        'ActionIndex.buildIndex: allActionDefinitions must be an array. Skipping index build.'
      );

      actionIndex.buildIndex(undefined);
      expect(logger.warn).toHaveBeenCalledWith(
        'ActionIndex.buildIndex: allActionDefinitions must be an array. Skipping index build.'
      );

      actionIndex.buildIndex('not-an-array');
      expect(logger.warn).toHaveBeenCalledWith(
        'ActionIndex.buildIndex: allActionDefinitions must be an array. Skipping index build.'
      );

      // Test with invalid action definitions (covers lines 81-84)
      const invalidActions = [
        null,
        undefined,
        'invalid-string',
        42,
        {},
        { id: 'valid:action', required_components: { actor: ['test'] } },
      ];

      actionIndex.buildIndex(invalidActions);

      // Should log debug messages for each invalid action
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Skipping invalid action definition:')
      );

      // Should still build index for valid action
      expect(logger.debug).toHaveBeenCalledWith(
        'Action index built. 1 component-to-action maps created.'
      );
    });

    it('should handle complex forbidden component scenarios', () => {
      // Test complex forbidden component logic
      const complexActions = [
        {
          id: 'action:stealth',
          name: 'Stealth',
          required_components: { actor: ['skills:stealth'] },
          forbidden_components: {
            actor: [
              'status:visible',
              'status:detected',
              'equipment:heavy_armor',
            ],
          },
        },
        {
          id: 'action:magic',
          name: 'Cast Magic',
          required_components: { actor: ['skills:magic', 'resources:mana'] },
          forbidden_components: {
            actor: ['status:silenced', 'environment:anti_magic'],
          },
        },
        {
          id: 'action:generic',
          name: 'Generic Action',
          // No restrictions
        },
      ];

      actionIndex.buildIndex(complexActions);

      // Create character with mixed conditions
      const character = entityManager.createEntity('complex-char');
      entityManager.addComponent(character.id, 'skills:stealth', { level: 5 });
      entityManager.addComponent(character.id, 'skills:magic', { level: 3 });
      entityManager.addComponent(character.id, 'resources:mana', {
        current: 50,
      });
      entityManager.addComponent(character.id, 'status:visible', {
        reason: 'light',
      });
      entityManager.addComponent(character.id, 'status:silenced', {
        duration: 10,
      });

      const candidates = actionIndex.getCandidateActions(character);

      // Should only get generic action (both stealth and magic forbidden)
      expect(candidates).toHaveLength(1);
      expect(candidates[0].id).toBe('action:generic');
    });
  });

  describe('TraceContext Integration', () => {
    it('should provide detailed trace information during action discovery', () => {
      // Build index with test actions
      actionIndex.buildIndex(testData.actions.basic);

      // Create test entity
      const actor = entityManager.createEntity('trace-test');
      entityManager.addComponent(actor.id, 'core:position', {
        locationId: 'test-location',
      });
      entityManager.addComponent(actor.id, 'core:movement', { locked: false });

      // Create trace context
      const trace = new TraceContext();

      // Spy on trace methods to verify integration
      jest.spyOn(trace, 'data');
      jest.spyOn(trace, 'info');
      jest.spyOn(trace, 'success');

      // Get candidates with trace
      const candidates = actionIndex.getCandidateActions(actor, trace);

      // Verify trace was called with correct information
      expect(trace.data).toHaveBeenCalledWith(
        expect.stringContaining("Actor 'trace-test' has components"),
        'ActionIndex.getCandidateActions',
        expect.objectContaining({
          components: expect.any(Array),
        })
      );

      expect(trace.info).toHaveBeenCalledWith(
        expect.stringContaining('Added'),
        'ActionIndex.getCandidateActions'
      );

      expect(trace.success).toHaveBeenCalledWith(
        expect.stringContaining('Final candidate list contains'),
        'ActionIndex.getCandidateActions',
        expect.objectContaining({
          actionIds: expect.any(Array),
        })
      );

      // Verify candidates were found
      expect(candidates.length).toBeGreaterThan(0);
    });

    it('should trace forbidden component filtering details', () => {
      // Create actions with forbidden components
      const tracedActions = [
        {
          id: 'trace:allowed',
          name: 'Allowed Action',
          required_components: { actor: ['test:required'] },
        },
        {
          id: 'trace:forbidden',
          name: 'Forbidden Action',
          required_components: { actor: ['test:required'] },
          forbidden_components: { actor: ['test:forbidden'] },
        },
      ];

      actionIndex.buildIndex(tracedActions);

      // Create entity with forbidden component
      const actor = entityManager.createEntity('trace-forbidden');
      entityManager.addComponent(actor.id, 'test:required', { value: true });
      entityManager.addComponent(actor.id, 'test:forbidden', {
        reason: 'test',
      });

      // Create trace
      const trace = new TraceContext();
      jest.spyOn(trace, 'info');

      // Get candidates
      const candidates = actionIndex.getCandidateActions(actor, trace);

      // Should trace forbidden component detection (covers lines 193, 201)
      expect(trace.info).toHaveBeenCalledWith(
        expect.stringContaining('Found 1 actions forbidden by component'),
        'ActionIndex.getCandidateActions'
      );

      expect(trace.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'Removed 1 actions due to forbidden components'
        ),
        'ActionIndex.getCandidateActions',
        expect.objectContaining({
          removedActionIds: ['trace:forbidden'],
        })
      );

      // Should only get allowed action
      expect(candidates).toHaveLength(1);
      expect(candidates[0].id).toBe('trace:allowed');
    });

    it('should work without trace context', () => {
      // Build index
      actionIndex.buildIndex(testData.actions.basic);

      // Create entity
      const actor = entityManager.createEntity('no-trace');
      entityManager.addComponent(actor.id, 'core:position', {});

      // Should work without trace
      expect(() => {
        const candidates = actionIndex.getCandidateActions(actor, null);
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();

      // Should work with undefined trace
      expect(() => {
        const candidates = actionIndex.getCandidateActions(actor, undefined);
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });
  });

  describe('Error Handling & Schema Integration', () => {
    it('should integrate with schema validation for action definitions', () => {
      // Load action schema
      const actionSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'schema://test/action.schema.json',
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$' },
          name: { type: 'string' },
          required_components: {
            type: 'object',
            properties: {
              actor: { type: 'array', items: { type: 'string' } },
            },
          },
          forbidden_components: {
            type: 'object',
            properties: {
              actor: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        required: ['id', 'name'],
      };

      schemaValidator.addSchema(actionSchema, 'test-action-schema');

      // Test valid action definitions
      const validActions = [
        {
          id: 'test:valid',
          name: 'Valid Action',
          required_components: { actor: ['test:component'] },
        },
      ];

      validActions.forEach((action) => {
        const validationResult = schemaValidator.validateAgainstSchema(
          action,
          'test-action-schema'
        );
        expect(validationResult).toBe(true);
      });

      // Build index with valid actions
      expect(() => {
        actionIndex.buildIndex(validActions);
      }).not.toThrow();

      // Test with malformed action (should be handled gracefully)
      const malformedActions = [
        {
          id: 'test:valid',
          name: 'Valid Action',
        },
        {
          // Missing required fields
          description: 'Invalid action',
        },
        null,
        undefined,
      ];

      expect(() => {
        actionIndex.buildIndex(malformedActions);
      }).not.toThrow();
    });

    it('should handle entity manager errors gracefully', () => {
      // Build index
      actionIndex.buildIndex(testData.actions.basic);

      // Create entity
      const actor = entityManager.createEntity('error-test');

      // Mock entity manager to throw error
      const originalMethod = entityManager.getAllComponentTypesForEntity;
      entityManager.getAllComponentTypesForEntity = jest
        .fn()
        .mockImplementation(() => {
          throw new Error('EntityManager error');
        });

      // Should handle error gracefully
      expect(() => {
        actionIndex.getCandidateActions(actor);
      }).toThrow('EntityManager error'); // The error will be thrown

      // Restore original method
      entityManager.getAllComponentTypesForEntity = originalMethod;
    });

    it('should handle edge cases with component data types', () => {
      // Test with various invalid component scenarios
      const actions = [
        {
          id: 'test:edge',
          name: 'Edge Case Action',
          required_components: { actor: ['valid:component'] },
          forbidden_components: { actor: ['invalid:component'] },
        },
      ];

      actionIndex.buildIndex(actions);

      // Test with entity having null/undefined components
      const actor = entityManager.createEntity('edge-case');

      // Manually set invalid component data
      const originalGetAllTypes = entityManager.getAllComponentTypesForEntity;
      entityManager.getAllComponentTypesForEntity = jest
        .fn()
        .mockReturnValue(['valid:component', null, undefined, '', '  ']);

      const candidates = actionIndex.getCandidateActions(actor);

      // Should handle invalid component types gracefully
      expect(Array.isArray(candidates)).toBe(true);

      // Restore method
      entityManager.getAllComponentTypesForEntity = originalGetAllTypes;
    });
  });

  describe('Complex Integration Scenarios', () => {
    it('should work with dynamic component addition/removal during gameplay', () => {
      // Build index with gameplay actions
      const gameplayActions = [
        {
          id: 'gameplay:equip_weapon',
          name: 'Equip Weapon',
          required_components: { actor: ['inventory:items'] },
          forbidden_components: { actor: ['status:disarmed'] },
        },
        {
          id: 'gameplay:cast_spell',
          name: 'Cast Spell',
          required_components: { actor: ['magic:mana'] },
          forbidden_components: { actor: ['status:silenced'] },
        },
        {
          id: 'gameplay:basic_action',
          name: 'Basic Action',
        },
      ];

      actionIndex.buildIndex(gameplayActions);

      // Create player
      const player = entityManager.createEntity('dynamic-player');
      entityManager.addComponent(player.id, 'inventory:items', {
        weapons: ['sword', 'bow'],
      });

      // Initial state
      let candidates = actionIndex.getCandidateActions(player);
      expect(candidates).toHaveLength(2); // equip_weapon + basic_action

      // Add magic ability
      entityManager.addComponent(player.id, 'magic:mana', { current: 100 });
      candidates = actionIndex.getCandidateActions(player);
      expect(candidates).toHaveLength(3); // All actions available

      // Add silenced status (blocks magic)
      entityManager.addComponent(player.id, 'status:silenced', { duration: 5 });
      candidates = actionIndex.getCandidateActions(player);
      expect(candidates).toHaveLength(2); // Magic blocked
      expect(candidates.map((a) => a.id)).not.toContain('gameplay:cast_spell');

      // Remove silenced status
      entityManager.removeComponent(player.id, 'status:silenced');
      candidates = actionIndex.getCandidateActions(player);
      expect(candidates).toHaveLength(3); // Magic available again

      // Add disarmed status (blocks weapon usage)
      entityManager.addComponent(player.id, 'status:disarmed', {
        reason: 'trap',
      });
      candidates = actionIndex.getCandidateActions(player);
      expect(candidates).toHaveLength(2); // Weapon usage blocked
      expect(candidates.map((a) => a.id)).not.toContain(
        'gameplay:equip_weapon'
      );
    });

    it('should integrate with complete action processing pipeline', () => {
      // This test simulates how ActionIndex integrates with other systems

      // Build comprehensive action catalog
      actionIndex.buildIndex([
        ...testData.actions.basic,
        ...testData.actions.comprehensive,
        {
          id: 'integration:test',
          name: 'Integration Test Action',
          required_components: { actor: ['test:integration'] },
          forbidden_components: { actor: ['test:blocked'] },
        },
      ]);

      // Create test scenario entities
      const entities = testData.actors;

      // Set up entities in entity manager
      Object.values(entities).forEach((actorData) => {
        const entity = entityManager.createEntity(actorData.id);
        Object.entries(actorData.components).forEach(([componentId, data]) => {
          entityManager.addComponent(entity.id, componentId, data);
        });
      });

      // Test action discovery for each entity type
      const playerEntity = entityManager.getEntityById(entities.player.id);
      const playerCandidates = actionIndex.getCandidateActions(playerEntity);
      expect(playerCandidates.length).toBeGreaterThan(0);

      const npcEntity = entityManager.getEntityById(entities.npc.id);
      const npcCandidates = actionIndex.getCandidateActions(npcEntity);
      expect(npcCandidates.length).toBeGreaterThan(0);

      const lockedEntity = entityManager.getEntityById(entities.lockedActor.id);
      const lockedCandidates = actionIndex.getCandidateActions(lockedEntity);
      expect(Array.isArray(lockedCandidates)).toBe(true);

      // Verify each entity gets appropriate actions based on components
      expect(playerCandidates.length).toBeGreaterThanOrEqual(
        npcCandidates.length
      );
    });

    it('should handle concurrent access scenarios', () => {
      // Build index
      actionIndex.buildIndex(testData.actions.basic);

      // Create entities
      const entities = [];
      for (let i = 0; i < 100; i++) {
        const entity = entityManager.createEntity(`concurrent_${i}`);
        entityManager.addComponent(entity.id, 'core:position', {});
        entities.push(entity);
      }

      // Simulate concurrent access
      const promises = entities.map((entity) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            const candidates = actionIndex.getCandidateActions(entity);
            resolve({ entityId: entity.id, candidateCount: candidates.length });
          }, Math.random() * 10); // Random delay up to 10ms
        });
      });

      return Promise.all(promises).then((results) => {
        expect(results).toHaveLength(100);
        results.forEach((result) => {
          expect(result.candidateCount).toBeGreaterThan(0);
          expect(typeof result.entityId).toBe('string');
        });
      });
    });
  });
});
