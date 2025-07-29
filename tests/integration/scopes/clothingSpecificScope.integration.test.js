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
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import fs from 'fs';
import path from 'path';

// Import actual scope file content
const clothingScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/intimacy/scopes/close_actors_facing_each_other_with_torso_clothing.scope'
  ),
  'utf8'
);

// Import secondary scope file content
const secondaryScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/intimacy/scopes/target_topmost_torso_upper_clothing.scope'
  ),
  'utf8'
);

// Import actual action files
import adjustClothingAction from '../../../data/mods/intimacy/actions/adjust_clothing.action.json';

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

    // Parse and register the clothing-specific scopes
    const parser = new DefaultDslParser({ logger });
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
      'intimacy:close_actors_facing_each_other_with_torso_clothing':
        primaryScopeDefinitions.get(
          'intimacy:close_actors_facing_each_other_with_torso_clothing'
        ),
      'intimacy:target_topmost_torso_upper_clothing':
        secondaryScopeDefinitions.get(
          'intimacy:target_topmost_torso_upper_clothing'
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
      evaluate: jest.fn((prerequisites, actionDef, actor, trace) => {
        console.log('Prerequisite evaluation called for:', actionDef?.id);
        console.log('  Actor:', actor?.id);
        console.log('  Prerequisites:', prerequisites);
        const result = true;
        console.log('  Result:', result);
        return result;
      }),
    };

    // Create the ActionPipelineOrchestrator
    const actionPipelineOrchestrator = new ActionPipelineOrchestrator({
      actionIndex: {
        getCandidateActions: jest.fn().mockImplementation((actor) => {
          console.log('getCandidateActions called with actor:', actor?.id);
          console.log('Returning:', [adjustClothingAction]);
          return [adjustClothingAction];
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
      unifiedScopeResolver: (() => {
        const unifiedScopeResolver = createMockUnifiedScopeResolver({
          scopeRegistry,
          entityManager,
          logger,
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
          console.log('  Full context:', args[1]);
          const result = originalResolve.apply(unifiedScopeResolver, args);
          console.log('UnifiedScopeResolver.resolve returning:', result);
          return result;
        });

        return unifiedScopeResolver;
      })(),
      targetContextBuilder: createMockTargetContextBuilder(),
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

    // Register the condition used by the scope
    dataRegistry.store('conditions', 'intimacy:both-actors-facing-each-other', {
      id: 'intimacy:both-actors-facing-each-other',
      description:
        'Checks if both actors are facing each other (neither is facing away from the other).',
      logic: {
        and: [
          {
            not: {
              in: [
                { var: 'entity.id' },
                { var: 'actor.components.intimacy:closeness.facing_away_from' },
              ],
            },
          },
          {
            not: {
              in: [
                { var: 'actor.id' },
                {
                  var: 'entity.components.intimacy:closeness.facing_away_from',
                },
              ],
            },
          },
        ],
      },
    });
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
      facing_away_from: facingAway ? [partnerId] : [],
    };
    entityManager.addComponent(
      actorId,
      'intimacy:closeness',
      actorClosenessData
    );

    // Set up partner's closeness data for bidirectional relationship
    const partnerClosenessData = {
      partners: [actorId],
      facing_away_from: partnerFacingAway ? [actorId] : [],
    };
    entityManager.addComponent(
      partnerId,
      'intimacy:closeness',
      partnerClosenessData
    );

    return actorId;
  }

  /**
   * Helper function to create target with or without clothing
   * Now also adds the required intimacy:closeness component for bidirectional relationships
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
    // Add the required intimacy:closeness component for bidirectional relationship
    const closenessData = {
      partners: [actorId],
      facing_away_from: facingAway ? [actorId] : [],
    };
    entityManager.addComponent(targetId, 'intimacy:closeness', closenessData);

    if (hasEquipmentComponent) {
      const equipmentData = hasClothing
        ? {
            equipped: {
              torso_upper: {
                base: ['shirt123'],
              },
            },
          }
        : {
            equipped: {
              torso_lower: {
                base: ['pants456'],
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
    it('should verify hasClothingInSlot operator works correctly', () => {
      // Arrange - Create entity with torso_upper clothing
      const targetId = 'target1';
      entityManager.addComponent(targetId, 'clothing:equipment', {
        equipped: {
          torso_upper: {
            base: ['shirt123'],
          },
        },
      });

      // Test the operator directly
      const context = {
        entity: entityManager.getEntityInstance(targetId),
      };

      const result = jsonLogicEval.evaluate(
        { hasClothingInSlot: ['.', 'torso_upper'] },
        context
      );

      console.log('hasClothingInSlot direct test result:', result);
      console.log('Entity context:', context.entity);
      console.log('Entity components:', context.entity?.components);

      expect(result).toBe(true);
    });

    it('should verify both-actors-facing-each-other condition works correctly', () => {
      // Arrange - Create actor and target with closeness relationship
      const actorId = 'actor1';
      const targetId = 'target1';

      entityManager.addComponent(actorId, 'intimacy:closeness', {
        partners: [targetId],
        facing_away_from: [],
      });

      entityManager.addComponent(targetId, 'intimacy:closeness', {
        partners: [actorId],
        facing_away_from: [],
      });

      // Test the condition directly
      const context = {
        actor: entityManager.getEntityInstance(actorId),
        entity: entityManager.getEntityInstance(targetId),
      };

      const result = jsonLogicEval.evaluate(
        { condition_ref: 'intimacy:both-actors-facing-each-other' },
        context
      );

      console.log('both-actors-facing-each-other condition result:', result);
      console.log(
        'Actor closeness:',
        context.actor?.components?.['intimacy:closeness']
      );
      console.log(
        'Entity closeness:',
        context.entity?.components?.['intimacy:closeness']
      );

      expect(result).toBe(true);
    });

    it('should test primary scope resolution step by step', () => {
      // Arrange - Create proper entities
      const actorId = 'actor1';
      const targetId = 'target1';

      // Actor with closeness to target
      entityManager.addComponent(actorId, 'intimacy:closeness', {
        partners: [targetId],
        facing_away_from: [],
      });

      // Target with closeness to actor AND torso_upper clothing
      entityManager.addComponent(targetId, 'intimacy:closeness', {
        partners: [actorId],
        facing_away_from: [],
      });

      entityManager.addComponent(targetId, 'clothing:equipment', {
        equipped: {
          torso_upper: {
            base: ['shirt123'],
          },
        },
      });

      // Create the garment entity
      entityManager.addComponent('shirt123', 'core:name', {
        name: 'silk shirt',
      });

      // Get the primary scope definition
      const scopeDefinition = scopeRegistry.getScope(
        'intimacy:close_actors_facing_each_other_with_torso_clothing'
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
      entityManager.addComponent(actorId, 'intimacy:closeness', {
        partners: [targetId],
        facing_away_from: [],
      });

      // Target with closeness to actor AND torso_upper clothing
      entityManager.addComponent(targetId, 'intimacy:closeness', {
        partners: [actorId],
        facing_away_from: [],
      });

      entityManager.addComponent(targetId, 'clothing:equipment', {
        equipped: {
          torso_upper: {
            base: ['shirt123'],
          },
        },
      });

      // Create the garment entity
      entityManager.addComponent('shirt123', 'core:name', {
        name: 'silk shirt',
      });

      // Test secondary scope: "primary.topmost_clothing.torso_upper"
      // But actually, contextFrom: "primary" means the scope is interpreted as "target.topmost_clothing.torso_upper"
      // where 'target' refers to the first resolved primary target
      const secondaryScope = 'target.topmost_clothing.torso_upper';
      const parser = new DefaultDslParser({ logger });
      const secondaryAst = parser.parse(secondaryScope);
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
      // The result contains an array, so we need to check for the array
      const resultArray = Array.from(secondaryResult);
      expect(resultArray).toHaveLength(1);
      expect(resultArray[0]).toEqual(['shirt123']); // The slot resolver returns arrays
    });

    it('should resolve primary scope correctly', () => {
      // Arrange - Test the primary scope directly
      const actorId = createActorWithCloseness('actor1', 'target1', false);
      const targetId = createTargetWithClothing('target1', true, true);

      // Create a runtime context similar to what the action system would use
      const runtimeCtx = {
        entityManager: entityManager,
        jsonLogicEval: jsonLogicEval,
        logger: logger,
      };

      // Get the primary scope definition
      const scopeDefinition = scopeRegistry.getScope(
        'intimacy:close_actors_facing_each_other_with_torso_clothing'
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
      expect(Array.from(result)).toContain(targetId);
    });

    it('should include actors with torso_upper clothing who are facing forward', async () => {
      // Arrange - create entities like the working integration test
      const actorId = 'actor1';
      const targetId = 'target1';
      const entities = [
        {
          id: actorId,
          components: {
            'intimacy:closeness': {
              partners: [targetId],
              facing_away_from: [],
            },
          },
        },
        {
          id: targetId,
          components: {
            'intimacy:closeness': {
              partners: [actorId],
              facing_away_from: [],
            },
            'clothing:equipment': {
              equipped: {
                torso_upper: {
                  base: ['shirt123'],
                },
              },
            },
          },
        },
        {
          id: 'shirt123',
          components: {
            'core:name': { name: 'silk shirt' },
          },
        },
      ];

      // Create fresh entity manager with the entities
      entityManager = new SimpleEntityManager(entities);

      // Recreate jsonLogicCustomOperators with fresh entityManager
      jsonLogicCustomOperators = new JsonLogicCustomOperators({
        logger,
        bodyGraphService: mockBodyGraphService,
        entityManager, // Use the fresh entity manager
      });
      jsonLogicCustomOperators.registerOperators(jsonLogicEval);

      // Recreate services that depend on entityManager
      const validatedEventDispatcher = {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };

      const safeEventDispatcher = new SafeEventDispatcher({
        validatedEventDispatcher,
        logger,
      });

      // Create prerequisite service mock
      const prerequisiteEvaluationService = {
        evaluate: jest.fn((prerequisites, actionDef, actor, trace) => {
          console.log('Prerequisite evaluation called for:', actionDef?.id);
          console.log('  Actor:', actor?.id);
          console.log('  Prerequisites:', prerequisites);
          const result = true;
          console.log('  Result:', result);
          return result;
        }),
      };

      const targetResolutionService = createTargetResolutionServiceWithMocks({
        logger,
        scopeEngine,
        entityManager, // Use the fresh entity manager
        scopeRegistry,
        safeEventDispatcher,
        jsonLogicEvaluationService: jsonLogicEval,
        dslParser: new DefaultDslParser({ logger }),
        actionErrorContextBuilder: createMockActionErrorContextBuilder(),
      });

      // Mock the target resolution service methods with logging
      const originalResolveTargets = targetResolutionService.resolveTargets;
      targetResolutionService.resolveTargets = jest.fn((...args) => {
        console.log(
          'TargetResolutionService.resolveTargets called with:',
          args
        );
        const result = originalResolveTargets.apply(
          targetResolutionService,
          args
        );
        console.log(
          'TargetResolutionService.resolveTargets returning:',
          result
        );
        return result;
      });

      // Create the ActionPipelineOrchestrator
      const actionPipelineOrchestrator = new ActionPipelineOrchestrator({
        actionIndex: {
          getCandidateActions: jest.fn().mockImplementation((actor) => {
            console.log('getCandidateActions called with actor:', actor?.id);
            console.log('Returning:', [adjustClothingAction]);
            return [adjustClothingAction];
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
        unifiedScopeResolver: (() => {
          const unifiedScopeResolver = createMockUnifiedScopeResolver({
            scopeRegistry,
            scopeEngine,
            entityManager, // Use the fresh entity manager
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
            try {
              const result = originalResolve.apply(unifiedScopeResolver, args);
              console.log('UnifiedScopeResolver.resolve returning:', result);
              return result;
            } catch (error) {
              console.log('UnifiedScopeResolver.resolve error:', error.message);
              console.log('Error stack:', error.stack);
              throw error;
            }
          });

          return unifiedScopeResolver;
        })(),
        targetContextBuilder: createMockTargetContextBuilder(entityManager),
      });

      actionDiscoveryService = new ActionDiscoveryService({
        entityManager,
        logger,
        actionPipelineOrchestrator,
        traceContextFactory: jest.fn(() => ({ addLog: jest.fn(), logs: [] })),
      });

      // Debug logging - verify entities are set up correctly
      console.log(
        'Actor components:',
        entityManager.getAllComponentTypesForEntity(actorId)
      );
      console.log(
        'Target components:',
        entityManager.getAllComponentTypesForEntity(targetId)
      );

      // Mock condition evaluation for facing direction
      const originalEvaluate = jsonLogicEval.evaluate;
      jsonLogicEval.evaluate = jest.fn((logic, context) => {
        console.log(
          'JsonLogic evaluation called with:',
          JSON.stringify(logic, null, 2)
        );
        console.log('Context:', JSON.stringify(context, null, 2));

        if (logic?.condition_ref === 'intimacy:both-actors-facing-each-other') {
          console.log('Returning true for facing condition');
          return true; // Both actors are facing each other
        }

        if (logic?.hasClothingInSlot) {
          console.log(
            'hasClothingInSlot called with:',
            logic.hasClothingInSlot
          );
          const result = originalEvaluate.call(jsonLogicEval, logic, context);
          console.log('hasClothingInSlot result:', result);
          return result;
        }

        const result = originalEvaluate.call(jsonLogicEval, logic, context);
        console.log('Other logic result:', result);
        return result;
      });

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'intimacy:adjust_clothing'
      );

      expect(adjustClothingActions).toHaveLength(1);
      expect(adjustClothingActions[0].params.primaryId).toBe(targetId);
      expect(adjustClothingActions[0].params.secondaryId).toBeDefined(); // Should be the garment ID
    });

    it('should exclude actors without clothing:equipment component', async () => {
      // Arrange
      const actorId = createActorWithCloseness('actor1', 'target1', false);
      const targetId = createTargetWithClothing(
        'target1',
        'actor1',
        true,
        false
      ); // No equipment component

      // Mock condition evaluation for facing direction
      jsonLogicEval.evaluate = jest.fn((logic, context) => {
        if (logic?.condition_ref === 'intimacy:both-actors-facing-each-other') {
          return false; // Not both facing each other
        }
        return false;
      });

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'intimacy:adjust_clothing'
      );

      expect(adjustClothingActions).toHaveLength(0);
    });

    it('should exclude actors with clothing in other slots but not torso_upper', async () => {
      // Arrange
      const actorId = createActorWithCloseness('actor1', 'target1', false);
      const targetId = createTargetWithClothing(
        'target1',
        'actor1',
        false,
        true
      ); // Has equipment but not torso_upper

      // Mock condition evaluation for facing direction
      jsonLogicEval.evaluate = jest.fn((logic, context) => {
        if (logic?.condition_ref === 'intimacy:both-actors-facing-each-other') {
          return false; // Not both facing each other
        }
        return false;
      });

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'intimacy:adjust_clothing'
      );

      expect(adjustClothingActions).toHaveLength(0);
    });

    it('should exclude actors facing away even with torso_upper clothing', async () => {
      // Arrange
      const actorId = createActorWithCloseness('actor1', 'target1', true); // Actor is facing away
      const targetId = createTargetWithClothing(
        'target1',
        'actor1',
        true,
        true
      );

      // Mock condition evaluation for facing direction
      jsonLogicEval.evaluate = jest.fn((logic, context) => {
        if (logic?.condition_ref === 'intimacy:both-actors-facing-each-other') {
          return false; // Actor is facing away
        }
        return false;
      });

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'intimacy:adjust_clothing'
      );

      expect(adjustClothingActions).toHaveLength(0);
    });

    it('should exclude actors not in closeness relationship', async () => {
      // Arrange
      entityManager.addComponent('actor1', 'intimacy:closeness', {
        partners: [], // No partners
        facing_away_from: [],
      });

      const targetId = createTargetWithClothing(
        'target1',
        'actor1',
        true,
        true
      );

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'intimacy:adjust_clothing'
      );

      expect(adjustClothingActions).toHaveLength(0);
    });

    it('should include multiple valid targets when conditions are met', async () => {
      // Arrange
      entityManager.addComponent('actor1', 'intimacy:closeness', {
        partners: ['target1', 'target2'],
        facing_away_from: [],
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
      entityManager.addComponent(target2Id, 'intimacy:closeness', {
        partners: [actorId],
        facing_away_from: [],
      });
      entityManager.addComponent(target2Id, 'clothing:equipment', {
        equipped: {
          torso_upper: {
            base: ['shirt456'],
          },
        },
      });
      entityManager.addComponent('shirt456', 'core:name', {
        name: 'cotton blouse',
      });

      // Mock condition evaluation for facing direction
      const originalEvaluate = jsonLogicEval.evaluate;
      jsonLogicEval.evaluate = jest.fn((logic, context) => {
        if (logic?.condition_ref === 'intimacy:both-actors-facing-each-other') {
          return true; // Both targets are facing forward
        }
        // For other logic (like hasClothingInSlot), use the original evaluator
        return originalEvaluate.call(jsonLogicEval, logic, context);
      });

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'intimacy:adjust_clothing'
      );

      expect(adjustClothingActions).toHaveLength(2);
      const primaryIds = adjustClothingActions.map(
        (action) => action.params.primaryId
      );
      expect(primaryIds).toContain(target1Id);
      expect(primaryIds).toContain(target2Id);

      // Verify all actions have secondary targets (garments)
      adjustClothingActions.forEach((action) => {
        expect(action.params.secondaryId).toBeDefined();
      });
    });
  });

  describe('Multi-target context resolution and template rendering', () => {
    it('should resolve secondary target from primary context', async () => {
      // Arrange
      const actorId = createActorWithCloseness('actor1', 'target1', false);
      const targetId = createTargetWithClothing(
        'target1',
        'actor1',
        true,
        true
      );

      // Mock condition evaluation for facing direction
      const originalEvaluate = jsonLogicEval.evaluate;
      jsonLogicEval.evaluate = jest.fn((logic, context) => {
        if (logic?.condition_ref === 'intimacy:both-actors-facing-each-other') {
          return true;
        }
        return originalEvaluate.call(jsonLogicEval, logic, context);
      });

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'intimacy:adjust_clothing'
      );

      expect(adjustClothingActions).toHaveLength(1);
      expect(adjustClothingActions[0].params.primaryId).toBe(targetId);
      expect(adjustClothingActions[0].params.secondaryId).toBe('shirt123'); // Resolved from primary's clothing
    });

    it('should handle missing clothing gracefully', async () => {
      // Arrange - Create actor with closeness but target without torso_upper clothing
      const actorId = createActorWithCloseness('actor1', 'target1', false);
      const targetId = createTargetWithClothing(
        'target1',
        'actor1',
        false,
        true
      ); // Has equipment but no torso_upper

      // Mock condition evaluation for facing direction
      jsonLogicEval.evaluate = jest.fn((logic, context) => {
        if (logic?.condition_ref === 'intimacy:both-actors-facing-each-other') {
          return true;
        }
        return false; // hasClothingInSlot should return false
      });

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert - Action should not be available when no torso_upper clothing
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'intimacy:adjust_clothing'
      );

      expect(adjustClothingActions).toHaveLength(0);
    });

    it('should render template with specific garment names', async () => {
      // Arrange
      const actorId = createActorWithCloseness('actor1', 'target1', false);
      const targetId = createTargetWithClothing(
        'target1',
        'actor1',
        true,
        true
      );

      // Mock condition evaluation for facing direction
      const originalEvaluate = jsonLogicEval.evaluate;
      jsonLogicEval.evaluate = jest.fn((logic, context) => {
        if (logic?.condition_ref === 'intimacy:both-actors-facing-each-other') {
          return true;
        }
        return originalEvaluate.call(jsonLogicEval, logic, context);
      });

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'intimacy:adjust_clothing'
      );

      expect(adjustClothingActions).toHaveLength(1);

      // Template should be formatted with specific garment name
      const action = adjustClothingActions[0];
      expect(action.command).toMatch(/adjust .+'s .+/); // Should include both primary and secondary names
      expect(action.command).not.toContain('{primary}');
      expect(action.command).not.toContain('{secondary}');
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
        (action) => action.id === 'intimacy:adjust_clothing'
      );

      // Action should not be available when context resolution fails
      expect(adjustClothingActions).toHaveLength(0);
    });
  });
});
