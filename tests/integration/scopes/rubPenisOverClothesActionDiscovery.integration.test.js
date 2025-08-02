/**
 * @file Integration tests for rub_penis_over_clothes action discovery with socket coverage
 * @description Tests that the actors_with_penis_facing_each_other_covered scope properly filters
 * actors based on penis socket coverage (covered vs uncovered), facing direction, and closeness
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
import { createMockActionErrorContextBuilder } from '../../common/mockFactories/actions.js';
import { createMockTargetContextBuilder } from '../../common/mocks/mockTargetContextBuilder.js';
import { createMockMultiTargetResolutionStage } from '../../common/mocks/mockMultiTargetResolutionStage.js';
import { PipelineStage } from '../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../src/actions/pipeline/PipelineResult.js';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import fs from 'fs';
import path from 'path';

// Import actual scope file content
const penisCoveredScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/sex/scopes/actors_with_penis_facing_each_other_covered.scope'
  ),
  'utf8'
);

// Import actual action file
import rubPenisOverClothesAction from '../../../data/mods/sex/actions/rub_penis_over_clothes.action.json';

jest.unmock('../../../src/scopeDsl/scopeRegistry.js');

/**
 * Creates a MultiTargetResolutionStage mock that actually evaluates scopes
 * instead of bypassing them like the standard mock
 *
 * @param dependencies
 */
function createScopeEvaluatingMock(dependencies) {
  const { scopeRegistry, scopeEngine, entityManager, logger, jsonLogicEval } =
    dependencies;

  return new (class extends PipelineStage {
    constructor() {
      super('ScopeEvaluatingMock');
    }

    async executeInternal(context) {
      const { candidateActions, actor, actionContext } = context;
      const actionsWithTargets = [];

      for (const actionDef of candidateActions) {
        // Skip actions without scopes
        if (!actionDef.scope) {
          continue;
        }

        // Get the unified scope resolver
        const unifiedScopeResolver = createMockUnifiedScopeResolver({
          scopeRegistry,
          scopeEngine,
          entityManager,
          logger,
          jsonLogicEvaluationService: jsonLogicEval,
          dslParser: new DefaultDslParser({ logger }),
          actionErrorContextBuilder: createMockActionErrorContextBuilder(),
        });

        // Create scope resolution context
        const scopeContext = {
          actor: actor,
          actionId: actionDef.id,
          actionContext: actionContext,
          trace: context.trace,
        };

        // Resolve the scope
        const scopeResult = unifiedScopeResolver.resolve(
          actionDef.scope,
          scopeContext
        );

        if (scopeResult.success && scopeResult.value.size > 0) {
          // Convert resolved targets to the expected format
          const resolvedTargets = Array.from(scopeResult.value);

          actionsWithTargets.push({
            actionDef,
            targetContexts: resolvedTargets.map((targetId) => ({
              type: 'entity',
              entityId: targetId,
              displayName: `Target ${targetId}`,
              placeholder: 'target',
            })),
            resolvedTargets: {
              primary: resolvedTargets.map((targetId) => ({
                id: targetId,
                displayName: `Target ${targetId}`,
                entity: null,
              })),
            },
            targetDefinitions: {
              primary: {
                scope: actionDef.scope,
                placeholder: 'target',
              },
            },
            isMultiTarget: false,
          });
        }
        // If scope resolution fails or returns no targets, the action is filtered out
      }

      return PipelineResult.success({
        data: {
          ...context.data,
          actionsWithTargets,
        },
      });
    }
  })();
}

