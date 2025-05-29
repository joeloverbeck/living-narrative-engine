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
// EventBus typedef might not be needed if not directly used.
/** @typedef {import('../../interfaces/IWorldContext.js').IWorldContext} IWorldContext */
// IActionExecutor typedef might not be needed if not directly used.
/** @typedef {import('../../interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem_Interface */
/** @typedef {import('../../commands/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../../turns/ports/IPromptOutputPort.js').IPromptOutputPort} IPromptOutputPort */
/** @typedef {import('../../turns/ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */
/** @typedef {import('../../turns/handlers/playerTurnHandler.js').default} PlayerTurnHandler_Concrete */
/** @typedef {import('../../turns/handlers/aiTurnHandler.js').default} AITurnHandler_Concrete */
/** @typedef {import('../../turns/services/turnHandlerResolver.js').default} TurnHandlerResolver_Concrete */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager_Interface */
/** @typedef {import('../../interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository */
/** @typedef {import('../../turns/interfaces/IHumanPlayerPromptService.js').IHumanPlayerPromptService} IPlayerPromptService */
/** @typedef {import('../../commands/interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter */
// ICommandInputPort typedef might not be needed if not directly used.
/** @typedef {import('../../services/subscriptionLifecycleManager.js').default} SubscriptionLifecycleManager */
// ITurnHandler typedef might not be needed if not directly used.
/** @typedef {import('../../turns/interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../turns/interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter_Interface */
// ISchemaValidator_Interface typedef removed as AITurnHandler no longer directly depends on it here.

// --- NEW JSDoc IMPORTS ---
/** @typedef {import('../../turns/interfaces/factories/ITurnStateFactory.js').ITurnStateFactory} ITurnStateFactory */
/** @typedef {import('../../turns/interfaces/factories/IAIPlayerStrategyFactory.js').IAIPlayerStrategyFactory} IAIPlayerStrategyFactory */
/** @typedef {import('../../turns/interfaces/factories/ITurnContextFactory.js').ITurnContextFactory} ITurnContextFactory */
/** @typedef {import('../../turns/interfaces/IAIGameStateProvider.js').IAIGameStateProvider} IAIGameStateProvider */
/** @typedef {import('../../services/AIPromptContentProvider.js').AIPromptContentProvider} IAIPromptContentProvider */
/** @typedef {import('../../turns/interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor */
/** @typedef {import('../../services/promptBuilder.js').PromptBuilder} IPromptBuilder */


// --- System Imports ---
import {ActionDiscoverySystem} from '../../systems/actionDiscoverySystem.js';
import TurnManager from '../../turns/turnManager.js';

// --- Handler & Resolver Imports ---
import PlayerTurnHandler from '../../turns/handlers/playerTurnHandler.js';
import AITurnHandler from '../../turns/handlers/aiTurnHandler.js';
import TurnHandlerResolver from '../../turns/services/turnHandlerResolver.js';

// --- DI & Helper Imports ---
import {tokens} from '../tokens.js';
import {Registrar} from '../registrarHelpers.js';
import {formatActionCommand} from '../../services/actionFormatter.js';
import {INITIALIZABLE, SHUTDOWNABLE} from "../tags.js";

