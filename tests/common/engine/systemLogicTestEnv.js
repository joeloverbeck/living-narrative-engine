/**
 * @file Helper for creating system logic test environments
 * @description Provides a standardized way to set up test environments for rule integration tests
 */
/* eslint-env jest */
/* global jest */

import OperationRegistry from '../../../src/logic/operationRegistry.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import { ActionIndex } from '../../../src/actions/actionIndex.js';
import { SimpleEntityManager } from '../entities/index.js';
import {
  createMockLogger,
  createCapturingEventBus,
} from '../mockFactories/index.js';
import { deepClone } from '../../../src/utils/cloneUtils.js';
import { expandMacros } from '../../../src/utils/macroUtils.js';

/**
 * Creates base services needed for rule engine tests.
 *
 * @description Builds the fundamental components used by the rule test
 * environment. This includes entity and operation managers along with the
 * system logic interpreter.
 * @param {object} options - Configuration options
 * @param {Function} options.createHandlers - Function to create handlers with
 *   `(entityManager, eventBus, logger)` parameters
 * @param {Array<{id:string,components:object}>} options.entities - Initial
 *   entities to load
 * @param {Array<object>} options.rules - System rules to load
 * @param {Array<object>} [options.actions] - Action definitions to load
 * @param {object} [options.conditions] - Condition definitions to load
 * @param {object} [options.macros] - Macro definitions to load
 * @param {object} [options.logger] - Logger instance to use
 * @param {() => object} [options.createLogger] - Factory to create a logger if
 *   none is provided
 * @param {object} [options.dataRegistry] - Data registry instance to use
 * @param {() => object} [options.createDataRegistry] - Factory to create a data
 *   registry if none is provided
 * @param {object} [options.eventBus] - Event bus instance to use
 * @param {() => object} [options.createEventBus] - Factory to create an event
 *   bus if none is provided
 * @returns {{
 *   eventBus: import('../../../src/events/eventBus.js').default,
 *   events: any[],
 *   operationRegistry: OperationRegistry,
 *   operationInterpreter: OperationInterpreter,
 *   jsonLogic: JsonLogicEvaluationService,
 *   systemLogicInterpreter: SystemLogicInterpreter,
 *   entityManager: SimpleEntityManager,
 *   logger: any,
 *   dataRegistry: any,
 *   cleanup: () => void,
 *   initializeEnv: (entities: Array<{id:string,components:object}>) => any
 * }} Base environment pieces used for tests.
 */
