/**
 * @file Integration tests for positioning:place_yourself_behind action discovery.
 * @description Tests that the action is properly discovered when scope conditions are met
 * and not discovered when scope conditions are not met.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { SimpleEntityManager } from '../../common/entities/index.js';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import { ActionPipelineOrchestrator } from '../../../src/actions/actionPipelineOrchestrator.js';
import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';
import { getEntityDisplayName } from '../../../src/utils/entityUtils.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import {
  ACTOR_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  NAME_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import fs from 'fs';
import path from 'path';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import {
  createTargetResolutionServiceWithMocks,
} from '../../common/mocks/mockUnifiedScopeResolver.js';
import DefaultDslParser from '../../../src/scopeDsl/parser/defaultDslParser.js';
import { createMockActionErrorContextBuilder } from '../../common/mockFactories/actions.js';
import { createMockTargetContextBuilder } from '../../common/mocks/mockTargetContextBuilder.js';
import { ActionIndex } from '../../../src/actions/actionIndex.js';
import { createMultiTargetResolutionStage } from '../../common/actions/multiTargetStageTestUtilities.js';

// Import the action we're testing
import placeYourselfBehindAction from '../../../data/mods/positioning/actions/place_yourself_behind.action.json';

// Unmock the real singleton to ensure the test and SUT use the same instance
jest.unmock('../../../src/scopeDsl/scopeRegistry.js');

describe('Place Yourself Behind Action Discovery Integration Tests', () => {
  let entityManager;
  let logger;
  let scopeRegistry;
  let scopeEngine;
  let jsonLogicEval;
  let actionDiscoveryService;
  let gameDataRepository;
  let safeEventDispatcher;
  let actionIndex;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    entityManager = new SimpleEntityManager([]);
    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();

    // Load the scope we're testing
    const actorsInLocationFacingScopeContent = fs.readFileSync(
      path.resolve(__dirname, '../../../data/mods/positioning/scopes/actors_in_location_facing.scope'),
      'utf8'
    );

    // Parse and register the scope
    const scopeDefinitions = parseScopeDefinitions(actorsInLocationFacingScopeContent, 'actors_in_location_facing.scope');
    
    // Initialize the scope registry with the parsed definitions
    const scopesToInit = {};
    scopeDefinitions.forEach((def, id) => {
      scopesToInit[id] = def;
    });
    scopeRegistry.initialize(scopesToInit);

    const dslParser = new DefaultDslParser({ logger });
    scopeEngine = new ScopeEngine({
      scopeRegistry,
      dslParser,
      logger,
    });

    jsonLogicEval = new JsonLogicEvaluationService({ logger });

    // Load conditions needed by the scope
    const conditionFiles = [
      '../../../data/mods/core/conditions/entity-at-location.condition.json',
      '../../../data/mods/core/conditions/entity-is-not-current-actor.condition.json', 
      '../../../data/mods/core/conditions/entity-has-actor-component.condition.json',
      '../../../data/mods/positioning/conditions/entity-in-facing-away.condition.json'
    ];

    const dataRegistry = new InMemoryDataRegistry();
    conditionFiles.forEach(file => {
      const condition = JSON.parse(fs.readFileSync(path.resolve(__dirname, file), 'utf8'));
      dataRegistry.store('conditions', condition.id, condition);
    });

    // Store the action we're testing
    dataRegistry.store('actions', placeYourselfBehindAction.id, placeYourselfBehindAction);

    gameDataRepository = new GameDataRepository(dataRegistry, logger);

    const mockEventBus = { 
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };
    safeEventDispatcher = new SafeEventDispatcher({ validatedEventDispatcher: mockEventBus, logger });

    // Set up action discovery service
    const targetResolutionService = createTargetResolutionServiceWithMocks({
      entityManager,
      scopeEngine,
      jsonLogicEval,
      gameDataRepository,
      logger,
    });

    const multiTargetResolutionStage = createMultiTargetResolutionStage({
      entityManager,
      logger,
      targetResolver: targetResolutionService,
    });

    const actionCommandFormatter = new ActionCommandFormatter({
      getEntityDisplayName,
      logger,
    });

    const actionPipelineOrchestrator = new ActionPipelineOrchestrator({
      multiTargetResolutionStage,
      actionCommandFormatter,
      safeEventDispatcher,
      logger,
    });

    actionIndex = new ActionIndex({ logger, entityManager });
    actionIndex.buildIndex([placeYourselfBehindAction]);

    actionDiscoveryService = new ActionDiscoveryService({
      actionIndex,
      actionPipelineOrchestrator,
      entityManager,
      logger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should discover place_yourself_behind action when actor can face target', async () => {
    // Arrange - Create entities in same location where actor is not facing away from target
    const actorId = 'test:player';
    const targetId = 'test:npc';
    const locationId = 'test:room';

    // Create actor
    entityManager.createEntity(actorId);
    entityManager.addComponent(actorId, ACTOR_COMPONENT_ID, {});
    entityManager.addComponent(actorId, POSITION_COMPONENT_ID, { locationId });
    entityManager.addComponent(actorId, NAME_COMPONENT_ID, { first: 'Player', last: 'Character' });

    // Create target in same location
    entityManager.createEntity(targetId);
    entityManager.addComponent(targetId, ACTOR_COMPONENT_ID, {});
    entityManager.addComponent(targetId, POSITION_COMPONENT_ID, { locationId });
    entityManager.addComponent(targetId, NAME_COMPONENT_ID, { first: 'Guard', last: 'NPC' });

    // Act - Discover available actions
    const result = await actionDiscoveryService.discoverAvailableActions(actorId);

    // Assert - Action should be discovered
    const placeYourselfBehindActions = result.actions.filter(action => 
      action.id === 'positioning:place_yourself_behind'
    );
    expect(placeYourselfBehindActions).toHaveLength(1);
    
    const action = placeYourselfBehindActions[0];
    expect(action.targets).toContain(targetId);
  });

  it('should not discover place_yourself_behind action when actor is facing away from potential target', async () => {
    // Arrange - Create entities where actor is facing away from target
    const actorId = 'test:player';
    const targetId = 'test:npc';
    const locationId = 'test:room';

    // Create actor with facing_away component targeting the potential target
    entityManager.createEntity(actorId);
    entityManager.addComponent(actorId, ACTOR_COMPONENT_ID, {});
    entityManager.addComponent(actorId, POSITION_COMPONENT_ID, { locationId });
    entityManager.addComponent(actorId, NAME_COMPONENT_ID, { first: 'Player', last: 'Character' });
    entityManager.addComponent(actorId, 'positioning:facing_away', {
      facing_away_from: [targetId]
    });

    // Create target in same location
    entityManager.createEntity(targetId);
    entityManager.addComponent(targetId, ACTOR_COMPONENT_ID, {});
    entityManager.addComponent(targetId, POSITION_COMPONENT_ID, { locationId });
    entityManager.addComponent(targetId, NAME_COMPONENT_ID, { first: 'Guard', last: 'NPC' });

    // Act - Discover available actions
    const result = await actionDiscoveryService.discoverAvailableActions(actorId);

    // Assert - Action should not be discovered for this target since actor is facing away
    const placeYourselfBehindActions = result.actions.filter(action => 
      action.id === 'positioning:place_yourself_behind'
    );
    
    // If action is discovered, the specific target should not be included
    const hasActionWithTarget = placeYourselfBehindActions.some(action => 
      action.targets && action.targets.includes(targetId)
    );
    expect(hasActionWithTarget).toBe(false);
  });

  it('should not discover place_yourself_behind action when no other actors in location', async () => {
    // Arrange - Create actor alone in location
    const actorId = 'test:player';
    const locationId = 'test:room';

    entityManager.createEntity(actorId);
    entityManager.addComponent(actorId, ACTOR_COMPONENT_ID, {});
    entityManager.addComponent(actorId, POSITION_COMPONENT_ID, { locationId });
    entityManager.addComponent(actorId, NAME_COMPONENT_ID, { first: 'Player', last: 'Character' });

    // Act - Discover available actions
    const result = await actionDiscoveryService.discoverAvailableActions(actorId);

    // Assert - Action should not be discovered (no valid targets)
    const placeYourselfBehindActions = result.actions.filter(action => 
      action.id === 'positioning:place_yourself_behind'
    );
    expect(placeYourselfBehindActions).toHaveLength(0);
  });

  it('should not discover place_yourself_behind action when potential targets are in different location', async () => {
    // Arrange - Create entities in different locations
    const actorId = 'test:player';
    const targetId = 'test:npc';
    const actorLocationId = 'test:room1';
    const targetLocationId = 'test:room2';

    // Create actor
    entityManager.createEntity(actorId);
    entityManager.addComponent(actorId, ACTOR_COMPONENT_ID, {});
    entityManager.addComponent(actorId, POSITION_COMPONENT_ID, { locationId: actorLocationId });
    entityManager.addComponent(actorId, NAME_COMPONENT_ID, { first: 'Player', last: 'Character' });

    // Create target in different location
    entityManager.createEntity(targetId);
    entityManager.addComponent(targetId, ACTOR_COMPONENT_ID, {});
    entityManager.addComponent(targetId, POSITION_COMPONENT_ID, { locationId: targetLocationId });
    entityManager.addComponent(targetId, NAME_COMPONENT_ID, { first: 'Guard', last: 'NPC' });

    // Act - Discover available actions
    const result = await actionDiscoveryService.discoverAvailableActions(actorId);

    // Assert - Action should not be discovered (targets not in same location)
    const placeYourselfBehindActions = result.actions.filter(action => 
      action.id === 'positioning:place_yourself_behind'
    );
    expect(placeYourselfBehindActions).toHaveLength(0);
  });

  it('should discover place_yourself_behind action for multiple valid targets', async () => {
    // Arrange - Create multiple valid targets in same location
    const actorId = 'test:player';
    const target1Id = 'test:npc1';
    const target2Id = 'test:npc2';
    const locationId = 'test:room';

    // Create actor
    entityManager.createEntity(actorId);
    entityManager.addComponent(actorId, ACTOR_COMPONENT_ID, {});
    entityManager.addComponent(actorId, POSITION_COMPONENT_ID, { locationId });
    entityManager.addComponent(actorId, NAME_COMPONENT_ID, { first: 'Player', last: 'Character' });

    // Create multiple targets
    [target1Id, target2Id].forEach((targetId, index) => {
      entityManager.createEntity(targetId);
      entityManager.addComponent(targetId, ACTOR_COMPONENT_ID, {});
      entityManager.addComponent(targetId, POSITION_COMPONENT_ID, { locationId });
      entityManager.addComponent(targetId, NAME_COMPONENT_ID, { 
        first: 'Guard', 
        last: `NPC${index + 1}` 
      });
    });

    // Act - Discover available actions
    const result = await actionDiscoveryService.discoverAvailableActions(actorId);

    // Assert - Action should be discovered with both targets
    const placeYourselfBehindActions = result.actions.filter(action => 
      action.id === 'positioning:place_yourself_behind'
    );
    expect(placeYourselfBehindActions).toHaveLength(1);
    
    const action = placeYourselfBehindActions[0];
    expect(action.targets).toContain(target1Id);
    expect(action.targets).toContain(target2Id);
    expect(action.targets).toHaveLength(2);
  });

  it('should filter out targets the actor is facing away from but include others', async () => {
    // Arrange - Create scenario where actor faces away from one target but not another
    const actorId = 'test:player';
    const validTargetId = 'test:valid_npc';
    const invalidTargetId = 'test:invalid_npc';
    const locationId = 'test:room';

    // Create actor facing away from one potential target
    entityManager.createEntity(actorId);
    entityManager.addComponent(actorId, ACTOR_COMPONENT_ID, {});
    entityManager.addComponent(actorId, POSITION_COMPONENT_ID, { locationId });
    entityManager.addComponent(actorId, NAME_COMPONENT_ID, { first: 'Player', last: 'Character' });
    entityManager.addComponent(actorId, 'positioning:facing_away', {
      facing_away_from: [invalidTargetId]
    });

    // Create valid target (actor not facing away)
    entityManager.createEntity(validTargetId);
    entityManager.addComponent(validTargetId, ACTOR_COMPONENT_ID, {});
    entityManager.addComponent(validTargetId, POSITION_COMPONENT_ID, { locationId });
    entityManager.addComponent(validTargetId, NAME_COMPONENT_ID, { 
      first: 'Valid', 
      last: 'Target' 
    });

    // Create invalid target (actor facing away)
    entityManager.createEntity(invalidTargetId);
    entityManager.addComponent(invalidTargetId, ACTOR_COMPONENT_ID, {});
    entityManager.addComponent(invalidTargetId, POSITION_COMPONENT_ID, { locationId });
    entityManager.addComponent(invalidTargetId, NAME_COMPONENT_ID, { 
      first: 'Invalid', 
      last: 'Target' 
    });

    // Act - Discover available actions
    const result = await actionDiscoveryService.discoverAvailableActions(actorId);

    // Assert - Action should be discovered only for valid target
    const placeYourselfBehindActions = result.actions.filter(action => 
      action.id === 'positioning:place_yourself_behind'
    );
    expect(placeYourselfBehindActions).toHaveLength(1);
    
    const action = placeYourselfBehindActions[0];
    expect(action.targets).toContain(validTargetId);
    expect(action.targets).not.toContain(invalidTargetId);
    expect(action.targets).toHaveLength(1);
  });
});