describe('Rub Penis Over Clothes Action Discovery Integration Tests', () => {
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
    dataRegistry.store(
      'actions',
      rubPenisOverClothesAction.id,
      rubPenisOverClothesAction
    );

    // Store the condition
    dataRegistry.store('conditions', 'intimacy:entity-not-in-facing-away', {
      id: 'intimacy:entity-not-in-facing-away',
      logic: {
        not: {
          in: [
            { var: 'entity.id' },
            {
              var: 'actor.components.positioning:facing_away.facing_away_from',
            },
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
      penisCoveredScopeContent,
      'actors_with_penis_facing_each_other_covered.scope'
    );

    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();

    scopeRegistry.initialize({
      'sex:actors_with_penis_facing_each_other_covered': scopeDefinitions.get(
        'sex:actors_with_penis_facing_each_other_covered'
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
      getAllActionDefinitions: jest
        .fn()
        .mockReturnValue([rubPenisOverClothesAction]),
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
      unifiedScopeResolver: createMockUnifiedScopeResolver({
        scopeRegistry,
        entityManager,
        logger,
      }),
      targetContextBuilder: createMockTargetContextBuilder(),
      multiTargetResolutionStage: createScopeEvaluatingMock({
        scopeRegistry,
        scopeEngine,
        entityManager,
        logger,
        jsonLogicEval,
      }),
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
     * Sets up test entities with optional clothing configuration
     *
     * @param {object} targetClothingConfig - Clothing configuration for target
     */
    function setupEntities(targetClothingConfig = {}) {
      const entities = [
        {
          id: 'actor1',
          components: {
            'positioning:closeness': {
              partners: ['target1'],
            },
            'positioning:facing_away': {
              facing_away_from: [],
            },
          },
        },
        {
          id: 'target1',
          components: {
            'positioning:closeness': {
              partners: ['actor1'],
            },
            'positioning:facing_away': {
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

      // Mock hasPartOfType to find penis
      mockBodyGraphService.findPartsByType.mockImplementation(
        (bodyComponent, partType) => {
          if (partType === 'penis') {
            return ['penis1'];
          }
          return [];
        }
      );

      // Mock buildAdjacencyCache
      mockBodyGraphService.buildAdjacencyCache.mockImplementation(() => {
        // No-op for tests
      });
    }

    it('should discover action when penis is covered', async () => {
      // Arrange - penis covered by clothing
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

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex:rub_penis_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(1);
      expect(rubOverClothesActions[0].params.targetId).toBe('target1');
    });

    it('should not discover action when penis is uncovered', async () => {
      // Arrange - no clothing equipment, penis uncovered
      setupEntities({});

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex:rub_penis_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(0);
    });

    it('should not discover action when clothing equipment exists but no slot metadata', async () => {
      // Arrange - equipment but no metadata (edge case where isSocketCovered returns false)
      setupEntities({
        'clothing:equipment': {
          equipped: {
            torso_lower: {
              base: ['pants1'],
            },
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
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex:rub_penis_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(0);
    });

    it('should discover action when penis is covered by multiple clothing layers', async () => {
      // Arrange - multiple layers covering penis
      setupEntities({
        'clothing:equipment': {
          equipped: {
            torso_lower: {
              underwear: ['underwear1'],
              base: ['pants1'],
              outer: ['jacket1'],
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

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex:rub_penis_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(1);
      expect(rubOverClothesActions[0].params.targetId).toBe('target1');
    });

    it('should not discover action when target is facing away', async () => {
      // Arrange - target facing away from actor, but penis covered
      const entities = [
        {
          id: 'actor1',
          components: {
            'positioning:closeness': {
              partners: ['target1'],
            },
            'positioning:facing_away': {
              facing_away_from: ['target1'], // Actor is facing away from target
            },
          },
        },
        {
          id: 'target1',
          components: {
            'positioning:closeness': {
              partners: ['actor1'],
            },
            'positioning:facing_away': {
              facing_away_from: [],
            },
            'anatomy:body': {
              body: {
                root: 'groin1',
              },
            },
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
                  coveredSockets: ['penis', 'vagina'],
                  allowedLayers: ['base'],
                },
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

      // Mock hasPartOfType to find penis
      mockBodyGraphService.findPartsByType.mockImplementation(
        (bodyComponent, partType) => {
          if (partType === 'penis') {
            return ['penis1'];
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
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex:rub_penis_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(0);
    });

    it('should not discover action when target has no penis', async () => {
      // Arrange - target without penis but with clothing
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
                  coveredSockets: ['vagina', 'left_hip', 'right_hip'],
                  allowedLayers: ['base'],
                },
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

      // Mock hasPartOfType to find no penis
      mockBodyGraphService.findPartsByType.mockImplementation(
        (bodyComponent, partType) => {
          return [];
        }
      );

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex:rub_penis_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(0);
    });

    it('should not discover action when no closeness relationship exists', async () => {
      // Arrange - no closeness component relationship
      const entities = [
        {
          id: 'actor1',
          components: {
            'positioning:facing_away': {
              facing_away_from: [],
            },
            // No closeness component
          },
        },
        {
          id: 'target1',
          components: {
            'anatomy:body': {
              body: {
                root: 'groin1',
              },
            },
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
                  coveredSockets: ['penis'],
                  allowedLayers: ['base'],
                },
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

      // Mock hasPartOfType to find penis
      mockBodyGraphService.findPartsByType.mockImplementation(
        (bodyComponent, partType) => {
          if (partType === 'penis') {
            return ['penis1'];
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
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex:rub_penis_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(0);
    });
  });
});
