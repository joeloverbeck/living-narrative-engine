/**
 * @file Integration test for singleton scope engine location context bug
 * @description Tests that the singleton scope engine properly updates location context
 * when actors move between locations, preventing stale location references.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { SimpleEntityManager } from '../common/entities/index.js';
import { ActionDiscoveryService } from '../../src/actions/actionDiscoveryService.js';
import { formatActionCommand } from '../../src/actions/actionFormatter.js';
import { SafeEventDispatcher } from '../../src/events/safeEventDispatcher.js';
import ScopeRegistry from '../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../src/scopeDsl/engine.js';
import { parseScopeDefinitions } from '../../src/scopeDsl/scopeDefinitionParser.js';
import JsonLogicEvaluationService from '../../src/logic/jsonLogicEvaluationService.js';
import InMemoryDataRegistry from '../../src/data/inMemoryDataRegistry.js';
import { GameDataRepository } from '../../src/data/gameDataRepository.js';
import { TargetResolutionService } from '../../src/actions/targetResolutionService.js';
import { createTraceContext } from '../../src/actions/tracing/traceContext.js';
import {
  POSITION_COMPONENT_ID,
  NAME_COMPONENT_ID,
  EXITS_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../src/constants/componentIds.js';

// Mock scope definitions
const MOCK_SCOPES = `
core:actors_in_location := entities(core:position)[
  {
    "and": [
      { "==": [{ "var": "entity.components.core:position.locationId" }, { "var": "location.id" }] },
      { "!=": [{ "var": "entity.id" }, { "var": "actor.id" }] },
      { "!!": { "var": "entity.components.core:actor" } }
    ]
  }
]

core:clear_directions := location.core:exits[
  { "!": { "var": "entity.blocker" } }
].target
`;

describe('Singleton Scope Engine Location Context', () => {
  let entityManager;
  let logger;
  let scopeEngine;
  let actionDiscoveryService;
  let registry;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create entities
    const entities = [
      {
        id: 'town',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Town' },
          [EXITS_COMPONENT_ID]: [
            { direction: 'to guild', target: 'guild', blocker: null },
          ],
        },
      },
      {
        id: 'guild',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Guild' },
          [EXITS_COMPONENT_ID]: [
            { direction: 'to town', target: 'town', blocker: null },
          ],
        },
      },
      {
        id: 'hero',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Hero' },
          [ACTOR_COMPONENT_ID]: { type: 'player' },
          [POSITION_COMPONENT_ID]: { locationId: 'guild' },
        },
      },
      {
        id: 'ninja',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Ninja' },
          [ACTOR_COMPONENT_ID]: { type: 'npc' },
          [POSITION_COMPONENT_ID]: { locationId: 'guild' },
        },
      },
    ];

    entityManager = new SimpleEntityManager(entities);

    // Set up registry with actions and conditions
    registry = new InMemoryDataRegistry({ logger });

    // Register actions
    registry.store('actions', 'core:follow', {
      id: 'core:follow',
      name: 'Follow',
      commandVerb: 'follow',
      scope: 'core:actors_in_location',
      template: 'follow {target}',
      prerequisites: [],
    });

    registry.store('actions', 'core:go', {
      id: 'core:go',
      name: 'Go',
      commandVerb: 'go',
      scope: 'core:clear_directions',
      template: 'go to {target}',
      prerequisites: [],
    });

    // Register conditions
    registry.store('conditions', 'core:entity-at-location', {
      id: 'core:entity-at-location',
      logic: {
        '==': [
          { var: 'entity.components.core:position.locationId' },
          { var: 'location.id' },
        ],
      },
    });

    registry.store('conditions', 'core:entity-is-not-current-actor', {
      id: 'core:entity-is-not-current-actor',
      logic: { '!=': [{ var: 'entity.id' }, { var: 'actor.id' }] },
    });

    registry.store('conditions', 'core:entity-has-actor-component', {
      id: 'core:entity-has-actor-component',
      logic: { '!!': { var: 'entity.components.core:actor' } },
    });

    registry.store('conditions', 'core:exit-is-unblocked', {
      id: 'core:exit-is-unblocked',
      logic: { '!': { var: 'entity.blocker' } },
    });

    // Set up scope registry
    const scopeRegistry = new ScopeRegistry({ logger });
    const scopeDefs = parseScopeDefinitions(MOCK_SCOPES, 'test.scope');
    scopeRegistry.initialize(Object.fromEntries(scopeDefs));

    // Create scope engine (singleton) - this is the key component being tested
    scopeEngine = new ScopeEngine({ logger });
    scopeEngine.setMaxDepth(4);

    // Set up services
    const gameDataRepository = new GameDataRepository(registry, logger);

    const jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository,
    });

    const validatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    const safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher,
      logger,
    });

    const targetResolutionService = new TargetResolutionService({
      scopeRegistry,
      scopeEngine, // Using the singleton scope engine
      entityManager,
      logger,
      safeEventDispatcher,
      jsonLogicEvaluationService: jsonLogicEval,
    });

    // Mock prerequisite evaluation service
    const prerequisiteEvaluationService = {
      evaluate: jest.fn(() => true),
    };

    // Mock action index
    const actionIndex = {
      getCandidateActions: jest.fn(() => [
        registry.get('actions', 'core:follow'),
        registry.get('actions', 'core:go'),
      ]),
    };

    actionDiscoveryService = new ActionDiscoveryService({
      entityManager,
      prerequisiteEvaluationService,
      actionIndex,
      logger,
      formatActionCommandFn: formatActionCommand,
      safeEventDispatcher,
      targetResolutionService,
      traceContextFactory: () => createTraceContext(),
    });
  });

  it('should update available exits when actor moves between locations', async () => {
    const heroActor = entityManager.getEntityInstance('hero');
    const guildLocation = entityManager.getEntityInstance('guild');
    const townLocation = entityManager.getEntityInstance('town');

    // Initially hero is in guild
    let actions = await actionDiscoveryService.getValidActions(heroActor, {
      currentLocation: guildLocation,
    });

    let goActions = actions.actions.filter((a) => a.id === 'core:go');
    expect(goActions).toHaveLength(1);
    expect(goActions[0].command).toBe('go to Town');
    expect(goActions[0].params.targetId).toBe('town');

    // Move hero to town
    entityManager.addComponent('hero', POSITION_COMPONENT_ID, {
      locationId: 'town',
    });

    // Get actions with new location
    actions = await actionDiscoveryService.getValidActions(heroActor, {
      currentLocation: townLocation,
    });

    goActions = actions.actions.filter((a) => a.id === 'core:go');
    expect(goActions).toHaveLength(1);
    expect(goActions[0].command).toBe('go to Guild');
    expect(goActions[0].params.targetId).toBe('guild');
  });

  it('should only show actors in the same location for follow action', async () => {
    const heroActor = entityManager.getEntityInstance('hero');
    const guildLocation = entityManager.getEntityInstance('guild');
    const townLocation = entityManager.getEntityInstance('town');

    // Hero and Ninja both in guild
    let actions = await actionDiscoveryService.getValidActions(heroActor, {
      currentLocation: guildLocation,
    });

    let followActions = actions.actions.filter((a) => a.id === 'core:follow');
    expect(followActions).toHaveLength(1);
    expect(followActions[0].command).toBe('follow Ninja');

    // Move hero to town (ninja stays in guild)
    entityManager.addComponent('hero', POSITION_COMPONENT_ID, {
      locationId: 'town',
    });

    actions = await actionDiscoveryService.getValidActions(heroActor, {
      currentLocation: townLocation,
    });

    followActions = actions.actions.filter((a) => a.id === 'core:follow');
    expect(followActions).toHaveLength(0); // No one to follow in town

    // Move ninja to town as well
    entityManager.addComponent('ninja', POSITION_COMPONENT_ID, {
      locationId: 'town',
    });

    actions = await actionDiscoveryService.getValidActions(heroActor, {
      currentLocation: townLocation,
    });

    followActions = actions.actions.filter((a) => a.id === 'core:follow');
    expect(followActions).toHaveLength(1);
    expect(followActions[0].command).toBe('follow Ninja');
  });

  it('should handle multiple location changes with singleton scope engine', async () => {
    const heroActor = entityManager.getEntityInstance('hero');
    const guildLocation = entityManager.getEntityInstance('guild');
    const townLocation = entityManager.getEntityInstance('town');

    // Test multiple moves to ensure singleton doesn't cache location
    const locations = [
      guildLocation,
      townLocation,
      guildLocation,
      townLocation,
    ];
    const expectedExits = ['town', 'guild', 'town', 'guild'];

    for (let i = 0; i < locations.length; i++) {
      const locationId = locations[i].id;
      entityManager.addComponent('hero', POSITION_COMPONENT_ID, { locationId });

      const actions = await actionDiscoveryService.getValidActions(heroActor, {
        currentLocation: locations[i],
      });

      const goActions = actions.actions.filter((a) => a.id === 'core:go');
      expect(goActions).toHaveLength(1);
      expect(goActions[0].params.targetId).toBe(expectedExits[i]);
    }
  });

  it('should not show stale location data when checking different actors', async () => {
    const heroActor = entityManager.getEntityInstance('hero');
    const ninjaActor = entityManager.getEntityInstance('ninja');
    const guildLocation = entityManager.getEntityInstance('guild');
    const townLocation = entityManager.getEntityInstance('town');

    // First check ninja's actions (in guild)
    let ninjaActions = await actionDiscoveryService.getValidActions(
      ninjaActor,
      {
        currentLocation: guildLocation,
      }
    );

    let ninjaGo = ninjaActions.actions.filter((a) => a.id === 'core:go');
    expect(ninjaGo[0].params.targetId).toBe('town');

    // Move hero to town
    entityManager.addComponent('hero', POSITION_COMPONENT_ID, {
      locationId: 'town',
    });

    // Check hero's actions (should see guild exit, not town)
    let heroActions = await actionDiscoveryService.getValidActions(heroActor, {
      currentLocation: townLocation,
    });

    let heroGo = heroActions.actions.filter((a) => a.id === 'core:go');
    expect(heroGo[0].params.targetId).toBe('guild');

    // Re-check ninja's actions to ensure they haven't changed
    ninjaActions = await actionDiscoveryService.getValidActions(ninjaActor, {
      currentLocation: guildLocation,
    });

    ninjaGo = ninjaActions.actions.filter((a) => a.id === 'core:go');
    expect(ninjaGo[0].params.targetId).toBe('town');
  });
});
