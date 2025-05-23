// src/core/config/registrations/coreSystemsRegistrations.js
// --- FILE START ---

/**
 * @fileoverview Registers core game logic systems, particularly those needing initialization or shutdown.
 * Also includes registration for turn-related handlers, resolvers, and the ITurnContext provider.
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../../turns/interfaces/ITurnOrderService.js').ITurnOrderService} ITurnOrderService */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/eventBus.js').EventBus} EventBus */
/** @typedef {import('../../interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../../interfaces/IActionExecutor.js').IActionExecutor} IActionExecutor */
/** @typedef {import('../../services/actionValidationService.js').ActionValidationService} ActionValidationService */
/** @typedef {import('../../interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem_Interface */ // MODIFIED: Changed name for clarity
/** @typedef {import('../../commands/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../../turns/ports/IPromptOutputPort.js').IPromptOutputPort} IPromptOutputPort */
/** @typedef {import('../../turns/ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */
/** @typedef {import('../../turns/handlers/playerTurnHandler.js').default} PlayerTurnHandler_Concrete */ // Renamed for clarity
/** @typedef {import('../../turns/handlers/aiTurnHandler.js').default} AITurnHandler_Concrete */       // Renamed for clarity
/** @typedef {import('../../turns/services/turnHandlerResolver.js').default} TurnHandlerResolver_Concrete */ // Renamed for clarity
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager_Interface */ // MODIFIED: Changed name for clarity
/** @typedef {import('../../interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository */
/** @typedef {import('../../turns/interfaces/IPlayerPromptService.js').IPlayerPromptService} IPlayerPromptService */
/** @typedef {import('../../commands/interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter */
/** @typedef {import('../../interfaces/ICommandInputPort.js').ICommandInputPort} ICommandInputPort */
/** @typedef {import('../../services/subscriptionLifecycleManager.js').default} SubscriptionLifecycleManager */
/** @typedef {import('../../turns/interfaces/ITurnHandler.js').ITurnHandler} ITurnHandler */
/** @typedef {import('../../turns/interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../turns/interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter_Interface */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator_Interface */ // <<< ADDED THIS LINE

// --- System Imports ---
import {ActionDiscoverySystem} from '../../systems/actionDiscoverySystem.js';
import TurnManager from '../../turns/turnManager.js';

// --- Handler & Resolver Imports ---
import PlayerTurnHandler from '../../turns/handlers/playerTurnHandler.js'; // Concrete class for factories
import AITurnHandler from '../../turns/handlers/aiTurnHandler.js';       // Concrete class for factories
import TurnHandlerResolver from '../../turns/services/turnHandlerResolver.js'; // Concrete Class

// --- DI & Helper Imports ---
import {tokens} from '../tokens.js';
import {Registrar} from '../registrarHelpers.js';
import {formatActionCommand} from '../../services/actionFormatter.js';
import {INITIALIZABLE, SHUTDOWNABLE} from "../tags.js";

/**
 * Registers core game systems tagged as initializable and/or shutdownable,
 * along with essential turn-handling services including the ITurnContext provider.
 * Excludes quest-related systems which are registered separately.
 *
 * @export
 * @param {AppContainer} container - The application's DI container.
 */