export function createBaseRuleEnvironment({
  createHandlers,
  entities = [],
  rules = [],
  actions = [],
  conditions = {},
  macros = {},
  scopes = {},
  logger = null,
  createLogger = null,
  dataRegistry = null,
  createDataRegistry = null,
  eventBus = null,
  createEventBus = null,
}) {
  // Create a debug logger that shows SystemLogicInterpreter messages
  const debugLogger = {
    debug: jest.fn((msg, ...args) => {
      if (msg.includes('[SystemLogicInterpreter]') || msg.includes('Rule')) {
        console.log('[DEBUG]', msg, ...args);
      }
    }),
    info: jest.fn(),
    warn: jest.fn((msg) => console.log('[WARN]', msg)),
    error: jest.fn((msg, ...args) => console.log('[ERROR]', msg, ...args)),
  };
  
  const testLogger =
    logger ||
    (typeof createLogger === 'function' ? createLogger() : debugLogger);
  // Expand macros in rules before passing them to the interpreter
  const expandedRules = rules.map(rule => {
    if (rule.actions) {
      const expandedRule = { ...rule };
      // Create a registry interface that expandMacros expects
      const macroRegistry = {
        get: (type, id) => {
          if (type === 'macros') {
            return macros[id];
          }
          return undefined;
        }
      };
      expandedRule.actions = expandMacros(rule.actions, macroRegistry, testLogger);
      return expandedRule;
    }
    return rule;
  });
  
  const testDataRegistry =
    dataRegistry ||
    (typeof createDataRegistry === 'function'
      ? createDataRegistry()
      : {
          getAllSystemRules: jest.fn().mockReturnValue(expandedRules),
          getAllActionDefinitions: jest.fn().mockReturnValue(actions),
          getConditionDefinition: jest
            .fn()
            .mockImplementation((conditionId) => {
              return conditions[conditionId] || undefined;
            }),
          getMacroDefinition: jest.fn().mockImplementation((macroId) => {
            return macros[macroId] || undefined;
          }),
        });

  const bus =
    eventBus ||
    (typeof createEventBus === 'function'
      ? createEventBus()
      : createCapturingEventBus());

  let entityManager;
  let operationRegistry;
  let operationInterpreter;
  let interpreter;

  const jsonLogic = new JsonLogicEvaluationService({
    logger: testLogger,
    gameDataRepository: testDataRegistry,
  });

  /**
   * Initializes core engine components for the rule environment.
   *
   * @private
   * @param {Array<{id:string,components:object}>} entityList - Entities to load.
   * @returns {{
   *   entityManager: SimpleEntityManager,
   *   operationRegistry: OperationRegistry,
   *   operationInterpreter: OperationInterpreter,
   *   systemLogicInterpreter: SystemLogicInterpreter
   * }} Initialized services.
   */
  function initializeEnv(entityList) {
    entityManager = new SimpleEntityManager(entityList);
    operationRegistry = new OperationRegistry({ logger: testLogger });
    const handlers = createHandlers(entityManager, bus, testLogger);
    for (const [type, handler] of Object.entries(handlers)) {
      if (!handler || typeof handler.execute !== 'function') {
        throw new Error(
          `Handler for ${type} must be an object with an execute() method`
        );
      }
      operationRegistry.register(type, handler.execute.bind(handler));
    }
    operationInterpreter = new OperationInterpreter({
      logger: testLogger,
      operationRegistry,
    });
    // Create the bodyGraphService mock that actually checks entity components
    const mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn(
        (bodyComponent, componentId, propertyPath, expectedValue) => {
          // If no body component or root, return not found
          if (!bodyComponent || !bodyComponent.root) {
            return { found: false };
          }

          // Check the root entity first
          const rootEntity = entityManager.getEntity(bodyComponent.root);
          if (rootEntity && rootEntity.components[componentId]) {
            const component = rootEntity.components[componentId];
            const actualValue = propertyPath
              ? component[propertyPath]
              : component;
            if (actualValue === expectedValue) {
              return { found: true, partId: bodyComponent.root };
            }
          }

          // For test environments, also check all entities that look like body parts
          // This is a simplified approach since we don't have the full graph traversal
          const allEntities = entityManager.getAllEntities();
          for (const entity of allEntities) {
            // Check if this entity has the component we're looking for
            if (entity.components && entity.components[componentId]) {
              const component = entity.components[componentId];
              const actualValue = propertyPath
                ? component[propertyPath]
                : component;
              if (actualValue === expectedValue) {
                return { found: true, partId: entity.id };
              }
            }
          }

          return { found: false };
        }
      ),
    };

    // Create and initialize ActionIndex
    const actionIndex = new ActionIndex({
      logger: testLogger,
      entityManager,
    });
    actionIndex.buildIndex(actions);

    // Create a simple scope resolver for testing
    const simpleScopeResolver = {
      resolveSync: (scopeName, context) => {
        // Handle the positioning:available_furniture scope
        if (scopeName === 'positioning:available_furniture') {
          console.log(
            '[SCOPE RESOLVER] Resolving positioning:available_furniture'
          );
          console.log('  - Actor ID:', context.actor?.id);
          console.log(
            '  - Actor components:',
            context.actor?.components
              ? Object.keys(context.actor.components)
              : 'none'
          );
          const actorLocation =
            context.actor?.components?.['core:position']?.locationId;
          console.log('  - Actor location:', actorLocation);
          if (!actorLocation) {
            console.log('  - No actor location found, returning empty set');
            return { success: true, value: new Set() };
          }

          // Find all entities with positioning:allows_sitting
          // Note: SimpleEntityManager doesn't have getAllEntities, we need to iterate differently
          const allEntityIds = entityManager.getEntityIds();
          console.log('  - Total entities in manager:', allEntityIds.length);
          console.log('  - All entity IDs:', allEntityIds);
          
          // Build entities array from IDs
          const allEntities = allEntityIds.map(id => {
            const instance = entityManager.getEntityInstance(id);
            return instance || { id, components: {} };
          });
          const furnitureEntities = allEntities.filter((entity) => {
            console.log('  - Checking entity:', entity.id);
            const hasSittingComponent =
              entity.components?.['positioning:allows_sitting'];
            const furnitureLocation =
              entity.components?.['core:position']?.locationId;

            if (entity.id === 'p_erotica:park_bench_instance') {
              console.log('  - Park bench entity found:');
              console.log(
                '    - Components:',
                entity.components ? Object.keys(entity.components) : 'none'
              );
              console.log(
                '    - Has sitting component:',
                !!hasSittingComponent
              );
              console.log('    - Furniture location:', furnitureLocation);
              console.log('    - Actor location:', actorLocation);
            }

            if (!hasSittingComponent || !furnitureLocation) {
              console.log(
                '    - Filtered out: no sitting component or location'
              );
              return false;
            }

            // Check if in same location
            if (furnitureLocation !== actorLocation) {
              console.log('    - Filtered out: different location');
              return false;
            }

            // Check if has available spots
            const spots = hasSittingComponent.spots;
            if (!Array.isArray(spots)) {
              console.log('    - Filtered out: spots not an array');
              return false;
            }

            const hasAvailableSpots = spots.some((spot) => spot === null);
            console.log('    - Has available spots:', hasAvailableSpots);
            return hasAvailableSpots;
          });

          const result = new Set(furnitureEntities.map((e) => e.id));
          console.log('  - Found furniture entities:', Array.from(result));
          return {
            success: true,
            value: result,
          };
        }

        // Handle the positioning:furniture_im_sitting_on scope
        if (scopeName === 'positioning:furniture_im_sitting_on') {
          console.log(
            '[SCOPE RESOLVER] Resolving positioning:furniture_im_sitting_on'
          );
          
          // This scope should find furniture that the actor is currently sitting on
          // The scope definition is: entities(positioning:allows_sitting)[][{"==": [{"var": "entity.id"}, {"var": "actor.components.positioning:sitting_on.furniture_id"}]}]
          
          // Get actor
          const actor = context?.actor || entityManager.getEntityInstance(context);
          if (!actor) {
            console.log('  - No actor found in context, returning empty set');
            return { success: true, value: new Set() };
          }
          
          // Get actor's sitting_on component
          const sittingOn = actor.components?.['positioning:sitting_on'];
          if (!sittingOn || !sittingOn.furniture_id) {
            console.log('  - Actor is not sitting on anything, returning empty set');
            return { success: true, value: new Set() };
          }
          
          console.log('  - Actor is sitting on furniture:', sittingOn.furniture_id);
          
          // Check if this furniture exists and has positioning:allows_sitting component
          const targetFurniture = entityManager.getEntityInstance(sittingOn.furniture_id);
          if (!targetFurniture || !targetFurniture.components?.['positioning:allows_sitting']) {
            console.log('  - Target furniture does not exist or does not allow sitting, returning empty set');
            return { success: true, value: new Set() };
          }
          
          console.log('  - Found target furniture, returning it');
          return { success: true, value: new Set([sittingOn.furniture_id]) };
        }

        // Handle other scopes or return empty set
        if (scopeName === 'none' || scopeName === 'self') {
          return { success: true, value: new Set([scopeName]) };
        }

        // Unknown scope - return empty set
        return { success: true, value: new Set() };
      },
    };

    interpreter = new SystemLogicInterpreter({
      logger: testLogger,
      eventBus: bus,
      dataRegistry: testDataRegistry,
      jsonLogicEvaluationService: jsonLogic,
      entityManager,
      operationInterpreter,
      bodyGraphService: mockBodyGraphService,
    });
    
    // Log rules being passed to SystemLogicInterpreter
    const rulesForInterpreter = testDataRegistry.getAllSystemRules();
    console.log('[TEST ENV] Rules passed to SystemLogicInterpreter:', rulesForInterpreter?.length || 0);
    if (rulesForInterpreter && rulesForInterpreter.length > 0) {
      console.log('[TEST ENV] Rule IDs:', rulesForInterpreter.map(r => r.rule_id));
    }
    
    interpreter.initialize();
    
    // Verify the interpreter is subscribed
    const listenerCount = bus.listenerCount('*');
    console.log('[TEST ENV] Event bus listener count for "*":', listenerCount);
    return {
      entityManager,
      operationRegistry,
      operationInterpreter,
      systemLogicInterpreter: interpreter,
      actionIndex,
      handlers,
      unifiedScopeResolver: simpleScopeResolver,
    };
  }

  const init = initializeEnv(entities);

  return {
    eventBus: bus,
    events: bus.events,
    operationRegistry: init.operationRegistry,
    operationInterpreter: init.operationInterpreter,
    jsonLogic,
    systemLogicInterpreter: init.systemLogicInterpreter,
    // Alias for backward compatibility with tests
    systemLogicOrchestrator: init.systemLogicInterpreter,
    entityManager: init.entityManager,
    actionIndex: init.actionIndex,
    handlers: init.handlers,
    unifiedScopeResolver: init.unifiedScopeResolver,
    logger: testLogger,
    dataRegistry: testDataRegistry,
    cleanup: () => {
      interpreter.shutdown();
    },
    initializeEnv,
  };
}

