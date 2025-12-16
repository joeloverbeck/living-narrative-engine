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
import {
  createMockActionErrorContextBuilder,
  createMockTargetRequiredComponentsValidator,
} from '../../common/mockFactories/actions.js';
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
    '../../../data/mods/sex-penile-manual/scopes/actors_with_penis_facing_each_other_covered.scope'
  ),
  'utf8'
);

// Import actual action file
import rubPenisOverClothesAction from '../../../data/mods/sex-penile-manual/actions/rub_penis_over_clothes.action.json';

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
        // Extract scope from modern format (targets.primary.scope) or legacy format (scope)
        const scopeName = actionDef.targets?.primary?.scope || actionDef.scope;
        // Skip actions without scopes
        if (!scopeName) {
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
          scopeName,
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
                scope: scopeName,
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
    dataRegistry.store('conditions', 'positioning:entity-not-in-facing-away', {
      id: 'positioning:entity-not-in-facing-away',
      logic: {
        '!': {
          in: [
            { var: 'actor.id' },
            {
              var: 'entity.components.positioning:facing_away.facing_away_from',
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
      penisCoveredScopeContent,
      'actors_with_penis_facing_each_other_covered.scope'
    );

    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();

    scopeRegistry.initialize({
      'sex-penile-manual:actors_with_penis_facing_each_other_covered':
        scopeDefinitions.get(
          'sex-penile-manual:actors_with_penis_facing_each_other_covered'
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
      multiTargetResolutionStage: createScopeEvaluatingMock({
        scopeRegistry,
        scopeEngine,
        entityManager,
        logger,
        jsonLogicEval,
      }),
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

    // Clear operator caches to prevent state contamination between tests
    if (jsonLogicCustomOperators) {
      jsonLogicCustomOperators.clearCaches();
    }
  });

  describe('socket coverage tests', () => {
    /**
     * Generates unique entity IDs for each test to prevent cache contamination
     *
     * @returns {object} Object containing unique entity IDs
     */
    function generateUniqueEntityIds() {
      const testName = expect.getState().currentTestName;
      const uniqueId = testName
        ? testName.replace(/\s+/g, '_').toLowerCase()
        : Date.now();

      return {
        actor: `actor_${uniqueId}`,
        target: `target_${uniqueId}`,
        groin: `groin_${uniqueId}`,
        penis: `penis_${uniqueId}`,
      };
    }

    /**
     * Sets up test entities with optional clothing configuration
     *
     * @param {object} targetClothingConfig - Clothing configuration for target
     */
    function setupEntities(targetClothingConfig = {}) {
      const entityIds = generateUniqueEntityIds();
      const entities = [
        {
          id: entityIds.actor,
          components: {
            'positioning:closeness': {
              partners: [entityIds.target],
            },
            'positioning:facing_away': {
              facing_away_from: [],
            },
          },
        },
        {
          id: entityIds.target,
          components: {
            'positioning:closeness': {
              partners: [entityIds.actor],
            },
            'positioning:facing_away': {
              facing_away_from: [],
            },
            'anatomy:body': {
              body: {
                root: entityIds.groin,
              },
            },
            ...targetClothingConfig,
          },
        },
        {
          id: entityIds.groin,
          components: {
            'anatomy:part': {
              parent: null,
              children: [entityIds.penis],
              subType: 'groin',
            },
          },
        },
        {
          id: entityIds.penis,
          components: {
            'anatomy:part': {
              parent: entityIds.groin,
              children: [],
              subType: 'penis',
            },
          },
        },
      ];

      entityManager.setEntities(entities);

      // Mock findPartsByType with correct signature (rootEntityId, partType)
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootEntityId, partType) => {
          if (rootEntityId === entityIds.groin && partType === 'penis') {
            return [entityIds.penis];
          }
          return [];
        }
      );

      // Mock buildAdjacencyCache
      mockBodyGraphService.buildAdjacencyCache.mockImplementation(() => {
        // No-op for tests - cache is handled by the mock above
      });

      return entityIds;
    }

    it('should discover action when penis is covered', async () => {
      // Arrange - penis covered by clothing
      const entityIds = setupEntities({
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
      const actorEntity = entityManager.getEntityInstance(entityIds.actor);
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex-penile-manual:rub_penis_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(1);
      expect(rubOverClothesActions[0].params.targetId).toBe(entityIds.target);
    });

    it('should not discover action when penis is uncovered', async () => {
      // Arrange - no clothing equipment, penis uncovered
      const entityIds = setupEntities({});

      // Act
      const actorEntity = entityManager.getEntityInstance(entityIds.actor);
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex-penile-manual:rub_penis_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(0);
    });

    it('should not discover action when clothing equipment exists but no slot metadata', async () => {
      // Arrange - equipment but no metadata (edge case where isSocketCovered returns false)
      const entityIds = setupEntities({
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
      const actorEntity = entityManager.getEntityInstance(entityIds.actor);
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex-penile-manual:rub_penis_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(0);
    });

    it('should discover action when penis is covered by multiple clothing layers', async () => {
      // Arrange - multiple layers covering penis
      const entityIds = setupEntities({
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
      const actorEntity = entityManager.getEntityInstance(entityIds.actor);
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex-penile-manual:rub_penis_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(1);
      expect(rubOverClothesActions[0].params.targetId).toBe(entityIds.target);
    });

    it('should not discover action when target is facing away', async () => {
      // Arrange - target facing away from actor, but penis covered
      const entityIds = generateUniqueEntityIds();
      const entities = [
        {
          id: entityIds.actor,
          components: {
            'positioning:closeness': {
              partners: [entityIds.target],
            },
            'positioning:facing_away': {
              facing_away_from: [],
            },
          },
        },
        {
          id: entityIds.target,
          components: {
            'positioning:closeness': {
              partners: [entityIds.actor],
            },
            'positioning:facing_away': {
              facing_away_from: [entityIds.actor], // Target is facing away from actor
            },
            'anatomy:body': {
              body: {
                root: entityIds.groin,
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
          id: entityIds.groin,
          components: {
            'anatomy:part': {
              parent: null,
              children: [entityIds.penis],
              subType: 'groin',
            },
          },
        },
        {
          id: entityIds.penis,
          components: {
            'anatomy:part': {
              parent: entityIds.groin,
              children: [],
              subType: 'penis',
            },
          },
        },
      ];

      entityManager.setEntities(entities);

      // Mock findPartsByType with correct signature (rootEntityId, partType)
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootEntityId, partType) => {
          if (rootEntityId === entityIds.groin && partType === 'penis') {
            return [entityIds.penis];
          }
          return [];
        }
      );

      // Act
      const actorEntity = entityManager.getEntityInstance(entityIds.actor);
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex-penile-manual:rub_penis_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(0);
    });

    it('should not discover action when target has no penis', async () => {
      // Arrange - target without penis but with clothing
      const entityIds = generateUniqueEntityIds();
      const entities = [
        {
          id: entityIds.actor,
          components: {
            'positioning:closeness': {
              partners: [entityIds.target],
            },
            'positioning:facing_away': {
              facing_away_from: [],
            },
          },
        },
        {
          id: entityIds.target,
          components: {
            'positioning:closeness': {
              partners: [entityIds.actor],
            },
            'positioning:facing_away': {
              facing_away_from: [],
            },
            'anatomy:body': {
              body: {
                root: entityIds.groin,
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
          id: entityIds.groin,
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

      // Mock findPartsByType to find no penis (correct signature)
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootEntityId, partType) => {
          return [];
        }
      );

      // Act
      const actorEntity = entityManager.getEntityInstance(entityIds.actor);
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex-penile-manual:rub_penis_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(0);
    });

    it('should not discover action when no closeness relationship exists', async () => {
      // Arrange - no closeness component relationship
      const entityIds = generateUniqueEntityIds();
      const entities = [
        {
          id: entityIds.actor,
          components: {
            'positioning:facing_away': {
              facing_away_from: [],
            },
            // No closeness component
          },
        },
        {
          id: entityIds.target,
          components: {
            'anatomy:body': {
              body: {
                root: entityIds.groin,
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
          id: entityIds.groin,
          components: {
            'anatomy:part': {
              parent: null,
              children: [entityIds.penis],
              subType: 'groin',
            },
          },
        },
        {
          id: entityIds.penis,
          components: {
            'anatomy:part': {
              parent: entityIds.groin,
              children: [],
              subType: 'penis',
            },
          },
        },
      ];

      entityManager.setEntities(entities);

      // Mock findPartsByType with correct signature (rootEntityId, partType)
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootEntityId, partType) => {
          if (rootEntityId === entityIds.groin && partType === 'penis') {
            return [entityIds.penis];
          }
          return [];
        }
      );

      // Act
      const actorEntity = entityManager.getEntityInstance(entityIds.actor);
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex-penile-manual:rub_penis_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(0);
    });
  });
});
