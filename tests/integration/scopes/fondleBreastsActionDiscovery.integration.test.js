/**
 * @file Integration tests for fondle_breasts action discovery with socket coverage
 * @description Tests that the actors_with_breasts_facing_each_other scope properly filters
 * actors based on breast socket coverage, facing direction, and closeness
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
import { createTargetResolutionServiceWithMocks } from '../../common/mocks/mockUnifiedScopeResolver.js';
import DefaultDslParser from '../../../src/scopeDsl/parser/defaultDslParser.js';
import { createMockActionErrorContextBuilder } from '../../common/mockFactories/actions.js';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import fs from 'fs';
import path from 'path';

// Import actual scope file content
const breastsScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/sex/scopes/actors_with_breasts_facing_each_other.scope'
  ),
  'utf8'
);

// Import actual action files
import fondleBreastsAction from '../../../data/mods/sex/actions/fondle_breasts.action.json';

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
      buildAdjacencyCache: jest.fn(),
    };

    const dataRegistry = new InMemoryDataRegistry({ logger });

    // Store the action
    dataRegistry.store('actions', fondleBreastsAction.id, fondleBreastsAction);

    // Store the condition
    dataRegistry.store('conditions', 'intimacy:entity-not-in-facing-away', {
      id: 'intimacy:entity-not-in-facing-away',
      logic: {
        not: {
          in: [
            { var: 'actor.id' },
            { var: 'entity.components.intimacy:closeness.facing_away_from' },
          ],
        },
      },
    });

    // Initialize JSON Logic with custom operators
    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: {
        getConditionDefinition: (id) => dataRegistry.get('conditions', id),
      },
    });
    jsonLogicCustomOperators = new JsonLogicCustomOperators({
      logger,
      bodyGraphService: mockBodyGraphService,
      entityManager,
    });
    jsonLogicCustomOperators.registerOperators(jsonLogicEval);

    // Parse and register the scope
    const parser = new DefaultDslParser({ logger });
    const scopeDefinitions = parseScopeDefinitions(
      breastsScopeContent,
      'actors_with_breasts_facing_each_other.scope'
    );

    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();

    scopeRegistry.initialize({
      'sex:actors_with_breasts_facing_each_other': scopeDefinitions.get(
        'sex:actors_with_breasts_facing_each_other'
      ),
    });

    scopeEngine = new ScopeEngine();
    const prerequisiteEvaluationService = {
      evaluateActionConditions: jest.fn().mockResolvedValue({
        success: true,
        errors: [],
      }),
    };

    const targetResolutionService = createTargetResolutionServiceWithMocks({
      scopeRegistry,
      scopeEngine,
      jsonLogicEvaluationService: jsonLogicEval,
      entityManager,
      logger,
    });

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
     */
    function setupEntities(targetClothingConfig = {}) {
      const entities = [
        {
          id: 'actor1',
          components: {
            'intimacy:closeness': {
              partners: ['target1'],
              facing_away_from: [],
            },
          },
        },
        {
          id: 'target1',
          components: {
            'intimacy:closeness': {
              partners: ['actor1'],
              facing_away_from: [],
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
        (bodyComponent, partType) => {
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
        (action) => action.id === 'sex:fondle_breasts'
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
        (action) => action.id === 'sex:fondle_breasts'
      );
      expect(fondleBreastsActions).toHaveLength(1);
      expect(fondleBreastsActions[0].params.targetId).toBe('target1');
    });

    it('should not discover action when both breasts are covered', async () => {
      // Arrange - full coverage
      setupEntities({
        'clothing:equipment': {
          equipped: {
            torso_upper: {
              base: ['shirt1'],
            },
          },
        },
        'clothing:slot_metadata': {
          slotMappings: {
            torso_upper: {
              coveredSockets: ['left_chest', 'right_chest'],
              allowedLayers: ['base', 'outer'],
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
        (action) => action.id === 'sex:fondle_breasts'
      );
      expect(fondleBreastsActions).toHaveLength(0);
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
        (action) => action.id === 'sex:fondle_breasts'
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
        (action) => action.id === 'sex:fondle_breasts'
      );
      expect(fondleBreastsActions).toHaveLength(1);
    });

    it('should not discover action when target is facing away', async () => {
      // Arrange - target facing away
      const entities = [
        {
          id: 'actor1',
          components: {
            'intimacy:closeness': {
              partners: ['target1'],
              facing_away_from: [],
            },
          },
        },
        {
          id: 'target1',
          components: {
            'intimacy:closeness': {
              partners: ['actor1'],
              facing_away_from: ['actor1'], // Facing away from actor
            },
            'anatomy:body': {
              body: {
                root: 'torso1',
              },
            },
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
        (bodyComponent, partType) => {
          if (partType === 'breast') {
            return ['breast1', 'breast2'];
          }
          return [];
        }
      );

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const fondleBreastsActions = result.actions.filter(
        (action) => action.id === 'sex:fondle_breasts'
      );
      expect(fondleBreastsActions).toHaveLength(0);
    });
  });
});
