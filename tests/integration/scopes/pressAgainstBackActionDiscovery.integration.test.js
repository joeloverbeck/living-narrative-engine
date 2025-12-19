/**
 * @file Integration tests for press_against_back action discovery
 * @description Tests that the press_against_back action is properly discovered when
 * the actor has breasts and the target is facing away, and filtered out when conditions aren't met
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
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import {
  createTargetResolutionServiceWithMocks,
  createMockUnifiedScopeResolver,
} from '../../common/mocks/mockUnifiedScopeResolver.js';
// DefaultDslParser import removed - not needed for this test
import {
  createMockActionErrorContextBuilder,
  createMockTargetRequiredComponentsValidator,
} from '../../common/mockFactories/actions.js';
import { createMockTargetContextBuilder } from '../../common/mocks/mockTargetContextBuilder.js';
import { createMockMultiTargetResolutionStage } from '../../common/mocks/mockMultiTargetResolutionStage.js';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import { DefaultDslParser } from '../../../src/scopeDsl/parser/defaultDslParser.js';
import fs from 'fs';
import path from 'path';

// Import actual scope file content
const closeActorsFacingAwayScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/caressing/scopes/close_actors_facing_away.scope'
  ),
  'utf8'
);

// Import actual action files
import pressAgainstBackAction from '../../../data/mods/sex-breastplay/actions/press_against_back.action.json';

jest.unmock('../../../src/scopeDsl/scopeRegistry.js');

describe('Press Against Back Action Discovery Integration Tests', () => {
  let entityManager;
  let logger;
  let scopeRegistry;
  let scopeEngine;
  let jsonLogicEval;
  let actionDiscoveryService;
  let jsonLogicCustomOperators;
  let mockBodyGraphService;
  let safeEventDispatcher;
  let mockMultiTargetResolutionStage;
  let mockPrerequisiteEvaluationService;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    entityManager = new SimpleEntityManager([]);

    // Mock body graph service for custom operators
    mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn(),
      findPartsByType: jest.fn(),
      getAllParts: jest.fn(),
      buildAdjacencyCache: jest.fn().mockReturnValue(undefined),
    };

    const dataRegistry = new InMemoryDataRegistry({ logger });

    // Store the action
    dataRegistry.store(
      'actions',
      pressAgainstBackAction.id,
      pressAgainstBackAction
    );

    // Store the actual condition from the file system
    const actualCondition = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../../data/mods/positioning/conditions/actor-in-entity-facing-away.condition.json'
        ),
        'utf8'
      )
    );
    dataRegistry.store(
      'conditions',
      'positioning:actor-in-entity-facing-away',
      actualCondition
    );

    // Initialize JSON Logic with custom operators
    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: {
        getConditionDefinition: (id) => dataRegistry.get('conditions', id),
      },
    });
    // Create mock lighting state service
    const mockLightingStateService = {
      isLocationLit: jest.fn().mockReturnValue(true),
    };

    jsonLogicCustomOperators = new JsonLogicCustomOperators({
      logger,
      bodyGraphService: mockBodyGraphService,
      entityManager,
      lightingStateService: mockLightingStateService,
    });

    jsonLogicCustomOperators.registerOperators(jsonLogicEval);

    // Parse and register the scope
    const scopeDefinitions = parseScopeDefinitions(
      closeActorsFacingAwayScopeContent,
      'close_actors_facing_away.scope'
    );

    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();

    scopeRegistry.initialize({
      'caressing:close_actors_facing_away': scopeDefinitions.get(
        'caressing:close_actors_facing_away'
      ),
    });

    scopeEngine = new ScopeEngine();

    // Create mock prerequisite service that can be configured per test
    mockPrerequisiteEvaluationService = {
      evaluateActionConditions: jest.fn(),
    };

    const targetResolutionService = createTargetResolutionServiceWithMocks({
      scopeRegistry,
      scopeEngine,
      jsonLogicEvaluationService: jsonLogicEval,
      entityManager,
      logger,
    });

    // Create mock MultiTargetResolutionStage
    mockMultiTargetResolutionStage = createMockMultiTargetResolutionStage();

    const gameDataRepository = {
      getAllActionDefinitions: jest
        .fn()
        .mockReturnValue([pressAgainstBackAction]),
      get: jest.fn((type, id) => dataRegistry.get(type, id)),
    };

    safeEventDispatcher = new SafeEventDispatcher({
      logger,
      validatedEventDispatcher: {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      },
    });

    // Create mock TargetComponentValidator
    const mockTargetComponentValidator = {
      validateTargetComponents: jest.fn().mockReturnValue({ valid: true }),
      validateEntityComponents: jest.fn().mockReturnValue({ valid: true }),
    };

    // Create mock TargetRequiredComponentsValidator
    const mockTargetRequiredComponentsValidator =
      createMockTargetRequiredComponentsValidator();
    const actionPipelineOrchestrator = new ActionPipelineOrchestrator({
      actionIndex: {
        getCandidateActions: jest.fn().mockImplementation((actor, trace) => {
          // Get all actions
          const allActions = gameDataRepository.getAllActionDefinitions();

          // Filter based on required_components (like the real ActionIndex does)
          return allActions.filter((actionDef) => {
            if (!actionDef.required_components?.actor) {
              return true; // No requirements, include it
            }

            // Get actor components
            const actorComponents = actor.getAllComponents
              ? Object.keys(actor.getAllComponents())
              : actor.components
                ? Object.keys(actor.components)
                : [];

            // Check if actor has all required components
            return actionDef.required_components.actor.every(
              (requiredComponent) => actorComponents.includes(requiredComponent)
            );
          });
        }),
      },
      prerequisiteService: mockPrerequisiteEvaluationService,
      targetService: targetResolutionService,
      formatter: new ActionCommandFormatter(),
      entityManager,
      safeEventDispatcher,
      getEntityDisplayNameFn: getEntityDisplayName,
      errorBuilder: createMockActionErrorContextBuilder(),
      logger,
      unifiedScopeResolver: createMockUnifiedScopeResolver({
        scopeRegistry,
        entityManager,
        logger,
        dslParser: new DefaultDslParser(),
        actionErrorContextBuilder: createMockActionErrorContextBuilder(),
        jsonLogicEvaluationService: jsonLogicEval,
      }),
      targetContextBuilder: createMockTargetContextBuilder(),
      multiTargetResolutionStage: mockMultiTargetResolutionStage,
      targetComponentValidator: mockTargetComponentValidator,
      targetRequiredComponentsValidator: mockTargetRequiredComponentsValidator,
    });

    actionDiscoveryService = new ActionDiscoveryService({
      entityManager,
      logger,
      actionPipelineOrchestrator,
      traceContextFactory: jest.fn(() => ({ addLog: jest.fn(), logs: [] })),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Sets up test entities with an actor that has breast anatomy and a target.
   *
   * @param {object} targetFacingConfig - Additional configuration for the target entity
   */
  function setupEntitiesWithBreasts(targetFacingConfig = {}) {
    const entities = [
      {
        id: 'actor1',
        components: {
          'core:actor': { name: 'Actor 1' },
          'personal-space-states:closeness': {
            partners: ['target1'],
          },
          'anatomy:body': {
            body: {
              root: 'actor_torso',
            },
          },
        },
      },
      {
        id: 'target1',
        components: {
          'core:actor': { name: 'Target 1' },
          'personal-space-states:closeness': {
            partners: ['actor1'],
          },
          'positioning:facing_away': {
            facing_away_from: ['actor1'], // Target is facing away from actor
          },
          ...targetFacingConfig,
        },
      },
      {
        id: 'actor_torso',
        components: {
          'anatomy:part': {
            parent: null,
            children: ['actor_breast1', 'actor_breast2'],
            subType: 'torso',
          },
        },
      },
      {
        id: 'actor_breast1',
        components: {
          'anatomy:part': {
            parent: 'actor_torso',
            children: [],
            subType: 'breast',
          },
        },
      },
      {
        id: 'actor_breast2',
        components: {
          'anatomy:part': {
            parent: 'actor_torso',
            children: [],
            subType: 'breast',
          },
        },
      },
    ];

    entityManager.setEntities(entities);

    // Mock hasPartOfType to find breasts on the actor
    mockBodyGraphService.findPartsByType.mockImplementation(
      (rootId, partType) => {
        if (rootId === 'actor_torso' && partType === 'breast') {
          return ['actor_breast1', 'actor_breast2'];
        }
        return [];
      }
    );
  }

  /**
   * Sets up test entities with an actor that does not have breast anatomy.
   */
  function setupEntitiesWithoutBreasts() {
    const entities = [
      {
        id: 'actor1',
        components: {
          'core:actor': { name: 'Actor 1' },
          'personal-space-states:closeness': {
            partners: ['target1'],
          },
          'anatomy:body': {
            body: {
              root: 'actor_torso_no_breasts',
            },
          },
        },
      },
      {
        id: 'target1',
        components: {
          'core:actor': { name: 'Target 1' },
          'personal-space-states:closeness': {
            partners: ['actor1'],
          },
          'positioning:facing_away': {
            facing_away_from: ['actor1'],
          },
        },
      },
      {
        id: 'actor_torso_no_breasts',
        components: {
          'anatomy:part': {
            parent: null,
            children: [],
            subType: 'torso',
          },
        },
      },
    ];

    entityManager.setEntities(entities);

    // Mock hasPartOfType to return no breasts
    mockBodyGraphService.findPartsByType.mockImplementation(() => []);
  }

  describe('action discovery tests', () => {
    it('should not discover action when actor lacks breast anatomy', async () => {
      // Arrange
      setupEntitiesWithoutBreasts();

      // Mock the prerequisite evaluation to fail for breast check
      mockPrerequisiteEvaluationService.evaluateActionConditions.mockResolvedValue(
        {
          success: false,
          errors: ['You need breasts to perform this action.'],
        }
      );

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const pressAgainstBackActions = result.actions.filter(
        (action) => action.id === 'sex-breastplay:press_against_back'
      );
      expect(pressAgainstBackActions).toHaveLength(0);
    });

    it('should not discover action when target is facing toward actor', async () => {
      // Arrange - target facing toward actor instead of away

      // Mock the prerequisite evaluation to pass for breast check (scope should filter out the action)
      mockPrerequisiteEvaluationService.evaluateActionConditions.mockResolvedValue(
        {
          success: true,
          errors: [],
        }
      );

      setupEntitiesWithBreasts({
        'positioning:facing_away': {
          facing_away_from: [], // Target is not facing away from actor
        },
      });

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert - should not find action due to scope filtering
      const pressAgainstBackActions = result.actions.filter(
        (action) => action.id === 'sex-breastplay:press_against_back'
      );
      expect(pressAgainstBackActions).toHaveLength(0);
    });

    it('should not discover action when actors are not in closeness', async () => {
      // Arrange - entities without closeness relationship

      // Mock the prerequisite evaluation to pass for breast check (closeness should filter out the action)
      mockPrerequisiteEvaluationService.evaluateActionConditions.mockResolvedValue(
        {
          success: true,
          errors: [],
        }
      );

      const entities = [
        {
          id: 'actor1',
          components: {
            'core:actor': { name: 'Actor 1' },
            'personal-space-states:closeness': {
              partners: [], // No closeness partners
            },
            'anatomy:body': {
              body: {
                root: 'actor_torso',
              },
            },
          },
        },
        {
          id: 'target1',
          components: {
            'core:actor': { name: 'Target 1' },
            'personal-space-states:closeness': {
              partners: [], // No closeness partners
            },
            'positioning:facing_away': {
              facing_away_from: ['actor1'],
            },
          },
        },
      ];

      entityManager.setEntities(entities);

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert - should not find action due to lack of closeness
      const pressAgainstBackActions = result.actions.filter(
        (action) => action.id === 'sex-breastplay:press_against_back'
      );
      expect(pressAgainstBackActions).toHaveLength(0);
    });
  });
});
