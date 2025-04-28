/**
 * @fileoverview Registers the logic interpretation layer services:
 * OperationRegistry, OperationInterpreter, SystemLogicInterpreter, and their handlers.
 */

// --- JSDoc Imports ---
/** @typedef {import('../../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

// --- DI & Helper Imports ---
import {tokens} from '../../tokens.js';
import {Registrar} from '../../dependencyInjection/registrarHelpers.js';

// --- Core Service Imports ---
import OperationRegistry from '../../../logic/operationRegistry.js';
import OperationInterpreter from '../../../logic/operationInterpreter.js';
import SystemLogicInterpreter from '../../../logic/systemLogicInterpreter.js';

// --- Handler Imports (All handlers imported ONLY here as per requirements) ---
import DispatchEventHandler from '../../../logic/operationHandlers/dispatchEventHandler.js';
import LogHandler from '../../../logic/operationHandlers/logHandler.js';
import ModifyComponentHandler from '../../../logic/operationHandlers/modifyComponentHandler.js';
import QueryComponentHandler from '../../../logic/operationHandlers/queryComponentHandler.js';
import ModifyDomElementHandler from '../../../logic/operationHandlers/modifyDomElementHandler.js';

// --- ADDED: Import or define INITIALIZABLE ---
// Choose one option:
// import { INITIALIZABLE } from './coreSystemsRegistrations.js'; // Assuming it's exported there
const INITIALIZABLE = ['initializableSystem']; // Or define locally if preferred


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
        dispatcher: c.resolve(tokens.ValidatedEventDispatcher)
    }));
    logger.debug('Interpreter Registrations: Registered DispatchEventHandler.');

    // LogHandler expects { logger }
    registrar.singletonFactory(tokens.LogHandler, c => new LogHandler({
        logger: c.resolve(tokens.ILogger)
    }));
    logger.debug('Interpreter Registrations: Registered LogHandler.');

    // ModifyComponentHandler expects { entityManager, logger }
    registrar.singletonFactory(tokens.ModifyComponentHandler, c => new ModifyComponentHandler({
        entityManager: c.resolve(tokens.EntityManager),
        logger: c.resolve(tokens.ILogger)
    }));
    logger.debug('Interpreter Registrations: Registered ModifyComponentHandler.');

    // QueryComponentHandler expects { entityManager, logger }
    registrar.singletonFactory(tokens.QueryComponentHandler, c => new QueryComponentHandler({
        entityManager: c.resolve(tokens.EntityManager),
        logger: c.resolve(tokens.ILogger)
    }));
    logger.debug('Interpreter Registrations: Registered QueryComponentHandler.');

    // ======================================================
    // <<< CORRECTION HERE >>>
    // Change registrar.single to registrar.singletonFactory to match constructor signature { logger }
    registrar.singletonFactory(tokens.ModifyDomElementHandler, c => new ModifyDomElementHandler({
        logger: c.resolve(tokens.ILogger)
    }));
    // ======================================================
    logger.debug('Interpreter Registrations: Registered ModifyDomElementHandler.');


    // --- 2. Register Operation Registry ---
    registrar.singletonFactory(tokens.OperationRegistry, (c) => {
        const internalLogger = c.resolve(tokens.ILogger);
        const registry = new OperationRegistry({logger: internalLogger});
        internalLogger.debug('Interpreter Registrations: OperationRegistry factory creating instance...');
        registry.register('DISPATCH_EVENT', c.resolve(tokens.DispatchEventHandler).execute.bind(c.resolve(tokens.DispatchEventHandler)));
        internalLogger.debug('Interpreter Registrations: Registered DISPATCH_EVENT handler within OperationRegistry.');
        registry.register('LOG', c.resolve(tokens.LogHandler).execute.bind(c.resolve(tokens.LogHandler)));
        internalLogger.debug('Interpreter Registrations: Registered LOG handler within OperationRegistry.');
        registry.register('MODIFY_COMPONENT', c.resolve(tokens.ModifyComponentHandler).execute.bind(c.resolve(tokens.ModifyComponentHandler)));
        internalLogger.debug('Interpreter Registrations: Registered MODIFY_COMPONENT handler within OperationRegistry.');
        registry.register('QUERY_COMPONENT', c.resolve(tokens.QueryComponentHandler).execute.bind(c.resolve(tokens.QueryComponentHandler)));
        internalLogger.debug('Interpreter Registrations: Registered QUERY_COMPONENT handler within OperationRegistry.');
        registry.register('MODIFY_DOM_ELEMENT', c.resolve(tokens.ModifyDomElementHandler).execute.bind(c.resolve(tokens.ModifyDomElementHandler))); // This resolve will now use the corrected factory
        internalLogger.debug('Interpreter Registrations: Registered MODIFY_DOM_ELEMENT handler within OperationRegistry.');
        internalLogger.debug('Interpreter Registrations: OperationRegistry instance populated.');
        return registry;
    });
    logger.info('Interpreter Registrations: Registered OperationRegistry factory.');


    // --- 3. Register Operation Interpreter ---
    // OperationInterpreter expects { logger, operationRegistry }
    registrar.singletonFactory(tokens.OperationInterpreter, c => new OperationInterpreter({
        logger: c.resolve(tokens.ILogger),
        operationRegistry: c.resolve(tokens.OperationRegistry)
    }));
    logger.info('Interpreter Registrations: Registered OperationInterpreter.');


    // --- 4. Register System Logic Interpreter ---
    // SystemLogicInterpreter expects { logger, eventBus, dataRegistry, jsonLogicEvaluationService, entityManager, operationInterpreter }
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