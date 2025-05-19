// src/core/config/registrations/coreSystemsRegistrations.js
// ****** MODIFIED FILE ******

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
/** @typedef {import('../../../services/actionValidationService.js').ActionValidationService} ActionValidationService */
/** @typedef {import('../../interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem */
/** @typedef {import('../../commands/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../../turns/ports/IPromptOutputPort.js').IPromptOutputPort} IPromptOutputPort */
/** @typedef {import('../../turns/ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */
/** @typedef {import('../../turns/handlers/playerTurnHandler.js').default} PlayerTurnHandler_Concrete */ // Renamed for clarity
/** @typedef {import('../../turns/handlers/aiTurnHandler.js').default} AITurnHandler_Concrete */       // Renamed for clarity
/** @typedef {import('../../turns/services/turnHandlerResolver.js').default} TurnHandlerResolver */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository */
/** @typedef {import('../../turns/interfaces/IPlayerPromptService.js').IPlayerPromptService} IPlayerPromptService */
/** @typedef {import('../../commands/interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter */
/** @typedef {import('../../interfaces/ICommandInputPort.js').ICommandInputPort} ICommandInputPort */
/** @typedef {import('../../services/subscriptionLifecycleManager.js').default} SubscriptionLifecycleManager */
/** @typedef {import('../../turns/interfaces/ITurnHandler.js').ITurnHandler} ITurnHandler */
/** @typedef {import('../../turns/interfaces/ITurnContext.js').ITurnContext} ITurnContext */

// --- System Imports ---
import {ActionDiscoverySystem} from '../../../systems/actionDiscoverySystem.js';
import TurnManager from '../../turns/turnManager.js';

// --- Handler & Resolver Imports ---
import PlayerTurnHandler from '../../turns/handlers/playerTurnHandler.js'; // Concrete class for factories
import AITurnHandler from '../../turns/handlers/aiTurnHandler.js';       // Concrete class for factories
import TurnHandlerResolver from '../../turns/services/turnHandlerResolver.js';

