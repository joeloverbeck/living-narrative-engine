// src/dependencyInjection/registrations/interpreterRegistrations.js
// ****** MODIFIED FILE ******

/**
 * @file Registers the logic interpretation layer services:
 * OperationRegistry, OperationInterpreter, SystemLogicInterpreter, CommandOutcomeInterpreter, and their handlers.
 */

// --- JSDoc Imports ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../data/systemDataRegistry.js').SystemDataRegistry} SystemDataRegistry */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */ // For handlers
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */ // For handlers
/** @typedef {import('../../interfaces/IDataRegistry.js').IDataRegistry} IDataRegistry */ // For SystemLogicInterpreter
/** @typedef {import('../../logic/jsonLogicEvaluationService.js').JsonLogicEvaluationService} JsonLogicEvaluationService */ // For SystemLogicInterpreter
/** @typedef {import('../../commands/interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter */

// --- DI & Helper Imports ---
import { tokens } from '../tokens.js';
import { Registrar } from '../registrarHelpers.js';
import { INITIALIZABLE, SHUTDOWNABLE } from '../tags.js';

// --- Core Service Imports ---
import OperationRegistry from '../../logic/operationRegistry.js';
import OperationInterpreter from '../../logic/operationInterpreter.js';
import SystemLogicInterpreter from '../../logic/systemLogicInterpreter.js';
import CommandOutcomeInterpreter from '../../commands/interpreters/commandOutcomeInterpreter.js'; // Concrete class

// --- Handler Imports ---
import DispatchEventHandler from '../../logic/operationHandlers/dispatchEventHandler.js';
import LogHandler from '../../logic/operationHandlers/logHandler.js';
import ModifyComponentHandler from '../../logic/operationHandlers/modifyComponentHandler.js';
import AddComponentHandler from '../../logic/operationHandlers/addComponentHandler.js';
import QueryComponentHandler from '../../logic/operationHandlers/queryComponentHandler.js';
import RemoveComponentHandler from '../../logic/operationHandlers/removeComponentHandler.js';
import SetVariableHandler from '../../logic/operationHandlers/setVariableHandler.js';
import QuerySystemDataHandler from '../../logic/operationHandlers/querySystemDataHandler.js';

/**
 * Registers the OperationRegistry, OperationInterpreter, SystemLogicInterpreter,
 * CommandOutcomeInterpreter, and all associated Operation Handlers.
 *
 * @export
 * @param {AppContainer} container - The application's DI container.
 */
