// src/core/config/registrations/interpreterRegistrations.js

/**
 * @fileoverview Registers the logic interpretation layer services:
 * OperationRegistry, OperationInterpreter, SystemLogicInterpreter, and their handlers.
 */

// --- JSDoc Imports ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/services/systemDataRegistry.js').SystemDataRegistry} SystemDataRegistry */ // Assuming type is needed for QuerySystemDataHandler

// --- DI & Helper Imports ---
import {tokens} from '../tokens.js'; // Correct path to tokens
import {Registrar} from '../../dependencyInjection/registrarHelpers.js'; // Correct path if needed
import {INITIALIZABLE} from '../tags.js'; // Correct path to tags

// --- Core Service Imports ---
import OperationRegistry from '../../../logic/operationRegistry.js';
import OperationInterpreter from '../../../logic/operationInterpreter.js';
import SystemLogicInterpreter from '../../../logic/systemLogicInterpreter.js';

// --- Handler Imports (All handlers imported ONLY here as per requirements) ---
import DispatchEventHandler from '../../../logic/operationHandlers/dispatchEventHandler.js';
import LogHandler from '../../../logic/operationHandlers/logHandler.js';
import ModifyComponentHandler from '../../../logic/operationHandlers/modifyComponentHandler.js';
import AddComponentHandler from '../../../logic/operationHandlers/addComponentHandler.js';
import QueryComponentHandler from '../../../logic/operationHandlers/queryComponentHandler.js';
import ModifyDomElementHandler from '../../../logic/operationHandlers/modifyDomElementHandler.js';
import RemoveComponentHandler from "../../../logic/operationHandlers/removeComponentHandler.js";
import AppendUiMessageHandler from '../../../logic/operationHandlers/appendUiMessageHandler.js';
// <<< ADDED IMPORTS for new handlers
import SetVariableHandler from '../../../logic/operationHandlers/setVariableHandler.js';
import QuerySystemDataHandler from '../../../logic/operationHandlers/querySystemDataHandler.js';


/**
 * Registers the OperationRegistry, OperationInterpreter, SystemLogicInterpreter,
 * and all associated Operation Handlers.
 *
 * @export
 * @param {AppContainer} container - The application's DI container.
 */
