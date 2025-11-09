/**
 * @file Registers interpreter-layer services: operation handlers,
 * operation registry/interpreter, and the system logic interpreter.
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js
 */

/** @typedef {import('../appContainer.js').default} AppContainer */

import { tokens } from '../tokens.js';
import { Registrar } from '../../utils/registrarHelpers.js';
import { INITIALIZABLE, SHUTDOWNABLE } from '../tags.js';

import OperationRegistry from '../../logic/operationRegistry.js';
import OperationInterpreter from '../../logic/operationInterpreter.js';
import SystemLogicInterpreter from '../../logic/systemLogicInterpreter.js';
import CommandOutcomeInterpreter from '../../commands/interpreters/commandOutcomeInterpreter.js';
import ActionSequenceService from '../../logic/actionSequenceService.js';

// operation handlers
import { registerOperationHandlers } from './operationHandlerRegistrations.js';

/**
 * Registers all interpreter-layer services in the DI container.
 *
 * @param {AppContainer} container - The dependency injection container
 */
export function registerInterpreters(container) {
  const registrar = new Registrar(container);

  // ---------------------------------------------------------------------------
  //  Command-outcome interpreter
  // ---------------------------------------------------------------------------
  registrar.singletonFactory(
    tokens.ICommandOutcomeInterpreter,
    (c) =>
      new CommandOutcomeInterpreter({
        logger: c.resolve(tokens.ILogger),
        dispatcher: c.resolve(tokens.ISafeEventDispatcher),
      })
  );

  // ---------------------------------------------------------------------------
  //  Individual operation handler singletons
  // ---------------------------------------------------------------------------
  registerOperationHandlers(registrar);

  // ---------------------------------------------------------------------------
  //  OperationRegistry
  // ---------------------------------------------------------------------------
  /**
   * Operation Registry Mappings
   *
   * Maps operation type strings to handler tokens
   *
   * Requirements:
   * - Operation type must match schema "const" value exactly
   * - Handler token must be defined in tokens-core.js (without "I" prefix)
   * - Handler must be registered in operationHandlerRegistrations.js
   *
   * Verification:
   * Run `npm run validate` or `npm run validate:strict` to check consistency
   *
   * @see src/dependencyInjection/tokens/tokens-core.js
   * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js
   * @see src/utils/preValidationUtils.js (KNOWN_OPERATION_TYPES)
   */
  registrar.singletonFactory(tokens.OperationRegistry, (c) => {
    const registry = new OperationRegistry({
      logger: c.resolve(tokens.ILogger),
    });

    // Defer resolution of handlers until execution time,
    // so we don't prematurely pull in IWorldContext during registration.
    const bind =
      (tkn) =>
      (...args) =>
        c.resolve(tkn).execute(...args);

    // Operation mappings - keep alphabetically sorted
    // Format: registry.register('OPERATION_TYPE', bind(tokens.HandlerToken));
    registry.register('DISPATCH_EVENT', bind(tokens.DispatchEventHandler));
    registry.register(
      'DISPATCH_PERCEPTIBLE_EVENT',
      bind(tokens.DispatchPerceptibleEventHandler)
    );
    registry.register('DISPATCH_SPEECH', bind(tokens.DispatchSpeechHandler));
    registry.register('DISPATCH_THOUGHT', bind(tokens.DispatchThoughtHandler));
    registry.register('LOG', bind(tokens.LogHandler));
    registry.register('MODIFY_COMPONENT', bind(tokens.ModifyComponentHandler));
    registry.register('ADD_COMPONENT', bind(tokens.AddComponentHandler));
    registry.register('REMOVE_COMPONENT', bind(tokens.RemoveComponentHandler));
    registry.register('QUERY_COMPONENT', bind(tokens.QueryComponentHandler));
    registry.register('QUERY_COMPONENTS', bind(tokens.QueryComponentsHandler));
    registry.register('QUERY_LOOKUP', bind(tokens.QueryLookupHandler));
    registry.register('QUERY_ENTITIES', bind(tokens.QueryEntitiesHandler));
    registry.register('SET_VARIABLE', bind(tokens.SetVariableHandler));
    registry.register('END_TURN', bind(tokens.EndTurnHandler));
    registry.register('FOR_EACH', bind(tokens.ForEachHandler));
    registry.register('IF', bind(tokens.IfHandler));
    registry.register(
      'SYSTEM_MOVE_ENTITY',
      bind(tokens.SystemMoveEntityHandler)
    );
    registry.register('GET_TIMESTAMP', bind(tokens.GetTimestampHandler));
    registry.register('GET_NAME', bind(tokens.GetNameHandler));

    registry.register(
      'REBUILD_LEADER_LIST_CACHE',
      bind(tokens.RebuildLeaderListCacheHandler)
    );
    registry.register(
      'CHECK_FOLLOW_CYCLE',
      bind(tokens.CheckFollowCycleHandler)
    );
    registry.register(
      'ESTABLISH_FOLLOW_RELATION',
      bind(tokens.EstablishFollowRelationHandler)
    );
    registry.register(
      'BREAK_FOLLOW_RELATION',
      bind(tokens.BreakFollowRelationHandler)
    );
    registry.register(
      'ADD_PERCEPTION_LOG_ENTRY',
      bind(tokens.AddPerceptionLogEntryHandler)
    );
    registry.register('HAS_COMPONENT', bind(tokens.HasComponentHandler));
    registry.register(
      'MODIFY_ARRAY_FIELD',
      bind(tokens.ModifyArrayFieldHandler)
    );
    registry.register(
      'MODIFY_CONTEXT_ARRAY',
      bind(tokens.ModifyContextArrayHandler)
    );
    registry.register('IF_CO_LOCATED', bind(tokens.IfCoLocatedHandler));
    registry.register(
      'AUTO_MOVE_FOLLOWERS',
      bind(tokens.AutoMoveFollowersHandler)
    );
    registry.register(
      'AUTO_MOVE_CLOSENESS_PARTNERS',
      bind(tokens.AutoMoveClosenessPartnersHandler)
    );
    registry.register(
      'MERGE_CLOSENESS_CIRCLE',
      bind(tokens.MergeClosenessCircleHandler)
    );
    registry.register('MATH', bind(tokens.MathHandler));
    registry.register(
      'REMOVE_FROM_CLOSENESS_CIRCLE',
      bind(tokens.RemoveFromClosenessCircleHandler)
    );
    registry.register(
      'ESTABLISH_SITTING_CLOSENESS',
      bind(tokens.EstablishSittingClosenessHandler)
    );
    registry.register(
      'ESTABLISH_LYING_CLOSENESS',
      bind(tokens.EstablishLyingClosenessHandler)
    );
    registry.register(
      'REMOVE_SITTING_CLOSENESS',
      bind(tokens.RemoveSittingClosenessHandler)
    );
    registry.register(
      'BREAK_CLOSENESS_WITH_TARGET',
      bind(tokens.BreakClosenessWithTargetHandler)
    );
    registry.register(
      'HAS_BODY_PART_WITH_COMPONENT_VALUE',
      bind(tokens.HasBodyPartWithComponentValueHandler)
    );
    registry.register('UNEQUIP_CLOTHING', bind(tokens.UnequipClothingHandler));
    registry.register('LOCK_MOVEMENT', bind(tokens.LockMovementHandler));
    registry.register(
      'LOCK_MOUTH_ENGAGEMENT',
      bind(tokens.LockMouthEngagementHandler)
    );
    registry.register(
      'UNLOCK_MOUTH_ENGAGEMENT',
      bind(tokens.UnlockMouthEngagementHandler)
    );
    registry.register('UNLOCK_MOVEMENT', bind(tokens.UnlockMovementHandler));
    registry.register(
      'ATOMIC_MODIFY_COMPONENT',
      bind(tokens.AtomicModifyComponentHandler)
    );
    registry.register(
      'REGENERATE_DESCRIPTION',
      bind(tokens.RegenerateDescriptionHandler)
    );
    registry.register('RESOLVE_DIRECTION', bind(tokens.ResolveDirectionHandler));
    registry.register('SEQUENCE', bind(tokens.SequenceHandler));
    registry.register('TRANSFER_ITEM', bind(tokens.TransferItemHandler));
    registry.register(
      'VALIDATE_INVENTORY_CAPACITY',
      bind(tokens.ValidateInventoryCapacityHandler)
    );
    registry.register(
      'DROP_ITEM_AT_LOCATION',
      bind(tokens.DropItemAtLocationHandler)
    );
    registry.register(
      'PICK_UP_ITEM_FROM_LOCATION',
      bind(tokens.PickUpItemFromLocationHandler)
    );
    registry.register('OPEN_CONTAINER', bind(tokens.OpenContainerHandler));
    registry.register(
      'TAKE_FROM_CONTAINER',
      bind(tokens.TakeFromContainerHandler)
    );
    registry.register(
      'PUT_IN_CONTAINER',
      bind(tokens.PutInContainerHandler)
    );
    registry.register(
      'VALIDATE_CONTAINER_CAPACITY',
      bind(tokens.ValidateContainerCapacityHandler)
    );
    registry.register('DRINK_FROM', bind(tokens.DrinkFromHandler));
    registry.register('DRINK_ENTIRELY', bind(tokens.DrinkEntirelyHandler));

    return registry;
  });

  // ---------------------------------------------------------------------------
  //  OperationInterpreter
  // ---------------------------------------------------------------------------
  registrar.singletonFactory(
    tokens.OperationInterpreter,
    (c) =>
      new OperationInterpreter({
        logger: c.resolve(tokens.ILogger),
        operationRegistry: c.resolve(tokens.OperationRegistry),
      })
  );

  // ---------------------------------------------------------------------------
  //  ActionSequence Service
  // ---------------------------------------------------------------------------
  registrar.singletonFactory(
    tokens.ActionSequence,
    (c) =>
      new ActionSequenceService({
        logger: c.resolve(tokens.ILogger),
        operationInterpreter: c.resolve(tokens.OperationInterpreter),
      })
  );

  // ---------------------------------------------------------------------------
  //  SystemLogicInterpreter
  // ---------------------------------------------------------------------------
  registrar.tagged([...INITIALIZABLE, ...SHUTDOWNABLE]).singletonFactory(
    tokens.SystemLogicInterpreter,
    (c) =>
      new SystemLogicInterpreter({
        logger: c.resolve(tokens.ILogger),
        eventBus: c.resolve(tokens.EventBus),
        dataRegistry: c.resolve(tokens.IDataRegistry),
        jsonLogicEvaluationService: c.resolve(
          tokens.JsonLogicEvaluationService
        ),
        entityManager: c.resolve(tokens.IEntityManager),
        operationInterpreter: c.resolve(tokens.OperationInterpreter),
        bodyGraphService: c.resolve(tokens.BodyGraphService),
      })
  );
}
