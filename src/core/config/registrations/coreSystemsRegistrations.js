// src/core/config/registrations/coreSystemsRegistrations.js
// --- FILE START (Entire file content as requested) ---

/**
 * @fileoverview Registers core game logic systems, particularly those needing initialization or shutdown.
 * Also includes registration for turn-related handlers and resolvers.
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../../interfaces/ITurnOrderService.js').ITurnOrderService} ITurnOrderService */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/eventBus.js').EventBus} EventBus */
/** @typedef {import('../../interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../../interfaces/IActionExecutor.js').IActionExecutor} IActionExecutor */
/** @typedef {import('../../../services/conditionEvaluationService.js').ConditionEvaluationService} ConditionEvaluationService */
/** @typedef {import('../../../services/itemTargetResolverService.js').ItemTargetResolverService} ItemTargetResolverService */
/** @typedef {import('../../../services/actionValidationService.js').ActionValidationService} ActionValidationService */
/** @typedef {import('../../interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem */
/** @typedef {import('../../interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../../ports/IPromptOutputPort.js').IPromptOutputPort} IPromptOutputPort */
/** @typedef {import('../../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */
/** @typedef {import('../../handlers/playerTurnHandler.js').default} PlayerTurnHandler */
/** @typedef {import('../../handlers/aiTurnHandler.js').default} AITurnHandler */
/** @typedef {import('../../services/turnHandlerResolver.js').default} TurnHandlerResolver */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository */
/** @typedef {import('../../interfaces/IPlayerPromptService.js').IPlayerPromptService} IPlayerPromptService */
/** @typedef {import('../../interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter */
/** @typedef {import('../../interfaces/ICommandInputPort.js').ICommandInputPort} ICommandInputPort */
/** @typedef {import('../../services/subscriptionLifecycleManager.js').default} SubscriptionLifecycleManager */ // <<< ADDED FOR PlayerTurnHandler


// --- System Imports ---
import EquipmentEffectSystem from '../../../systems/equipmentEffectSystem.js';
import EquipmentSlotSystem from '../../../systems/equipmentSlotSystem.js';
import InventorySystem from '../../../systems/inventorySystem.js';
import CombatSystem from '../../../systems/combatSystem.js';
import DeathSystem from '../../../systems/deathSystem.js';
import MovementSystem from '../../../systems/movementSystem.js';
import WorldPresenceSystem from '../../../systems/worldPresenceSystem.js';
import ItemUsageSystem from '../../../systems/itemUsageSystem.js';
import {NotificationUISystem} from '../../../systems/notificationUISystem.js';
import OpenableSystem from '../../../systems/openableSystem.js';
import HealthSystem from '../../../systems/healthSystem.js';
import StatusEffectSystem from '../../../systems/statusEffectSystem.js';
import LockSystem from '../../../systems/lockSystem.js';
import {ActionDiscoverySystem} from '../../../systems/actionDiscoverySystem.js'; // Concrete Class Import
import TurnManager from '../../turnManager.js';

// --- Handler & Resolver Imports ---
import PlayerTurnHandler from '../../handlers/playerTurnHandler.js'; // Concrete class
import AITurnHandler from '../../handlers/aiTurnHandler.js'; // Concrete class
import TurnHandlerResolver from '../../services/turnHandlerResolver.js'; // Concrete class

// --- DI & Helper Imports ---
import {tokens} from '../tokens.js';
import {Registrar} from '../registrarHelpers.js';
import {formatActionCommand} from '../../../services/actionFormatter.js';
import {INITIALIZABLE, SHUTDOWNABLE} from "../tags.js";

/**
 * Registers core game systems tagged as initializable and/or shutdownable,
 * along with essential turn-handling services.
 * Excludes quest-related systems which are registered separately.
 *
 * @export
 * @param {AppContainer} container - The application's DI container.
 */
