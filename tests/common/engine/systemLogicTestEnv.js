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
import {
  createMockLogger,
  createCapturingEventBus,
} from '../mockFactories/index.js';
import { deepClone } from '../../../src/utils/cloneUtils.js';
import { expandMacros } from '../../../src/utils/macroUtils.js';
import { setupEntityCacheInvalidation } from '../../../src/scopeDsl/core/entityHelpers.js';
import IfHandler from '../../../src/logic/operationHandlers/ifHandler.js';
import ForEachHandler from '../../../src/logic/operationHandlers/forEachHandler.js';

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
  lookups = {},
  logger = null,
  createLogger = null,
  dataRegistry = null,
  createDataRegistry = null,
  eventBus = null,
  createEventBus = null,
}) {
  // Create a debug logger that silences debug output for performance tests
  const debugLogger = {
    debug: jest.fn(),
    info: jest.fn(),
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
            if (type === 'macros') {
              return macros[id] || undefined;
            }
            if (type === 'lookups') {
              return lookups[id] || undefined;
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
    const handlers = createHandlers(entityManager, bus, testLogger, testDataRegistry);
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

    operationRegistry.register('IF', ifHandler.execute.bind(ifHandler));
    operationRegistry.register('FOR_EACH', forEachHandler.execute.bind(forEachHandler));

    // Store these handlers in the handlers object for consistency
    handlers.IF = ifHandler;
    handlers.FOR_EACH = forEachHandler;

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
            const component = entityManager.getComponentData(partId, componentId);

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

    const jsonLogicCustomOperators = new JsonLogicCustomOperators({
      logger: testLogger,
      entityManager,
      bodyGraphService: mockBodyGraphService,
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
        // Handle the positioning:available_furniture scope
        if (scopeName === 'positioning:available_furniture') {
          const actorLocation =
            context.actor?.components?.['core:position']?.locationId;
          if (!actorLocation) {
            return { success: true, value: new Set() };
          }

          // Find all entities with positioning:allows_sitting
          // Note: SimpleEntityManager doesn't have getAllEntities, we need to iterate differently
          const allEntityIds = entityManager.getEntityIds();

          // Build entities array from IDs
          const allEntities = allEntityIds.map((id) => {
            const instance = entityManager.getEntityInstance(id);
            return instance || { id, components: {} };
          });
          const furnitureEntities = allEntities.filter((entity) => {
            const hasSittingComponent =
              entity.components?.['positioning:allows_sitting'];
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

        // Handle the positioning:furniture_im_sitting_on and positioning:furniture_actor_sitting_on scopes
        // These are equivalent - both find the furniture the actor is sitting on
        if (scopeName === 'positioning:furniture_im_sitting_on' || scopeName === 'positioning:furniture_actor_sitting_on') {
          // This scope should find furniture that the actor is currently sitting on
          // The scope definition is: entities(positioning:allows_sitting)[][{"==": [{"var": "entity.id"}, {"var": "actor.components.positioning:sitting_on.furniture_id"}]}]

          // Get actor
          const actor =
            context?.actor || entityManager.getEntityInstance(context);
          if (!actor) {
            return { success: true, value: new Set() };
          }

          // Get actor's sitting_on component
          const sittingOn = actor.components?.['positioning:sitting_on'];
          if (!sittingOn || !sittingOn.furniture_id) {
            return { success: true, value: new Set() };
          }

          // Check if this furniture exists and has positioning:allows_sitting component
          const targetFurniture = entityManager.getEntityInstance(
            sittingOn.furniture_id
          );
          if (
            !targetFurniture ||
            !targetFurniture.components?.['positioning:allows_sitting']
          ) {
            return { success: true, value: new Set() };
          }

          return { success: true, value: new Set([sittingOn.furniture_id]) };
        }

        // Handle the positioning:available_surfaces scope
        if (scopeName === 'positioning:available_surfaces') {
          // Extract actor ID from context (context might be an object with actor property or just the ID)
          const actorId = context?.actor?.id || context;

          // Get actor's position
          const actor = entityManager.getEntityInstance(actorId);
          const actorPosition = actor?.components?.['core:position'];
          if (!actorPosition || !actorPosition.locationId) {
            return { success: true, value: new Set() };
          }

          // Find all entities with positioning:allows_bending_over in the same location
          const allEntities = Array.from(entityManager.entities.values());
          const availableSurfaces = allEntities.filter(entity => {
            const hasBendingComponent = entity.components?.['positioning:allows_bending_over'];
            const entityPosition = entity.components?.['core:position'];
            const sameLocation = entityPosition?.locationId === actorPosition.locationId;
            return hasBendingComponent && sameLocation;
          });

          const surfaceIds = availableSurfaces.map(surface => surface.id);
          return { success: true, value: new Set(surfaceIds) };
        }

        // Handle the positioning:surface_im_bending_over scope
        if (scopeName === 'positioning:surface_im_bending_over') {
          // Extract actor ID from context
          const actorId = context?.actor?.id || context;

          // Get actor's bending_over component
          const actor = entityManager.getEntityInstance(actorId);
          const bendingOver = actor?.components?.['positioning:bending_over'];

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

        // Handle the positioning:close_actors scope
        if (scopeName === 'positioning:close_actors') {
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
          const inventoryResult = simpleScopeResolver.resolveSync('items:actor_inventory_items', context);
          const inventoryItems = inventoryResult.success ? inventoryResult.value : new Set();

          // Get items at location
          const locationResult = simpleScopeResolver.resolveSync('items:items_at_location', context);
          const locationItems = locationResult.success ? locationResult.value : new Set();

          // Union both sets
          const allItems = new Set([...inventoryItems, ...locationItems]);
          return { success: true, value: allItems };
        }

        // Handle the items:open_containers_at_location scope
        if (scopeName === 'items:open_containers_at_location') {
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
            const containerComponent = entity.components?.['items:container'];
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

        // Handle the items:openable_containers_at_location scope
        if (scopeName === 'items:openable_containers_at_location') {
          // Extract actor ID from context
          const actorId = context?.actor?.id || context;

          // Get actor's position
          const actor = entityManager.getEntityInstance(actorId);
          const actorPosition = actor?.components?.['core:position'];
          if (!actorPosition || !actorPosition.locationId) {
            return { success: true, value: new Set() };
          }

          // Find all entities with items:container at same location that are open
          const allEntityIds = entityManager.getEntityIds();
          const allEntities = allEntityIds.map((id) => {
            const instance = entityManager.getEntityInstance(id);
            return instance || { id, components: {} };
          });

          const containersAtLocation = allEntities.filter((entity) => {
            const hasContainerComponent = entity.components?.['items:container'];
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

          const containerIds = containersAtLocation.map((container) => container.id);
          return { success: true, value: new Set(containerIds) };
        }

        // Handle the items:container_contents scope
        if (scopeName === 'items:container_contents') {
          // This scope uses contextFrom: primary, so the container should be in context
          const containerId = context?.primary?.id || context?.target?.id;

          if (!containerId) {
            return { success: true, value: new Set() };
          }

          // Get container entity and its contents
          const container = entityManager.getEntityInstance(containerId);
          const containerComponent = container?.components?.['items:container'];

          if (!containerComponent || !Array.isArray(containerComponent.contents)) {
            return { success: true, value: new Set() };
          }

          // Return the items in the container's contents array
          return { success: true, value: new Set(containerComponent.contents) };
        }

        // Handle the positioning:closest_leftmost_occupant scope
        if (scopeName === 'positioning:closest_leftmost_occupant') {
          // This scope finds the closest occupant to the left of the actor on furniture
          // It requires the furniture entity in context.target (from contextFrom: primary)
          const furnitureId = context?.target?.id;
          const actorId = context?.actor?.id;

          if (!furnitureId || !actorId) {
            return { success: true, value: new Set() };
          }

          // Get furniture entity and its sitting component
          const furniture = entityManager.getEntityInstance(furnitureId);
          const allowsSitting = furniture?.components?.['positioning:allows_sitting'];
          if (!allowsSitting || !Array.isArray(allowsSitting.spots)) {
            return { success: true, value: new Set() };
          }

          const spots = allowsSitting.spots;

          // Get actor's sitting position
          const actor = entityManager.getEntityInstance(actorId);
          const actorSitting = actor?.components?.['positioning:sitting_on'];
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
              const occupantSitting = occupant?.components?.['positioning:sitting_on'];
              if (occupantSitting && occupantSitting.furniture_id === furnitureId && occupantSitting.spot_index === i) {
                return { success: true, value: new Set([occupantId]) };
              }
            }
          }

          // No occupant found to the left
          return { success: true, value: new Set() };
        }

        if (scopeName === 'positioning:closest_rightmost_occupant') {
          const furnitureId = context?.target?.id;
          const actorId = context?.actor?.id;

          if (!furnitureId || !actorId) {
            return { success: true, value: new Set() };
          }

          const furniture = entityManager.getEntityInstance(furnitureId);
          const allowsSitting = furniture?.components?.['positioning:allows_sitting'];
          if (!allowsSitting || !Array.isArray(allowsSitting.spots)) {
            return { success: true, value: new Set() };
          }

          const spots = allowsSitting.spots;
          const actor = entityManager.getEntityInstance(actorId);
          const actorSitting = actor?.components?.['positioning:sitting_on'];
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
              const occupantSitting = occupant?.components?.['positioning:sitting_on'];
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

        // Handle the positioning:actors_sitting_with_space_to_right scope
        if (scopeName === 'positioning:actors_sitting_with_space_to_right') {
          // Get target furniture from context
          const targetId = context?.target?.id;
          if (!targetId) {
            return { success: true, value: new Set() };
          }

          // Get furniture entity and its sitting component
          const furniture = entityManager.getEntityInstance(targetId);
          const allowsSitting = furniture?.components?.['positioning:allows_sitting'];
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
          const rightmostOccupiedIndex = occupiedIndices.length > 0
            ? Math.max(...occupiedIndices)
            : -1;

          // Filter for actors sitting on this furniture who meet all criteria
          const validActors = allEntities.filter((entity) => {
            // Must have core:actor component
            if (!entity.components?.['core:actor']) {
              return false;
            }

            // Must be sitting on this furniture
            const sittingOn = entity.components?.['positioning:sitting_on'];
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
            if (spots[spotIndex + 1] !== null || spots[spotIndex + 2] !== null) {
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
          if (
            !instrument ||
            !instrument.components?.['music:is_instrument']
          ) {
            return { success: true, value: new Set() };
          }

          return { success: true, value: new Set([playingMusic.playing_on]) };
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

    interpreter.initialize();

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

  const actionValidationContextBuilder = new ActionValidationContextBuilder({
    entityManager: init.entityManager,
    logger: testLogger,
  });

  const prerequisiteService = new PrerequisiteEvaluationService({
    logger: testLogger,
    jsonLogicEvaluationService: jsonLogic,
    actionValidationContextBuilder,
    gameDataRepository: testDataRegistry,
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

          if (!dependency || orderedKeys.includes(dependency) || !remainingKeys.has(dependency)) {
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
        targets: {},
      };

      for (const [resolvedKey, resolvedValue] of Object.entries(resolvedTargets)) {
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
      if (!resolvedTargets || Object.keys(resolvedTargets).length === 0) {
        return null;
      }

      const override = { targets: {} };

      for (const [targetKey, resolvedTarget] of Object.entries(resolvedTargets)) {
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

      if (actorId) {
        const actorOverride = createResolvedTarget(actorId);
        if (actorOverride) {
          override.actor = actorOverride;
        }
      }

      return override;
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
        const resolutionContext = buildContextForTarget(resolvedTargets, key, definition);

        let result;
        try {
          result = env.unifiedScopeResolver.resolveSync(scopeName, resolutionContext);
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
            if (Array.isArray(requiredComponents) && requiredComponents.length > 0) {
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
            if (Array.isArray(forbiddenComponents) && forbiddenComponents.length > 0) {
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
    const filteredAssignments = filterAssignmentsByComponentRules(pendingAssignments);
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
    return candidates.filter((action) => env.validateAction(actorId, action.id));
  };

  return env;
}