/**
 * Resets an existing rule test environment.
 *
 * @description Shuts down the current interpreter and reinitializes core
 * components using the provided entities.
 * @param {ReturnType<typeof createBaseRuleEnvironment>} env - Environment to
 *   reset
 * @param {Array<{id:string,components:object}>} newEntities - Entities to load
 *   after reset
 */
export function resetRuleEnvironment(env, newEntities = []) {
  env.cleanup();
  const clonedEntities = newEntities.map((e) => deepClone(e));
  const newEnv = env.initializeEnv(clonedEntities);
  env.entityManager = newEnv.entityManager;
  env.operationRegistry = newEnv.operationRegistry;
  env.operationInterpreter = newEnv.operationInterpreter;
  env.systemLogicInterpreter = newEnv.systemLogicInterpreter;
  env.actionIndex = newEnv.actionIndex;
}

/**
 * Helper function to create a properly formatted attempt_action event payload
 * that meets schema requirements and supports both legacy and multi-target formats.
 *
 * @param {object} params - Event parameters
 * @param {string} params.actorId - The acting entity ID
 * @param {string} params.actionId - The action being attempted
 * @param {string} [params.targetId] - Primary target for legacy format
 * @param {object} [params.targets] - Multi-target format targets
 * @param {string} [params.originalInput] - Original input (defaults to generated)
 * @returns {object} Properly formatted event payload
 */