export function registerCoreSystems(container) {
    const registrar = new Registrar(container);
    /** @type {ILogger} */
    const logger = container.resolve(tokens.ILogger);

    let registrationCount = 0; // Initialize counter

    // --- Systems (Tagged as Initializable only) ---
    registrar.tagged(INITIALIZABLE).single(tokens.EquipmentEffectSystem, EquipmentEffectSystem, [
        tokens.EventBus, tokens.IEntityManager, tokens.IGameDataRepository // Use Interfaces
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.EquipmentEffectSystem)} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;

    registrar.tagged(INITIALIZABLE).single(tokens.EquipmentSlotSystem, EquipmentSlotSystem, [
        tokens.EventBus, tokens.IEntityManager, tokens.IGameDataRepository // Use Interfaces
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.EquipmentSlotSystem)} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;

    registrar.tagged(INITIALIZABLE).single(tokens.InventorySystem, InventorySystem, [
        tokens.EventBus, tokens.IEntityManager, tokens.IGameDataRepository, tokens.IWorldContext // Use Interfaces
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.InventorySystem)} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;

    registrar.tagged(INITIALIZABLE).single(tokens.DeathSystem, DeathSystem, [
        tokens.EventBus, tokens.IEntityManager // Use Interface
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.DeathSystem)} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;

    registrar.tagged(INITIALIZABLE).single(tokens.ItemUsageSystem, ItemUsageSystem, [
        tokens.EventBus, tokens.IEntityManager, tokens.ConditionEvaluationService, tokens.ItemTargetResolverService, tokens.IGameDataRepository // Use Interfaces
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.ItemUsageSystem)} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;

    registrar.tagged(INITIALIZABLE).single(tokens.MovementSystem, MovementSystem, [
        tokens.EventBus, tokens.IEntityManager // Use Interface
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.MovementSystem)} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;

    // --- Systems with Shutdown() (Tagged with both INITIALIZABLE and SHUTDOWNABLE) ---
    const initializableAndShutdownable = [...INITIALIZABLE, ...SHUTDOWNABLE];
    const tagsString = initializableAndShutdownable.join(', '); // For logging

    registrar.tagged(initializableAndShutdownable).single(tokens.CombatSystem, CombatSystem, [
        tokens.EventBus, tokens.IEntityManager, tokens.IGameDataRepository // Use Interfaces
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.CombatSystem)} tagged with ${tagsString}.`);
    registrationCount++;

    registrar.tagged(initializableAndShutdownable).single(tokens.WorldPresenceSystem, WorldPresenceSystem, [
        tokens.EventBus, tokens.IEntityManager // Use Interface
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.WorldPresenceSystem)} tagged with ${tagsString}.`);
    registrationCount++;

    registrar.tagged(initializableAndShutdownable).single(tokens.NotificationUISystem, NotificationUISystem, [
        tokens.EventBus, tokens.IGameDataRepository // Use Interface
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.NotificationUISystem)} tagged with ${tagsString}.`);
    registrationCount++;

    registrar.tagged(initializableAndShutdownable).single(tokens.OpenableSystem, OpenableSystem, [
        tokens.EventBus, tokens.IEntityManager // Use Interface
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.OpenableSystem)} tagged with ${tagsString}.`);
    registrationCount++;

    registrar.tagged(initializableAndShutdownable).single(tokens.HealthSystem, HealthSystem, [
        tokens.EventBus, tokens.IEntityManager, tokens.IGameDataRepository // Use Interfaces
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.HealthSystem)} tagged with ${tagsString}.`);
    registrationCount++;

    registrar.tagged(initializableAndShutdownable).single(tokens.StatusEffectSystem, StatusEffectSystem, [
        tokens.EventBus, tokens.IEntityManager, tokens.IGameDataRepository // Use Interfaces
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.StatusEffectSystem)} tagged with ${tagsString}.`);
    registrationCount++;

    registrar.tagged(initializableAndShutdownable).single(tokens.LockSystem, LockSystem, [
        tokens.EventBus, tokens.IEntityManager // Use Interface
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.LockSystem)} tagged with ${tagsString}.`);
    registrationCount++;


    // --- Register ActionDiscoverySystem against its Interface Token using singletonFactory ---
    // Tagged INITIALIZABLE. Add SHUTDOWNABLE if it gets a shutdown() method.
    registrar.tagged(INITIALIZABLE).singletonFactory(tokens.IActionDiscoverySystem, (c) => new ActionDiscoverySystem({
        gameDataRepository: /** @type {IGameDataRepository} */ (c.resolve(tokens.IGameDataRepository)), // Use Interface
        entityManager: /** @type {IEntityManager} */ (c.resolve(tokens.IEntityManager)),           // Use Interface
        actionValidationService: c.resolve(tokens.ActionValidationService),
        logger: c.resolve(tokens.ILogger),
        formatActionCommandFn: formatActionCommand, // Direct function reference
        getEntityIdsForScopesFn: () => new Set() // Placeholder - ensure this is correct
    }));
    logger.debug(`Core Systems Registration: Registered ${String(tokens.IActionDiscoverySystem)} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;

    // Register PlayerTurnHandler (Singleton due to event subscription & destroy() method)
    // Tagged SHUTDOWNABLE because it needs cleanup via destroy().
    // Use singletonFactory to handle the object constructor parameter correctly.
    registrar.tagged(SHUTDOWNABLE).singletonFactory(tokens.PlayerTurnHandler, (c) =>
        new PlayerTurnHandler({ // Instantiates the concrete class
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
            commandProcessor: /** @type {ICommandProcessor} */ (c.resolve(tokens.ICommandProcessor)),
            worldContext: /** @type {IWorldContext} */ (c.resolve(tokens.IWorldContext)),
            entityManager: /** @type {IEntityManager} */ (c.resolve(tokens.IEntityManager)),
            gameDataRepository: /** @type {IGameDataRepository} */ (c.resolve(tokens.IGameDataRepository)),
            promptOutputPort: /** @type {IPromptOutputPort} */ (c.resolve(tokens.IPromptOutputPort)),
            turnEndPort: /** @type {ITurnEndPort} */ (c.resolve(tokens.ITurnEndPort)),
            playerPromptService: /** @type {IPlayerPromptService} */ (c.resolve(tokens.IPlayerPromptService)),
            commandInputPort: /** @type {ICommandInputPort} */ (c.resolve(tokens.ICommandInputPort)),
            commandOutcomeInterpreter: /** @type {ICommandOutcomeInterpreter} */ (c.resolve(tokens.ICommandOutcomeInterpreter)),
            safeEventDispatcher: /** @type {ISafeEventDispatcher} */ (c.resolve(tokens.ISafeEventDispatcher)),
            subscriptionLifecycleManager: /** @type {SubscriptionLifecycleManager} */ (c.resolve(tokens.SubscriptionLifecycleManager)) // <<< ADDED
        })
    );
    logger.debug(`Core Systems Registration: Registered ${tokens.PlayerTurnHandler} with injected SubscriptionLifecycleManager.`);
    registrationCount++;

    // Register AITurnHandler (Singleton appropriate, constructor takes object)
    // Not tagged SHUTDOWNABLE as it currently has no destroy() method.
    registrar.singletonFactory(tokens.AITurnHandler, (c) => new AITurnHandler({ // Instantiates the concrete class
        logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
        commandProcessor: /** @type {ICommandProcessor} */ (c.resolve(tokens.ICommandProcessor)),
        actionDiscoverySystem: /** @type {IActionDiscoverySystem} */ (c.resolve(tokens.IActionDiscoverySystem)),
        validatedEventDispatcher: /** @type {IValidatedEventDispatcher} */ (c.resolve(tokens.IValidatedEventDispatcher)),
        worldContext: /** @type {IWorldContext} */ (c.resolve(tokens.IWorldContext)),
        turnEndPort: /** @type {ITurnEndPort} */ (c.resolve(tokens.ITurnEndPort))
    }));
    logger.debug(`Core Systems Registration: Registered ${tokens.AITurnHandler}.`);
    registrationCount++;


    // Register TurnHandlerResolver (Singleton is appropriate)
    // No specific tags needed unless it requires init/shutdown hooks later.
    registrar.singletonFactory(tokens.TurnHandlerResolver, (c) => new TurnHandlerResolver({ // Instantiates the concrete class
        logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
        playerTurnHandler: /** @type {PlayerTurnHandler} */ (c.resolve(tokens.PlayerTurnHandler)), // Resolves concrete PlayerTurnHandler
        aiTurnHandler: /** @type {AITurnHandler} */ (c.resolve(tokens.AITurnHandler))         // Resolves concrete AITurnHandler
    }));
    logger.debug(`Core Systems Registration: Registered ${tokens.TurnHandlerResolver}.`);
    registrationCount++;


    // --- Register TurnManager AFTER its dependencies ---
    // Tagged as INITIALIZABLE
    registrar.tagged(INITIALIZABLE).singletonFactory(tokens.ITurnManager, (c) => new TurnManager({
        turnOrderService: /** @type {ITurnOrderService} */ (c.resolve(tokens.ITurnOrderService)),
        entityManager: /** @type {IEntityManager} */ (c.resolve(tokens.IEntityManager)), // Use Interface
        logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
        dispatcher: /** @type {IValidatedEventDispatcher} */ (c.resolve(tokens.IValidatedEventDispatcher)),
        turnHandlerResolver: /** @type {TurnHandlerResolver} */ (c.resolve(tokens.TurnHandlerResolver)) // Resolves concrete TurnHandlerResolver
    }));
    logger.debug(`Core Systems Registration: Registered ${tokens.ITurnManager}.`);
    registrationCount++;

    // Final log message using the incremented counter
    logger.info(`Core Systems Registration: Completed registering ${registrationCount} systems, handlers, and services, tagging relevant ones with '${INITIALIZABLE[0]}' and '${SHUTDOWNABLE[0]}'.`);
}

// --- FILE END ---