export function registerCoreSystems(container) {
    const registrar = new Registrar(container);
    /** @type {ILogger} */
    const logger = container.resolve(tokens.ILogger);

    let registrationCount = 0;
    logger.info('Core Systems Registration: Starting...');

    // --- Register ActionDiscoverySystem against its Interface Token using singletonFactory ---
    registrar.tagged(INITIALIZABLE).singletonFactory(tokens.IActionDiscoverySystem, (c) => new ActionDiscoverySystem({
        gameDataRepository: /** @type {IGameDataRepository} */ (c.resolve(tokens.IGameDataRepository)),
        entityManager: /** @type {IEntityManager_Interface} */ (c.resolve(tokens.IEntityManager)),
        actionValidationService: c.resolve(tokens.ActionValidationService),
        logger: c.resolve(tokens.ILogger),
        formatActionCommandFn: formatActionCommand,
        getEntityIdsForScopesFn: () => new Set()
    }));
    logger.debug(`Core Systems Registration: Registered ${String(tokens.IActionDiscoverySystem)} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;


    // --- Turn Handlers, Resolver, and Manager ---
    // PlayerTurnHandler registration remains for potential direct use if needed.
    registrar.tagged(SHUTDOWNABLE).singletonFactory(tokens.PlayerTurnHandler, (c) =>
        new PlayerTurnHandler({
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
            commandProcessor: /** @type {ICommandProcessor} */ (c.resolve(tokens.ICommandProcessor)),
            turnEndPort: /** @type {ITurnEndPort} */ (c.resolve(tokens.ITurnEndPort)),
            playerPromptService: /** @type {IPlayerPromptService} */ (c.resolve(tokens.IPlayerPromptService)),
            commandOutcomeInterpreter: /** @type {ICommandOutcomeInterpreter} */ (c.resolve(tokens.ICommandOutcomeInterpreter)),
            safeEventDispatcher: /** @type {ISafeEventDispatcher} */ (c.resolve(tokens.ISafeEventDispatcher)),
            subscriptionLifecycleManager: /** @type {SubscriptionLifecycleManager} */ (c.resolve(tokens.SubscriptionLifecycleManager))
        })
    );
    logger.debug(`Core Systems Registration: Registered ${tokens.PlayerTurnHandler} tagged ${SHUTDOWNABLE.join(', ')}.`);
    registrationCount++;

    // AITurnHandler registration is primarily for the factory now, but can remain for direct resolution if necessary.
    // If AITurnHandler itself needs to be SHUTDOWNABLE, add the tag here.
    registrar.singletonFactory(tokens.AITurnHandler, (c) => new AITurnHandler({
        logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
        gameWorldAccess: /** @type {IWorldContext} */ (c.resolve(tokens.IWorldContext)),
        turnEndPort: /** @type {ITurnEndPort} */ (c.resolve(tokens.ITurnEndPort)),
        illmAdapter: /** @type {ILLMAdapter_Interface} */ (c.resolve(tokens.ILLMAdapter)),
        commandProcessor: /** @type {ICommandProcessor} */ (c.resolve(tokens.ICommandProcessor)),
        commandOutcomeInterpreter: /** @type {ICommandOutcomeInterpreter} */ (c.resolve(tokens.ICommandOutcomeInterpreter)),
        safeEventDispatcher: /** @type {ISafeEventDispatcher} */ (c.resolve(tokens.ISafeEventDispatcher)),
        subscriptionManager: /** @type {SubscriptionLifecycleManager} */ (c.resolve(tokens.SubscriptionLifecycleManager)),
        entityManager: /** @type {IEntityManager_Interface} */ (c.resolve(tokens.IEntityManager)),
        actionDiscoverySystem: /** @type {IActionDiscoverySystem_Interface} */ (c.resolve(tokens.IActionDiscoverySystem)),
        schemaValidator: /** @type {ISchemaValidator_Interface} */ (c.resolve(tokens.ISchemaValidator)), // <<< MODIFIED: Added ISchemaValidator
    }));
    logger.debug(`Core Systems Registration: Registered ${tokens.AITurnHandler}.`);
    registrationCount++;

    // ****** MODIFIED SECTION START ******
    registrar.singletonFactory(tokens.TurnHandlerResolver, (c) => {
        // Define factory functions that will create NEW instances of handlers
        const createPlayerHandlerFactory = () => new PlayerTurnHandler({
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
            commandProcessor: /** @type {ICommandProcessor} */ (c.resolve(tokens.ICommandProcessor)),
            turnEndPort: /** @type {ITurnEndPort} */ (c.resolve(tokens.ITurnEndPort)),
            playerPromptService: /** @type {IPlayerPromptService} */ (c.resolve(tokens.IPlayerPromptService)),
            commandOutcomeInterpreter: /** @type {ICommandOutcomeInterpreter} */ (c.resolve(tokens.ICommandOutcomeInterpreter)),
            safeEventDispatcher: /** @type {ISafeEventDispatcher} */ (c.resolve(tokens.ISafeEventDispatcher)),
            subscriptionLifecycleManager: /** @type {SubscriptionLifecycleManager} */ (c.resolve(tokens.SubscriptionLifecycleManager)),
        });

        const createAiHandlerFactory = () => {
            const resolvedLogger = /** @type {ILogger} */ (c.resolve(tokens.ILogger));
            const resolvedIllmAdapter = /** @type {ILLMAdapter_Interface} */ (c.resolve(tokens.ILLMAdapter));
            const resolvedEntityManager = /** @type {IEntityManager_Interface} */ (c.resolve(tokens.IEntityManager));
            const resolvedActionDiscoverySystem = /** @type {IActionDiscoverySystem_Interface} */ (c.resolve(tokens.IActionDiscoverySystem));
            const resolvedSchemaValidator = /** @type {ISchemaValidator_Interface} */ (c.resolve(tokens.ISchemaValidator)); // <<< MODIFIED: Resolve ISchemaValidator

            if (!resolvedIllmAdapter) {
                resolvedLogger.error(`CoreSystemsRegistration: Failed to resolve ${String(tokens.ILLMAdapter)} for AITurnHandler factory.`);
                throw new Error(`Missing dependency ${String(tokens.ILLMAdapter)} for AITurnHandler factory`);
            }
            if (!resolvedEntityManager) {
                resolvedLogger.error(`CoreSystemsRegistration: Failed to resolve ${String(tokens.IEntityManager)} for AITurnHandler factory.`);
                throw new Error(`Missing dependency ${String(tokens.IEntityManager)} for AITurnHandler factory`);
            }
            if (!resolvedActionDiscoverySystem) {
                resolvedLogger.error(`CoreSystemsRegistration: Failed to resolve ${String(tokens.IActionDiscoverySystem)} for AITurnHandler factory.`);
                throw new Error(`Missing dependency ${String(tokens.IActionDiscoverySystem)} for AITurnHandler factory`);
            }
            if (!resolvedSchemaValidator) { // <<< MODIFIED: Add check for ISchemaValidator
                resolvedLogger.error(`CoreSystemsRegistration: Failed to resolve ${String(tokens.ISchemaValidator)} for AITurnHandler factory.`);
                throw new Error(`Missing dependency ${String(tokens.ISchemaValidator)} for AITurnHandler factory`);
            }
            return new AITurnHandler({
                logger: resolvedLogger,
                gameWorldAccess: /** @type {IWorldContext} */ (c.resolve(tokens.IWorldContext)),
                turnEndPort: /** @type {ITurnEndPort} */ (c.resolve(tokens.ITurnEndPort)),
                illmAdapter: resolvedIllmAdapter,
                commandProcessor: /** @type {ICommandProcessor} */ (c.resolve(tokens.ICommandProcessor)),
                commandOutcomeInterpreter: /** @type {ICommandOutcomeInterpreter} */ (c.resolve(tokens.ICommandOutcomeInterpreter)),
                safeEventDispatcher: /** @type {ISafeEventDispatcher} */ (c.resolve(tokens.ISafeEventDispatcher)),
                subscriptionManager: /** @type {SubscriptionLifecycleManager} */ (c.resolve(tokens.SubscriptionLifecycleManager)),
                entityManager: resolvedEntityManager,
                actionDiscoverySystem: resolvedActionDiscoverySystem,
                schemaValidator: resolvedSchemaValidator, // <<< MODIFIED: Pass ISchemaValidator
            });
        };

        return new TurnHandlerResolver({
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
            createPlayerTurnHandler: createPlayerHandlerFactory,
            createAiTurnHandler: createAiHandlerFactory
        });
    });
    // ****** MODIFIED SECTION END ******
    logger.debug(`Core Systems Registration: Registered ${tokens.TurnHandlerResolver} (with handler factories).`);
    registrationCount++;

    registrar.tagged(INITIALIZABLE).singletonFactory(tokens.ITurnManager, (c) => new TurnManager({
        turnOrderService: /** @type {ITurnOrderService} */ (c.resolve(tokens.ITurnOrderService)),
        entityManager: /** @type {IEntityManager_Interface} */ (c.resolve(tokens.IEntityManager)),
        logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
        dispatcher: /** @type {IValidatedEventDispatcher} */ (c.resolve(tokens.IValidatedEventDispatcher)),
        turnHandlerResolver: /** @type {TurnHandlerResolver_Concrete} */ (c.resolve(tokens.TurnHandlerResolver))
    }));
    logger.debug(`Core Systems Registration: Registered ${tokens.ITurnManager} tagged ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;

    container.register(
        tokens.ITurnContext,
        (c) => {
            const localLogger = /** @type {ILogger} */ (c.resolve(tokens.ILogger));
            const turnManager = /** @type {ITurnManager | null} */ (c.resolve(tokens.ITurnManager));

            if (!turnManager) {
                localLogger.warn(`ITurnContext Factory: ${String(tokens.ITurnManager)} could not be resolved. Returning null.`);
                return null;
            }

            const activeHandler = turnManager.getActiveTurnHandler();
            if (activeHandler && typeof activeHandler.getTurnContext === 'function') {
                const context = activeHandler.getTurnContext();
                return context;
            } else if (activeHandler) {
                localLogger.warn(`ITurnContext Factory: Active handler (${activeHandler.constructor.name}) found, but getTurnContext is not a function. Returning null.`);
            }
            return null;
        },
        {lifecycle: 'transient'}
    );
    logger.debug(`Core Systems Registration: Registered transient factory for ${String(tokens.ITurnContext)}.`);
    registrationCount++;


    logger.info(`Core Systems Registration: Completed registering ${registrationCount} systems, handlers, services, and providers.`);
}

// --- FILE END ---