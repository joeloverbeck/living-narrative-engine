/**
 * @file Integration tests for rub_vagina_over_clothes action discovery with socket coverage
 * @description Tests that the actors_with_vagina_facing_each_other_covered scope properly filters
 * actors based on vagina socket coverage (covered vs uncovered), facing direction, and closeness
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
import { PipelineStage } from '../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../src/actions/pipeline/PipelineResult.js';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import fs from 'fs';
import path from 'path';

// Import actual scope file content
const vaginaCoveredScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/sex/scopes/actors_with_vagina_facing_each_other_covered.scope'
  ),
  'utf8'
);

// Import actual action file
import rubVaginaOverClothesAction from '../../../data/mods/sex/actions/rub_vagina_over_clothes.action.json';

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
        // Ensure actor has an id property
        const actorForScope = typeof actor === 'string' ? { id: actor } : actor;

        const scopeContext = {
          actor: actorForScope,
          actionId: actionDef.id,
          actionContext: actionContext,
          trace: context.trace,
        };

        // Resolve the scope
        const scopeResult = await unifiedScopeResolver.resolve(
          scopeName,
          scopeContext
        );

        // Check if resolve returned an ActionResult
        let resolvedTargets;
        if (scopeResult && scopeResult.success !== undefined) {
          // It's an ActionResult
          if (scopeResult.success) {
            resolvedTargets = Array.from(scopeResult.value || []);
          } else {
            console.log(
              `Scope resolution failed for ${scopeName}:`,
              scopeResult.errors
            );
            resolvedTargets = [];
          }
        } else {
          // Direct result (backward compatibility)
          resolvedTargets = scopeResult;
        }

        // Add actions with valid targets
        if (resolvedTargets && resolvedTargets.length > 0) {
          actionsWithTargets.push({
            actionDef,
            targetContexts: resolvedTargets.map((target) => ({
              type: 'entity',
              entityId: target.id || target,
              displayName: target.displayName || target,
              placeholder: 'target',
            })),
            resolvedTargets: {
              primary: resolvedTargets,
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

describe('Rub Vagina Over Clothes Action Discovery Integration Tests', () => {
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
      rubVaginaOverClothesAction.id,
      rubVaginaOverClothesAction
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
    jsonLogicCustomOperators = new JsonLogicCustomOperators({
      logger,
      bodyGraphService: mockBodyGraphService,
      entityManager,
    });
    jsonLogicCustomOperators.registerOperators(jsonLogicEval);

    // Parse and register the scope
    const parser = new DefaultDslParser({ logger });
    const scopeDefinitions = parseScopeDefinitions(
      vaginaCoveredScopeContent,
      'actors_with_vagina_facing_each_other_covered.scope'
    );

    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();

    const scopeDef = scopeDefinitions.get(
      'sex:actors_with_vagina_facing_each_other_covered'
    );

    scopeRegistry.initialize({
      'sex:actors_with_vagina_facing_each_other_covered': scopeDef,
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
        .mockReturnValue([rubVaginaOverClothesAction]),
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
              children: ['vagina1'],
              subType: 'groin',
            },
          },
        },
        {
          id: 'vagina1',
          components: {
            'anatomy:part': {
              parent: 'groin1',
              children: [],
              subType: 'vagina',
            },
          },
        },
      ];

      entityManager.setEntities(entities);

      // Mock buildAdjacencyCache - called before findPartsByType
      mockBodyGraphService.buildAdjacencyCache.mockImplementation((rootId) => {
        console.log('buildAdjacencyCache called with:', rootId);
        // No-op, just needs to be callable
      });

      // Mock hasPartOfType to find vagina
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootEntityId, partType) => {
          console.log('findPartsByType called with:', {
            rootEntityId,
            partType,
          });
          if (rootEntityId === 'groin1' && partType === 'vagina') {
            console.log('Returning vagina1');
            return ['vagina1'];
          }
          console.log('Returning empty array');
          return [];
        }
      );
    }

    it('should discover action when vagina is covered', async () => {
      // Arrange - vagina covered by clothing
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
        currentLocation: { id: 'test-location' },
      });

      // Debug: Log the result
      if (result.actions.length === 0) {
        console.log('No actions found! Debugging info:');
        const target1 = entityManager.getEntityInstance('target1');
        console.log('Entity target1:', target1);
        if (target1) {
          console.log('Target1 components:', target1.getAllComponents());
        }
      }
      console.log('Discovery result:', JSON.stringify(result, null, 2));
      console.log(
        'All actions found:',
        result.actions.map((a) => a.id)
      );
      console.log(
        'Mock calls - buildAdjacencyCache:',
        mockBodyGraphService.buildAdjacencyCache.mock.calls
      );
      console.log(
        'Mock calls - findPartsByType:',
        mockBodyGraphService.findPartsByType.mock.calls
      );

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex:rub_vagina_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(1);
      expect(rubOverClothesActions[0].params.targetId).toBe('target1');
    });

    it('should not discover action when vagina is uncovered', async () => {
      // Arrange - no clothing equipment, vagina uncovered
      setupEntities({});

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
        currentLocation: { id: 'test-location' },
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex:rub_vagina_over_clothes'
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
        currentLocation: { id: 'test-location' },
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex:rub_vagina_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(0);
    });

    it('should discover action when vagina is covered by multiple clothing layers', async () => {
      // Arrange - multiple layers covering vagina
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
        currentLocation: { id: 'test-location' },
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex:rub_vagina_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(1);
      expect(rubOverClothesActions[0].params.targetId).toBe('target1');
    });

    it('should not discover action when target is facing away', async () => {
      // Arrange - target facing away from actor, but vagina covered
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
              facing_away_from: ['actor1'], // Facing away from actor
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
              children: ['vagina1'],
              subType: 'groin',
            },
          },
        },
        {
          id: 'vagina1',
          components: {
            'anatomy:part': {
              parent: 'groin1',
              children: [],
              subType: 'vagina',
            },
          },
        },
      ];

      entityManager.setEntities(entities);

      // Mock hasPartOfType to find vagina
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootEntityId, partType) => {
          if (rootEntityId === 'groin1' && partType === 'vagina') {
            return ['vagina1'];
          }
          return [];
        }
      );

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
        currentLocation: { id: 'test-location' },
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex:rub_vagina_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(0);
    });

    it('should not discover action when target has no vagina', async () => {
      // Arrange - target without vagina but with clothing
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
                  coveredSockets: ['penis', 'left_hip', 'right_hip'],
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
              children: [], // No vagina
              subType: 'groin',
            },
          },
        },
      ];

      entityManager.setEntities(entities);

      // Mock hasPartOfType to find no vagina
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootEntityId, partType) => {
          return [];
        }
      );

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
        currentLocation: { id: 'test-location' },
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex:rub_vagina_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(0);
    });

    it('should not discover action when no closeness relationship exists', async () => {
      // Arrange - no closeness component relationship
      const entities = [
        {
          id: 'actor1',
          components: {
            // No closeness component
          },
        },
        {
          id: 'target1',
          components: {
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
                  coveredSockets: ['vagina'],
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
              children: ['vagina1'],
              subType: 'groin',
            },
          },
        },
        {
          id: 'vagina1',
          components: {
            'anatomy:part': {
              parent: 'groin1',
              children: [],
              subType: 'vagina',
            },
          },
        },
      ];

      entityManager.setEntities(entities);

      // Mock hasPartOfType to find vagina
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootEntityId, partType) => {
          if (rootEntityId === 'groin1' && partType === 'vagina') {
            return ['vagina1'];
          }
          return [];
        }
      );

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
        currentLocation: { id: 'test-location' },
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex:rub_vagina_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(0);
    });
  });
});
