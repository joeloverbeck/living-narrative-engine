/**
 * @file Registers interpreter-layer services: operation handlers,
 * operation registry/interpreter, and the system logic interpreter.
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js
 */

/** @typedef {import('../appContainer.js').default} AppContainer */

import { tokens } from '../tokens.js';
import { Registrar } from '../registrarHelpers.js';
import { INITIALIZABLE, SHUTDOWNABLE } from '../tags.js';

import OperationRegistry from '../../logic/operationRegistry.js';
import OperationInterpreter from '../../logic/operationInterpreter.js';
import SystemLogicInterpreter from '../../logic/systemLogicInterpreter.js';
import CommandOutcomeInterpreter from '../../commands/interpreters/commandOutcomeInterpreter.js';

// operation handlers
import DispatchEventHandler from '../../logic/operationHandlers/dispatchEventHandler.js';
import LogHandler from '../../logic/operationHandlers/logHandler.js';
import ModifyComponentHandler from '../../logic/operationHandlers/modifyComponentHandler.js';
import AddComponentHandler from '../../logic/operationHandlers/addComponentHandler.js';
import QueryComponentHandler from '../../logic/operationHandlers/queryComponentHandler.js';
import RemoveComponentHandler from '../../logic/operationHandlers/removeComponentHandler.js';
import SetVariableHandler from '../../logic/operationHandlers/setVariableHandler.js';
import SystemMoveEntityHandler from '../../logic/operationHandlers/systemMoveEntityHandler.js';
import GetTimestampHandler from '../../logic/operationHandlers/getTimestampHandler.js';
import ResolveDirectionHandler from '../../logic/operationHandlers/resolveDirectionHandler.js';
import RebuildLeaderListCacheHandler from '../../logic/operationHandlers/rebuildLeaderListCacheHandler';
import CheckFollowCycleHandler from '../../logic/operationHandlers/checkFollowCycleHandler';
import AddPerceptionLogEntryHandler from '../../logic/operationHandlers/addPerceptionLogEntryHandler';
import QueryEntitiesHandler from '../../logic/operationHandlers/queryEntitiesHandler.js';
import HasComponentHandler from '../../logic/operationHandlers/hasComponentHandler';
import ModifyArrayFieldHandler from '../../logic/operationHandlers/modifyArrayFieldHandler';
import MathHandler from '../../logic/operationHandlers/mathHandler.js';

/**
 * Registers all interpreter-layer services in the DI container.
 *
 * @param {AppContainer} container
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
  const handlerFactories = [
    [
      tokens.DispatchEventHandler,
      DispatchEventHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          dispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        }),
    ],
    [
      tokens.LogHandler,
      LogHandler,
      (c, Handler) => new Handler({ logger: c.resolve(tokens.ILogger) }),
    ],
    [
      tokens.ModifyComponentHandler,
      ModifyComponentHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.AddComponentHandler,
      AddComponentHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.RemoveComponentHandler,
      RemoveComponentHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
        }),
    ],
    [
      tokens.QueryComponentHandler,
      QueryComponentHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
        }),
    ],
    [
      tokens.SetVariableHandler,
      SetVariableHandler,
      (c, Handler) => new Handler({ logger: c.resolve(tokens.ILogger) }),
    ],
    [
      tokens.SystemMoveEntityHandler,
      SystemMoveEntityHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          dispatcher: c.resolve(tokens.IValidatedEventDispatcher),
          logger: c.resolve(tokens.ILogger),
        }),
    ],
    [
      tokens.GetTimestampHandler,
      GetTimestampHandler,
      (c, Handler) => new Handler({ logger: c.resolve(tokens.ILogger) }),
    ],
    [
      tokens.ResolveDirectionHandler,
      ResolveDirectionHandler,
      (c, Handler) =>
        new Handler({
          worldContext: c.resolve(tokens.IWorldContext),
          logger: c.resolve(tokens.ILogger),
        }),
    ],
    [
      tokens.RebuildLeaderListCacheHandler,
      RebuildLeaderListCacheHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
        }),
    ],
    [
      tokens.CheckFollowCycleHandler,
      CheckFollowCycleHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
        }),
    ],
    [
      tokens.AddPerceptionLogEntryHandler,
      AddPerceptionLogEntryHandler,
      (c, H) =>
        new H({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.QueryEntitiesHandler,
      QueryEntitiesHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          jsonLogicEvaluationService: c.resolve(
            tokens.JsonLogicEvaluationService
          ),
        }),
    ],
    [
      tokens.HasComponentHandler,
      HasComponentHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.ModifyArrayFieldHandler,
      ModifyArrayFieldHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          // --- FIX START ---
          // The handler's constructor requires an ISafeEventDispatcher, which was missing.
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
          // --- FIX END ---
        }),
    ],
    [
      tokens.MathHandler,
      MathHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          jsonLogicEvaluationService: c.resolve(
            tokens.JsonLogicEvaluationService
          ),
        }),
    ],
  ];

  for (const [token, ctor, factory] of handlerFactories) {
    registrar.singletonFactory(token, (c) => factory(c, ctor));
  }

  // ---------------------------------------------------------------------------
  //  OperationRegistry
  // ---------------------------------------------------------------------------
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

    registry.register('DISPATCH_EVENT', bind(tokens.DispatchEventHandler));
    registry.register('LOG', bind(tokens.LogHandler));
    registry.register('MODIFY_COMPONENT', bind(tokens.ModifyComponentHandler));
    registry.register('ADD_COMPONENT', bind(tokens.AddComponentHandler));
    registry.register('REMOVE_COMPONENT', bind(tokens.RemoveComponentHandler));
    registry.register('QUERY_COMPONENT', bind(tokens.QueryComponentHandler));
    registry.register('QUERY_ENTITIES', bind(tokens.QueryEntitiesHandler));
    registry.register('SET_VARIABLE', bind(tokens.SetVariableHandler));
    registry.register(
      'SYSTEM_MOVE_ENTITY',
      bind(tokens.SystemMoveEntityHandler)
    );
    registry.register('GET_TIMESTAMP', bind(tokens.GetTimestampHandler));
    registry.register(
      'RESOLVE_DIRECTION',
      bind(tokens.ResolveDirectionHandler)
    );
    registry.register(
      'REBUILD_LEADER_LIST_CACHE',
      bind(tokens.RebuildLeaderListCacheHandler)
    );
    registry.register(
      'CHECK_FOLLOW_CYCLE',
      bind(tokens.CheckFollowCycleHandler)
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
    registry.register('MATH', bind(tokens.MathHandler));

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
      })
  );
}
