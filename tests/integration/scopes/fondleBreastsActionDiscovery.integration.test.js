/**
 * @file Integration tests for fondle_breasts action discovery with socket coverage
 * @description Tests that the actors_with_breasts_facing_each_other_or_away scope properly filters
 * actors based on breast socket coverage, facing direction, and closeness
 *
 * NOTE: This test uses a mock MultiTargetResolutionStage that bypasses actual scope evaluation.
 * For tests that verify the scope evaluation with custom operators actually works, see
 * fondleBreastsScopeEvaluation.integration.test.js
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
import DefaultDslParser from '../../../src/scopeDsl/parser/defaultDslParser.js';
import {
  createMockActionErrorContextBuilder,
  createMockTargetRequiredComponentsValidator,
} from '../../common/mockFactories/actions.js';
import { createMockTargetContextBuilder } from '../../common/mocks/mockTargetContextBuilder.js';
import { createMockMultiTargetResolutionStage } from '../../common/mocks/mockMultiTargetResolutionStage.js';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import fs from 'fs';
import path from 'path';

// Import actual scope file content
const breastsScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/sex-breastplay/scopes/actors_with_breasts_facing_each_other_or_away.scope'
  ),
  'utf8'
);

// Import actual action files
import fondleBreastsAction from '../../../data/mods/sex-breastplay/actions/fondle_breasts.action.json';

jest.unmock('../../../src/scopeDsl/scopeRegistry.js');

describe('Fondle Breasts Action Discovery Integration Tests', () => {
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
    dataRegistry.store('actions', fondleBreastsAction.id, fondleBreastsAction);

    // Store the relevant positioning conditions from the file system
    const facingEachOtherCondition = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../../data/mods/positioning/conditions/both-actors-facing-each-other.condition.json'
        ),
        'utf8'
      )
    );
    dataRegistry.store(
      'conditions',
      'positioning:both-actors-facing-each-other',
      facingEachOtherCondition
    );

    const actorBehindCondition = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../../data/mods/positioning/conditions/actor-is-behind-entity.condition.json'
        ),
        'utf8'
      )
    );
    dataRegistry.store(
      'conditions',
      'positioning:actor-is-behind-entity',
      actorBehindCondition
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

    // Wrap the jsonLogicEval addOperation to track what's being registered
    const originalAddOperation = jsonLogicEval.addOperation.bind(jsonLogicEval);
    const registeredOps = [];
    jsonLogicEval.addOperation = function (name, func) {
      console.log('Test: Registering operator:', name);
      registeredOps.push(name);

      // Wrap the operator function to log when it's called
      const wrappedFunc = function (...args) {
        console.log(`Test: Operator ${name} called with:`, args);
        console.log(
          `Test: Operator ${name} context keys:`,
          this ? Object.keys(this) : 'no context'
        );
        const result = func.apply(this, args);
        console.log(`Test: Operator ${name} returned:`, result);
        return result;
      };

      return originalAddOperation(name, wrappedFunc);
    };

    jsonLogicCustomOperators.registerOperators(jsonLogicEval);
    console.log('Test: Registered operators:', registeredOps);

    // Parse and register the scope
    const parser = new DefaultDslParser({ logger });
    const scopeDefinitions = parseScopeDefinitions(
      breastsScopeContent,
      'actors_with_breasts_facing_each_other_or_away.scope'
    );

    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();

    scopeRegistry.initialize({
      'sex-breastplay:actors_with_breasts_facing_each_other_or_away':
        scopeDefinitions.get(
          'sex-breastplay:actors_with_breasts_facing_each_other_or_away'
        ),
    });

    scopeEngine = new ScopeEngine();
    const prerequisiteEvaluationService = {
      evaluateActionConditions: jest.fn().mockResolvedValue({
        success: true,
        errors: [],
      }),
    };

    // Add debug to verify we're passing the right instance
    console.log(
      'Test: jsonLogicEval passed to createTargetResolutionServiceWithMocks === jsonLogicEval with operators?',
      jsonLogicEval === jsonLogicEval
    );

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
      getAllActionDefinitions: jest.fn().mockReturnValue([fondleBreastsAction]),
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
        getCandidateActions: jest
          .fn()
          .mockImplementation(() =>
            gameDataRepository.getAllActionDefinitions()
          ),
      },
      prerequisiteService: prerequisiteEvaluationService,
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

  describe('socket coverage tests', () => {
    /**
     *
     * @param targetClothingConfig
     * @param options
     */
    function setupEntities(targetClothingConfig = {}, options = {}) {
      const { targetFacingAway = false, actorFacingAway = false } = options;
      const entities = [
        {
          id: 'actor1',
          components: {
            'core:actor': { name: 'Actor 1' },
            'personal-space-states:closeness': {
              partners: ['target1'],
            },
            'positioning:facing_away': {
              facing_away_from: actorFacingAway ? ['target1'] : [],
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
              facing_away_from: targetFacingAway ? ['actor1'] : [],
            },
            'anatomy:body': {
              body: {
                root: 'torso1',
              },
            },
            ...targetClothingConfig,
          },
        },
        {
          id: 'torso1',
          components: {
            'anatomy:part': {
              parent: null,
              children: ['breast1', 'breast2'],
              subType: 'torso',
            },
          },
        },
        {
          id: 'breast1',
          components: {
            'anatomy:part': {
              parent: 'torso1',
              children: [],
              subType: 'breast',
            },
          },
        },
        {
          id: 'breast2',
          components: {
            'anatomy:part': {
              parent: 'torso1',
              children: [],
              subType: 'breast',
            },
          },
        },
      ];

      entityManager.setEntities(entities);

      // Mock hasPartOfType to find breasts
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootId, partType) => {
          if (partType === 'breast') {
            return ['breast1', 'breast2'];
          }
          return [];
        }
      );
    }

    it('should discover action when both breasts are uncovered', async () => {
      // Arrange - no clothing equipment
      setupEntities({});

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const fondleBreastsActions = result.actions.filter(
        (action) => action.id === 'sex-breastplay:fondle_breasts'
      );
      expect(fondleBreastsActions).toHaveLength(1);
      expect(fondleBreastsActions[0].params.targetId).toBe('target1');
    });

    it('should discover action when the target is facing away from the actor', async () => {
      // Arrange - target faces away to allow behind-the-back interaction
      setupEntities({}, { targetFacingAway: true });

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const fondleBreastsActions = result.actions.filter(
        (action) => action.id === 'sex-breastplay:fondle_breasts'
      );
      expect(fondleBreastsActions).toHaveLength(1);
      expect(fondleBreastsActions[0].params.targetId).toBe('target1');
    });

    it('should discover action when one breast is covered and one is uncovered', async () => {
      // Arrange - partial coverage
      setupEntities({
        'clothing:equipment': {
          equipped: {
            torso_partial: {
              base: ['partial_shirt'],
            },
          },
        },
        'clothing:slot_metadata': {
          slotMappings: {
            torso_partial: {
              coveredSockets: ['left_chest'], // Only covers left breast
              allowedLayers: ['base'],
            },
          },
        },
      });

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const fondleBreastsActions = result.actions.filter(
        (action) => action.id === 'sex-breastplay:fondle_breasts'
      );
      expect(fondleBreastsActions).toHaveLength(1);
      expect(fondleBreastsActions[0].params.targetId).toBe('target1');
    });

    it('should discover action when no clothing equipment component exists', async () => {
      // Arrange - no clothing equipment component
      setupEntities({});

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const fondleBreastsActions = result.actions.filter(
        (action) => action.id === 'sex-breastplay:fondle_breasts'
      );
      expect(fondleBreastsActions).toHaveLength(1);
    });

    it('should discover action when no slot metadata component exists', async () => {
      // Arrange - equipment but no metadata
      setupEntities({
        'clothing:equipment': {
          torso_upper: {
            items: ['shirt1'],
            layers: { base: 'shirt1' },
          },
        },
        // No clothing:slot_metadata component
      });

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const fondleBreastsActions = result.actions.filter(
        (action) => action.id === 'sex-breastplay:fondle_breasts'
      );
      expect(fondleBreastsActions).toHaveLength(1);
    });
  });
});