export function createAttemptActionPayload({
  actorId,
  actionId,
  targetId = null,
  targets = null,
  originalInput = null,
}) {
  // Build the base payload with required fields
  const payload = {
    eventName: 'core:attempt_action',
    actorId,
    actionId,
    originalInput: originalInput || `${actionId} ${targetId || 'none'}`.trim(),
  };

  // Add target information based on what's provided
  if (targets) {
    // Multi-target format
    payload.targets = targets;
    // Set targetId as primary for backward compatibility
    if (targets.primary) {
      payload.targetId =
        typeof targets.primary === 'string'
          ? targets.primary
          : targets.primary.entityId;
    }
  } else if (targetId) {
    // Legacy single-target format
    payload.targetId = targetId;
  }

  return payload;
}

/**
 * Creates a complete test environment for system logic rule testing.
 *
 * @param {object} options - Configuration options
 * @param {Function} options.createHandlers - Function to create handlers with (entityManager, eventBus, logger) parameters
 * @param {Array<{id:string,components:object}>} options.entities - Initial entities
 * @param {Array<object>} options.rules - System rules to load
 * @param {Array<object>} [options.actions] - Action definitions to load
 * @param {object} [options.conditions] - Condition definitions to load
 * @param {object} [options.macros] - Macro definitions to load
 * @param {object} [options.logger] - Logger instance to use
 * @param {() => object} [options.createLogger] - Logger factory
 * @param {object} [options.dataRegistry] - Data registry instance to use
 * @param {() => object} [options.createDataRegistry] - Data registry factory
 * @param {object} [options.eventBus] - Event bus instance to use
 * @param {() => object} [options.createEventBus] - Event bus factory
 * @returns {object} Test environment with all components and cleanup function
 */