export function registerCoreSystems(container) {
    const registrar = new Registrar(container);
    /** @type {ILogger} */
    const logger = container.resolve(tokens.ILogger);

    let registrationCount = 0;
    logger.info('Core Systems Registration: Starting...');

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

    registrar.tagged(SHUTDOWNABLE).singletonFactory(tokens.PlayerTurnHandler, (c) =>
        new PlayerTurnHandler({
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
            turnStateFactory: /** @type {ITurnStateFactory} */ (c.resolve(tokens.ITurnStateFactory)), // MODIFIED
            commandProcessor: /** @type {ICommandProcessor} */ (c.resolve(tokens.ICommandProcessor)),
            turnEndPort: /** @type {ITurnEndPort} */ (c.resolve(tokens.ITurnEndPort)),
            playerPromptService: /** @type {IPlayerPromptService} */ (c.resolve(tokens.IPlayerPromptService)),
            commandOutcomeInterpreter: /** @type {ICommandOutcomeInterpreter} */ (c.resolve(tokens.ICommandOutcomeInterpreter)),
            safeEventDispatcher: /** @type {ISafeEventDispatcher} */ (c.resolve(tokens.ISafeEventDispatcher)),
            subscriptionLifecycleManager: /** @type {SubscriptionLifecycleManager} */ (c.resolve(tokens.SubscriptionLifecycleManager)),
            // gameWorldAccess can be added if PlayerTurnHandler needs it and it's defined in tokens
        })
    );
    logger.debug(`Core Systems Registration: Registered ${tokens.PlayerTurnHandler} tagged ${SHUTDOWNABLE.join(', ')}.`);
    registrationCount++;

    registrar.singletonFactory(tokens.AITurnHandler, (c) => {
        return new AITurnHandler({
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
            turnStateFactory: /** @type {ITurnStateFactory} */ (c.resolve(tokens.ITurnStateFactory)), // MODIFIED
            gameWorldAccess: /** @type {IWorldContext} */ (c.resolve(tokens.IWorldContext)),
            turnEndPort: /** @type {ITurnEndPort} */ (c.resolve(tokens.ITurnEndPort)),
            illmAdapter: /** @type {ILLMAdapter_Interface} */ (c.resolve(tokens.ILLMAdapter)),
            commandProcessor: /** @type {ICommandProcessor} */ (c.resolve(tokens.ICommandProcessor)),
            commandOutcomeInterpreter: /** @type {ICommandOutcomeInterpreter} */ (c.resolve(tokens.ICommandOutcomeInterpreter)),
            safeEventDispatcher: /** @type {ISafeEventDispatcher} */ (c.resolve(tokens.ISafeEventDispatcher)),
            subscriptionManager: /** @type {SubscriptionLifecycleManager} */ (c.resolve(tokens.SubscriptionLifecycleManager)),
            entityManager: /** @type {IEntityManager_Interface} */ (c.resolve(tokens.IEntityManager)),
            actionDiscoverySystem: /** @type {IActionDiscoverySystem_Interface} */ (c.resolve(tokens.IActionDiscoverySystem)),
            promptBuilder: /** @type {IPromptBuilder} */ (c.resolve(tokens.IPromptBuilder)),
            aiPlayerStrategyFactory: /** @type {IAIPlayerStrategyFactory} */ (c.resolve(tokens.IAIPlayerStrategyFactory)),
            turnContextFactory: /** @type {ITurnContextFactory} */ (c.resolve(tokens.ITurnContextFactory)),
            gameStateProvider: /** @type {IAIGameStateProvider} */ (c.resolve(tokens.IAIGameStateProvider)),
            promptContentProvider: /** @type {IAIPromptContentProvider} */ (c.resolve(tokens.IAIPromptContentProvider)),
            llmResponseProcessor: /** @type {ILLMResponseProcessor} */ (c.resolve(tokens.ILLMResponseProcessor)),
        });
    });
    logger.debug(`Core Systems Registration: Registered ${tokens.AITurnHandler}.`);
    registrationCount++;

    registrar.singletonFactory(tokens.TurnHandlerResolver, (c) => {
        const createPlayerHandlerFactory = () => new PlayerTurnHandler({
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
            turnStateFactory: /** @type {ITurnStateFactory} */ (c.resolve(tokens.ITurnStateFactory)), // MODIFIED
            commandProcessor: /** @type {ICommandProcessor} */ (c.resolve(tokens.ICommandProcessor)),
            turnEndPort: /** @type {ITurnEndPort} */ (c.resolve(tokens.ITurnEndPort)),
            playerPromptService: /** @type {IPlayerPromptService} */ (c.resolve(tokens.IPlayerPromptService)),
            commandOutcomeInterpreter: /** @type {ICommandOutcomeInterpreter} */ (c.resolve(tokens.ICommandOutcomeInterpreter)),
            safeEventDispatcher: /** @type {ISafeEventDispatcher} */ (c.resolve(tokens.ISafeEventDispatcher)),
            subscriptionLifecycleManager: /** @type {SubscriptionLifecycleManager} */ (c.resolve(tokens.SubscriptionLifecycleManager)),
        });

        const createAiHandlerFactory = () => {
            return new AITurnHandler({
                logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
                turnStateFactory: /** @type {ITurnStateFactory} */ (c.resolve(tokens.ITurnStateFactory)), // MODIFIED
                gameWorldAccess: /** @type {IWorldContext} */ (c.resolve(tokens.IWorldContext)),
                turnEndPort: /** @type {ITurnEndPort} */ (c.resolve(tokens.ITurnEndPort)),
                illmAdapter: /** @type {ILLMAdapter_Interface} */ (c.resolve(tokens.ILLMAdapter)),
                commandProcessor: /** @type {ICommandProcessor} */ (c.resolve(tokens.ICommandProcessor)),
                commandOutcomeInterpreter: /** @type {ICommandOutcomeInterpreter} */ (c.resolve(tokens.ICommandOutcomeInterpreter)),
                safeEventDispatcher: /** @type {ISafeEventDispatcher} */ (c.resolve(tokens.ISafeEventDispatcher)),
                subscriptionManager: /** @type {SubscriptionLifecycleManager} */ (c.resolve(tokens.SubscriptionLifecycleManager)),
                entityManager: /** @type {IEntityManager_Interface} */ (c.resolve(tokens.IEntityManager)),
                actionDiscoverySystem: /** @type {IActionDiscoverySystem_Interface} */ (c.resolve(tokens.IActionDiscoverySystem)),
                promptBuilder: /** @type {IPromptBuilder} */ (c.resolve(tokens.IPromptBuilder)),
                aiPlayerStrategyFactory: /** @type {IAIPlayerStrategyFactory} */ (c.resolve(tokens.IAIPlayerStrategyFactory)),
                turnContextFactory: /** @type {ITurnContextFactory} */ (c.resolve(tokens.ITurnContextFactory)),
                gameStateProvider: /** @type {IAIGameStateProvider} */ (c.resolve(tokens.IAIGameStateProvider)),
                promptContentProvider: /** @type {IAIPromptContentProvider} */ (c.resolve(tokens.IAIPromptContentProvider)),
                llmResponseProcessor: /** @type {ILLMResponseProcessor} */ (c.resolve(tokens.ILLMResponseProcessor)),
            });
        };

        return new TurnHandlerResolver({
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
            createPlayerTurnHandler: createPlayerHandlerFactory,
            createAiTurnHandler: createAiHandlerFactory
        });
    });
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