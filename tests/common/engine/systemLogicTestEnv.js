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
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import { ActionValidationContextBuilder } from '../../../src/actions/validation/actionValidationContextBuilder.js';
import { PrerequisiteEvaluationService } from '../../../src/actions/validation/prerequisiteEvaluationService.js';
import { ActionIndex } from '../../../src/actions/actionIndex.js';
import { createEntityContext } from '../../../src/logic/contextAssembler.js';
import { SimpleEntityManager } from '../entities/index.js';
import { createEntityManagerAdapter } from '../entities/entityManagerTestFactory.js';
import {
  createMockLogger,
  createCapturingEventBus,
} from '../mockFactories/index.js';
import { deepClone } from '../../../src/utils/cloneUtils.js';
import { expandMacros } from '../../../src/utils/macroUtils.js';
import { setupEntityCacheInvalidation } from '../../../src/scopeDsl/core/entityHelpers.js';
import IfHandler from '../../../src/logic/operationHandlers/ifHandler.js';
import ForEachHandler from '../../../src/logic/operationHandlers/forEachHandler.js';
import IfCoLocatedHandler from '../../../src/logic/operationHandlers/ifCoLocatedHandler.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';

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
 * @param {object} [options.scopes] - Scope definitions for scope resolution
 * @param {object} [options.lookups] - Lookup definitions for QUERY_LOOKUP operations
 * @param {boolean} [options.debugPrerequisites] - Enable debug mode for enhanced prerequisite error messages
 * @param {boolean} [options.useAdapterEntityManager] - Use TestEntityManagerAdapter for production API compatibility
 * @param {import('ajv').default|null} [options.schemaValidator] - Optional AJV instance for rule validation (SCHVALTESINT-003)
 * @param {boolean} [options.validateOnSetup] - Validate rules on setup when schemaValidator is provided
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
 *   initializeEnv: (entities: Array<{id:string,components:object}>) => any,
 *   validateRule: (ruleData: object) => void,
 *   hasValidation: () => boolean
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
  lookups = {},
  logger = null,
  createLogger = null,
  dataRegistry = null,
  createDataRegistry = null,
  eventBus = null,
  createEventBus = null,
  debugPrerequisites = false,
  useAdapterEntityManager = true,
  schemaValidator = null,
  validateOnSetup = true,
}) {
  // Create a debug logger that silences debug output for performance tests
  const debugLogger = {
    debug: jest.fn(),
    info: console.info, // Enable info logs for debugging
    warn: jest.fn(),
    error: jest.fn(),
  };

  const testLogger =
    logger ||
    (typeof createLogger === 'function' ? createLogger() : debugLogger);
  // Expand macros in rules before passing them to the interpreter
  const expandedRules = rules.map((rule) => {
    if (rule.actions) {
      const expandedRule = { ...rule };
      // Create a registry interface that expandMacros expects
      const macroRegistry = {
        get: (type, id) => {
          if (type === 'macros') {
            return macros[id];
          }
          return undefined;
        },
      };
      expandedRule.actions = expandMacros(
        rule.actions,
        macroRegistry,
        testLogger
      );
      return expandedRule;
    }
    return rule;
  });

  // Validate rules on setup if schema validator is provided (SCHVALTESINT-003)
  if (schemaValidator && validateOnSetup && rules.length > 0) {
    const ruleSchemaId = 'schema://living-narrative-engine/rule.schema.json';
    const ruleValidate = schemaValidator.getSchema(ruleSchemaId);
    if (ruleValidate) {
      for (const rule of rules) {
        const valid = ruleValidate(rule);
        if (!valid) {
          const errors = ruleValidate.errors || [];
          const errorDetails = errors
            .map((e) => `    ${e.instancePath || '/'}: ${e.message}`)
            .join('\n');
          throw new Error(
            `Schema validation failed for rule\n` +
              `  Rule ID: ${rule.rule_id || rule.id || 'unknown'}\n` +
              `  Schema: ${ruleSchemaId}\n` +
              `  Validation errors:\n${errorDetails}`
          );
        }
      }
    }
  }

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
          getComponentDefinition: jest.fn().mockReturnValue(null),
          get: jest.fn().mockImplementation((type, id) => {
            // Handle two-parameter calls: get(type, id)
            if (id !== undefined) {
              if (type === 'macros') {
                return macros[id] || undefined;
              }
              if (type === 'lookups') {
                return lookups[id] || undefined;
              }
              return undefined;
            }
            // Handle single-parameter calls: get(scopeName) for backward compatibility
            // Check if this is a scope name
            if (typeof type === 'string' && scopes[type]) {
              return scopes[type];
            }
            return undefined;
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

  // Types that appear as 'type' property values but are NOT operation types
  const NON_OPERATION_TYPES = new Set([
    'flat',
    'percentage',
    // Damage types from APPLY_DAMAGE operation schema
    'slashing',
    'piercing',
    'bludgeoning',
    'fire',
    'cold',
    'lightning',
    'poison',
    'acid',
    'psychic',
    'necrotic',
    'radiant',
    'force',
    'thunder',
  ]);

  function collectOperationTypes(candidate, accumulator) {
    if (!candidate) {
      return;
    }

    if (Array.isArray(candidate)) {
      candidate.forEach((item) => collectOperationTypes(item, accumulator));
      return;
    }

    if (typeof candidate !== 'object') {
      return;
    }

    if (
      typeof candidate.type === 'string' &&
      !NON_OPERATION_TYPES.has(candidate.type)
    ) {
      accumulator.add(candidate.type);
    }

    for (const value of Object.values(candidate)) {
      collectOperationTypes(value, accumulator);
    }
  }

  function validateOperationCoverage(operationRegistry, ruleset) {
    if (!ruleset || ruleset.length === 0) {
      return;
    }

    const missingByRule = [];

    for (const rule of ruleset) {
      const operations = new Set();
      collectOperationTypes(rule.actions || rule, operations);
      const missing = Array.from(operations).filter(
        (opType) => opType && !operationRegistry.hasHandler(opType)
      );

      if (missing.length > 0) {
        missingByRule.push({
          id: rule.rule_id || rule.id || 'unknown-rule',
          missing,
        });
      }
    }

    if (missingByRule.length > 0) {
      const missingOps = Array.from(
        new Set(missingByRule.flatMap((entry) => entry.missing))
      ).join(', ');
      const ruleDetails = missingByRule
        .map((entry) => `  - ${entry.id}: ${entry.missing.join(', ')}`)
        .join('\n');

      throw new Error(
        [
          'Preflight operation handler validation failed.',
          `Missing handlers: ${missingOps}.`,
          'Rules:',
          ruleDetails,
        ].join('\n')
      );
    }
  }

  /**
   * Initializes core engine components for the rule environment.
   *
   * @private
   * @param {Array<{id:string,components:object}>} entityList - Entities to load.
   * @returns {{
   *   entityManager: SimpleEntityManager|TestEntityManagerAdapter,
   *   operationRegistry: OperationRegistry,
   *   operationInterpreter: OperationInterpreter,
   *   systemLogicInterpreter: SystemLogicInterpreter
   * }} Initialized services.
   */
  function initializeEnv(entityList) {
    // Create entity manager with adapter by default for production API compatibility
    entityManager = useAdapterEntityManager
      ? createEntityManagerAdapter({
          logger: testLogger,
          initialEntities: entityList,
        })
      : new SimpleEntityManager(entityList); // Legacy fallback - takes array of entities
    operationRegistry = new OperationRegistry({ logger: testLogger });
    operationInterpreter = new OperationInterpreter({
      logger: testLogger,
      operationRegistry,
    });

    let handlers = createHandlers(
      entityManager,
      bus,
      testLogger,
      testDataRegistry
    );

    const registrationPlan = [];
    const pushHandlerToPlan = (type, handler, source) => {
      if (!handler || typeof handler.execute !== 'function') {
        throw new Error(
          `Handler for ${type} must be an object with an execute() method`
        );
      }

      registrationPlan.push({ type, handler, source });
    };

    for (const [type, handler] of Object.entries(handlers)) {
      pushHandlerToPlan(type, handler, 'factory');
    }

    // Register IF and FOR_EACH handlers after operationInterpreter is created
    // These handlers need operationInterpreter and jsonLogic, which creates a circular dependency
    // if they're created in the initial createHandlers call
    // Use lazy resolution to avoid circular dependency
    const ifHandler = new IfHandler({
      operationInterpreter: () => operationInterpreter,
      jsonLogic,
      logger: testLogger,
    });
    const forEachHandler = new ForEachHandler({
      operationInterpreter: () => operationInterpreter,
      jsonLogic,
      logger: testLogger,
    });

    pushHandlerToPlan('IF', ifHandler, 'flow-handler');
    pushHandlerToPlan('FOR_EACH', forEachHandler, 'flow-handler');

    // Create a safe event dispatcher wrapper for handlers that need it
    const safeEventDispatcher = {
      dispatch: (eventType, payload) => {
        bus.dispatch(eventType, payload);
        return Promise.resolve(true);
      },
    };

    // IF_CO_LOCATED also needs lazy resolution for operationInterpreter
    const ifCoLocatedHandler = new IfCoLocatedHandler({
      logger: testLogger,
      entityManager,
      operationInterpreter: () => operationInterpreter,
      safeEventDispatcher,
    });
    pushHandlerToPlan('IF_CO_LOCATED', ifCoLocatedHandler, 'flow-handler');

    const dedupedEntries = [];
    const duplicates = [];

    for (const entry of registrationPlan) {
      const existingIndex = dedupedEntries.findIndex(
        (candidate) => candidate.type === entry.type
      );

      if (existingIndex !== -1) {
        const previous = dedupedEntries[existingIndex];
        duplicates.push({
          type: entry.type,
          previousSource: previous.source,
          winnerSource: entry.source,
        });
        dedupedEntries[existingIndex] = entry;
      } else {
        dedupedEntries.push(entry);
      }
    }

    if (duplicates.length > 0) {
      const duplicateSummary = duplicates
        .map(
          ({ type, previousSource, winnerSource }) =>
            `${type} (${winnerSource} over ${previousSource})`
        )
        .join(', ');
      testLogger.warn(
        `Mod test handler registry: consolidated duplicate registrations: ${duplicateSummary}. Using the last declaration for each operation.`
      );
    }

    const resolvedHandlers = {};

    for (const entry of dedupedEntries) {
      operationRegistry.register(
        entry.type,
        entry.handler.execute.bind(entry.handler)
      );
      resolvedHandlers[entry.type] = entry.handler;
    }

    handlers = resolvedHandlers;

    validateOperationCoverage(operationRegistry, expandedRules);

    // Create the bodyGraphService mock that actually checks entity components
    const getDescendantPartIds = (rootId) => {
      const visited = new Set();
      const stack = rootId ? [rootId] : [];
      const descendants = new Set();

      while (stack.length > 0) {
        const currentId = stack.pop();
        if (!currentId || visited.has(currentId)) {
          continue;
        }

        visited.add(currentId);

        const partComponent = entityManager.getComponentData(
          currentId,
          'anatomy:part'
        );
        if (!partComponent) {
          continue;
        }

        descendants.add(currentId);

        const children = Array.isArray(partComponent.children)
          ? partComponent.children
          : [];
        for (const childId of children) {
          if (!visited.has(childId)) {
            stack.push(childId);
          }
        }
      }

      return descendants;
    };

    const mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn(
        (bodyComponent, componentId, propertyPath, expectedValue) => {
          if (!bodyComponent) {
            return { found: false };
          }

          const rootId = bodyComponent.root ?? bodyComponent.body?.root;
          if (!rootId) {
            return { found: false };
          }

          const descendantIds = getDescendantPartIds(rootId);

          for (const partId of descendantIds) {
            const component = entityManager.getComponentData(
              partId,
              componentId
            );

            if (!component) {
              continue;
            }

            const actualValue = propertyPath
              ? component[propertyPath]
              : component;
            if (actualValue === expectedValue) {
              return { found: true, partId };
            }
          }

          return { found: false };
        }
      ),
      buildAdjacencyCache: jest.fn(() => undefined),
      findPartsByType: jest.fn((rootId, partType) => {
        if (!rootId) {
          return [];
        }

        const descendantIds = getDescendantPartIds(rootId);
        const matches = [];

        for (const partId of descendantIds) {
          const partComponent = entityManager.getComponentData(
            partId,
            'anatomy:part'
          );
          if (partComponent?.subType === partType) {
            matches.push(partId);
          }
        }

        return matches;
      }),
      getAllParts: jest.fn((bodyComponentOrRoot) => {
        if (!bodyComponentOrRoot) {
          return [];
        }

        let rootId = null;
        if (typeof bodyComponentOrRoot === 'string') {
          rootId = bodyComponentOrRoot;
        } else {
          rootId =
            bodyComponentOrRoot.root ?? bodyComponentOrRoot.body?.root ?? null;
        }

        if (!rootId) {
          return [];
        }

        return Array.from(getDescendantPartIds(rootId));
      }),
      clearCache: jest.fn(),
    };

    // Create mock lightingStateService for JsonLogicCustomOperators
    const mockLightingStateService = {
      getLocationLightingState: jest.fn((locationId) => ({
        isLit: true,
        lightSources: [],
      })),
      isLocationLit: jest.fn((locationId) => true),
    };

    const jsonLogicCustomOperators = new JsonLogicCustomOperators({
      logger: testLogger,
      entityManager,
      bodyGraphService: mockBodyGraphService,
      lightingStateService: mockLightingStateService,
    });
    jsonLogicCustomOperators.registerOperators(jsonLogic);

    // Create and initialize ActionIndex
    const actionIndex = new ActionIndex({
      logger: testLogger,
      entityManager,
    });
    actionIndex.buildIndex(actions);

    // Create a simple scope resolver for testing
    const simpleScopeResolver = {
      resolveSync: (scopeName, context) => {
        // Handle the sitting:available_furniture scope
        if (scopeName === 'sitting:available_furniture') {
          const actorLocation =
            context.actor?.components?.['core:position']?.locationId;
          if (!actorLocation) {
            return { success: true, value: new Set() };
          }

          // Find all entities with sitting:allows_sitting
          // Note: SimpleEntityManager doesn't have getAllEntities, we need to iterate differently
          const allEntityIds = entityManager.getEntityIds();

          // Build entities array from IDs
          const allEntities = allEntityIds.map((id) => {
            const instance = entityManager.getEntityInstance(id);
            return instance || { id, components: {} };
          });
          const furnitureEntities = allEntities.filter((entity) => {
            const hasSittingComponent =
              entity.components?.['sitting:allows_sitting'];
            const furnitureLocation =
              entity.components?.['core:position']?.locationId;

            if (!hasSittingComponent || !furnitureLocation) {
              return false;
            }

            // Check if in same location
            if (furnitureLocation !== actorLocation) {
              return false;
            }

            // Check if has available spots
            const spots = hasSittingComponent.spots;
            if (!Array.isArray(spots)) {
              return false;
            }

            const hasAvailableSpots = spots.some((spot) => spot === null);
            return hasAvailableSpots;
          });

          const result = new Set(furnitureEntities.map((e) => e.id));
          return {
            success: true,
            value: result,
          };
        }

        // Handle the sitting:furniture_im_sitting_on and personal-space:furniture_actor_sitting_on scopes
        // These are equivalent - both find the furniture the actor is sitting on
        if (
          scopeName === 'sitting:furniture_im_sitting_on' ||
          scopeName === 'personal-space:furniture_actor_sitting_on'
        ) {
          // This scope should find furniture that the actor is currently sitting on
          // The scope definition is: entities(sitting:allows_sitting)[][{"==": [{"var": "entity.id"}, {"var": "actor.components.sitting-states:sitting_on.furniture_id"}]}]

          // Get actor
          const actor =
            context?.actor || entityManager.getEntityInstance(context);
          if (!actor) {
            return { success: true, value: new Set() };
          }

          // Get actor's sitting_on component
          const sittingOn = actor.components?.['sitting-states:sitting_on'];
          if (!sittingOn || !sittingOn.furniture_id) {
            return { success: true, value: new Set() };
          }

          // Check if this furniture exists and has sitting:allows_sitting component
          const targetFurniture = entityManager.getEntityInstance(
            sittingOn.furniture_id
          );
          if (
            !targetFurniture ||
            !targetFurniture.components?.['sitting:allows_sitting']
          ) {
            return { success: true, value: new Set() };
          }

          return { success: true, value: new Set([sittingOn.furniture_id]) };
        }

        // Handle the bending:available_surfaces scope
        if (scopeName === 'bending:available_surfaces') {
          // Extract actor ID from context (context might be an object with actor property or just the ID)
          const actorId = context?.actor?.id || context;

          // Get actor's position
          const actor = entityManager.getEntityInstance(actorId);
          const actorPosition = actor?.components?.['core:position'];
          if (!actorPosition || !actorPosition.locationId) {
            return { success: true, value: new Set() };
          }

          // Find all entities with bending:allows_bending_over in the same location
          const allEntities = Array.from(entityManager.entities);
          const availableSurfaces = allEntities.filter((entity) => {
            const hasBendingComponent =
              entity.components?.['bending:allows_bending_over'];
            const entityPosition = entity.components?.['core:position'];
            const sameLocation =
              entityPosition?.locationId === actorPosition.locationId;
            return hasBendingComponent && sameLocation;
          });

          const surfaceIds = availableSurfaces.map((surface) => surface.id);
          return { success: true, value: new Set(surfaceIds) };
        }

        // Handle the bending:surface_im_bending_over scope
        if (scopeName === 'bending:surface_im_bending_over') {
          // Extract actor ID from context
          const actorId = context?.actor?.id || context;

          // Get actor's bending_over component
          const actor = entityManager.getEntityInstance(actorId);
          const bendingOver = actor?.components?.['bending-states:bending_over'];

          if (!bendingOver || !bendingOver.surface_id) {
            return { success: true, value: new Set() };
          }

          return { success: true, value: new Set([bendingOver.surface_id]) };
        }

        // Handle the items:items_at_location scope
        if (scopeName === 'items:items_at_location') {
          // Extract actor ID from context
          const actorId = context?.actor?.id || context;

          // Get actor's position
          const actor = entityManager.getEntityInstance(actorId);
          const actorPosition = actor?.components?.['core:position'];
          if (!actorPosition || !actorPosition.locationId) {
            return { success: true, value: new Set() };
          }

          // Find all entities with items:item, items:portable, and core:position at same location
          const allEntityIds = entityManager.getEntityIds();
          const allEntities = allEntityIds.map((id) => {
            const instance = entityManager.getEntityInstance(id);
            return instance || { id, components: {} };
          });

          const itemsAtLocation = allEntities.filter((entity) => {
            const hasItemComponent = entity.components?.['items:item'];
            const hasPortableComponent = entity.components?.['items:portable'];
            const entityPosition = entity.components?.['core:position'];

            if (!hasItemComponent || !hasPortableComponent || !entityPosition) {
              return false;
            }

            // Check if in same location as actor
            return entityPosition.locationId === actorPosition.locationId;
          });

          const itemIds = itemsAtLocation.map((item) => item.id);
          return { success: true, value: new Set(itemIds) };
        }

        // Handle the items:non_portable_items_at_location scope
        if (scopeName === 'items:non_portable_items_at_location') {
          // Extract actor ID from context
          const actorId = context?.actor?.id || context;

          // Get actor's position
          const actor = entityManager.getEntityInstance(actorId);
          const actorPosition = actor?.components?.['core:position'];
          if (!actorPosition || !actorPosition.locationId) {
            return { success: true, value: new Set() };
          }

          // Find all entities with items:item (but NOT items:portable) at same location
          const allEntityIds = entityManager.getEntityIds();
          const allEntities = allEntityIds.map((id) => {
            const instance = entityManager.getEntityInstance(id);
            return instance || { id, components: {} };
          });

          const nonPortableItemsAtLocation = allEntities.filter((entity) => {
            const hasItemComponent = entity.components?.['items:item'];
            const hasPortableComponent = entity.components?.['items:portable'];
            const entityPosition = entity.components?.['core:position'];

            // Must have items:item component
            if (!hasItemComponent || !entityPosition) {
              return false;
            }

            // Must NOT have items:portable component
            if (hasPortableComponent) {
              return false;
            }

            // Check if in same location as actor
            return entityPosition.locationId === actorPosition.locationId;
          });

          const itemIds = nonPortableItemsAtLocation.map((item) => item.id);
          return { success: true, value: new Set(itemIds) };
        }

        // Handle the core:actors_in_location scope (same as personal-space:close_actors)
        if (
          scopeName === 'core:actors_in_location' ||
          scopeName === 'personal-space:close_actors'
        ) {
          // Extract actor ID from context
          const actorId = context?.actor?.id || context;

          // Get actor's position
          const actor = entityManager.getEntityInstance(actorId);
          const actorPosition = actor?.components?.['core:position'];
          if (!actorPosition || !actorPosition.locationId) {
            return { success: true, value: new Set() };
          }

          // Find all other actors (entities with core:actor component) in the same location
          const allEntityIds = entityManager.getEntityIds();
          const allEntities = allEntityIds.map((id) => {
            const instance = entityManager.getEntityInstance(id);
            return instance || { id, components: {} };
          });

          const closeActors = allEntities.filter((entity) => {
            // Skip the actor itself
            if (entity.id === actorId) {
              return false;
            }

            const hasActorComponent = entity.components?.['core:actor'];
            const entityPosition = entity.components?.['core:position'];

            if (!hasActorComponent || !entityPosition) {
              return false;
            }

            // Check if in same location as actor
            return entityPosition.locationId === actorPosition.locationId;
          });

          const actorIds = closeActors.map((a) => a.id);
          return { success: true, value: new Set(actorIds) };
        }

        // Handle the items:actor_inventory_items scope
        if (scopeName === 'items:actor_inventory_items') {
          // Extract actor ID from context
          const actorId = context?.actor?.id || context;

          // Get actor's inventory
          const actor = entityManager.getEntityInstance(actorId);
          const inventory = actor?.components?.['items:inventory'];
          if (!inventory || !Array.isArray(inventory.items)) {
            return { success: true, value: new Set() };
          }

          // Normalize mixed inventory formats (string IDs, {id}, or {itemId})
          const normalizedItemIds = inventory.items
            .map((entry) => {
              if (typeof entry === 'string') {
                return entry;
              }

              if (entry && typeof entry === 'object') {
                if (typeof entry.itemId === 'string' && entry.itemId.trim()) {
                  return entry.itemId;
                }

                if (typeof entry.id === 'string' && entry.id.trim()) {
                  return entry.id;
                }
              }

              return null;
            })
            .filter((value) => typeof value === 'string' && value.length > 0);

          return { success: true, value: new Set(normalizedItemIds) };
        }

        // Handle the items:examinable_items scope (union of inventory + location items)
        if (scopeName === 'items:examinable_items') {
          // Get items from inventory
          const inventoryResult = simpleScopeResolver.resolveSync(
            'items:actor_inventory_items',
            context
          );
          const inventoryItems = inventoryResult.success
            ? inventoryResult.value
            : new Set();

          // Get items at location
          const locationResult = simpleScopeResolver.resolveSync(
            'items:items_at_location',
            context
          );
          const locationItems = locationResult.success
            ? locationResult.value
            : new Set();

          // Union both sets
          const allItems = new Set([...inventoryItems, ...locationItems]);
          return { success: true, value: allItems };
        }

        // Handle the containers-core:open_containers_at_location scope
        if (scopeName === 'containers-core:open_containers_at_location') {
          const actorId = context?.actor?.id || context;

          const actor = entityManager.getEntityInstance(actorId);
          const actorPosition = actor?.components?.['core:position'];
          if (!actorPosition || !actorPosition.locationId) {
            return { success: true, value: new Set() };
          }

          const allEntityIds = entityManager.getEntityIds();
          const allEntities = allEntityIds.map((id) => {
            const instance = entityManager.getEntityInstance(id);
            return instance || { id, components: {} };
          });

          const openContainers = allEntities.filter((entity) => {
            const containerComponent = entity.components?.['containers-core:container'];
            const entityPosition = entity.components?.['core:position'];

            if (!containerComponent || !entityPosition) {
              return false;
            }

            if (entityPosition.locationId !== actorPosition.locationId) {
              return false;
            }

            return containerComponent.isOpen === true;
          });

          const containerIds = openContainers.map((container) => container.id);
          return { success: true, value: new Set(containerIds) };
        }

        // Handle the containers-core:openable_containers_at_location scope
        if (scopeName === 'containers-core:openable_containers_at_location') {
          // Extract actor ID from context
          const actorId = context?.actor?.id || context;

          // Get actor's position
          const actor = entityManager.getEntityInstance(actorId);
          const actorPosition = actor?.components?.['core:position'];
          if (!actorPosition || !actorPosition.locationId) {
            return { success: true, value: new Set() };
          }

          // Find all entities with containers-core:container at same location that are open
          const allEntityIds = entityManager.getEntityIds();
          const allEntities = allEntityIds.map((id) => {
            const instance = entityManager.getEntityInstance(id);
            return instance || { id, components: {} };
          });

          const containersAtLocation = allEntities.filter((entity) => {
            const hasContainerComponent =
              entity.components?.['containers-core:container'];
            const entityPosition = entity.components?.['core:position'];

            if (!hasContainerComponent || !entityPosition) {
              return false;
            }

            // Check if in same location as actor
            if (entityPosition.locationId !== actorPosition.locationId) {
              return false;
            }

            // Check if container is closed (not open)
            return hasContainerComponent.isOpen === false;
          });

          const containerIds = containersAtLocation.map(
            (container) => container.id
          );
          return { success: true, value: new Set(containerIds) };
        }

        // Handle the containers-core:container_contents scope
        if (scopeName === 'containers-core:container_contents') {
          // This scope uses contextFrom: primary, so the container should be in context
          const containerId = context?.primary?.id || context?.target?.id;

          if (!containerId) {
            return { success: true, value: new Set() };
          }

          // Get container entity and its contents
          const container = entityManager.getEntityInstance(containerId);
          const containerComponent = container?.components?.['containers-core:container'];

          if (
            !containerComponent ||
            !Array.isArray(containerComponent.contents)
          ) {
            return { success: true, value: new Set() };
          }

          // Return the items in the container's contents array
          return { success: true, value: new Set(containerComponent.contents) };
        }

        // Handle the personal-space:closest_leftmost_occupant scope
        if (scopeName === 'personal-space:closest_leftmost_occupant') {
          // This scope finds the closest occupant to the left of the actor on furniture
          // It requires the furniture entity in context.target (from contextFrom: primary)
          const furnitureId = context?.target?.id;
          const actorId = context?.actor?.id;

          if (!furnitureId || !actorId) {
            return { success: true, value: new Set() };
          }

          // Get furniture entity and its sitting component
          const furniture = entityManager.getEntityInstance(furnitureId);
          const allowsSitting =
            furniture?.components?.['sitting:allows_sitting'];
          if (!allowsSitting || !Array.isArray(allowsSitting.spots)) {
            return { success: true, value: new Set() };
          }

          const spots = allowsSitting.spots;

          // Get actor's sitting position
          const actor = entityManager.getEntityInstance(actorId);
          const actorSitting = actor?.components?.['sitting-states:sitting_on'];
          if (!actorSitting || actorSitting.furniture_id !== furnitureId) {
            return { success: true, value: new Set() };
          }

          const actorIndex = actorSitting.spot_index;

          // Check if spot immediately to the left of actor is empty (required for scooting)
          if (actorIndex <= 0 || spots[actorIndex - 1] !== null) {
            return { success: true, value: new Set() };
          }

          // Find closest occupant to the left of actor
          for (let i = actorIndex - 1; i >= 0; i--) {
            if (spots[i] !== null) {
              const occupantId = spots[i];
              // Verify the occupant exists and has correct component data
              const occupant = entityManager.getEntityInstance(occupantId);
              const occupantSitting =
                occupant?.components?.['sitting-states:sitting_on'];
              if (
                occupantSitting &&
                occupantSitting.furniture_id === furnitureId &&
                occupantSitting.spot_index === i
              ) {
                return { success: true, value: new Set([occupantId]) };
              }
            }
          }

          // No occupant found to the left
          return { success: true, value: new Set() };
        }

        if (scopeName === 'personal-space:closest_rightmost_occupant') {
          const furnitureId = context?.target?.id;
          const actorId = context?.actor?.id;

          if (!furnitureId || !actorId) {
            return { success: true, value: new Set() };
          }

          const furniture = entityManager.getEntityInstance(furnitureId);
          const allowsSitting =
            furniture?.components?.['sitting:allows_sitting'];
          if (!allowsSitting || !Array.isArray(allowsSitting.spots)) {
            return { success: true, value: new Set() };
          }

          const spots = allowsSitting.spots;
          const actor = entityManager.getEntityInstance(actorId);
          const actorSitting = actor?.components?.['sitting-states:sitting_on'];
          if (!actorSitting || actorSitting.furniture_id !== furnitureId) {
            return { success: true, value: new Set() };
          }

          const actorIndex = actorSitting.spot_index;

          if (
            typeof actorIndex !== 'number' ||
            actorIndex >= spots.length - 1 ||
            spots[actorIndex + 1] !== null
          ) {
            return { success: true, value: new Set() };
          }

          for (let i = actorIndex + 1; i < spots.length; i++) {
            if (spots[i] !== null) {
              const occupantId = spots[i];
              const occupant = entityManager.getEntityInstance(occupantId);
              const occupantSitting =
                occupant?.components?.['sitting-states:sitting_on'];
              if (
                occupantSitting &&
                occupantSitting.furniture_id === furnitureId &&
                occupantSitting.spot_index === i
              ) {
                return { success: true, value: new Set([occupantId]) };
              }
            }
          }
          return { success: true, value: new Set() };
        }

        // Handle the personal-space:actors_sitting_with_space_to_right scope
        if (scopeName === 'personal-space:actors_sitting_with_space_to_right') {
          // Get target furniture from context
          const targetId = context?.target?.id;
          if (!targetId) {
            return { success: true, value: new Set() };
          }

          // Get furniture entity and its sitting component
          const furniture = entityManager.getEntityInstance(targetId);
          const allowsSitting =
            furniture?.components?.['sitting:allows_sitting'];
          if (!allowsSitting || !Array.isArray(allowsSitting.spots)) {
            return { success: true, value: new Set() };
          }

          const spots = allowsSitting.spots;

          // Find all actors sitting on this furniture with at least 2 empty spots to their right
          const allEntityIds = entityManager.getEntityIds();
          const allEntities = allEntityIds.map((id) => {
            const instance = entityManager.getEntityInstance(id);
            return instance || { id, components: {} };
          });

          // Find all occupied spots and their indices
          const occupiedIndices = [];
          for (let i = 0; i < spots.length; i++) {
            if (spots[i] !== null) {
              occupiedIndices.push(i);
            }
          }

          // Find the rightmost occupied index
          const rightmostOccupiedIndex =
            occupiedIndices.length > 0 ? Math.max(...occupiedIndices) : -1;

          // Filter for actors sitting on this furniture who meet all criteria
          const validActors = allEntities.filter((entity) => {
            // Must have core:actor component
            if (!entity.components?.['core:actor']) {
              return false;
            }

            // Must be sitting on this furniture
            const sittingOn = entity.components?.['sitting-states:sitting_on'];
            if (!sittingOn || sittingOn.furniture_id !== targetId) {
              return false;
            }

            const spotIndex = sittingOn.spot_index;

            // Must actually be in the spot they claim (data integrity check)
            if (spots[spotIndex] !== entity.id) {
              return false;
            }

            // Must have at least 2 spots to the right
            if (spotIndex + 2 >= spots.length) {
              return false;
            }

            // Both spots to the right must be empty
            if (
              spots[spotIndex + 1] !== null ||
              spots[spotIndex + 2] !== null
            ) {
              return false;
            }

            // Must be the rightmost occupied spot (highest index with occupant)
            if (spotIndex !== rightmostOccupiedIndex) {
              return false;
            }

            return true;
          });

          const actorIds = validActors.map((actor) => actor.id);
          return { success: true, value: new Set(actorIds) };
        }

        // Handle the music:instrument_actor_is_playing scope
        if (scopeName === 'music:instrument_actor_is_playing') {
          // Get actor from context
          const actor =
            context?.actor || entityManager.getEntityInstance(context);
          if (!actor) {
            return { success: true, value: new Set() };
          }

          // Get actor's playing_music component
          const playingMusic = actor.components?.['music:playing_music'];
          if (!playingMusic || !playingMusic.playing_on) {
            return { success: true, value: new Set() };
          }

          // Check if the instrument exists and has music:is_instrument component
          const instrument = entityManager.getEntityInstance(
            playingMusic.playing_on
          );
          if (!instrument || !instrument.components?.['music:is_instrument']) {
            return { success: true, value: new Set() };
          }

          return { success: true, value: new Set([playingMusic.playing_on]) };
        }

        // Handle the movement:dimensional_portals scope
        if (scopeName === 'movement:dimensional_portals') {
          // Get actor's location
          const actorId = context?.actor?.id || context;
          const actor = entityManager.getEntityInstance(actorId);
          const actorPosition = actor?.components?.['core:position'];

          if (!actorPosition || !actorPosition.locationId) {
            return { success: true, value: new Set() };
          }

          // Get location entity
          const location = entityManager.getEntityInstance(
            actorPosition.locationId
          );
          const exits = location?.components?.['locations:exits'];

          if (!Array.isArray(exits)) {
            return { success: true, value: new Set() };
          }

          // Filter exits that have a blocker with blockers:is_dimensional_portal component
          const dimensionalPortals = exits
            .filter((exit) => {
              if (!exit.blocker) {
                return false;
              }

              const blocker = entityManager.getEntityInstance(exit.blocker);
              return (
                blocker?.components?.['blockers:is_dimensional_portal'] !==
                undefined
              );
            })
            .map((exit) => exit.target)
            .filter(
              (target) => typeof target === 'string' && target.length > 0
            );

          return { success: true, value: new Set(dimensionalPortals) };
        }

        // Handle other scopes or return empty set
        if (scopeName === 'none' || scopeName === 'self') {
          return { success: true, value: new Set([scopeName]) };
        }

        // Check if scope is loaded from file in scopes object
        if (scopes && scopes[scopeName]) {
          // Use scope engine to evaluate the loaded scope
          const scopeEngine = new ScopeEngine();

          try {
            // Get actor entity from context
            const actorId = context?.actor?.id || context;
            const actorEntity = entityManager.getEntityInstance(actorId);

            if (!actorEntity) {
              return { success: true, value: new Set() };
            }

            // Create runtime context with target/targets from context if available
            const runtimeCtx = {
              entityManager,
              logger: testLogger,
              jsonLogicEval: jsonLogic,
              target: context?.target,
              targets: context?.targets,
            };

            // Resolve the scope using the engine
            const result = scopeEngine.resolve(
              scopes[scopeName].ast,
              actorEntity,
              runtimeCtx
            );

            return {
              success: true,
              value:
                result instanceof Set
                  ? result
                  : new Set(Array.isArray(result) ? result : [result]),
            };
          } catch (error) {
            testLogger.warn(
              `Failed to evaluate scope ${scopeName}: ${error.message}`
            );
            return { success: true, value: new Set() };
          }
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

    interpreter.initialize();

    return {
      entityManager,
      operationRegistry,
      operationInterpreter,
      systemLogicInterpreter: interpreter,
      bodyGraphService: mockBodyGraphService,
      actionIndex,
      handlers,
      unifiedScopeResolver: simpleScopeResolver,
    };
  }

  const init = initializeEnv(entities);

  const actionValidationContextBuilder = new ActionValidationContextBuilder({
    entityManager: init.entityManager,
    logger: testLogger,
  });

  const prerequisiteService = new PrerequisiteEvaluationService({
    logger: testLogger,
    jsonLogicEvaluationService: jsonLogic,
    actionValidationContextBuilder,
    gameDataRepository: testDataRegistry,
    entityManager: init.entityManager,
    debugMode: debugPrerequisites,
  });

  // Setup entity cache invalidation to match production behavior
  // This ensures the entity cache is automatically cleared when components are added/removed
  setupEntityCacheInvalidation(bus);

  return {
    eventBus: bus,
    events: bus.events,
    operationRegistry: init.operationRegistry,
    operationInterpreter: init.operationInterpreter,
    jsonLogic,
    systemLogicInterpreter: init.systemLogicInterpreter,
    // Alias for backward compatibility with tests
    systemLogicOrchestrator: init.systemLogicInterpreter,
    // Expose mock body graph service so custom scope resolvers can use it
    bodyGraphService: init.bodyGraphService,
    entityManager: init.entityManager,
    actionIndex: init.actionIndex,
    handlers: init.handlers,
    unifiedScopeResolver: init.unifiedScopeResolver,
    logger: testLogger,
    dataRegistry: testDataRegistry,
    prerequisiteService,
    createHandlers,
    cleanup: () => {
      interpreter.shutdown();
    },
    initializeEnv,

    /**
     * Validates a single rule against the rule schema.
     * Requires schemaValidator to be provided during environment creation.
     *
     * @param {object} ruleData - Rule to validate
     * @throws {Error} If validator not provided or validation fails
     */
    validateRule(ruleData) {
      if (!schemaValidator) {
        throw new Error('Schema validator not provided to test environment');
      }
      const ruleSchemaId = 'schema://living-narrative-engine/rule.schema.json';
      const ruleValidate = schemaValidator.getSchema(ruleSchemaId);
      if (!ruleValidate) {
        throw new Error(`Rule schema not found: ${ruleSchemaId}`);
      }
      const valid = ruleValidate(ruleData);
      if (!valid) {
        const errors = ruleValidate.errors || [];
        const errorDetails = errors
          .map((e) => `    ${e.instancePath || '/'}: ${e.message}`)
          .join('\n');
        throw new Error(
          `Schema validation failed for rule\n` +
            `  Rule ID: ${ruleData.rule_id || ruleData.id || 'unknown'}\n` +
            `  Schema: ${ruleSchemaId}\n` +
            `  Validation errors:\n${errorDetails}`
        );
      }
    },

    /**
     * Checks if schema validation is available.
     *
     * @returns {boolean} True if schemaValidator was provided
     */
    hasValidation() {
      return schemaValidator !== null;
    },
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
  // NOTE: Do NOT update unifiedScopeResolver here - it has custom scope overrides
  // that must persist across resets. The overridden resolveSync method uses a getter
  // to dynamically access testEnv.entityManager, so it will use the new entity manager.

  // Clear the event bus events array if it has a _clearHandlers method
  if (env.eventBus && typeof env.eventBus._clearHandlers === 'function') {
    // Only clear the events, not the handlers themselves since we want to keep the SystemLogicInterpreter subscribed
    if (env.eventBus.events && Array.isArray(env.eventBus.events)) {
      env.eventBus.events.length = 0;
    }
  }

  // Update the events reference to the event bus's events array
  env.events = env.eventBus.events;
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

  // Add a convenience method for dispatching attempt_action events with validation
  env.dispatchAction = async (params) => {
    const payload = createAttemptActionPayload(params);

    // Validate action using ActionIndex before dispatch
    if (payload.actionId) {
      const isValid = env.validateAction(payload.actorId, payload.actionId);

      if (!isValid) {
        env.logger.debug(
          `Action ${payload.actionId} filtered out by ActionIndex for actor ${payload.actorId}`
        );
        // Return early - don't dispatch the event
        return true;
      }
    }

    // Dispatch the event
    const result = await env.eventBus.dispatch('core:attempt_action', payload);

    // IMPORTANT: Give the SystemLogicInterpreter time to process the event
    // The interpreter listens to events asynchronously, so we need a small delay
    // to ensure rules are processed before the test continues
    await new Promise((resolve) => setTimeout(resolve, 10)); // Reduced from 100ms to 10ms for performance

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

    // If action has target scopes, validate that there are valid targets for all of them
    // Check primary, secondary, and tertiary target scopes
    const targetDefinitions = (() => {
      if (!action.targets) {
        return [];
      }

      if (typeof action.targets === 'string') {
        return [{ key: 'primary', definition: { scope: action.targets } }];
      }

      if (typeof action.targets !== 'object') {
        return [];
      }

      const targetEntries = Object.entries(action.targets).reduce(
        (acc, [key, value]) => {
          if (value && typeof value === 'object') {
            acc[key] = value;
          }
          return acc;
        },
        {}
      );

      const orderedKeys = [];
      const remainingKeys = new Set(Object.keys(targetEntries));

      while (remainingKeys.size > 0) {
        let progress = false;

        for (const key of Array.from(remainingKeys)) {
          const def = targetEntries[key] || {};
          // Check if contextFrom exists before accessing - only secondary/tertiary targets have it
          const dependency = 'contextFrom' in def ? def.contextFrom : undefined;

          if (
            !dependency ||
            orderedKeys.includes(dependency) ||
            !remainingKeys.has(dependency)
          ) {
            orderedKeys.push(key);
            remainingKeys.delete(key);
            progress = true;
          }
        }

        if (!progress) {
          // Fallback: break potential cycles by appending the rest in insertion order
          for (const key of remainingKeys) {
            orderedKeys.push(key);
          }
          break;
        }
      }

      return orderedKeys.map((key) => ({
        key,
        definition: targetEntries[key] || {},
      }));
    })();

    if (targetDefinitions.length === 0) {
      return true;
    }

    if (!env.unifiedScopeResolver) {
      env.logger.debug(
        `Warning: No scope resolver available to validate targets for action ${actionId}`
      );
      return true;
    }

    const actorInstance = env.entityManager.getEntityInstance(actorId);
    const actorComponents = actorInstance?.getAllComponents
      ? actorInstance.getAllComponents()
      : actorInstance?.components || {};
    const actorContext = {
      id: actorId,
      components: actorComponents,
    };

    const buildContextForTarget = (resolvedTargets, targetKey, targetDef) => {
      const context = {
        actor: actorContext,
        actorEntity: actorContext, // Add actorEntity for ScopeEngine compatibility
        targets: {},
      };

      const actorPosition = actorComponents['core:position'];
      if (actorPosition?.locationId) {
        context.location = { id: actorPosition.locationId };
        context.actorLocation = actorPosition.locationId;
      }

      for (const [resolvedKey, resolvedValue] of Object.entries(
        resolvedTargets
      )) {
        if (!resolvedValue) {
          continue;
        }

        context[resolvedKey] = resolvedValue;
        context.targets[resolvedKey] = [resolvedValue];
      }

      if (resolvedTargets.primary) {
        context.primary = resolvedTargets.primary;
      }
      if (resolvedTargets.secondary) {
        context.secondary = resolvedTargets.secondary;
      }
      if (resolvedTargets.tertiary) {
        context.tertiary = resolvedTargets.tertiary;
      }

      // Check if contextFrom exists before accessing - only secondary/tertiary targets have it
      if (targetDef && 'contextFrom' in targetDef && targetDef.contextFrom) {
        const referencedTarget = resolvedTargets[targetDef.contextFrom];
        if (referencedTarget) {
          context[targetDef.contextFrom] = referencedTarget;
          context.target = referencedTarget;
        }
      } else if (!context.target && resolvedTargets.primary) {
        context.target = resolvedTargets.primary;
      }

      return context;
    };

    const buildPrerequisiteContextOverride = (resolvedTargets, actorId) => {
      // For actions with no targets (targets: "none"), we still need to create
      // a context override with the actor for prerequisite evaluation
      const hasTargets =
        resolvedTargets && Object.keys(resolvedTargets).length > 0;

      const override = { targets: {} };

      if (hasTargets) {
        for (const [targetKey, resolvedTarget] of Object.entries(
          resolvedTargets
        )) {
          if (!resolvedTarget || !resolvedTarget.id) {
            continue;
          }

          const entityContext = createEntityContext(
            resolvedTarget.id,
            env.entityManager,
            env.logger
          );

          override[targetKey] = entityContext;
          override.targets[targetKey] = [entityContext];

          if (targetKey === 'primary') {
            override.primary = entityContext;
          }

          if (!override.target) {
            override.target = entityContext;
          }
        }

        if (!override.target) {
          const firstContext = Object.values(override).find(
            (value) =>
              value &&
              typeof value === 'object' &&
              'id' in value &&
              'components' in value
          );

          if (firstContext) {
            override.target = firstContext;
          }
        }
      }

      // Always add actor context if actorId is provided
      if (actorId) {
        const actorOverride = createResolvedTarget(actorId);
        if (actorOverride) {
          override.actor = actorOverride;
        }
      }

      // Return override if we have actor context, even if no targets
      if (override.actor || hasTargets) {
        return override;
      }

      return null;
    };

    const createResolvedTarget = (entityId) => {
      if (!entityId) {
        return null;
      }

      const entityInstance = env.entityManager.getEntityInstance(entityId);
      const components = entityInstance?.getAllComponents
        ? entityInstance.getAllComponents()
        : entityInstance?.components || {};

      return {
        id: entityId,
        components,
      };
    };

    let pendingAssignments = [
      {
        resolvedTargets: {},
      },
    ];

    for (const { key, definition } of targetDefinitions) {
      const scopeName = definition?.scope;

      if (!scopeName || scopeName === 'none') {
        continue;
      }

      if (scopeName === 'self') {
        const selfTarget = createResolvedTarget(actorId);
        pendingAssignments = pendingAssignments.map(({ resolvedTargets }) => ({
          resolvedTargets: {
            ...resolvedTargets,
            [key]: selfTarget,
          },
        }));
        continue;
      }

      const nextAssignments = [];

      for (const { resolvedTargets } of pendingAssignments) {
        const resolutionContext = buildContextForTarget(
          resolvedTargets,
          key,
          definition
        );

        let result;
        try {
          result = env.unifiedScopeResolver.resolveSync(
            scopeName,
            resolutionContext
          );
        } catch (error) {
          env.logger.debug(
            `Failed to resolve ${key} scope ${scopeName} for action ${actionId}: ${error.message}`
          );
          continue;
        }

        if (!result?.success || !result.value || result.value.size === 0) {
          env.logger.debug(
            `Action ${actionId} has no valid ${key} targets for scope ${scopeName}`
          );
          continue;
        }

        for (const entityId of result.value) {
          const resolvedTarget = createResolvedTarget(entityId);
          if (!resolvedTarget) {
            continue;
          }

          nextAssignments.push({
            resolvedTargets: {
              ...resolvedTargets,
              [key]: resolvedTarget,
            },
          });
        }
      }

      if (nextAssignments.length === 0) {
        return false;
      }

      pendingAssignments = nextAssignments;
    }

    const filterAssignmentsByComponentRules = (assignments) => {
      if (!assignments || assignments.length === 0) {
        return assignments;
      }

      const applyTargetFilters = ({ resolvedTargets }) => {
        for (const [targetKey, target] of Object.entries(resolvedTargets)) {
          const targetComponents = target?.components || {};

          if (action.required_components) {
            const requiredComponents = action.required_components[targetKey];
            if (
              Array.isArray(requiredComponents) &&
              requiredComponents.length > 0
            ) {
              const missingComponent = requiredComponents.find(
                (componentId) => !targetComponents[componentId]
              );

              if (missingComponent) {
                env.logger.debug(
                  `Action ${actionId}: ${targetKey} target ${target.id} missing required component ${missingComponent}`
                );
                return false;
              }
            }
          }

          if (action.forbidden_components) {
            const forbiddenComponents = action.forbidden_components[targetKey];
            if (
              Array.isArray(forbiddenComponents) &&
              forbiddenComponents.length > 0
            ) {
              const violatingComponent = forbiddenComponents.find(
                (componentId) => targetComponents[componentId]
              );

              if (violatingComponent) {
                env.logger.debug(
                  `Action ${actionId}: ${targetKey} target ${target.id} has forbidden component ${violatingComponent}`
                );
                return false;
              }
            }
          }
        }

        return true;
      };

      return assignments.filter(applyTargetFilters);
    };

    // Validate required and forbidden components for all resolved targets
    const filteredAssignments =
      filterAssignmentsByComponentRules(pendingAssignments);
    if (!filteredAssignments || filteredAssignments.length === 0) {
      return false;
    }

    pendingAssignments = filteredAssignments;

    if (pendingAssignments.length === 0) {
      return false;
    }

    if (
      Array.isArray(action.prerequisites) &&
      action.prerequisites.length > 0
    ) {
      try {
        const actorEntity = env.entityManager.getEntityInstance(actorId);
        if (!actorEntity) {
          return false;
        }

        const assignmentsPassingPrereqs = [];

        for (const assignment of pendingAssignments) {
          const contextOverride = buildPrerequisiteContextOverride(
            assignment.resolvedTargets,
            actorId
          );

          if (!contextOverride) {
            env.logger.debug(
              `Action ${actionId}: No context override created for prerequisite evaluation`
            );
            continue;
          }

          const actorOverride = createResolvedTarget(actorId);
          const effectiveOverride = actorOverride
            ? { ...contextOverride, actor: actorOverride }
            : contextOverride;

          const passed = env.prerequisiteService.evaluate(
            action.prerequisites,
            action,
            actorEntity,
            null,
            { contextOverride: effectiveOverride }
          );

          if (passed) {
            assignmentsPassingPrereqs.push(assignment);
          }
        }

        if (assignmentsPassingPrereqs.length === 0) {
          env.logger.debug(
            `Action ${actionId}: No target assignments passed prerequisite evaluation for actor ${actorId}`
          );
          return false;
        }

        pendingAssignments = assignmentsPassingPrereqs;
      } catch (error) {
        env.logger.debug(
          `Action ${actionId}: Prerequisite evaluation error for actor ${actorId}: ${error.message}`
        );
        return false;
      }
    }

    return true;
  };

  // Add a method to get available actions with scope validation
  // Changed to validate scopes during discovery to match expected behavior
  env.getAvailableActions = (actorId) => {
    const actor = env.entityManager.getEntityInstance(actorId);
    if (!actor) {
      return [];
    }

    const actorEntity = { id: actorId };
    const candidates = env.actionIndex.getCandidateActions(actorEntity);

    // Filter candidates by scope validation
    return candidates.filter((action) =>
      env.validateAction(actorId, action.id)
    );
  };

  return env;
}
