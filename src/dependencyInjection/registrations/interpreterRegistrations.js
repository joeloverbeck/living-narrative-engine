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
import DispatchPerceptibleEventHandler from '../../logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import DispatchSpeechHandler from '../../logic/operationHandlers/dispatchSpeechHandler.js';
import LogHandler from '../../logic/operationHandlers/logHandler.js';
import ModifyComponentHandler from '../../logic/operationHandlers/modifyComponentHandler.js';
import AddComponentHandler from '../../logic/operationHandlers/addComponentHandler.js';
import QueryComponentHandler from '../../logic/operationHandlers/queryComponentHandler.js';
import QueryComponentsHandler from '../../logic/operationHandlers/queryComponentsHandler.js';
import RemoveComponentHandler from '../../logic/operationHandlers/removeComponentHandler.js';
import SetVariableHandler from '../../logic/operationHandlers/setVariableHandler.js';
import EndTurnHandler from '../../logic/operationHandlers/endTurnHandler.js';
import SystemMoveEntityHandler from '../../logic/operationHandlers/systemMoveEntityHandler.js';
import GetTimestampHandler from '../../logic/operationHandlers/getTimestampHandler.js';
import GetNameHandler from '../../logic/operationHandlers/getNameHandler.js';
import ResolveDirectionHandler from '../../logic/operationHandlers/resolveDirectionHandler.js';
import RebuildLeaderListCacheHandler from '../../logic/operationHandlers/rebuildLeaderListCacheHandler';
import CheckFollowCycleHandler from '../../logic/operationHandlers/checkFollowCycleHandler';
import EstablishFollowRelationHandler from '../../logic/operationHandlers/establishFollowRelationHandler.js';
import BreakFollowRelationHandler from '../../logic/operationHandlers/breakFollowRelationHandler.js';
import AddPerceptionLogEntryHandler from '../../logic/operationHandlers/addPerceptionLogEntryHandler';
import QueryEntitiesHandler from '../../logic/operationHandlers/queryEntitiesHandler.js';
import HasComponentHandler from '../../logic/operationHandlers/hasComponentHandler';
import ModifyArrayFieldHandler from '../../logic/operationHandlers/modifyArrayFieldHandler';
import MathHandler from '../../logic/operationHandlers/mathHandler.js';
import IfCoLocatedHandler from '../../logic/operationHandlers/ifCoLocatedHandler.js';
import ModifyContextArrayHandler from '../../logic/operationHandlers/modifyContextArrayHandler.js';
import AutoMoveFollowersHandler from '../../logic/operationHandlers/autoMoveFollowersHandler.js';
import MergeClosenessCircleHandler from '../../logic/operationHandlers/mergeClosenessCircleHandler.js';
import RemoveFromClosenessCircleHandler from '../../logic/operationHandlers/removeFromClosenessCircleHandler.js';
import jsonLogic from 'json-logic-js';

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
      tokens.DispatchPerceptibleEventHandler,
      DispatchPerceptibleEventHandler,
      (c, Handler) =>
        new Handler({
          dispatcher: c.resolve(tokens.ISafeEventDispatcher),
          logger: c.resolve(tokens.ILogger),
          addPerceptionLogEntryHandler: c.resolve(
            tokens.AddPerceptionLogEntryHandler
          ),
        }),
    ],
    [
      tokens.DispatchSpeechHandler,
      DispatchSpeechHandler,
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
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.QueryComponentHandler,
      QueryComponentHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.QueryComponentsHandler,
      QueryComponentsHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.SetVariableHandler,
      SetVariableHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          jsonLogic,
        }),
    ],
    [
      tokens.EndTurnHandler,
      EndTurnHandler,
      (c, Handler) =>
        new Handler({
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
          logger: c.resolve(tokens.ILogger),
        }),
    ],
    [
      tokens.SystemMoveEntityHandler,
      SystemMoveEntityHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.GetTimestampHandler,
      GetTimestampHandler,
      (c, Handler) => new Handler({ logger: c.resolve(tokens.ILogger) }),
    ],
    [
      tokens.GetNameHandler,
      GetNameHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
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
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.CheckFollowCycleHandler,
      CheckFollowCycleHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.EstablishFollowRelationHandler,
      EstablishFollowRelationHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          rebuildLeaderListCacheHandler: c.resolve(
            tokens.RebuildLeaderListCacheHandler
          ),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.BreakFollowRelationHandler,
      BreakFollowRelationHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          rebuildLeaderListCacheHandler: c.resolve(
            tokens.RebuildLeaderListCacheHandler
          ),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
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
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
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
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.ModifyContextArrayHandler,
      ModifyContextArrayHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.IfCoLocatedHandler,
      IfCoLocatedHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          operationInterpreter: c.resolve(tokens.OperationInterpreter),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.MathHandler,
      MathHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.AutoMoveFollowersHandler,
      AutoMoveFollowersHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          systemMoveEntityHandler: c.resolve(tokens.SystemMoveEntityHandler),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.MergeClosenessCircleHandler,
      MergeClosenessCircleHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
          closenessCircleService: c.resolve(tokens.ClosenessCircleService),
        }),
    ],
    [
      tokens.RemoveFromClosenessCircleHandler,
      RemoveFromClosenessCircleHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
          closenessCircleService: c.resolve(tokens.ClosenessCircleService),
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
    registry.register(
      'DISPATCH_PERCEPTIBLE_EVENT',
      bind(tokens.DispatchPerceptibleEventHandler)
    );
    registry.register('DISPATCH_SPEECH', bind(tokens.DispatchSpeechHandler));
    registry.register('LOG', bind(tokens.LogHandler));
    registry.register('MODIFY_COMPONENT', bind(tokens.ModifyComponentHandler));
    registry.register('ADD_COMPONENT', bind(tokens.AddComponentHandler));
    registry.register('REMOVE_COMPONENT', bind(tokens.RemoveComponentHandler));
    registry.register('QUERY_COMPONENT', bind(tokens.QueryComponentHandler));
    registry.register('QUERY_COMPONENTS', bind(tokens.QueryComponentsHandler));
    registry.register('QUERY_ENTITIES', bind(tokens.QueryEntitiesHandler));
    registry.register('SET_VARIABLE', bind(tokens.SetVariableHandler));
    registry.register('END_TURN', bind(tokens.EndTurnHandler));
    registry.register(
      'SYSTEM_MOVE_ENTITY',
      bind(tokens.SystemMoveEntityHandler)
    );
    registry.register('GET_TIMESTAMP', bind(tokens.GetTimestampHandler));
    registry.register('GET_NAME', bind(tokens.GetNameHandler));
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
      'MERGE_CLOSENESS_CIRCLE',
      bind(tokens.MergeClosenessCircleHandler)
    );
    registry.register('MATH', bind(tokens.MathHandler));
    registry.register(
      'REMOVE_FROM_CLOSENESS_CIRCLE',
      bind(tokens.RemoveFromClosenessCircleHandler)
    );

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
