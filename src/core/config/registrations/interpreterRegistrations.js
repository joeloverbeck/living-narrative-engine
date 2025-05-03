// src/core/config/registrations/interpreterRegistrations.js

/**
 * @fileoverview Registers the logic interpretation layer services:
 * OperationRegistry, OperationInterpreter, SystemLogicInterpreter, and their handlers.
 */

// --- JSDoc Imports ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../core/services/systemDataRegistry.js').SystemDataRegistry} SystemDataRegistry */

// --- DI & Helper Imports ---
import {tokens} from '../tokens.js';
import {Registrar} from '../registrarHelpers.js';
// --- MODIFIED: Import SHUTDOWNABLE tag ---
import {INITIALIZABLE, SHUTDOWNABLE} from '../tags.js';

// --- Core Service Imports ---
import OperationRegistry from '../../../logic/operationRegistry.js';
import OperationInterpreter from '../../../logic/operationInterpreter.js';
import SystemLogicInterpreter from '../../../logic/systemLogicInterpreter.js';

// --- Handler Imports ---
import DispatchEventHandler from '../../../logic/operationHandlers/dispatchEventHandler.js';
import LogHandler from '../../../logic/operationHandlers/logHandler.js';
import ModifyComponentHandler from '../../../logic/operationHandlers/modifyComponentHandler.js';
import AddComponentHandler from '../../../logic/operationHandlers/addComponentHandler.js';
import QueryComponentHandler from '../../../logic/operationHandlers/queryComponentHandler.js';
import ModifyDomElementHandler from '../../../logic/operationHandlers/modifyDomElementHandler.js';
import RemoveComponentHandler from "../../../logic/operationHandlers/removeComponentHandler.js";
import AppendUiMessageHandler from '../../../logic/operationHandlers/appendUiMessageHandler.js';
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

    registrar.singletonFactory(tokens.DispatchEventHandler, c => new DispatchEventHandler({
        logger: c.resolve(tokens.ILogger),
        dispatcher: c.resolve(tokens.IValidatedEventDispatcher)
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
        logger: c.resolve(tokens.ILogger),
        domRenderer: c.resolve(tokens.DomRenderer)
    }));
    logger.debug('Interpreter Registrations: Registered ModifyDomElementHandler.');

    registrar.singletonFactory(tokens.AppendUiMessageHandler, c => new AppendUiMessageHandler({
        logger: c.resolve(tokens.ILogger),
        domRenderer: c.resolve(tokens.DomRenderer)
    }));
    logger.debug('Interpreter Registrations: Registered AppendUiMessageHandler.');

    registrar.singletonFactory(tokens.SetVariableHandler, c => new SetVariableHandler({
        logger: c.resolve(tokens.ILogger)
    }));
    logger.debug('Interpreter Registrations: Registered SetVariableHandler.');

    registrar.singletonFactory(tokens.QuerySystemDataHandler, c => new QuerySystemDataHandler({
        logger: c.resolve(tokens.ILogger),
        systemDataRegistry: c.resolve(tokens.SystemDataRegistry)
    }));
    logger.debug('Interpreter Registrations: Registered QuerySystemDataHandler.');


    registrar.singletonFactory(tokens.OperationRegistry, (c) => {
        const internalLogger = c.resolve(tokens.ILogger);
        const registry = new OperationRegistry({logger: internalLogger});
        internalLogger.debug('Interpreter Registrations: OperationRegistry factory creating instance...');

        const bindExecute = (token) => {
            const handlerInstance = c.resolve(token);
            if (!handlerInstance || typeof handlerInstance.execute !== 'function') {
                internalLogger.error(`Interpreter Registrations: Failed to resolve or find execute method for handler token "${token.description || token.toString()}". Cannot register in OperationRegistry.`);
                return (params, context) => {
                    internalLogger.error(`Operation handler for token "${token.description || token.toString()}" was not properly resolved or bound. Operation skipped.`);
                };
            }
            return handlerInstance.execute.bind(handlerInstance);
        };

        registry.register('DISPATCH_EVENT', bindExecute(tokens.DispatchEventHandler));
        registry.register('LOG', bindExecute(tokens.LogHandler));
        registry.register('MODIFY_COMPONENT', bindExecute(tokens.ModifyComponentHandler));
        registry.register('ADD_COMPONENT', bindExecute(tokens.AddComponentHandler));
        registry.register('REMOVE_COMPONENT', bindExecute(tokens.RemoveComponentHandler));
        registry.register('QUERY_COMPONENT', bindExecute(tokens.QueryComponentHandler));
        registry.register('MODIFY_DOM_ELEMENT', bindExecute(tokens.ModifyDomElementHandler));
        registry.register('APPEND_UI_MESSAGE', bindExecute(tokens.AppendUiMessageHandler));
        registry.register('SET_VARIABLE', bindExecute(tokens.SetVariableHandler));
        registry.register('QUERY_SYSTEM_DATA', bindExecute(tokens.QuerySystemDataHandler));

        internalLogger.debug('Interpreter Registrations: Finished registering handlers within OperationRegistry instance.');
        return registry;
    });
    logger.info('Interpreter Registrations: Registered OperationRegistry factory.');


    registrar.singletonFactory(tokens.OperationInterpreter, c => new OperationInterpreter({
        logger: c.resolve(tokens.ILogger),
        operationRegistry: c.resolve(tokens.OperationRegistry)
    }));
    logger.info('Interpreter Registrations: Registered OperationInterpreter.');


    registrar.tagged([...INITIALIZABLE, ...SHUTDOWNABLE]).singletonFactory(tokens.SystemLogicInterpreter, (c) => {
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
    logger.info(`Interpreter Registrations: Registered SystemLogicInterpreter factory tagged with ${[...INITIALIZABLE, ...SHUTDOWNABLE].join(', ')}.`);

    logger.info('Interpreter Registrations: Complete.');
}