export function createRuleTestEnvironment(options) {
  const env = createBaseRuleEnvironment(options);
  env.reset = (newEntities = []) => {
    resetRuleEnvironment(env, newEntities);
  };

  // Add the helper function to the environment for easy access
  env.createAttemptActionPayload = createAttemptActionPayload;

  // Track dispatch count for debugging
  let dispatchCount = 0;
  
  // Add a convenience method for dispatching attempt_action events with validation
  env.dispatchAction = async (params) => {
    dispatchCount++;
    console.log(`[DISPATCH #${dispatchCount}] Starting dispatch:`, params);
    const payload = createAttemptActionPayload(params);

    // Validate action using ActionIndex before dispatch
    if (payload.actionId) {
      const actor = { id: payload.actorId };
      const isValid = env.validateAction(payload.actorId, payload.actionId);

      console.log(`[DISPATCH] Action validation for ${payload.actionId}: ${isValid}`);
      
      // Debug actor state for get_up_from_furniture validation
      if (payload.actionId === 'positioning:get_up_from_furniture') {
        const actorEntity = env.entityManager.getEntityInstance(payload.actorId);
        console.log(`[DISPATCH] Actor state for get_up validation:`, JSON.stringify(actorEntity, null, 2));
        
        // Try to resolve the target scope
        try {
          const scopeResult = env.unifiedScopeResolver.resolveSync('positioning:furniture_im_sitting_on', payload.actorId);
          console.log(`[DISPATCH] furniture_im_sitting_on scope resolved to:`, scopeResult);
          
          // Let's also manually check what entities have positioning:allows_sitting
          const allEntities = Array.from(env.entityManager.entities.values());
          const furnitureEntities = allEntities.filter(e => e.components['positioning:allows_sitting']);
          console.log(`[DISPATCH] All furniture entities:`, furnitureEntities.map(e => ({id: e.id, component: e.components['positioning:allows_sitting']})));
          
          // Check the specific furniture_id from actor's sitting_on component
          const actorSittingOn = actorEntity.components['positioning:sitting_on'];
          console.log(`[DISPATCH] Actor sitting_on component:`, actorSittingOn);
          
          if (actorSittingOn) {
            const targetFurniture = env.entityManager.getEntityInstance(actorSittingOn.furniture_id);
            console.log(`[DISPATCH] Target furniture (${actorSittingOn.furniture_id}):`, targetFurniture);
          }
          
        } catch (err) {
          console.log(`[DISPATCH] Error resolving furniture_im_sitting_on scope:`, err.message);
        }
      }
      if (!isValid) {
        console.log(`[DISPATCH] Action ${payload.actionId} FILTERED OUT by ActionIndex for actor ${payload.actorId}`);
        env.logger.debug(
          `Action ${payload.actionId} filtered out by ActionIndex for actor ${payload.actorId}`
        );
        // Return early - don't dispatch the event
        return true;
      }
      console.log(`[DISPATCH] Action ${payload.actionId} PASSED validation, proceeding with dispatch`);
    }

    // Dispatch the event
    console.log('[DISPATCH ACTION] Dispatching event:', 'core:attempt_action', 'Full payload:', JSON.stringify(payload, null, 2));
    
    // Log actor's current state before dispatch
    const actor = env.entityManager.getEntityInstance(payload.actorId);
    if (actor) {
      console.log('[DISPATCH ACTION] Actor state before dispatch:', JSON.stringify(actor, null, 2));
    }
    const result = await env.eventBus.dispatch('core:attempt_action', payload);
    
    // IMPORTANT: Give the SystemLogicInterpreter time to process the event
    // The interpreter listens to events asynchronously, so we need a small delay
    // to ensure rules are processed before the test continues
    await new Promise(resolve => setTimeout(resolve, 50)); // Increased delay to ensure processing
    
    console.log('[DISPATCH ACTION] Event dispatched, result:', result);
    return result;
  };

  // Add action validation helper
  env.validateAction = (actorId, actionId) => {
    // Check if entity exists
    const actor = env.entityManager.getEntityInstance(actorId);
    if (!actor) {
      return false; // Entity doesn't exist, action invalid
    }

    // Create proper actor entity object for ActionIndex
    const actorEntity = { id: actorId };
    const candidates = env.actionIndex.getCandidateActions(actorEntity);

    // Check if action is in candidates
    const action = candidates.find((action) => action.id === actionId);
    if (!action) {
      return false; // Action not in candidate list
    }

    // If action has a targets scope, validate that there are valid targets
    if (
      action.targets &&
      typeof action.targets === 'string' &&
      action.targets !== 'none'
    ) {
      // Create context for scope resolution
      const actorComponents = {};

      // Use getEntityInstance which returns the entity with all components
      const actorEntity = env.entityManager.getEntityInstance(actorId);
      if (actorEntity && actorEntity.components) {
        Object.assign(actorComponents, actorEntity.components);
      }

      const context = {
        actor: {
          id: actorId,
          components: actorComponents,
        },
      };

      // Use the scope resolver if available
      if (env.unifiedScopeResolver) {
        try {
          const result = env.unifiedScopeResolver.resolveSync(
            action.targets,
            context
          );
          if (!result.success || !result.value || result.value.size === 0) {
            env.logger.debug(
              `Action ${actionId} has no valid targets for scope ${action.targets}`
            );
            return false; // No valid targets
          }
        } catch (error) {
          env.logger.debug(
            `Failed to resolve scope ${action.targets} for action ${actionId}: ${error.message}`
          );
          return false;
        }
      } else {
        // Fallback: For simple tests without scope resolver, just check if targets is 'none' or 'self'
        if (action.targets !== 'none' && action.targets !== 'self') {
          env.logger.debug(
            `Warning: No scope resolver available to validate targets for action ${actionId}`
          );
          // For now, return true to maintain backward compatibility with existing tests
          return true;
        }
      }
    }

    return true;
  };

  // Add a method to get available actions (for debugging)
  env.getAvailableActions = (actorId) => {
    const actor = env.entityManager.getEntityInstance(actorId);
    if (!actor) {
      return [];
    }

    const actorEntity = { id: actorId };
    const candidates = env.actionIndex.getCandidateActions(actorEntity);

    // Filter by scope validation
    return candidates.filter((action) =>
      env.validateAction(actorId, action.id)
    );
  };

  return env;
}
