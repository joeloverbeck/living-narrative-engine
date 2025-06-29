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

// operation handlers
import { registerOperationHandlers } from './operationHandlerRegistrations.js';

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
  registerOperationHandlers(registrar);

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