export function registerInterpreters(container) {
  const registrar = new Registrar(container);
  /** @type {ILogger} */
  const logger = container.resolve(tokens.ILogger);
  logger.debug('Interpreter Registrations: Starting...');

  // --- Register CommandOutcomeInterpreter against ICommandOutcomeInterpreter token ---
  registrar.singletonFactory(
    tokens.ICommandOutcomeInterpreter,
    (c) =>
      new CommandOutcomeInterpreter({
        // <<< MODIFIED TOKEN
        logger: c.resolve(tokens.ILogger),
        dispatcher: c.resolve(tokens.ISafeEventDispatcher), // Uses ISafeEventDispatcher
      })
  );
  logger.debug(
    `Interpreter Registrations: Registered ${tokens.ICommandOutcomeInterpreter}.`
  ); // <<< MODIFIED TOKEN

  // --- Register Operation Handlers ---
  registrar.singletonFactory(
    tokens.DispatchEventHandler,
    (c) =>
      new DispatchEventHandler({
        logger: c.resolve(tokens.ILogger),
        dispatcher: c.resolve(tokens.IValidatedEventDispatcher),
      })
  );
  logger.debug('Interpreter Registrations: Registered DispatchEventHandler.');

  registrar.singletonFactory(
    tokens.LogHandler,
    (c) =>
      new LogHandler({
        logger: c.resolve(tokens.ILogger),
      })
  );
  logger.debug('Interpreter Registrations: Registered LogHandler.');

  registrar.singletonFactory(
    tokens.ModifyComponentHandler,
    (c) =>
      new ModifyComponentHandler({
        entityManager: c.resolve(tokens.IEntityManager), // Use IEntityManager
        logger: c.resolve(tokens.ILogger),
      })
  );
  logger.debug('Interpreter Registrations: Registered ModifyComponentHandler.');

  registrar.singletonFactory(
    tokens.AddComponentHandler,
    (c) =>
      new AddComponentHandler({
        entityManager: c.resolve(tokens.IEntityManager), // Use IEntityManager
        logger: c.resolve(tokens.ILogger),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      })
  );
  logger.debug('Interpreter Registrations: Registered AddComponentHandler.');

  registrar.singletonFactory(
    tokens.RemoveComponentHandler,
    (c) =>
      new RemoveComponentHandler({
        entityManager: c.resolve(tokens.IEntityManager), // Use IEntityManager
        logger: c.resolve(tokens.ILogger),
      })
  );
  logger.debug('Interpreter Registrations: Registered RemoveComponentHandler.');

  registrar.singletonFactory(
    tokens.QueryComponentHandler,
    (c) =>
      new QueryComponentHandler({
        entityManager: c.resolve(tokens.IEntityManager), // Use IEntityManager
        logger: c.resolve(tokens.ILogger),
      })
  );
  logger.debug('Interpreter Registrations: Registered QueryComponentHandler.');

  registrar.singletonFactory(
    tokens.SetVariableHandler,
    (c) =>
      new SetVariableHandler({
        logger: c.resolve(tokens.ILogger),
      })
  );
  logger.debug('Interpreter Registrations: Registered SetVariableHandler.');

  registrar.singletonFactory(
    tokens.QuerySystemDataHandler,
    (c) =>
      new QuerySystemDataHandler({
        logger: c.resolve(tokens.ILogger),
        systemDataRegistry: c.resolve(tokens.SystemDataRegistry),
      })
  );
  logger.debug('Interpreter Registrations: Registered QuerySystemDataHandler.');

  // --- Register OperationRegistry (aggregates handlers) ---
  registrar.singletonFactory(tokens.OperationRegistry, (c) => {
    const internalLogger = c.resolve(tokens.ILogger);
    const registry = new OperationRegistry({ logger: internalLogger });
    internalLogger.debug(
      'Interpreter Registrations: OperationRegistry factory creating instance...'
    );

    const bindExecute = (token) => {
      const handlerInstance = c.resolve(token);
      // Added a more descriptive error if resolution fails
      if (!handlerInstance) {
        internalLogger.error(
          `Interpreter Registrations: Failed to resolve handler token "${String(token)}" required by OperationRegistry.`
        );
        return (params, context) => {
          internalLogger.error(
            `Operation handler for token "${String(token)}" was not resolved. Operation skipped.`
          );
        };
      }
      if (typeof handlerInstance.execute !== 'function') {
        internalLogger.error(
          `Interpreter Registrations: Resolved instance for token "${String(token)}" does not have an 'execute' method.`
        );
        return (params, context) => {
          internalLogger.error(
            `Operation handler for token "${String(token)}" is invalid (missing execute). Operation skipped.`
          );
        };
      }
      return handlerInstance.execute.bind(handlerInstance);
    };

    registry.register(
      'DISPATCH_EVENT',
      bindExecute(tokens.DispatchEventHandler)
    );
    registry.register('LOG', bindExecute(tokens.LogHandler));
    registry.register(
      'MODIFY_COMPONENT',
      bindExecute(tokens.ModifyComponentHandler)
    );
    registry.register('ADD_COMPONENT', bindExecute(tokens.AddComponentHandler));
    registry.register(
      'REMOVE_COMPONENT',
      bindExecute(tokens.RemoveComponentHandler)
    );
    registry.register(
      'QUERY_COMPONENT',
      bindExecute(tokens.QueryComponentHandler)
    );
    registry.register('SET_VARIABLE', bindExecute(tokens.SetVariableHandler));
    registry.register(
      'QUERY_SYSTEM_DATA',
      bindExecute(tokens.QuerySystemDataHandler)
    );

    internalLogger.debug(
      'Interpreter Registrations: Finished registering handlers within OperationRegistry instance.'
    );
    return registry;
  });
  logger.debug(
    'Interpreter Registrations: Registered OperationRegistry factory.'
  );

  // --- Register Interpreters (depend on registry/handlers) ---
  registrar.singletonFactory(
    tokens.OperationInterpreter,
    (c) =>
      new OperationInterpreter({
        logger: c.resolve(tokens.ILogger),
        operationRegistry: c.resolve(tokens.OperationRegistry),
      })
  );
  logger.debug('Interpreter Registrations: Registered OperationInterpreter.');

  registrar
    .tagged([...INITIALIZABLE, ...SHUTDOWNABLE])
    .singletonFactory(tokens.SystemLogicInterpreter, (c) => {
      const systemLogger = c.resolve(tokens.ILogger);
      systemLogger.debug(
        'Interpreter Registrations: SystemLogicInterpreter factory creating instance...'
      );
      return new SystemLogicInterpreter({
        logger: systemLogger,
        eventBus: c.resolve(tokens.EventBus),
        dataRegistry: c.resolve(tokens.IDataRegistry),
        jsonLogicEvaluationService: c.resolve(
          tokens.JsonLogicEvaluationService
        ),
        entityManager: c.resolve(tokens.IEntityManager), // Use IEntityManager
        operationInterpreter: c.resolve(tokens.OperationInterpreter),
      });
    });
  logger.debug(
    `Interpreter Registrations: Registered SystemLogicInterpreter factory tagged with ${[...INITIALIZABLE, ...SHUTDOWNABLE].join(', ')}.`
  );

  logger.debug('Interpreter Registrations: Complete.');
}
