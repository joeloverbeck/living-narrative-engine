// src/core/config/registrations/interpreterRegistrations.js

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
    // These are registered as singletons first, so they can be resolved
    // by the OperationRegistry factory function later.

    registrar.singletonFactory(tokens.DispatchEventHandler, c => new DispatchEventHandler({
        // DispatchEventHandler prefers ValidatedEventDispatcher but can use EventBus
        // We resolve ValidatedEventDispatcher here, assuming it's the primary choice.
        dispatcher: c.resolve(tokens.ValidatedEventDispatcher)
    }));
    logger.debug('Interpreter Registrations: Registered DispatchEventHandler.');

    registrar.single(tokens.LogHandler, LogHandler, [
        tokens.ILogger // LogHandler takes logger directly
    ]);
    logger.debug('Interpreter Registrations: Registered LogHandler.');

    registrar.single(tokens.ModifyComponentHandler, ModifyComponentHandler, [
        tokens.EntityManager,
        tokens.ILogger
    ]);
    logger.debug('Interpreter Registrations: Registered ModifyComponentHandler.');

    registrar.single(tokens.QueryComponentHandler, QueryComponentHandler, [
        tokens.EntityManager,
        tokens.ILogger
    ]);
    logger.debug('Interpreter Registrations: Registered QueryComponentHandler.');


    // --- 2. Register Operation Registry ---
    // Use singletonFactory because it needs to instantiate handlers and register them internally.
    registrar.singletonFactory(tokens.OperationRegistry, (c) => {
        const internalLogger = c.resolve(tokens.ILogger);
        const registry = new OperationRegistry({logger: internalLogger});
        internalLogger.debug('Interpreter Registrations: OperationRegistry factory creating instance...');

        // Resolve handlers and register them
        registry.register('DISPATCH_EVENT', c.resolve(tokens.DispatchEventHandler).execute.bind(c.resolve(tokens.DispatchEventHandler)));
        internalLogger.debug('Interpreter Registrations: Registered DISPATCH_EVENT handler within OperationRegistry.');

        registry.register('LOG', c.resolve(tokens.LogHandler).execute.bind(c.resolve(tokens.LogHandler)));
        internalLogger.debug('Interpreter Registrations: Registered LOG handler within OperationRegistry.');

        registry.register('MODIFY_COMPONENT', c.resolve(tokens.ModifyComponentHandler).execute.bind(c.resolve(tokens.ModifyComponentHandler)));
        internalLogger.debug('Interpreter Registrations: Registered MODIFY_COMPONENT handler within OperationRegistry.');

        registry.register('QUERY_COMPONENT', c.resolve(tokens.QueryComponentHandler).execute.bind(c.resolve(tokens.QueryComponentHandler)));
        internalLogger.debug('Interpreter Registrations: Registered QUERY_COMPONENT handler within OperationRegistry.');

        // Add registrations for any other handlers here...

        internalLogger.debug('Interpreter Registrations: OperationRegistry instance populated.');
        return registry;
    });
    logger.info('Interpreter Registrations: Registered OperationRegistry factory.');


    // --- 3. Register Operation Interpreter ---
    // Depends on ILogger and the OperationRegistry registered above.
    registrar.single(tokens.OperationInterpreter, OperationInterpreter, [
        tokens.ILogger,
        tokens.OperationRegistry
    ]);
    logger.info('Interpreter Registrations: Registered OperationInterpreter.');


    // --- 4. Register System Logic Interpreter ---
    // Depends on multiple services, including OperationInterpreter registered above.
    // Use singletonFactory because constructor takes a single dependencies object.
    registrar.singletonFactory(tokens.SystemLogicInterpreter, (c) => {
        const systemLogger = c.resolve(tokens.ILogger);
        systemLogger.debug('Interpreter Registrations: SystemLogicInterpreter factory creating instance...');
        // Note: SystemLogicInterpreter should not be initialized (call .initialize()) here.
        // Initialization happens later in the application lifecycle.
        return new SystemLogicInterpreter({
            logger: systemLogger,
            eventBus: c.resolve(tokens.EventBus),
            dataRegistry: c.resolve(tokens.IDataRegistry),
            jsonLogicEvaluationService: c.resolve(tokens.JsonLogicEvaluationService),
            entityManager: c.resolve(tokens.EntityManager),
            operationInterpreter: c.resolve(tokens.OperationInterpreter) // Dependency
        });
    });
    logger.info('Interpreter Registrations: Registered SystemLogicInterpreter factory.');

    logger.info('Interpreter Registrations: Complete.');
} // LOC count: ~100 (well within < 200 limit)