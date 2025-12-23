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
import {
  createMockActionErrorContextBuilder,
  createMockTargetRequiredComponentsValidator,
} from '../../common/mockFactories/actions.js';
import { createMockTargetContextBuilder } from '../../common/mocks/mockTargetContextBuilder.js';
import { PipelineStage } from '../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../src/actions/pipeline/PipelineResult.js';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import jsonLogic from 'json-logic-js';
import { createMockBodyGraphService } from '../../common/mockFactories/bodyGraphServiceFactory.js';
import { clearEntityCache } from '../../../src/scopeDsl/core/entityHelpers.js';
import fs from 'fs';
import path from 'path';

// Import actual scope file content
const vaginaCoveredScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/sex-dry-intimacy/scopes/actors_with_vagina_facing_each_other_covered.scope'
  ),
  'utf8'
);
const closeActorsFacingScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/personal-space/scopes/close_actors_facing_each_other.scope'
  ),
  'utf8'
);

// Import actual action and condition files
import rubVaginaOverClothesAction from '../../../data/mods/sex-dry-intimacy/actions/rub_vagina_over_clothes.action.json';
import bothActorsFacingEachOtherCondition from '../../../data/mods/facing-states/conditions/both-actors-facing-each-other.condition.json';

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
          const normalizedTargets = resolvedTargets.map((target) => {
            if (typeof target === 'string') {
              const entity = entityManager.getEntityInstance(target) || null;
              return {
                id: target,
                displayName:
                  entity?.components?.['meta:display_name']?.value ||
                  `Target ${target}`,
                entity,
              };
            }

            if (target && typeof target === 'object') {
              const targetId = target.id || target.entityId || null;
              if (targetId) {
                const entity =
                  target.entity ||
                  entityManager.getEntityInstance(targetId) ||
                  null;
                return {
                  id: targetId,
                  displayName:
                    target.displayName ||
                    entity?.components?.['meta:display_name']?.value ||
                    `Target ${targetId}`,
                  entity,
                };
              }
            }

            return {
              id: String(target),
              displayName: `Target ${String(target)}`,
              entity: null,
            };
          });

          actionsWithTargets.push({
            actionDef,
            targetContexts: normalizedTargets.map((target) => ({
              type: 'entity',
              entityId: target.id,
              displayName: target.displayName,
              placeholder: 'target',
            })),
            resolvedTargets: {
              primary: normalizedTargets,
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

    // Create a fresh mock body graph service using factory
    // This ensures complete isolation between tests
    mockBodyGraphService = createMockBodyGraphService();

    const dataRegistry = new InMemoryDataRegistry({ logger });

    // Store the action
    dataRegistry.store(
      'actions',
      rubVaginaOverClothesAction.id,
      rubVaginaOverClothesAction
    );

    // Store positioning conditions used by referenced scopes
    dataRegistry.store(
      'conditions',
      bothActorsFacingEachOtherCondition.id,
      bothActorsFacingEachOtherCondition
    );
    dataRegistry.store('conditions', 'facing-states:entity-not-in-facing-away', {
      id: 'facing-states:entity-not-in-facing-away',
      logic: {
        '!': {
          in: [
            { var: 'actor.id' },
            {
              var: 'entity.components.facing-states:facing_away.facing_away_from',
            },
          ],
        },
      },
    });

    // Create fresh JSON Logic evaluation service for each test
    // This ensures operators don't persist between tests
    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: {
        getConditionDefinition: (id) => dataRegistry.get('conditions', id),
      },
    });

    // NOTE: Operators are NOT registered here - they will be registered
    // after mock setup in each test or in setupEntities()
    jsonLogicCustomOperators = null;

    // Parse and register the scope
    const parser = new DefaultDslParser({ logger });
    const scopeDefinitions = parseScopeDefinitions(
      vaginaCoveredScopeContent,
      'actors_with_vagina_facing_each_other_covered.scope'
    );
    const positioningScopeDefinitions = parseScopeDefinitions(
      closeActorsFacingScopeContent,
      'close_actors_facing_each_other.scope'
    );

    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();

    const scopeDef = scopeDefinitions.get(
      'sex-dry-intimacy:actors_with_vagina_facing_each_other_covered'
    );
    const positioningScopeDef = positioningScopeDefinitions.get(
      'personal-space:close_actors_facing_each_other'
    );

    if (!scopeDef || !positioningScopeDef) {
      throw new Error('Failed to load required scope definitions for test');
    }

    scopeRegistry.initialize({
      'personal-space:close_actors_facing_each_other': positioningScopeDef,
      'sex-dry-intimacy:actors_with_vagina_facing_each_other_covered': scopeDef,
    });

    scopeEngine = new ScopeEngine({ scopeRegistry });
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
    // CRITICAL: Clear entity cache to prevent test contamination
    // This is essential for test isolation as the cache persists between tests
    clearEntityCache();

    // IMPORTANT: Remove all custom operators to prevent contamination
    // This is critical for test isolation as json-logic-js uses a global instance
    const customOperators = [
      'hasPartWithComponentValue',
      'hasPartOfType',
      'hasPartOfTypeWithComponentValue',
      'hasClothingInSlot',
      'isSlotExposed',
      'isSocketCovered',
      'not', // Also remove the 'not' operator added by JsonLogicEvaluationService
    ];

    // Remove each custom operator directly from json-logic-js
    // This ensures complete cleanup even if jsonLogicEval is null
    customOperators.forEach((op) => {
      try {
        jsonLogic.rm_operation(op);
      } catch (e) {
        // Ignore errors - operator might not exist
      }
    });

    // Clear all mocks and restore original implementations
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Clear references
    jsonLogicEval = null;
    jsonLogicCustomOperators = null;
    mockBodyGraphService = null;
  });

  // Helper function to register operators with current mock state
  /**
   *
   */
  function registerOperatorsWithCurrentMocks() {
    // Remove old operators first if they exist
    const customOperators = [
      'hasPartWithComponentValue',
      'hasPartOfType',
      'hasPartOfTypeWithComponentValue',
      'hasClothingInSlot',
      'isSlotExposed',
      'isSocketCovered',
    ];

    customOperators.forEach((op) => {
      try {
        jsonLogic.rm_operation(op);
      } catch (e) {
        // Ignore - operator might not exist
      }
    });

    // Create mock lighting state service
    const mockLightingStateService = {
      isLocationLit: jest.fn().mockReturnValue(true),
    };

    // Create new operators with current mock state
    jsonLogicCustomOperators = new JsonLogicCustomOperators({
      logger,
      bodyGraphService: mockBodyGraphService,
      entityManager,
      lightingStateService: mockLightingStateService,
    });
    jsonLogicCustomOperators.registerOperators(jsonLogicEval);
  }

  describe('socket coverage tests', () => {
    /**
     * Sets up test entities with optional clothing configuration
     * Note: This function now ensures complete mock isolation per test
     *
     * @param {object} targetClothingConfig - Clothing configuration for target
     */
    function setupEntities(targetClothingConfig = {}) {
      const entities = [
        {
          id: 'actor1',
          components: {
            'personal-space-states:closeness': {
              partners: ['target1'],
            },
            'facing-states:facing_away': {
              facing_away_from: [],
            },
          },
        },
        {
          id: 'target1',
          components: {
            'personal-space-states:closeness': {
              partners: ['actor1'],
            },
            'facing-states:facing_away': {
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

      // Configure mock implementations for this test
      // Using mockImplementation ensures a fresh function for each call
      mockBodyGraphService.buildAdjacencyCache.mockImplementation((rootId) => {
        // No-op, just needs to be callable
      });

      mockBodyGraphService.findPartsByType.mockClear();
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootEntityId, partType) => {
          if (rootEntityId === 'groin1' && partType === 'vagina') {
            return ['vagina1'];
          }
          return [];
        }
      );

      // CRITICAL: Register operators AFTER mock setup
      registerOperatorsWithCurrentMocks();
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

      const scopeDefinition = scopeRegistry.getScope(
        'sex-dry-intimacy:actors_with_vagina_facing_each_other_covered'
      );
      const baseScopeDefinition = scopeRegistry.getScope(
        'personal-space:close_actors_facing_each_other'
      );
      const actorInstance = entityManager.getEntityInstance('actor1');
      const actorWithComponents = {
        id: actorInstance.id,
        components: actorInstance.getAllComponents(),
      };
      expect(
        actorWithComponents.components['personal-space-states:closeness']
      ).toBeDefined();
      expect(
        actorWithComponents.components['personal-space-states:closeness'].partners
      ).toContain('target1');
      expect(
        entityManager.getComponentData('target1', 'clothing:equipment')
      ).toBeDefined();
      expect(
        entityManager.getComponentData('target1', 'clothing:slot_metadata')
      ).toBeDefined();
      const targetInstance = entityManager.getEntityInstance('target1');
      const targetWithComponents = {
        id: targetInstance.id,
        components: targetInstance.getAllComponents(),
      };
      const evaluationContext = {
        entity: targetWithComponents,
        actor: actorWithComponents,
        components: targetWithComponents.components,
        id: targetWithComponents.id,
      };
      expect(
        jsonLogicEval.evaluate(
          { hasPartOfType: ['.', 'vagina'] },
          evaluationContext
        )
      ).toBe(true);
      expect(
        jsonLogicEval.evaluate(
          { isSocketCovered: ['.', 'vagina'] },
          evaluationContext
        )
      ).toBe(true);
      const baseResolved = scopeEngine.resolve(
        baseScopeDefinition.ast,
        actorWithComponents,
        { entityManager, jsonLogicEval, logger }
      );
      expect(Array.from(baseResolved)).toContain('target1');

      const resolvedIds = scopeEngine.resolve(
        scopeDefinition.ast,
        actorWithComponents,
        { entityManager, jsonLogicEval, logger }
      );
      expect(mockBodyGraphService.findPartsByType).toHaveBeenCalled();
      expect(Array.from(resolvedIds)).toContain('target1');

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
        currentLocation: { id: 'test-location' },
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex-dry-intimacy:rub_vagina_over_clothes'
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
        (action) => action.id === 'sex-dry-intimacy:rub_vagina_over_clothes'
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
        (action) => action.id === 'sex-dry-intimacy:rub_vagina_over_clothes'
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
        (action) => action.id === 'sex-dry-intimacy:rub_vagina_over_clothes'
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
            'personal-space-states:closeness': {
              partners: ['target1'],
            },
            'facing-states:facing_away': {
              facing_away_from: [],
            },
          },
        },
        {
          id: 'target1',
          components: {
            'personal-space-states:closeness': {
              partners: ['actor1'],
            },
            'facing-states:facing_away': {
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

      // Configure mock implementations with fresh functions
      // This ensures no contamination from previous tests
      mockBodyGraphService.buildAdjacencyCache.mockClear();
      mockBodyGraphService.buildAdjacencyCache.mockImplementation((rootId) => {
        // No-op, just needs to be callable
      });

      mockBodyGraphService.findPartsByType.mockClear();
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootEntityId, partType) => {
          if (rootEntityId === 'groin1' && partType === 'vagina') {
            return ['vagina1'];
          }
          return [];
        }
      );

      // CRITICAL: Register operators AFTER mock setup
      registerOperatorsWithCurrentMocks();

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
        currentLocation: { id: 'test-location' },
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex-dry-intimacy:rub_vagina_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(0);
    });

    it('should not discover action when target has no vagina', async () => {
      // Arrange - target without vagina but with clothing
      const entities = [
        {
          id: 'actor1',
          components: {
            'personal-space-states:closeness': {
              partners: ['target1'],
            },
            'facing-states:facing_away': {
              facing_away_from: [],
            },
          },
        },
        {
          id: 'target1',
          components: {
            'personal-space-states:closeness': {
              partners: ['actor1'],
            },
            'facing-states:facing_away': {
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

      // Configure mock implementations with fresh functions
      // This ensures no contamination from previous tests
      mockBodyGraphService.buildAdjacencyCache.mockClear();
      mockBodyGraphService.buildAdjacencyCache.mockImplementation((rootId) => {
        // No-op, just needs to be callable
      });

      mockBodyGraphService.findPartsByType.mockClear();
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootEntityId, partType) => {
          return [];
        }
      );

      // CRITICAL: Register operators AFTER mock setup
      registerOperatorsWithCurrentMocks();

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
        currentLocation: { id: 'test-location' },
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex-dry-intimacy:rub_vagina_over_clothes'
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
            'facing-states:facing_away': {
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

      // Configure mock implementations with fresh functions
      // This ensures no contamination from previous tests
      mockBodyGraphService.buildAdjacencyCache.mockClear();
      mockBodyGraphService.buildAdjacencyCache.mockImplementation((rootId) => {
        // No-op, just needs to be callable
      });

      mockBodyGraphService.findPartsByType.mockClear();
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootEntityId, partType) => {
          if (rootEntityId === 'groin1' && partType === 'vagina') {
            return ['vagina1'];
          }
          return [];
        }
      );

      // CRITICAL: Register operators AFTER mock setup
      registerOperatorsWithCurrentMocks();

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
        currentLocation: { id: 'test-location' },
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex-dry-intimacy:rub_vagina_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(0);
    });
  });
});
