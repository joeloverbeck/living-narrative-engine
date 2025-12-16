/**
 * @file Integration tests for clothing-specific scope resolution
 * @description Tests that the close_actors_facing_each_other_with_torso_clothing scope
 * properly filters actors based on closeness, facing direction, and clothing requirements
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
import { MultiTargetActionFormatter } from '../../../src/actions/formatters/MultiTargetActionFormatter.js';
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
// import { createMockMultiTargetResolutionStage } from '../../common/mocks/mockMultiTargetResolutionStage.js';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import fs from 'fs';
import path from 'path';

// Import actual scope file content
const clothingScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/caressing/scopes/close_actors_facing_each_other_with_torso_clothing.scope'
  ),
  'utf8'
);

// Import secondary scope file content
const secondaryScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/clothing/scopes/target_topmost_torso_upper_clothing.scope'
  ),
  'utf8'
);

// Import actual action files
import adjustClothingAction from '../../../data/mods/caressing/actions/adjust_clothing.action.json';

jest.unmock('../../../src/scopeDsl/scopeRegistry.js');

describe('Clothing-Specific Scope Integration Tests', () => {
  let entityManager;
  let logger;
  let scopeRegistry;
  let scopeEngine;
  let jsonLogicEval;
  let actionDiscoveryService;
  let jsonLogicCustomOperators;
  let mockBodyGraphService;

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

    // Register the conditions used by the scope and action
    dataRegistry.store(
      'conditions',
      'positioning:both-actors-facing-each-other',
      {
        id: 'positioning:both-actors-facing-each-other',
        description:
          'Checks if both actors are facing each other (neither is facing away from the other).',
        logic: {
          and: [
            {
              '!': {
                in: [
                  { var: 'entity.id' },
                  {
                    var: 'actor.components.positioning:facing_away.facing_away_from',
                  },
                ],
              },
            },
            {
              '!': {
                in: [
                  { var: 'actor.id' },
                  {
                    var: 'entity.components.positioning:facing_away.facing_away_from',
                  },
                ],
              },
            },
          ],
        },
      }
    );

    // Register the prerequisite condition for the action
    dataRegistry.store('conditions', 'affection:actor-is-in-closeness', {
      id: 'affection:actor-is-in-closeness',
      description:
        'Checks if the actor is currently in closeness with someone.',
      logic: {
        '>': [
          { var: 'actor.components.positioning:closeness.partners.length' },
          0,
        ],
      },
    });

    // Create a proper gameDataRepository that returns conditions from dataRegistry
    const gameDataRepository = {
      getConditionDefinition: (id) => {
        const condition = dataRegistry.get('conditions', id);
        logger.debug(
          `gameDataRepository.getConditionDefinition('${id}') returning:`,
          condition
        );
        return condition;
      },
    };

    // Initialize JSON Logic with custom operators
    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository,
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

    // Parse and register the clothing-specific scopes
    // const parser = new DefaultDslParser({ logger });
    const primaryScopeDefinitions = parseScopeDefinitions(
      clothingScopeContent,
      'close_actors_facing_each_other_with_torso_clothing.scope'
    );

    const secondaryScopeDefinitions = parseScopeDefinitions(
      secondaryScopeContent,
      'target_topmost_torso_upper_clothing.scope'
    );

    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();

    scopeRegistry.initialize({
      'caressing:close_actors_facing_each_other_with_torso_clothing':
        primaryScopeDefinitions.get(
          'caressing:close_actors_facing_each_other_with_torso_clothing'
        ),
      'clothing:target_topmost_torso_upper_clothing':
        secondaryScopeDefinitions.get(
          'clothing:target_topmost_torso_upper_clothing'
        ),
    });

    scopeEngine = new ScopeEngine();

    const validatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    const safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher,
      logger,
    });

    const targetResolutionService = createTargetResolutionServiceWithMocks({
      logger,
      scopeEngine,
      entityManager,
      scopeRegistry,
      safeEventDispatcher,
      jsonLogicEvaluationService: jsonLogicEval,
      dslParser: new DefaultDslParser({ logger }),
      actionErrorContextBuilder: createMockActionErrorContextBuilder(),
    });

    // Mock the target resolution service methods with logging
    const originalResolveTargets = targetResolutionService.resolveTargets;
    targetResolutionService.resolveTargets = jest.fn((...args) => {
      console.log('TargetResolutionService.resolveTargets called with:', args);
      const result = originalResolveTargets.apply(
        targetResolutionService,
        args
      );
      console.log('TargetResolutionService.resolveTargets returning:', result);
      return result;
    });

    // Create prerequisite service mock
    const prerequisiteEvaluationService = {
      evaluate: jest.fn((prerequisites, actionDef, actor) => {
        console.log('Prerequisite evaluation called for:', actionDef?.id);
        console.log('  Actor:', actor?.id);
        console.log('  Prerequisites:', prerequisites);
        const result = true;
        console.log('  Result:', result);
        return result;
      }),
    };

    // Create multi-target formatter
    const baseFormatter = new ActionCommandFormatter();
    const multiTargetFormatter = new MultiTargetActionFormatter(
      baseFormatter,
      logger
    );

    // Create the ActionPipelineOrchestrator

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
        getCandidateActions: jest.fn().mockImplementation((actor) => {
          console.log('getCandidateActions called with actor:', actor?.id);
          console.log('Actor has components:', !!actor?.components);
          console.log(
            'Actor closeness partners:',
            actor?.components?.['positioning:closeness']?.partners
          );
          console.log('Returning action:', adjustClothingAction.id);
          return [adjustClothingAction];
        }),
      },
      prerequisiteService: prerequisiteEvaluationService,
      targetService: targetResolutionService,
      formatter: multiTargetFormatter,
      entityManager,
      safeEventDispatcher,
      getEntityDisplayNameFn: getEntityDisplayName,
      errorBuilder: createMockActionErrorContextBuilder(),
      logger,
      unifiedScopeResolver: (() => {
        const unifiedScopeResolver = createMockUnifiedScopeResolver({
          scopeRegistry,
          scopeEngine,
          entityManager,
          logger,
          safeEventDispatcher,
          jsonLogicEvaluationService: jsonLogicEval,
          dslParser: new DefaultDslParser({ logger }),
          actionErrorContextBuilder: createMockActionErrorContextBuilder(),
        });

        // Add logging to unified scope resolver
        const originalResolve = unifiedScopeResolver.resolve;
        unifiedScopeResolver.resolve = jest.fn((...args) => {
          console.log('UnifiedScopeResolver.resolve called with:');
          console.log('  Scope name:', args[0]);
          console.log('  Context actor:', args[1]?.actor);
          console.log(
            '  Context actor components:',
            args[1]?.actor?.components
          );
          console.log(
            '  Full context:',
            JSON.stringify(
              {
                ...args[1],
                actor: args[1]?.actor
                  ? {
                      id: args[1].actor.id,
                      hasComponents: !!args[1].actor.components,
                    }
                  : undefined,
                target: args[1]?.target
                  ? {
                      id: args[1].target.id,
                      hasComponents: !!args[1].target.components,
                    }
                  : undefined,
              },
              null,
              2
            )
          );
          const result = originalResolve.apply(unifiedScopeResolver, args);
          console.log('UnifiedScopeResolver.resolve returning:', result);
          return result;
        });

        return unifiedScopeResolver;
      })(),
      targetContextBuilder: createMockTargetContextBuilder(entityManager),
      targetComponentValidator: mockTargetComponentValidator,
      targetRequiredComponentsValidator: mockTargetRequiredComponentsValidator,
      multiTargetResolutionStage: (() => {
        // Create a custom mock that properly handles multi-target actions
        // This mock simulates the multi-target resolution based on entity state
        const {
          PipelineStage,
        } = require('../../../src/actions/pipeline/PipelineStage.js');
        const {
          PipelineResult,
        } = require('../../../src/actions/pipeline/PipelineResult.js');

        return new (class extends PipelineStage {
          constructor() {
            super('MockMultiTargetResolution');
          }

          async executeInternal(context) {
            const { candidateActions, actor } = context;

            const actionsWithTargets = [];

            for (const actionDef of candidateActions) {
              // Check if this is a multi-target action
              const isMultiTarget =
                actionDef.targets && typeof actionDef.targets === 'object';

              if (
                isMultiTarget &&
                actionDef.id === 'caressing:adjust_clothing'
              ) {
                // For adjust_clothing, check closeness relationships and clothing
                const actorCloseness =
                  actor.components?.['positioning:closeness'];
                if (!actorCloseness?.partners?.length) continue;

                // Check each potential target
                for (const partnerId of actorCloseness.partners) {
                  const target = entityManager.getEntityInstance(partnerId);
                  if (!target) continue;

                  // Check if target has closeness back to actor
                  const targetCloseness =
                    target.components?.['positioning:closeness'];
                  if (!targetCloseness?.partners?.includes(actor.id)) continue;

                  // Check if neither is facing away from the other
                  const actorFacingAway =
                    actor.components?.['positioning:facing_away'];
                  const targetFacingAway =
                    target.components?.['positioning:facing_away'];
                  if (
                    actorFacingAway?.facing_away_from?.includes(partnerId) ||
                    targetFacingAway?.facing_away_from?.includes(actor.id)
                  )
                    continue;

                  // Check if target has torso_upper clothing
                  const equipment = target.components?.['clothing:equipment'];
                  if (equipment?.equipped?.torso_upper?.base) {
                    const clothingId = equipment.equipped.torso_upper.base;

                    actionsWithTargets.push({
                      actionDef,
                      targetContexts: [
                        {
                          type: 'entity',
                          entityId: partnerId,
                          displayName: partnerId,
                          placeholder: 'primary',
                        },
                        {
                          type: 'entity',
                          entityId: clothingId,
                          displayName: clothingId,
                          placeholder: 'secondary',
                          contextFromId: partnerId,
                        },
                      ],
                      resolvedTargets: {
                        primary: [
                          {
                            id: partnerId,
                            displayName: partnerId,
                            entity: target,
                          },
                        ],
                        secondary: [
                          {
                            id: clothingId,
                            displayName: clothingId,
                            entity: null,
                            contextFromId: partnerId,
                          },
                        ],
                      },
                      targetDefinitions: actionDef.targets,
                      isMultiTarget: true,
                    });
                  }
                }
              } else {
                // Default handling for non-multi-target actions
                // Just return a simple target for testing
                if (entityManager.getEntityInstance('target1')) {
                  actionsWithTargets.push({
                    actionDef,
                    targetContexts: [
                      {
                        type: 'entity',
                        entityId: 'target1',
                        displayName: 'Target 1',
                        placeholder: 'target',
                      },
                    ],
                    resolvedTargets: {
                      primary: [
                        {
                          id: 'target1',
                          displayName: 'Target 1',
                          entity: entityManager.getEntityInstance('target1'),
                        },
                      ],
                    },
                    targetDefinitions: {
                      primary: {
                        scope: actionDef.scope || actionDef.targets,
                        placeholder: 'target',
                      },
                    },
                    isMultiTarget: false,
                  });
                }
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
      })(),
    });

    actionDiscoveryService = new ActionDiscoveryService({
      entityManager,
      logger,
      actionPipelineOrchestrator,
      traceContextFactory: jest.fn(() => ({ addLog: jest.fn(), logs: [] })),
    });

    // Register the adjust_clothing action
    dataRegistry.store(
      'actions',
      adjustClothingAction.id,
      adjustClothingAction
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper function to create actor with closeness relationship
   * Now ensures bidirectional closeness relationships
   *
   * @param actorId
   * @param partnerId
   * @param facingAway - Whether the actor is facing away from the partner
   * @param partnerFacingAway - Whether the partner is facing away from the actor
   */
  function createActorWithCloseness(
    actorId,
    partnerId,
    facingAway = false,
    partnerFacingAway = false
  ) {
    // Set up actor's closeness data
    const actorClosenessData = {
      partners: [partnerId],
    };
    entityManager.addComponent(
      actorId,
      'positioning:closeness',
      actorClosenessData
    );

    // Set up actor's facing_away data if applicable
    if (facingAway) {
      entityManager.addComponent(actorId, 'positioning:facing_away', {
        facing_away_from: [partnerId],
      });
    }

    // Set up partner's closeness data for bidirectional relationship
    const partnerClosenessData = {
      partners: [actorId],
    };
    entityManager.addComponent(
      partnerId,
      'positioning:closeness',
      partnerClosenessData
    );

    // Set up partner's facing_away data if applicable
    if (partnerFacingAway) {
      entityManager.addComponent(partnerId, 'positioning:facing_away', {
        facing_away_from: [actorId],
      });
    }

    return actorId;
  }

  /**
   * Helper function to setup standard mock for jsonLogicEval
   *
   * @param shouldFacingConditionReturnTrue - Whether the facing condition should return true
   */
  function setupJsonLogicMock(shouldFacingConditionReturnTrue = true) {
    const originalEvaluate = jsonLogicEval.evaluate.bind(jsonLogicEval);
    jsonLogicEval.evaluate = jest.fn((logic, context) => {
      if (
        logic?.condition_ref === 'positioning:both-actors-facing-each-other'
      ) {
        return shouldFacingConditionReturnTrue;
      }
      // For all other operators, use the original evaluator
      return originalEvaluate(logic, context);
    });
  }

  /**
   * Helper function to create target with or without clothing
   * Now also adds the required positioning:closeness component for bidirectional relationships
   *
   * @param targetId
   * @param actorId - The actor ID to establish closeness with (default: 'actor1')
   * @param hasClothing
   * @param hasEquipmentComponent
   * @param facingAway - Whether the target is facing away from the actor
   */
  function createTargetWithClothing(
    targetId,
    actorId = 'actor1',
    hasClothing = true,
    hasEquipmentComponent = true,
    facingAway = false
  ) {
    // Add the required positioning:closeness component for bidirectional relationship
    const closenessData = {
      partners: [actorId],
    };
    entityManager.addComponent(
      targetId,
      'positioning:closeness',
      closenessData
    );

    // Add facing_away component if applicable
    if (facingAway) {
      entityManager.addComponent(targetId, 'positioning:facing_away', {
        facing_away_from: [actorId],
      });
    }

    if (hasEquipmentComponent) {
      const equipmentData = hasClothing
        ? {
            equipped: {
              torso_upper: {
                base: 'shirt123', // Changed from array to single string
              },
            },
          }
        : {
            equipped: {
              torso_lower: {
                base: 'pants456', // Changed from array to single string
              },
            },
          };

      entityManager.addComponent(targetId, 'clothing:equipment', equipmentData);

      // Create the clothing item entity for multi-target resolution
      if (hasClothing) {
        entityManager.addComponent('shirt123', 'core:name', {
          name: 'silk shirt',
        });
      } else {
        entityManager.addComponent('pants456', 'core:name', {
          name: 'cotton pants',
        });
      }
    }

    return targetId;
  }

  describe('adjust_clothing action scope resolution', () => {
    it('should verify both-actors-facing-each-other condition works correctly', () => {
      // Arrange - Create actor and target with closeness relationship
      const actorId = 'actor1';
      const targetId = 'target1';

      entityManager.addComponent(actorId, 'positioning:closeness', {
        partners: [targetId],
      });

      entityManager.addComponent(targetId, 'positioning:closeness', {
        partners: [actorId],
      });

      // Test the condition directly
      const context = {
        actor: entityManager.getEntityInstance(actorId),
        entity: entityManager.getEntityInstance(targetId),
      };

      const result = jsonLogicEval.evaluate(
        { condition_ref: 'positioning:both-actors-facing-each-other' },
        context
      );

      console.log('both-actors-facing-each-other condition result:', result);
      console.log(
        'Actor closeness:',
        context.actor?.components?.['positioning:closeness']
      );
      console.log(
        'Entity closeness:',
        context.entity?.components?.['positioning:closeness']
      );

      expect(result).toBe(true);
    });

    it('should test primary scope resolution step by step', () => {
      // Arrange - Create proper entities
      const actorId = 'actor1';
      const targetId = 'target1';

      // Actor with closeness to target
      entityManager.addComponent(actorId, 'positioning:closeness', {
        partners: [targetId],
      });

      // Target with closeness to actor AND torso_upper clothing
      entityManager.addComponent(targetId, 'positioning:closeness', {
        partners: [actorId],
      });

      entityManager.addComponent(targetId, 'clothing:equipment', {
        equipped: {
          torso_upper: {
            base: 'shirt123', // Changed from array to single string
          },
        },
      });

      // Create the garment entity
      entityManager.addComponent('shirt123', 'core:name', {
        name: 'silk shirt',
      });

      // Get the primary scope definition
      const scopeDefinition = scopeRegistry.getScope(
        'caressing:close_actors_facing_each_other_with_torso_clothing'
      );
      console.log('Scope definition:', scopeDefinition);

      // Parse the scope
      const parser = new DefaultDslParser({ logger });
      const ast = parser.parse(scopeDefinition.expr);
      console.log('Parsed AST:', JSON.stringify(ast, null, 2));

      // Get the actor entity
      const actorEntity = entityManager.getEntityInstance(actorId);
      console.log('Actor entity:', actorEntity);
      console.log('Actor components:', actorEntity?.components);

      // Build runtime context
      const runtimeCtx = {
        entityManager: entityManager,
        jsonLogicEval: jsonLogicEval,
        logger: logger,
        actor: actorEntity,
      };

      // Resolve the scope directly
      const result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);

      console.log('Primary scope resolution result:', Array.from(result));
      console.log('Result size:', result.size);

      expect(result.size).toBeGreaterThan(0);
      expect(Array.from(result)).toContain(targetId);
    });

    it('should test secondary scope resolution with contextFrom', () => {
      // Arrange - Create the same entities as above
      const actorId = 'actor1';
      const targetId = 'target1';

      // Actor with closeness to target
      entityManager.addComponent(actorId, 'positioning:closeness', {
        partners: [targetId],
      });

      // Target with closeness to actor AND torso_upper clothing
      entityManager.addComponent(targetId, 'positioning:closeness', {
        partners: [actorId],
      });

      entityManager.addComponent(targetId, 'clothing:equipment', {
        equipped: {
          torso_upper: {
            base: 'shirt123', // Changed from array to single string
          },
        },
      });

      // Create the garment entity
      entityManager.addComponent('shirt123', 'core:name', {
        name: 'silk shirt',
      });

      // The secondary scope uses the actual scope expression from the scope file
      const secondaryScopeDefinition = scopeRegistry.getScope(
        'clothing:target_topmost_torso_upper_clothing'
      );
      console.log('Secondary scope definition:', secondaryScopeDefinition);

      const parser = new DefaultDslParser({ logger });
      const secondaryAst = parser.parse(secondaryScopeDefinition.expr);
      console.log(
        'Secondary scope AST:',
        JSON.stringify(secondaryAst, null, 2)
      );

      // Build context where 'target' refers to the primary target entity (as TargetContextBuilder does)
      const contextWithTarget = {
        entityManager: entityManager,
        jsonLogicEval: jsonLogicEval,
        logger: logger,
        actor: entityManager.getEntityInstance(actorId),
        target: entityManager.getEntityInstance(targetId), // This matches TargetContextBuilder.buildDependentContext
      };

      // Resolve the secondary scope
      const secondaryResult = scopeEngine.resolve(
        secondaryAst,
        entityManager.getEntityInstance(targetId),
        contextWithTarget
      );

      console.log(
        'Secondary scope resolution result:',
        Array.from(secondaryResult)
      );
      console.log('Secondary result size:', secondaryResult.size);

      expect(secondaryResult.size).toBeGreaterThan(0);
      // The result contains a single item now
      const resultArray = Array.from(secondaryResult);
      expect(resultArray).toHaveLength(1);
      expect(resultArray[0]).toEqual('shirt123'); // The slot resolver returns single string now
    });

    it('should resolve primary scope correctly', () => {
      // Arrange - Test the primary scope directly
      const actorId = createActorWithCloseness('actor1', 'target1', false);
      createTargetWithClothing('target1', true, true);

      // Create a runtime context similar to what the action system would use
      const runtimeCtx = {
        entityManager: entityManager,
        jsonLogicEval: jsonLogicEval,
        logger: logger,
      };

      // Get the primary scope definition
      const scopeDefinition = scopeRegistry.getScope(
        'caressing:close_actors_facing_each_other_with_torso_clothing'
      );
      expect(scopeDefinition).toBeDefined();

      // Parse the scope
      const parser = new DefaultDslParser({ logger });
      const ast = parser.parse(scopeDefinition.expr);

      // Get the actor entity
      const actorEntity = entityManager.getEntityInstance(actorId);

      // Mock the condition evaluation to always return true
      jsonLogicEval.evaluate = jest.fn().mockReturnValue(true);

      // Resolve the scope directly
      const result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);

      console.log('Direct scope resolution result:', Array.from(result));
      expect(result.size).toBeGreaterThan(0);
      expect(Array.from(result)).toContain('target1');
    });

    it('should include actors with torso_upper clothing who are facing forward', async () => {
      // Arrange - use helper functions to create entities
      const actorId = createActorWithCloseness('actor1', 'target1', false);
      createTargetWithClothing('target1', 'actor1', true, true);

      // Setup mock for facing condition
      setupJsonLogicMock(true);

      // Add debugging
      const actorEntity = entityManager.getEntityInstance(actorId);
      console.log('Actor entity:', actorEntity);
      console.log('Actor components:', actorEntity?.components);
      console.log(
        'Actor closeness component:',
        actorEntity?.components?.['positioning:closeness']
      );

      const targetEntity = entityManager.getEntityInstance('target1');
      console.log('Target entity:', targetEntity);
      console.log('Target components:', targetEntity?.components);
      console.log(
        'Target closeness component:',
        targetEntity?.components?.['positioning:closeness']
      );
      console.log(
        'Target equipment component:',
        targetEntity?.components?.['clothing:equipment']
      );

      // Act
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      console.log('getValidActions result:', result);
      console.log('Total actions returned:', result.actions.length);

      // Assert
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'caressing:adjust_clothing'
      );

      expect(adjustClothingActions).toHaveLength(1);
      expect(adjustClothingActions[0].params.isMultiTarget).toBe(true);
      expect(adjustClothingActions[0].params.targetIds.primary).toEqual([
        'target1',
      ]);
      expect(adjustClothingActions[0].params.targetIds.secondary).toEqual([
        'shirt123',
      ]);
    });

    it('should exclude actors without clothing:equipment component', async () => {
      // Arrange
      const actorId = createActorWithCloseness('actor1', 'target1', false);
      createTargetWithClothing('target1', 'actor1', true, false); // No equipment component

      // Setup mock for facing condition
      setupJsonLogicMock(false);

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'caressing:adjust_clothing'
      );

      expect(adjustClothingActions).toHaveLength(0);
    });

    it('should exclude actors with clothing in other slots but not torso_upper', async () => {
      // Arrange
      const actorId = createActorWithCloseness('actor1', 'target1', false);
      createTargetWithClothing('target1', 'actor1', false, true); // Has equipment but not torso_upper

      // Setup mock for facing condition
      setupJsonLogicMock(false);

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'caressing:adjust_clothing'
      );

      expect(adjustClothingActions).toHaveLength(0);
    });

    it('should ignore underwear-only torso items for the clothing scope', async () => {
      // Arrange
      const actorId = createActorWithCloseness('actor1', 'target1', false);
      entityManager.addComponent('target1', 'clothing:equipment', {
        equipped: {
          torso_upper: {
            underwear: 'undershirt123',
          },
        },
      });

      // Facing condition succeeds so coverage is the deciding factor
      setupJsonLogicMock(true);

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert - Underwear is not counted toward covering layers (base/outer/armor)
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'caressing:adjust_clothing'
      );

      expect(adjustClothingActions).toHaveLength(0);
    });

    it('should exclude actors facing away even with torso_upper clothing', async () => {
      // Arrange
      const actorId = createActorWithCloseness('actor1', 'target1', true); // Actor is facing away
      createTargetWithClothing('target1', 'actor1', true, true);

      // Setup mock for facing condition
      setupJsonLogicMock(false);

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'caressing:adjust_clothing'
      );

      expect(adjustClothingActions).toHaveLength(0);
    });

    it('should exclude actors not in closeness relationship', async () => {
      // Arrange
      entityManager.addComponent('actor1', 'positioning:closeness', {
        partners: [], // No partners
      });

      createTargetWithClothing('target1', 'actor1', true, true);

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'caressing:adjust_clothing'
      );

      expect(adjustClothingActions).toHaveLength(0);
    });

    it('should include multiple valid targets when conditions are met', async () => {
      // Arrange
      entityManager.addComponent('actor1', 'positioning:closeness', {
        partners: ['target1', 'target2'],
      });
      const actorId = 'actor1';

      // Create first target with shirt123
      const target1Id = createTargetWithClothing(
        'target1',
        'actor1',
        true,
        true
      );

      // Create second target with different clothing and bidirectional closeness
      const target2Id = 'target2';
      entityManager.addComponent(target2Id, 'positioning:closeness', {
        partners: [actorId],
      });
      entityManager.addComponent(target2Id, 'clothing:equipment', {
        equipped: {
          torso_upper: {
            base: 'shirt456', // Changed from array to single string
          },
        },
      });
      entityManager.addComponent('shirt456', 'core:name', {
        name: 'cotton blouse',
      });

      // Setup mock for facing condition
      setupJsonLogicMock(true);

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'caressing:adjust_clothing'
      );

      // The multi-target formatter now generates separate combinations for context-dependent targets
      expect(adjustClothingActions.length).toBeGreaterThanOrEqual(1);
      expect(adjustClothingActions[0].params.isMultiTarget).toBe(true);

      // Each combination represents a specific primary-secondary pair
      const allPrimaryIds = adjustClothingActions.flatMap(
        (action) => action.params.targetIds.primary
      );
      const allSecondaryIds = adjustClothingActions.flatMap(
        (action) => action.params.targetIds.secondary
      );

      expect(allPrimaryIds).toContain(target1Id);
      expect(allPrimaryIds).toContain(target2Id);
      expect(allSecondaryIds).toContain('shirt123');
      expect(allSecondaryIds).toContain('shirt456');

      // Each action now represents a single combination
      adjustClothingActions.forEach((action) => {
        expect(typeof action.command).toBe('string');
        expect(action.command).toMatch(
          /adjust (target1|target2)'s (shirt123|shirt456)/
        );
      });

      // Verify we have the expected combinations
      // const commands = adjustClothingActions.map((action) => action.command);
      // const hasExpectedCombinations =
      //   (commands.includes("adjust target1's shirt123") ||
      //     commands.includes("adjust target2's shirt456")) &&
      //   commands.length >= 1;
    });
  });

  describe('Multi-target context resolution and template rendering', () => {
    it('should resolve secondary target from primary context', async () => {
      // Arrange
      const actorId = createActorWithCloseness('actor1', 'target1', false);
      createTargetWithClothing('target1', 'actor1', true, true);

      // Setup mock for facing condition
      setupJsonLogicMock(true);

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'caressing:adjust_clothing'
      );

      expect(adjustClothingActions).toHaveLength(1);
      expect(adjustClothingActions[0].params.isMultiTarget).toBe(true);
      expect(adjustClothingActions[0].params.targetIds.primary).toEqual([
        'target1',
      ]);
      expect(adjustClothingActions[0].params.targetIds.secondary).toEqual([
        'shirt123',
      ]); // Resolved from primary's clothing
    });

    it('should handle missing clothing gracefully', async () => {
      // Arrange - Create actor with closeness but target without torso_upper clothing
      const actorId = createActorWithCloseness('actor1', 'target1', false);
      createTargetWithClothing('target1', 'actor1', false, true); // Has equipment but no torso_upper

      // Setup mock for facing condition
      setupJsonLogicMock(true);

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert - Action should not be available when no torso_upper clothing
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'caressing:adjust_clothing'
      );

      expect(adjustClothingActions).toHaveLength(0);
    });

    it('should render template with specific garment names', async () => {
      // Arrange
      const actorId = createActorWithCloseness('actor1', 'target1', false);
      createTargetWithClothing('target1', 'actor1', true, true);

      // Setup mock for facing condition
      setupJsonLogicMock(true);

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'caressing:adjust_clothing'
      );

      expect(adjustClothingActions).toHaveLength(1);

      // Template should be formatted with specific garment name
      const action = adjustClothingActions[0];
      // For multi-target actions, command might be a string or array
      const commandText = Array.isArray(action.command)
        ? action.command[0]
        : action.command;
      expect(commandText).toMatch(/adjust .+'s .+/); // Should include both primary and secondary names
      expect(commandText).not.toContain('{primary}');
      expect(commandText).not.toContain('{secondary}');
    });

    it('should handle context resolution failures gracefully', async () => {
      // Arrange - Create an invalid context scenario
      const actorId = createActorWithCloseness(
        'actor1',
        'nonexistent_target',
        false
      );

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert - Should handle gracefully without throwing errors
      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();

      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'caressing:adjust_clothing'
      );

      // Action should not be available when context resolution fails
      expect(adjustClothingActions).toHaveLength(0);
    });
  });
});