export function registerInterpreters(container) {
    const registrar = new Registrar(container);
    /** @type {ILogger} */
    const logger = container.resolve(tokens.ILogger);
    logger.info('Interpreter Registrations: Starting...');

    // --- 1. Register Operation Handlers ---
    registrar.singletonFactory(tokens.DispatchEventHandler, c => new DispatchEventHandler({
        dispatcher: c.resolve(tokens.ValidatedEventDispatcher) // Assuming ValidatedEventDispatcher is preferred and registered
        // dispatcher: c.resolve(tokens.EventBus) // Fallback if needed
    }));
    logger.debug('Interpreter Registrations: Registered DispatchEventHandler.');

    registrar.singletonFactory(tokens.LogHandler, c => new LogHandler({
        logger: c.resolve(tokens.ILogger)
    }));
    logger.debug('Interpreter Registrations: Registered LogHandler.');

    registrar.singletonFactory(tokens.ModifyComponentHandler, c => new ModifyComponentHandler({
        entityManager: c.resolve(tokens.EntityManager),
        logger: c.resolve(tokens.ILogger)
    }));
    logger.debug('Interpreter Registrations: Registered ModifyComponentHandler.');

    registrar.singletonFactory(tokens.AddComponentHandler, c => new AddComponentHandler({
        entityManager: c.resolve(tokens.EntityManager),
        logger: c.resolve(tokens.ILogger)
    }));
    logger.debug('Interpreter Registrations: Registered AddComponentHandler.');

    registrar.singletonFactory(tokens.RemoveComponentHandler, c => new RemoveComponentHandler({
        entityManager: c.resolve(tokens.EntityManager),
        logger: c.resolve(tokens.ILogger)
    }));
    logger.debug('Interpreter Registrations: Registered RemoveComponentHandler.');

    registrar.singletonFactory(tokens.QueryComponentHandler, c => new QueryComponentHandler({
        entityManager: c.resolve(tokens.EntityManager),
        logger: c.resolve(tokens.ILogger)
    }));
    logger.debug('Interpreter Registrations: Registered QueryComponentHandler.');

    registrar.singletonFactory(tokens.ModifyDomElementHandler, c => new ModifyDomElementHandler({
        logger: c.resolve(tokens.ILogger)
    }));
    logger.debug('Interpreter Registrations: Registered ModifyDomElementHandler.');

    registrar.singletonFactory(tokens.AppendUiMessageHandler, c => new AppendUiMessageHandler({
        logger: c.resolve(tokens.ILogger)
        // domRenderer: c.resolve(tokens.DomRenderer) // Optional: Uncomment if injecting DomRenderer
    }));
    logger.debug('Interpreter Registrations: Registered AppendUiMessageHandler.');

    // <<< ADDED: Register SetVariableHandler >>>
    registrar.singletonFactory(tokens.SetVariableHandler, c => new SetVariableHandler({
        logger: c.resolve(tokens.ILogger)
    }));
    logger.debug('Interpreter Registrations: Registered SetVariableHandler.'); // <<< ADDED LOG

    // <<< ADDED: Register QuerySystemDataHandler >>>
    registrar.singletonFactory(tokens.QuerySystemDataHandler, c => new QuerySystemDataHandler({
        logger: c.resolve(tokens.ILogger),
        // Ensure SystemDataRegistry is registered under this token elsewhere
        systemDataRegistry: c.resolve(tokens.SystemDataRegistry)
    }));
    logger.debug('Interpreter Registrations: Registered QuerySystemDataHandler.'); // <<< ADDED LOG


    // --- 2. Register Operation Registry ---
    registrar.singletonFactory(tokens.OperationRegistry, (c) => {
        const internalLogger = c.resolve(tokens.ILogger);
        const registry = new OperationRegistry({logger: internalLogger});
        internalLogger.debug('Interpreter Registrations: OperationRegistry factory creating instance...');

        // Bind the execute method of the resolved handler instance
        const bindExecute = (token) => c.resolve(token).execute.bind(c.resolve(token));

        registry.register('DISPATCH_EVENT', bindExecute(tokens.DispatchEventHandler));
        internalLogger.debug('Interpreter Registrations: Registered DISPATCH_EVENT handler within OperationRegistry.');

        registry.register('LOG', bindExecute(tokens.LogHandler));
        internalLogger.debug('Interpreter Registrations: Registered LOG handler within OperationRegistry.');

        registry.register('MODIFY_COMPONENT', bindExecute(tokens.ModifyComponentHandler));
        internalLogger.debug('Interpreter Registrations: Registered MODIFY_COMPONENT handler within OperationRegistry.');

        registry.register('ADD_COMPONENT', bindExecute(tokens.AddComponentHandler));
        internalLogger.debug('Interpreter Registrations: Registered ADD_COMPONENT handler within OperationRegistry.');

        registry.register('REMOVE_COMPONENT', bindExecute(tokens.RemoveComponentHandler));
        internalLogger.debug('Interpreter Registrations: Registered REMOVE_COMPONENT handler within OperationRegistry.');

        registry.register('QUERY_COMPONENT', bindExecute(tokens.QueryComponentHandler));
        internalLogger.debug('Interpreter Registrations: Registered QUERY_COMPONENT handler within OperationRegistry.');

        registry.register('MODIFY_DOM_ELEMENT', bindExecute(tokens.ModifyDomElementHandler));
        internalLogger.debug('Interpreter Registrations: Registered MODIFY_DOM_ELEMENT handler within OperationRegistry.');

        registry.register('APPEND_UI_MESSAGE', bindExecute(tokens.AppendUiMessageHandler));
        internalLogger.debug('Interpreter Registrations: Registered APPEND_UI_MESSAGE handler within OperationRegistry.');

        // <<< ADDED: Register SET_VARIABLE in the registry >>>
        registry.register('SET_VARIABLE', bindExecute(tokens.SetVariableHandler));
        internalLogger.debug('Interpreter Registrations: Registered SET_VARIABLE handler within OperationRegistry.'); // <<< ADDED LOG

        // <<< ADDED: Register QUERY_SYSTEM_DATA in the registry >>>
        registry.register('QUERY_SYSTEM_DATA', bindExecute(tokens.QuerySystemDataHandler));
        internalLogger.debug('Interpreter Registrations: Registered QUERY_SYSTEM_DATA handler within OperationRegistry.'); // <<< ADDED LOG

        internalLogger.debug('Interpreter Registrations: OperationRegistry instance populated.');
        return registry;
    });
    logger.info('Interpreter Registrations: Registered OperationRegistry factory.');


    // --- 3. Register Operation Interpreter ---
    registrar.singletonFactory(tokens.OperationInterpreter, c => new OperationInterpreter({
        logger: c.resolve(tokens.ILogger),
        operationRegistry: c.resolve(tokens.OperationRegistry)
    }));
    logger.info('Interpreter Registrations: Registered OperationInterpreter.');


    // --- 4. Register System Logic Interpreter ---
    registrar.tagged(INITIALIZABLE).singletonFactory(tokens.SystemLogicInterpreter, (c) => {
        const systemLogger = c.resolve(tokens.ILogger);
        systemLogger.debug('Interpreter Registrations: SystemLogicInterpreter factory creating instance...');
        return new SystemLogicInterpreter({
            logger: systemLogger,
            eventBus: c.resolve(tokens.EventBus),
            dataRegistry: c.resolve(tokens.IDataRegistry),
            jsonLogicEvaluationService: c.resolve(tokens.JsonLogicEvaluationService),
            entityManager: c.resolve(tokens.EntityManager),
            operationInterpreter: c.resolve(tokens.OperationInterpreter)
        });
    });
    logger.info(`Interpreter Registrations: Registered SystemLogicInterpreter factory tagged with ${INITIALIZABLE.join(', ')}.`);

    logger.info('Interpreter Registrations: Complete.');
}