// --- DI & Helper Imports ---
import {tokens} from '../tokens.js';
import {Registrar} from '../registrarHelpers.js';
import {formatActionCommand} from '../../../services/actionFormatter.js';
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
        entityManager: /** @type {IEntityManager} */ (c.resolve(tokens.IEntityManager)),
        actionValidationService: c.resolve(tokens.ActionValidationService),
        logger: c.resolve(tokens.ILogger),
        formatActionCommandFn: formatActionCommand,
        getEntityIdsForScopesFn: () => new Set()
    }));
    logger.debug(`Core Systems Registration: Registered ${String(tokens.IActionDiscoverySystem)} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;


    // --- Turn Handlers, Resolver, and Manager ---

    // Note: The following registrations for PlayerTurnHandler and AITurnHandler
    // as singletons might still be useful if other parts of your system need to
    // resolve a specific, shared instance of these handlers for some reason
    // (e.g., for configuration or direct access outside of the turn loop).
    // However, the TurnHandlerResolver will now use its own factories to create
    // *new* instances for each turn. If these tokens are *only* for the resolver,
    // and the resolver now uses factories, these specific singleton registrations
    // for the concrete handler types might become optional or could be removed
    // if they cause confusion. For now, they are left to minimize breaking changes
    // elsewhere, but the resolver below is changed.

    registrar.tagged(SHUTDOWNABLE).singletonFactory(tokens.PlayerTurnHandler, (c) =>
        new PlayerTurnHandler({
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
            commandProcessor: /** @type {ICommandProcessor} */ (c.resolve(tokens.ICommandProcessor)),
            turnEndPort: /** @type {ITurnEndPort} */ (c.resolve(tokens.ITurnEndPort)),
            playerPromptService: /** @type {IPlayerPromptService} */ (c.resolve(tokens.IPlayerPromptService)),
            commandOutcomeInterpreter: /** @type {ICommandOutcomeInterpreter} */ (c.resolve(tokens.ICommandOutcomeInterpreter)),
            safeEventDispatcher: /** @type {ISafeEventDispatcher} */ (c.resolve(tokens.ISafeEventDispatcher)),
            subscriptionLifecycleManager: /** @type {SubscriptionLifecycleManager} */ (c.resolve(tokens.SubscriptionLifecycleManager))
            // gameWorldAccess defaults to {} in PlayerTurnHandler constructor, so not explicitly passed here
        })
    );
    logger.debug(`Core Systems Registration: Registered ${tokens.PlayerTurnHandler} tagged ${SHUTDOWNABLE.join(', ')}.`);
    registrationCount++;

    registrar.singletonFactory(tokens.AITurnHandler, (c) => new AITurnHandler({
        logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
        // Dependencies for AITurnHandler based on its constructor in aiTurnHandler.js:
        gameWorldAccess: /** @type {IWorldContext} */ (c.resolve(tokens.IWorldContext)), // Assuming IWorldContext for gameWorldAccess
        turnEndPort: /** @type {ITurnEndPort} */ (c.resolve(tokens.ITurnEndPort))
        // Other dependencies like commandProcessor, actionDiscoverySystem, etc.,
        // were in the original registration but are not in AITurnHandler's current constructor.
        // Added them back based on original registration as they might be used by a fuller AI implementation.
        // If AITurnHandler.js is updated to use them, uncomment. For now, matching its actual constructor:
        // commandProcessor: /** @type {ICommandProcessor} */ (c.resolve(tokens.ICommandProcessor)),
        // actionDiscoverySystem: /** @type {IActionDiscoverySystem} */ (c.resolve(tokens.IActionDiscoverySystem)),
        // validatedEventDispatcher: /** @type {IValidatedEventDispatcher} */ (c.resolve(tokens.IValidatedEventDispatcher)),
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
            // PlayerTurnHandler's constructor has `gameWorldAccess = {}` as a default.
            // If you want to inject a specific instance, resolve it here:
            // gameWorldAccess: c.resolve(tokens.YourGameWorldAccessToken),
        });

        const createAiHandlerFactory = () => new AITurnHandler({
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
            // AITurnHandler's constructor has `gameWorldAccess = {}` as a default.
            // The original registration passed IWorldContext for this.
            gameWorldAccess: /** @type {IWorldContext} */ (c.resolve(tokens.IWorldContext)),
            turnEndPort: /** @type {ITurnEndPort} */ (c.resolve(tokens.ITurnEndPort)),
            // Add other dependencies here if AITurnHandler's constructor changes
        });

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
        entityManager: /** @type {IEntityManager} */ (c.resolve(tokens.IEntityManager)),
        logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
        dispatcher: /** @type {IValidatedEventDispatcher} */ (c.resolve(tokens.IValidatedEventDispatcher)),
        turnHandlerResolver: /** @type {TurnHandlerResolver} */ (c.resolve(tokens.TurnHandlerResolver)) // Resolves the resolver configured with factories
    }));
    logger.debug(`Core Systems Registration: Registered ${tokens.ITurnManager} tagged ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;

    // --- Provider for current ITurnContext (Transient) ---
    // ... (this part remains unchanged) ...
    container.register(
        tokens.ITurnContext,
        (c) => {
            const localLogger = /** @type {ILogger} */ (c.resolve(tokens.ILogger));
            const turnManager = /** @type {ITurnManager | null} */ (c.resolve(tokens.ITurnManager));

            if (!turnManager) {
                localLogger.warn(`ITurnContext Factory: ${tokens.ITurnManager} could not be resolved. Returning null.`);
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
    logger.debug(`Core Systems Registration: Registered transient factory for ${tokens.ITurnContext}.`);
    registrationCount++;


    logger.info(`Core Systems Registration: Completed registering ${registrationCount} systems, handlers, services, and providers.`);
}

// --- FILE END ---