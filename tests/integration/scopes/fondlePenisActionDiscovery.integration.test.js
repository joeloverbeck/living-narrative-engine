/**
 * @file Integration tests for fondle_penis action discovery with socket coverage
 * @description Tests that the actors_with_penis_facing_each_other scope properly filters
 * actors based on penis socket coverage, facing direction, and closeness
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
import { TargetComponentValidator } from '../../../src/actions/validation/TargetComponentValidator.js';
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
import {
  createMockMultiTargetResolutionStage,
  createEmptyMockMultiTargetResolutionStage,
} from '../../common/mocks/mockMultiTargetResolutionStage.js';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import fs from 'fs';
import path from 'path';

// Import actual scope file content
const penisScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/sex-core/scopes/actors_with_penis_facing_each_other.scope'
  ),
  'utf8'
);

// Import actual action files
import fondlePenisAction from '../../../data/mods/sex-penile-manual/actions/fondle_penis.action.json';

jest.unmock('../../../src/scopeDsl/scopeRegistry.js');

describe('Fondle Penis Action Discovery Integration Tests', () => {
  let entityManager;
  let logger;
  let scopeRegistry;
  let scopeEngine;
  let jsonLogicEval;
  let actionDiscoveryService;
  let jsonLogicCustomOperators;
  let mockBodyGraphService;
  let safeEventDispatcher;
  let multiTargetResolutionStage;
  let prerequisiteEvaluationService;
  let targetResolutionService;
  let gameDataRepository;

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
    dataRegistry.store('actions', fondlePenisAction.id, fondlePenisAction);

    // Store the condition
    dataRegistry.store('conditions', 'positioning:entity-not-in-facing-away', {
      id: 'positioning:entity-not-in-facing-away',
      logic: {
        not: {
          in: [
            { var: 'actor.id' },
            { var: 'entity.components.positioning:closeness.facing_away_from' },
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
    const parser = new DefaultDslParser({ logger });
    const scopeDefinitions = parseScopeDefinitions(
      penisScopeContent,
      'actors_with_penis_facing_each_other.scope'
    );

    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();

    scopeRegistry.initialize({
      'sex-core:actors_with_penis_facing_each_other': scopeDefinitions.get(
        'sex-core:actors_with_penis_facing_each_other'
      ),
    });

    scopeEngine = new ScopeEngine();
    prerequisiteEvaluationService = {
      evaluateActionConditions: jest.fn().mockResolvedValue({
        success: true,
        errors: [],
      }),
    };

    targetResolutionService = createTargetResolutionServiceWithMocks({
      scopeRegistry,
      scopeEngine,
      jsonLogicEvaluationService: jsonLogicEval,
      entityManager,
      logger,
    });

    gameDataRepository = {
      getAllActionDefinitions: jest.fn().mockReturnValue([fondlePenisAction]),
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

    // Default to normal mock - individual tests can override
    multiTargetResolutionStage = createMockMultiTargetResolutionStage();
  });

  // Helper to create action discovery service with custom mock
  /**
   *
   * @param shouldFindActions
   */
  function createActionDiscoveryService(shouldFindActions = true) {
    const stage = shouldFindActions
      ? createMockMultiTargetResolutionStage()
      : createEmptyMockMultiTargetResolutionStage();

    // Create mock TargetComponentValidator
    const targetComponentValidator = new TargetComponentValidator({
      logger,
      entityManager,
    });

    // Create mock TargetRequiredComponentsValidator
    const mockTargetRequiredComponentsValidator =
      createMockTargetRequiredComponentsValidator();
    const actionPipelineOrchestrator = new ActionPipelineOrchestrator({
      actionIndex: {
        getCandidateActions: jest.fn().mockImplementation((actor) => {
          const actions = gameDataRepository.getAllActionDefinitions();
          const actorComponentIds =
            entityManager.getAllComponentTypesForEntity(actor.id) || [];

          return actions.filter((actionDef) => {
            const forbiddenActorComponents =
              actionDef.forbidden_components?.actor || [];
            return !forbiddenActorComponents.some((componentId) =>
              actorComponentIds.includes(componentId)
            );
          });
        }),
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
      multiTargetResolutionStage: stage,
      targetComponentValidator,
      targetRequiredComponentsValidator: mockTargetRequiredComponentsValidator,
    });

    return new ActionDiscoveryService({
      entityManager,
      logger,
      actionPipelineOrchestrator,
      traceContextFactory: jest.fn(() => ({ addLog: jest.fn(), logs: [] })),
    });
  }

  beforeEach(() => {
    // Create default action discovery service
    actionDiscoveryService = createActionDiscoveryService(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('socket coverage tests', () => {
    /**
     *
     * @param targetClothingConfig
     * @param actorAdditionalComponents
     */
    function setupEntities(
      targetClothingConfig = {},
      actorAdditionalComponents = {}
    ) {
      const actorComponents = {
        'positioning:closeness': {
          partners: ['target1'],
          facing_away_from: [],
        },
        ...actorAdditionalComponents,
      };

      const entities = [
        {
          id: 'actor1',
          components: actorComponents,
        },
        {
          id: 'target1',
          components: {
            'positioning:closeness': {
              partners: ['actor1'],
              facing_away_from: [],
            },
            'anatomy:body': {
              body: {
                root: 'groin1',
              },
            },
            ...targetClothingConfig,
          },
        },
        {
          id: 'groin1',
          components: {
            'anatomy:part': {
              parent: null,
              children: ['penis1'],
              subType: 'groin',
            },
          },
        },
        {
          id: 'penis1',
          components: {
            'anatomy:part': {
              parent: 'groin1',
              children: [],
              subType: 'penis',
            },
          },
        },
      ];

      entityManager.setEntities(entities);

      // Mock hasPartOfType to find penis - FIXED: correct parameters (rootId, partType)
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootId, partType) => {
          if (rootId === 'groin1' && partType === 'penis') {
            return ['penis1'];
          }
          return [];
        }
      );
    }

    it('should discover action when penis is uncovered', async () => {
      // Arrange - no clothing equipment
      setupEntities({});

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const fondlePenisActions = result.actions.filter(
        (action) => action.id === 'sex-penile-manual:fondle_penis'
      );
      expect(fondlePenisActions).toHaveLength(1);
      expect(fondlePenisActions[0].params.targetId).toBe('target1');
    });

    it('should not discover action when penis is covered', async () => {
      // Arrange - penis covered
      setupEntities({
        'clothing:equipment': {
          equipped: {
            torso_lower: {
              base: ['pants1'],
            },
          },
        },
        'clothing:slot_metadata': {
          slotMappings: {
            torso_lower: {
              coveredSockets: ['penis', 'vagina', 'left_hip', 'right_hip'],
              allowedLayers: ['underwear', 'base', 'outer'],
            },
          },
        },
      });

      // Use empty mock since this should return no actions
      const customActionDiscoveryService = createActionDiscoveryService(false);

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await customActionDiscoveryService.getValidActions(
        actorEntity,
        {
          jsonLogicEval,
        }
      );

      // Assert
      const fondlePenisActions = result.actions.filter(
        (action) => action.id === 'sex-penile-manual:fondle_penis'
      );
      expect(fondlePenisActions).toHaveLength(0);
    });

    it('should not discover action when actor is being vaginally penetrated', async () => {
      setupEntities(
        {},
        {
          'positioning:being_fucked_vaginally': { actorId: 'charlie' },
        }
      );

      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      const fondlePenisActions = result.actions.filter(
        (action) => action.id === 'sex-penile-manual:fondle_penis'
      );
      expect(fondlePenisActions).toHaveLength(0);
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
      const fondlePenisActions = result.actions.filter(
        (action) => action.id === 'sex-penile-manual:fondle_penis'
      );
      expect(fondlePenisActions).toHaveLength(1);
    });

    it('should discover action when no slot metadata component exists', async () => {
      // Arrange - equipment but no metadata
      setupEntities({
        'clothing:equipment': {
          torso_lower: {
            items: ['pants1'],
            layers: { base: 'pants1' },
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
      const fondlePenisActions = result.actions.filter(
        (action) => action.id === 'sex-penile-manual:fondle_penis'
      );
      expect(fondlePenisActions).toHaveLength(1);
    });

    it('should not discover action when target is facing away', async () => {
      // Arrange - target facing away
      const entities = [
        {
          id: 'actor1',
          components: {
            'positioning:closeness': {
              partners: ['target1'],
              facing_away_from: [],
            },
          },
        },
        {
          id: 'target1',
          components: {
            'positioning:closeness': {
              partners: ['actor1'],
              facing_away_from: ['actor1'], // Facing away from actor
            },
            'anatomy:body': {
              body: {
                root: 'groin1',
              },
            },
          },
        },
        {
          id: 'groin1',
          components: {
            'anatomy:part': {
              parent: null,
              children: ['penis1'],
              subType: 'groin',
            },
          },
        },
        {
          id: 'penis1',
          components: {
            'anatomy:part': {
              parent: 'groin1',
              children: [],
              subType: 'penis',
            },
          },
        },
      ];

      entityManager.setEntities(entities);

      // Mock hasPartOfType to find penis - FIXED: correct parameters (rootId, partType)
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootId, partType) => {
          if (rootId === 'groin1' && partType === 'penis') {
            return ['penis1'];
          }
          return [];
        }
      );

      // Use empty mock since this should return no actions
      const customActionDiscoveryService = createActionDiscoveryService(false);

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await customActionDiscoveryService.getValidActions(
        actorEntity,
        {
          jsonLogicEval,
        }
      );

      // Assert
      const fondlePenisActions = result.actions.filter(
        (action) => action.id === 'sex-penile-manual:fondle_penis'
      );
      expect(fondlePenisActions).toHaveLength(0);
    });

    it('should not discover action when target has no penis', async () => {
      // Arrange - target without penis
      const entities = [
        {
          id: 'actor1',
          components: {
            'positioning:closeness': {
              partners: ['target1'],
              facing_away_from: [],
            },
          },
        },
        {
          id: 'target1',
          components: {
            'positioning:closeness': {
              partners: ['actor1'],
              facing_away_from: [],
            },
            'anatomy:body': {
              body: {
                root: 'groin1',
              },
            },
          },
        },
        {
          id: 'groin1',
          components: {
            'anatomy:part': {
              parent: null,
              children: [], // No penis
              subType: 'groin',
            },
          },
        },
      ];

      entityManager.setEntities(entities);

      // Mock hasPartOfType to find no penis - FIXED: correct parameters (rootId, partType)
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootId, partType) => {
          return []; // Always return empty for this test case
        }
      );

      // Use empty mock since this should return no actions
      const customActionDiscoveryService = createActionDiscoveryService(false);

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await customActionDiscoveryService.getValidActions(
        actorEntity,
        {
          jsonLogicEval,
        }
      );

      // Assert
      const fondlePenisActions = result.actions.filter(
        (action) => action.id === 'sex-penile-manual:fondle_penis'
      );
      expect(fondlePenisActions).toHaveLength(0);
    });
  });
});
