/**
 * @file Integration tests for MultiTargetResolutionStage
 * @see src/actions/pipeline/stages/MultiTargetResolutionStage.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { MultiTargetResolutionStage } from '../../../../../src/actions/pipeline/stages/MultiTargetResolutionStage.js';
import { EntityManagerTestBed } from '../../../../common/entities/entityManagerTestBed.js';
import EntityDefinition from '../../../../../src/entities/entityDefinition.js';
import ConsoleLogger from '../../../../../src/logging/consoleLogger.js';
import { ActionResult } from '../../../../../src/actions/core/actionResult.js';

// Helper function to create mock unified scope resolver
/**
 *
 */
function createMockUnifiedScopeResolver() {
  return {
    resolve: jest.fn(),
  };
}

// Helper function to create mock target resolver
/**
 *
 */
function createMockTargetResolver() {
  return {
    resolveTargets: jest.fn(),
  };
}

// Helper function to create mock target context builder
/**
 *
 */
function createMockTargetContextBuilder() {
  return {
    buildBaseContext: jest.fn(),
    buildDependentContext: jest.fn(),
  };
}

describe('MultiTargetResolutionStage - Integration Tests', () => {
  let stage;
  let entityTestBed;
  let entityManager;
  let unifiedScopeResolver;
  let targetContextBuilder;
  let targetResolver;
  let logger;

  beforeEach(async () => {
    // Setup logger
    logger = new ConsoleLogger('ERROR');
    logger.debug = jest.fn();
    logger.error = jest.fn();
    logger.warn = jest.fn();
    logger.info = jest.fn();

    // Setup entity manager test bed
    entityTestBed = new EntityManagerTestBed();
    entityManager = entityTestBed.entityManager;

    // Create real-ish mock services that work with actual entities
    unifiedScopeResolver = createMockUnifiedScopeResolver();
    targetContextBuilder = createMockTargetContextBuilder();
    targetResolver = createMockTargetResolver();

    // Create the stage with the real entity manager
    stage = new MultiTargetResolutionStage({
      unifiedScopeResolver,
      entityManager: entityTestBed.entityManager, // Use the real entity manager
      targetResolver,
      targetContextBuilder,
      logger,
    });
  });

  afterEach(() => {
    entityTestBed.cleanup();
    jest.clearAllMocks();
  });

  describe('Real Entity Integration', () => {
    it('should resolve multi-target actions with real entities and components', async () => {
      // Create location entity
      const locationDef = new EntityDefinition('test:location', {
        description: 'Test location',
        components: {
          'core:name': { value: 'Town Square' },
          'core:location': {
            description: 'A bustling town square',
            entities: [],
          },
        },
      });

      // Create actor entity definition
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Test actor',
        components: {
          'core:name': { value: 'Hero' },
          'core:actor': { name: 'Hero', health: 100 },
          'core:inventory': { items: [] },
          'core:position': { locationId: 'location-001' },
        },
      });

      // Create weapon entity definition
      const weaponDef = new EntityDefinition('test:weapon', {
        description: 'Test weapon',
        components: {
          'core:name': { value: 'Sword' },
          'core:item': { type: 'weapon', weight: 5 },
          'core:weapon': { damage: 10 },
        },
      });

      // Create enemy entity definition
      const enemyDef = new EntityDefinition('test:enemy', {
        description: 'Test enemy',
        components: {
          'core:name': { value: 'Goblin' },
          'core:actor': { name: 'Goblin', health: 50 },
          'core:position': { locationId: 'location-001' },
        },
      });

      entityTestBed.setupDefinitions(
        locationDef,
        actorDef,
        weaponDef,
        enemyDef
      );

      // Create entities
      const location = await entityManager.createEntityInstance(
        'test:location',
        {
          instanceId: 'location-001',
        }
      );
      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'actor-001',
      });
      const weapon = await entityManager.createEntityInstance('test:weapon', {
        instanceId: 'weapon-001',
      });
      const enemy = await entityManager.createEntityInstance('test:enemy', {
        instanceId: 'enemy-001',
      });

      // Add weapon to actor's inventory
      await entityManager.addComponent('actor-001', 'core:inventory', {
        items: ['weapon-001'],
      });

      // Add entities to location
      await entityManager.addComponent('location-001', 'core:location', {
        description: 'A bustling town square',
        entities: ['actor-001', 'enemy-001'],
      });

      // Setup mocks to return the right entities
      unifiedScopeResolver.resolve
        .mockResolvedValueOnce(ActionResult.success(new Set(['enemy-001']))) // primary target
        .mockResolvedValueOnce(ActionResult.success(new Set(['weapon-001']))); // secondary target

      targetContextBuilder.buildBaseContext.mockImplementation((actorId, locationId) => ({
        actor: {
          id: actorId,
          components: actor.getAllComponents ? actor.getAllComponents() : {},
        },
        location: {
          id: locationId,
          components: location && location.getAllComponents ? location.getAllComponents() : {},
        },
        game: { turnNumber: 1 },
      }));

      // Mock buildDependentContext for secondary target resolution
      targetContextBuilder.buildDependentContext.mockImplementation((baseContext, resolvedTargets, targetDef) => ({
        ...baseContext,
        targets: resolvedTargets,
        ...(targetDef.contextFrom && resolvedTargets[targetDef.contextFrom] && Array.isArray(resolvedTargets[targetDef.contextFrom]) && resolvedTargets[targetDef.contextFrom].length > 0
          ? { target: { id: resolvedTargets[targetDef.contextFrom][0].id, components: {} } }
          : {}),
      }));

      // Create multi-target action definition
      const actionDef = {
        id: 'combat:attack',
        name: 'Attack',
        template: 'attack {target} with {weapon}',
        targets: {
          primary: {
            scope: 'location.entities[{"!=": [{"var": "id"}, "actor-001"]}]',
            placeholder: 'target',
            description: 'Enemy to attack',
          },
          secondary: {
            scope: 'actor.inventory[]',
            placeholder: 'weapon',
            description: 'Weapon to use',
          },
        },
      };

      const context = {
        candidateActions: [actionDef],
        actor,
        actionContext: {
          location,
          actor,
        },
        data: {},
      };

      const result = await stage.executeInternal(context);

      // Debug logging
      console.log('Test result:', JSON.stringify(result, null, 2));
      console.log('unifiedScopeResolver.resolve was called:', unifiedScopeResolver.resolve.mock.calls);
      console.log('targetContextBuilder.buildBaseContext was called:', targetContextBuilder.buildBaseContext.mock.calls);
      
      // Check if entities exist
      console.log('enemy-001 exists:', !!entityTestBed.entityManager.getEntityInstance('enemy-001'));
      console.log('weapon-001 exists:', !!entityTestBed.entityManager.getEntityInstance('weapon-001'));
      console.log('actor-001 exists:', !!entityTestBed.entityManager.getEntityInstance('actor-001'));

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(1);

      const actionWithTargets = result.data.actionsWithTargets[0];
      expect(actionWithTargets.actionDef).toBe(actionDef);
      expect(actionWithTargets.targetContexts).toHaveLength(2);

      // Check resolved targets
      expect(actionWithTargets.targetContexts[0]).toEqual({
        entityId: 'enemy-001',
        displayName: 'Goblin',
        placeholder: 'target',
      });
      expect(actionWithTargets.targetContexts[1]).toEqual({
        entityId: 'weapon-001',
        displayName: 'Sword',
        placeholder: 'weapon',
      });

      // Check resolved targets structure
      expect(result.data.resolvedTargets).toEqual({
        primary: [
          {
            id: 'enemy-001',
            displayName: 'Goblin',
            entity: enemy,
          },
        ],
        secondary: [
          {
            id: 'weapon-001',
            displayName: 'Sword',
            entity: weapon,
          },
        ],
      });
    });

    it('should handle display name resolution from various components', async () => {
      // Create entities with different name sources
      const descriptionNameDef = new EntityDefinition('test:desc_entity', {
        description: 'Entity with description name',
        components: {
          'core:description': { name: 'Description Name Entity' },
        },
      });

      const actorNameDef = new EntityDefinition('test:actor_entity', {
        description: 'Entity with actor name',
        components: {
          'core:actor': { name: 'Actor Name Entity' },
        },
      });

      const itemNameDef = new EntityDefinition('test:item_entity', {
        description: 'Entity with item name',
        components: {
          'core:item': { name: 'Item Name Entity', type: 'misc' },
        },
      });

      const noNameDef = new EntityDefinition('test:no_name_entity', {
        description: 'Entity without name',
        components: {
          'core:misc': { data: 'test' },
        },
      });

      entityTestBed.setupDefinitions(
        descriptionNameDef,
        actorNameDef,
        itemNameDef,
        noNameDef
      );

      // Create entities
      await entityManager.createEntityInstance('test:desc_entity', {
        instanceId: 'desc-001',
      });
      await entityManager.createEntityInstance('test:actor_entity', {
        instanceId: 'actor-001',
      });
      await entityManager.createEntityInstance('test:item_entity', {
        instanceId: 'item-001',
      });
      await entityManager.createEntityInstance('test:no_name_entity', {
        instanceId: 'noname-001',
      });

      // Create player actor
      const actorDef = new EntityDefinition('test:player', {
        description: 'Player',
        components: {
          'core:name': { value: 'Player' },
          'core:actor': { name: 'Player' },
        },
      });
      entityTestBed.setupDefinitions(actorDef);
      const actor = await entityManager.createEntityInstance('test:player', {
        instanceId: 'player-001',
      });

      // Mock resolver to return all test entities
      unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(
          new Set(['desc-001', 'actor-001', 'item-001', 'noname-001'])
        )
      );

      targetContextBuilder.buildBaseContext.mockImplementation((actorId, locationId) => ({
        actor: {
          id: actorId,
          components: actor.getAllComponents ? actor.getAllComponents() : {},
        },
        location: { id: locationId },
        game: { turnNumber: 1 },
      }));

      const actionDef = {
        id: 'test:examine',
        name: 'Examine',
        template: 'examine {target}',
        targets: {
          primary: {
            scope: '["desc-001", "actor-001", "item-001", "noname-001"]',
            placeholder: 'target',
          },
        },
      };

      const context = {
        candidateActions: [actionDef],
        actor,
        actionContext: { actor },
        data: {},
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      const actionWithTargets = result.data.actionsWithTargets[0];
      expect(actionWithTargets.targetContexts).toHaveLength(4);

      // Check display names from different sources
      expect(actionWithTargets.targetContexts[0].displayName).toBe(
        'Description Name Entity'
      );
      expect(actionWithTargets.targetContexts[1].displayName).toBe(
        'Actor Name Entity'
      );
      expect(actionWithTargets.targetContexts[2].displayName).toBe(
        'Item Name Entity'
      );
      expect(actionWithTargets.targetContexts[3].displayName).toBe(
        'noname-001'
      ); // Falls back to ID
    });
  });

  describe('Multi-Target Resolution with Dependencies', () => {
    it('should resolve dependent targets with contextFrom', async () => {
      // Create NPCs with inventories
      const npcDef = new EntityDefinition('test:npc', {
        description: 'NPC with inventory',
        components: {
          'core:name': { value: 'Merchant' },
          'core:actor': { name: 'Merchant' },
          'core:inventory': { items: [] },
        },
      });

      const itemDef = new EntityDefinition('test:trade_item', {
        description: 'Tradeable item',
        components: {
          'core:name': { value: 'Gold Coin' },
          'core:item': { type: 'currency', weight: 0.01, value: 1 },
        },
      });

      entityTestBed.setupDefinitions(npcDef, itemDef);

      // Create entities
      const npc = await entityManager.createEntityInstance('test:npc', {
        instanceId: 'merchant-001',
      });
      await entityManager.createEntityInstance('test:trade_item', {
        instanceId: 'coin-001',
      });
      await entityManager.createEntityInstance('test:trade_item', {
        instanceId: 'coin-002',
      });

      // Add items to NPC inventory
      await entityManager.addComponent('merchant-001', 'core:inventory', {
        items: ['coin-001', 'coin-002'],
      });

      // Create player
      const playerDef = new EntityDefinition('test:player', {
        description: 'Player',
        components: {
          'core:name': { value: 'Player' },
          'core:actor': { name: 'Player' },
        },
      });
      entityTestBed.setupDefinitions(playerDef);
      const player = await entityManager.createEntityInstance('test:player', {
        instanceId: 'player-001',
      });

      // Setup mocks
      unifiedScopeResolver.resolve
        .mockResolvedValueOnce(ActionResult.success(new Set(['merchant-001']))) // primary
        .mockResolvedValueOnce(
          ActionResult.success(new Set(['coin-001', 'coin-002']))
        ); // secondary

      const baseContext = {
        actor: player,
        location: { id: 'test-location' },
        game: { turnNumber: 1 },
      };

      targetContextBuilder.buildBaseContext.mockImplementation((actorId, locationId) => baseContext);
      targetContextBuilder.buildDependentContext.mockReturnValue({
        ...baseContext,
        targets: {
          primary: [
            { id: 'merchant-001', displayName: 'Merchant', entity: npc },
          ],
        },
        target: npc,
      });

      // Action with dependent targets
      const actionDef = {
        id: 'trade:buy',
        name: 'Buy Item',
        template: 'buy {item} from {merchant}',
        targets: {
          primary: {
            scope: '["merchant-001"]',
            placeholder: 'merchant',
            description: 'Merchant to trade with',
          },
          secondary: {
            scope: 'target.inventory.items[]',
            placeholder: 'item',
            description: 'Item to buy',
            contextFrom: 'primary',
          },
        },
      };

      const context = {
        candidateActions: [actionDef],
        actor: player,
        actionContext: { actor: player },
        data: {},
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      const actionWithTargets = result.data.actionsWithTargets[0];
      expect(actionWithTargets.targetContexts).toHaveLength(3); // 1 merchant + 2 items

      // Check merchant
      expect(
        actionWithTargets.targetContexts.find(
          (tc) => tc.placeholder === 'merchant'
        )
      ).toEqual({
        entityId: 'merchant-001',
        displayName: 'Merchant',
        placeholder: 'merchant',
      });

      // Check items resolved from merchant's inventory
      const itemContexts = actionWithTargets.targetContexts.filter(
        (tc) => tc.placeholder === 'item'
      );
      expect(itemContexts).toHaveLength(2);
      expect(itemContexts[0].entityId).toBe('coin-001');
      expect(itemContexts[1].entityId).toBe('coin-002');

      // Verify that dependent context was built correctly
      expect(targetContextBuilder.buildDependentContext).toHaveBeenCalledWith(
        baseContext,
        expect.objectContaining({
          primary: expect.arrayContaining([
            expect.objectContaining({ id: 'merchant-001' }),
          ]),
        }),
        actionDef.targets.secondary
      );
    });

    it('should detect and handle circular dependencies', async () => {
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Actor',
        components: {
          'core:name': { value: 'Player' },
          'core:actor': { name: 'Player' },
        },
      });
      entityTestBed.setupDefinitions(actorDef);
      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'player-001',
      });

      // Action with circular dependency
      const actionDef = {
        id: 'test:circular',
        name: 'Circular Test',
        template: 'test {a} and {b}',
        targets: {
          a: {
            scope: 'test',
            placeholder: 'a',
            contextFrom: 'b', // a depends on b
          },
          b: {
            scope: 'test',
            placeholder: 'b',
            contextFrom: 'a', // b depends on a - circular!
          },
        },
      };

      const context = {
        candidateActions: [actionDef],
        actor,
        actionContext: { actor },
        data: {},
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(0); // No actions due to circular dependency
      // The circular dependency is detected during resolution order calculation,
      // which returns a failure result but doesn't trigger the error handler in the main loop
    });
  });

  describe('Scope Resolution', () => {
    it('should handle self scope correctly', async () => {
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Actor',
        components: {
          'core:name': { value: 'Player' },
          'core:actor': { name: 'Player' },
        },
      });
      entityTestBed.setupDefinitions(actorDef);
      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'player-001',
      });

      // Mock self scope resolution
      unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set(['player-001']))
      );

      targetContextBuilder.buildBaseContext.mockImplementation((actorId, locationId) => ({
        actor: {
          id: actorId,
          components: actor.getAllComponents ? actor.getAllComponents() : {},
        },
        location: { id: locationId },
        game: { turnNumber: 1 },
      }));

      const actionDef = {
        id: 'test:self_action',
        name: 'Self Action',
        template: 'examine {target}',
        targets: {
          primary: {
            scope: 'self',
            placeholder: 'target',
          },
        },
      };

      const context = {
        candidateActions: [actionDef],
        actor,
        actionContext: { actor },
        data: {},
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      const actionWithTargets = result.data.actionsWithTargets[0];
      expect(actionWithTargets.targetContexts).toHaveLength(1);
      expect(actionWithTargets.targetContexts[0]).toEqual({
        entityId: 'player-001',
        displayName: 'Player',
        placeholder: 'target',
      });
    });

    it('should handle empty scope results', async () => {
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Actor',
        components: {
          'core:name': { value: 'Player' },
          'core:actor': { name: 'Player' },
        },
      });
      entityTestBed.setupDefinitions(actorDef);
      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'player-001',
      });

      // Mock empty scope resolution
      unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set())
      );

      targetContextBuilder.buildBaseContext.mockImplementation((actorId, locationId) => ({
        actor: {
          id: actorId,
          components: actor.getAllComponents ? actor.getAllComponents() : {},
        },
        location: { id: locationId },
        game: { turnNumber: 1 },
      }));

      const actionDef = {
        id: 'test:no_targets',
        name: 'No Targets',
        template: 'use {item}',
        targets: {
          primary: {
            scope: 'actor.inventory.items[]', // Empty inventory
            placeholder: 'item',
          },
        },
      };

      const context = {
        candidateActions: [actionDef],
        actor,
        actionContext: { actor },
        data: {},
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(0); // No actions because no targets found
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing entities gracefully', async () => {
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Actor',
        components: {
          'core:name': { value: 'Player' },
          'core:actor': { name: 'Player' },
        },
      });
      entityTestBed.setupDefinitions(actorDef);
      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'player-001',
      });

      // Mock scope returning non-existent entities
      unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set(['missing-001', 'missing-002']))
      );

      targetContextBuilder.buildBaseContext.mockImplementation((actorId, locationId) => ({
        actor: {
          id: actorId,
          components: actor.getAllComponents ? actor.getAllComponents() : {},
        },
        location: { id: locationId },
        game: { turnNumber: 1 },
      }));

      const actionDef = {
        id: 'test:missing',
        name: 'Missing Target',
        template: 'interact with {target}',
        targets: {
          primary: {
            scope: '["missing-001", "missing-002"]',
            placeholder: 'target',
          },
        },
      };

      const context = {
        candidateActions: [actionDef],
        actor,
        actionContext: { actor },
        data: {},
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      // Should filter out missing entities
      expect(result.data.actionsWithTargets).toHaveLength(0);
    });

    it('should handle optional targets correctly', async () => {
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Actor',
        components: {
          'core:name': { value: 'Player' },
          'core:actor': { name: 'Player' },
          'core:inventory': { items: [] },
        },
      });

      const weaponDef = new EntityDefinition('test:weapon', {
        description: 'Weapon',
        components: {
          'core:name': { value: 'Sword' },
          'core:item': { type: 'weapon' },
        },
      });

      entityTestBed.setupDefinitions(actorDef, weaponDef);

      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'player-001',
      });
      const weapon = await entityManager.createEntityInstance('test:weapon', {
        instanceId: 'sword-001',
      });

      await entityManager.addComponent('player-001', 'core:inventory', {
        items: ['sword-001'],
      });

      await entityManager.createEntityInstance('test:actor', {
        instanceId: 'dummy-target',
      });

      // Mock resolutions
      unifiedScopeResolver.resolve
        .mockResolvedValueOnce(ActionResult.success(new Set(['dummy-target']))) // primary - exists
        .mockResolvedValueOnce(ActionResult.success(new Set(['sword-001']))) // secondary - exists
        .mockResolvedValueOnce(ActionResult.success(new Set())); // tertiary - empty (optional)

      targetContextBuilder.buildBaseContext.mockImplementation((actorId, locationId) => ({
        actor: {
          id: actorId,
          components: actor.getAllComponents ? actor.getAllComponents() : {},
        },
        location: { id: locationId },
        game: { turnNumber: 1 },
      }));

      // Mock buildDependentContext for multi-target resolution
      targetContextBuilder.buildDependentContext.mockImplementation((baseContext, resolvedTargets, targetDef) => ({
        ...baseContext,
        targets: resolvedTargets,
        ...(targetDef.contextFrom && resolvedTargets[targetDef.contextFrom] && Array.isArray(resolvedTargets[targetDef.contextFrom]) && resolvedTargets[targetDef.contextFrom].length > 0
          ? { target: { id: resolvedTargets[targetDef.contextFrom][0].id, components: {} } }
          : {}),
      }));

      const actionDef = {
        id: 'combat:attack',
        name: 'Attack',
        template: 'attack {target} with {weapon} using {technique}',
        targets: {
          primary: {
            scope: '["dummy-target"]',
            placeholder: 'target',
          },
          secondary: {
            scope: 'actor.inventory[]',
            placeholder: 'weapon',
          },
          tertiary: {
            scope: '[]', // Empty - no techniques available
            placeholder: 'technique',
            optional: true,
          },
        },
      };

      const context = {
        candidateActions: [actionDef],
        actor,
        actionContext: { actor },
        data: {},
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      const actionWithTargets = result.data.actionsWithTargets[0];
      // Should have target and weapon, but not technique (optional and empty)
      expect(actionWithTargets.targetContexts).toHaveLength(2);
      expect(actionWithTargets.targetContexts[0].placeholder).toBe('target');
      expect(actionWithTargets.targetContexts[1].placeholder).toBe('weapon');
    });

    it('should handle invalid target configurations', async () => {
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Actor',
        components: {
          'core:name': { value: 'Player' },
          'core:actor': { name: 'Player' },
        },
      });
      entityTestBed.setupDefinitions(actorDef);
      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'player-001',
      });

      // Various invalid configurations
      const invalidActions = [
        {
          id: 'test:null_targets',
          name: 'Null Targets',
          template: 'test',
          targets: null,
        },
        {
          id: 'test:string_targets_object',
          name: 'String Targets as Object',
          template: 'test',
          targets: 'invalid string',
        },
        {
          id: 'test:empty_targets',
          name: 'Empty Targets',
          template: 'test',
          targets: {},
        },
      ];

      const context = {
        candidateActions: invalidActions,
        actor,
        actionContext: { actor },
        data: {},
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(0);
      // Should log errors for invalid configurations
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle scope evaluation errors gracefully', async () => {
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Actor',
        components: {
          'core:name': { value: 'Player' },
          'core:actor': { name: 'Player' },
        },
      });
      entityTestBed.setupDefinitions(actorDef);
      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'player-001',
      });

      // Mock scope resolution failure
      unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.failure({
          error: 'Invalid scope syntax',
          phase: 'resolution',
        })
      );

      targetContextBuilder.buildBaseContext.mockImplementation((actorId, locationId) => ({
        actor: {
          id: actorId,
          components: actor.getAllComponents ? actor.getAllComponents() : {},
        },
        location: { id: locationId },
        game: { turnNumber: 1 },
      }));

      const actionDef = {
        id: 'test:invalid_scope',
        name: 'Invalid Scope',
        template: 'test {target}',
        targets: {
          primary: {
            scope: 'invalid..scope..syntax[[[',
            placeholder: 'target',
          },
        },
      };

      const context = {
        candidateActions: [actionDef],
        actor,
        actionContext: { actor },
        data: {},
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(0);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to resolve scope'),
        expect.any(Array)
      );
    });
  });

  describe('Legacy Format Support', () => {
    it('should handle legacy string targets', async () => {
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Actor',
        components: {
          'core:name': { value: 'Player' },
          'core:actor': { name: 'Player' },
          'core:inventory': { items: [] },
        },
      });

      const itemDef = new EntityDefinition('test:item', {
        description: 'Item',
        components: {
          'core:name': { value: 'Health Potion' },
          'core:item': { type: 'consumable' },
        },
      });

      entityTestBed.setupDefinitions(actorDef, itemDef);

      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'player-001',
      });
      await entityManager.createEntityInstance('test:item', {
        instanceId: 'potion-001',
      });

      await entityManager.addComponent('player-001', 'core:inventory', {
        items: ['potion-001'],
      });

      // Mock legacy resolver
      targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [{ entityId: 'potion-001', displayName: 'Health Potion' }],
      });

      // Legacy format with string targets
      const actionDef = {
        id: 'test:legacy',
        name: 'Legacy Action',
        template: 'use {target}',
        targets: 'actor.inventory.items[]', // String instead of object
      };

      const context = {
        candidateActions: [actionDef],
        actor,
        actionContext: { actor },
        data: {},
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      const actionWithTargets = result.data.actionsWithTargets[0];
      expect(actionWithTargets.targetContexts).toHaveLength(1);
      expect(actionWithTargets.targetContexts[0]).toEqual({
        entityId: 'potion-001',
        displayName: 'Health Potion',
        placeholder: undefined,
      });
    });

    it('should handle legacy scope property', async () => {
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Actor',
        components: {
          'core:name': { value: 'Player' },
          'core:actor': { name: 'Player' },
        },
      });
      entityTestBed.setupDefinitions(actorDef);
      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'player-001',
      });

      // Mock legacy resolver
      targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [{ entityId: 'player-001', displayName: 'Player' }],
      });

      // Legacy format with scope property instead of targets
      const actionDef = {
        id: 'test:legacy_scope',
        name: 'Legacy Scope',
        template: 'examine {target}',
        scope: 'self', // Old property name
      };

      const context = {
        candidateActions: [actionDef],
        actor,
        actionContext: { actor },
        data: {},
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      const actionWithTargets = result.data.actionsWithTargets[0];
      expect(actionWithTargets.targetContexts).toHaveLength(1);
      expect(actionWithTargets.targetContexts[0].entityId).toBe('player-001');
    });

    it('should handle legacy none scope', async () => {
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Actor',
        components: {
          'core:name': { value: 'Player' },
          'core:actor': { name: 'Player' },
        },
      });
      entityTestBed.setupDefinitions(actorDef);
      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'player-001',
      });

      // Mock legacy resolver for 'none' scope
      targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [],
      });

      const actionDef = {
        id: 'test:none_scope',
        name: 'No Target Action',
        template: 'meditate',
        targets: 'none',
      };

      const context = {
        candidateActions: [actionDef],
        actor,
        actionContext: { actor },
        data: {},
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      // Actions with 'none' scope should still be included
      expect(result.data.actionsWithTargets).toHaveLength(1);
      const actionWithTargets = result.data.actionsWithTargets[0];
      expect(actionWithTargets.targetContexts).toHaveLength(0);
    });
  });

  describe('Performance', () => {
    it('should handle multiple candidate actions efficiently', async () => {
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Actor',
        components: {
          'core:name': { value: 'Player' },
          'core:actor': { name: 'Player' },
          'core:inventory': { items: [] },
        },
      });

      entityTestBed.setupDefinitions(actorDef);
      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'player-001',
      });

      // Create many candidate actions
      const candidateActions = [];
      for (let i = 0; i < 20; i++) {
        candidateActions.push({
          id: `test:action${i}`,
          name: `Action ${i}`,
          template: `perform action ${i} on {target}`,
          targets: {
            primary: {
              scope: i % 2 === 0 ? 'self' : 'actor.inventory[]',
              placeholder: 'target',
            },
          },
        });
      }

      // Mock resolutions
      unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set(['player-001']))
      );

      targetContextBuilder.buildBaseContext.mockImplementation((actorId, locationId) => ({
        actor: {
          id: actorId,
          components: actor.getAllComponents ? actor.getAllComponents() : {},
        },
        location: { id: locationId },
        game: { turnNumber: 1 },
      }));

      const startTime = Date.now();
      const context = {
        candidateActions,
        actor,
        actionContext: { actor },
        data: {},
      };

      const result = await stage.executeInternal(context);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(20);

      // Should process all actions efficiently
      expect(endTime - startTime).toBeLessThan(200); // Less than 200ms for 20 actions
    });
  });

  describe('Complex Integration Scenarios', () => {
    it('should maintain backward compatibility with target contexts', async () => {
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Actor',
        components: {
          'core:name': { value: 'Player' },
          'core:actor': { name: 'Player' },
        },
      });
      entityTestBed.setupDefinitions(actorDef);
      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'player-001',
      });

      await entityManager.createEntityInstance('test:actor', {
        instanceId: 'dummy-001',
      });
      await entityManager.createEntityInstance('test:actor', {
        instanceId: 'dummy-002',
      });

      // Mock resolutions
      unifiedScopeResolver.resolve
        .mockResolvedValueOnce(ActionResult.success(new Set(['player-001']))) // primary
        .mockResolvedValueOnce(
          ActionResult.success(new Set(['dummy-001', 'dummy-002']))
        ); // secondary

      targetContextBuilder.buildBaseContext.mockImplementation((actorId, locationId) => ({
        actor: {
          id: actorId,
          components: actor.getAllComponents ? actor.getAllComponents() : {},
        },
        location: { id: locationId },
        game: { turnNumber: 1 },
      }));

      // Mock buildDependentContext for multi-target resolution
      targetContextBuilder.buildDependentContext.mockImplementation((baseContext, resolvedTargets, targetDef) => ({
        ...baseContext,
        targets: resolvedTargets,
        ...(targetDef.contextFrom && resolvedTargets[targetDef.contextFrom] && Array.isArray(resolvedTargets[targetDef.contextFrom]) && resolvedTargets[targetDef.contextFrom].length > 0
          ? { target: { id: resolvedTargets[targetDef.contextFrom][0].id, components: {} } }
          : {}),
      }));

      const actionDef = {
        id: 'test:compat',
        name: 'Compatibility Test',
        template: 'test {primary} and {secondary}',
        targets: {
          primary: {
            scope: 'self',
            placeholder: 'primary',
          },
          secondary: {
            scope: '["dummy-001", "dummy-002"]',
            placeholder: 'secondary',
          },
        },
      };

      const context = {
        candidateActions: [actionDef],
        actor,
        actionContext: { actor },
        data: {},
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);

      // Check backward compatibility fields
      expect(result.data.targetContexts).toBeDefined();
      expect(result.data.targetContexts).toHaveLength(3); // 1 primary + 2 secondary

      expect(result.data.resolvedTargets).toBeDefined();
      expect(result.data.targetDefinitions).toBeDefined();
      expect(result.data.targetDefinitions).toEqual(actionDef.targets);

      // Check action structure maintains compatibility
      const actionWithTargets = result.data.actionsWithTargets[0];
      expect(actionWithTargets.targetContexts).toBeDefined();
      expect(actionWithTargets.targetContexts).toHaveLength(3);
      expect(actionWithTargets.actionDef).toBe(actionDef);
    });
  });
});
