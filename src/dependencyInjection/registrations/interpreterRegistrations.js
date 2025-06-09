// -----------------------------------------------------------------------------
//  Interpreter-layer service registrations
// -----------------------------------------------------------------------------

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
import QuerySystemDataHandler from '../../logic/operationHandlers/querySystemDataHandler.js';
import SystemMoveEntityHandler from '../../logic/operationHandlers/systemMoveEntityHandler';

/** @param {AppContainer} container */
export function registerInterpreters(container) {
  const registrar = new Registrar(container);
  const logger = container.resolve(tokens.ILogger);

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
  //  Individual handler singletons
  // ---------------------------------------------------------------------------
  const handlerFactories = [
    [
      tokens.DispatchEventHandler,
      DispatchEventHandler,
      (c, h) =>
        new h({
          logger: c.resolve(tokens.ILogger),
          dispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        }),
    ],
    [
      tokens.LogHandler,
      LogHandler,
      (c, h) => new h({ logger: c.resolve(tokens.ILogger) }),
    ],
    [
      tokens.ModifyComponentHandler,
      ModifyComponentHandler,
      (c, h) =>
        new h({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
        }),
    ],
    [
      tokens.AddComponentHandler,
      AddComponentHandler,
      (c, h) =>
        new h({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.RemoveComponentHandler,
      RemoveComponentHandler,
      (c, h) =>
        new h({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
        }),
    ],
    [
      tokens.QueryComponentHandler,
      QueryComponentHandler,
      (c, h) =>
        new h({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
        }),
    ],
    [
      tokens.SetVariableHandler,
      SetVariableHandler,
      (c, h) => new h({ logger: c.resolve(tokens.ILogger) }),
    ],
    [
      tokens.QuerySystemDataHandler,
      QuerySystemDataHandler,
      (c, h) =>
        new h({
          logger: c.resolve(tokens.ILogger),
          systemDataRegistry: c.resolve(tokens.SystemDataRegistry),
        }),
    ],
    [
      tokens.SystemMoveEntityHandler,
      SystemMoveEntityHandler,
      (c, h) =>
        new h({
          entityManager: c.resolve(tokens.IEntityManager),
          dispatcher: c.resolve(tokens.IValidatedEventDispatcher),
          logger: c.resolve(tokens.ILogger),
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
    const reg = new OperationRegistry({ logger: c.resolve(tokens.ILogger) });

    const bind = (tkn) => c.resolve(tkn).execute.bind(c.resolve(tkn));

    reg.register('DISPATCH_EVENT', bind(tokens.DispatchEventHandler));
    reg.register('LOG', bind(tokens.LogHandler));
    reg.register('MODIFY_COMPONENT', bind(tokens.ModifyComponentHandler));
    reg.register('ADD_COMPONENT', bind(tokens.AddComponentHandler));
    reg.register('REMOVE_COMPONENT', bind(tokens.RemoveComponentHandler));
    reg.register('QUERY_COMPONENT', bind(tokens.QueryComponentHandler));
    reg.register('SET_VARIABLE', bind(tokens.SetVariableHandler));
    reg.register('QUERY_SYSTEM_DATA', bind(tokens.QuerySystemDataHandler));
    reg.register('SYSTEM_MOVE_ENTITY', bind(tokens.SystemMoveEntityHandler));

    return reg;
  });

  // ---------------------------------------------------------------------------
  //  OperationInterpreter
  // ---------------------------------------------------------------------------
  registrar.singletonFactory(tokens.OperationInterpreter, (c) => {
    return new OperationInterpreter({
      logger: c.resolve(tokens.ILogger),
      operationRegistry: c.resolve(tokens.OperationRegistry),
    });
  });

  // ---------------------------------------------------------------------------
  //  SystemLogicInterpreter (tags: INITIALIZABLE, SHUTDOWNABLE)
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
