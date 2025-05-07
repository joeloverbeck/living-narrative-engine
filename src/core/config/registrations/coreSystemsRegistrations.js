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
/** @typedef {import('../../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */ // <<< ADDED
/** @typedef {import('../../interfaces/eventBus.js').EventBus} EventBus */ // Assuming EventBus type definition exists
/** @typedef {import('../../interfaces/IWorldContext.js').IWorldContext} IWorldContext */ // Corrected typedef name
/** @typedef {import('../../interfaces/IActionExecutor.js').IActionExecutor} IActionExecutor */
/** @typedef {import('../../services/gameDataRepository.js').default} GameDataRepository */ // Corrected path & default export
/** @typedef {import('../../../services/conditionEvaluationService.js').ConditionEvaluationService} ConditionEvaluationService */ // Assuming type definition exists
/** @typedef {import('../../../services/itemTargetResolverService.js').ItemTargetResolverService} ItemTargetResolverService */ // Assuming type definition exists
/** @typedef {import('../../../services/actionValidationService.js').ActionValidationService} ActionValidationService */ // Assuming type definition exists
/** @typedef {import('../../interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem */
/** @typedef {import('../../interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../../ports/IPromptOutputPort.js').IPromptOutputPort} IPromptOutputPort */ // <<< ADDED
/** @typedef {import('../../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */ // <<< ADDED
/** @typedef {import('../../services/playerPromptService.js').default} PlayerPromptService */ // <<< ADDED
/** @typedef {import('../../interpreters/commandOutcomeInterpreter.js').default} CommandOutcomeInterpreter */ // <<< ADDED
/** @typedef {import('../../handlers/playerTurnHandler.js').default} PlayerTurnHandler */ // Added for resolver dependency
/** @typedef {import('../../handlers/aiTurnHandler.js').default} AITurnHandler */ // Added for resolver dependency
/** @typedef {import('../../services/turnHandlerResolver.js').default} TurnHandlerResolver */ // Added for TurnManager dependency


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
import MoveCoordinatorSystem from '../../../systems/moveCoordinatorSystem.js';
import OpenableSystem from '../../../systems/openableSystem.js';
import HealthSystem from '../../../systems/healthSystem.js';
import StatusEffectSystem from '../../../systems/statusEffectSystem.js';
import LockSystem from '../../../systems/lockSystem.js';
import PerceptionSystem from '../../../systems/perceptionSystem.js';
import {ActionDiscoverySystem} from '../../../systems/actionDiscoverySystem.js'; // Concrete Class Import
import TurnManager from '../../turnManager.js';

// --- Handler & Resolver Imports ---
import PlayerTurnHandler from '../../handlers/playerTurnHandler.js';
import AITurnHandler from '../../handlers/aiTurnHandler.js';
import TurnHandlerResolver from '../../services/turnHandlerResolver.js';

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
        tokens.EventBus, tokens.EntityManager, tokens.GameDataRepository
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.EquipmentEffectSystem)} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;

    registrar.tagged(INITIALIZABLE).single(tokens.EquipmentSlotSystem, EquipmentSlotSystem, [
        tokens.EventBus, tokens.EntityManager, tokens.GameDataRepository
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.EquipmentSlotSystem)} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;

    registrar.tagged(INITIALIZABLE).single(tokens.InventorySystem, InventorySystem, [
        tokens.EventBus, tokens.EntityManager, tokens.GameDataRepository, tokens.IWorldContext
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.InventorySystem)} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;

    registrar.tagged(INITIALIZABLE).single(tokens.DeathSystem, DeathSystem, [
        tokens.EventBus, tokens.EntityManager
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.DeathSystem)} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;

    registrar.tagged(INITIALIZABLE).single(tokens.ItemUsageSystem, ItemUsageSystem, [
        tokens.EventBus, tokens.EntityManager, tokens.ConditionEvaluationService, tokens.ItemTargetResolverService, tokens.GameDataRepository
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.ItemUsageSystem)} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;

    registrar.tagged(INITIALIZABLE).single(tokens.MovementSystem, MovementSystem, [
        tokens.EventBus, tokens.EntityManager
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.MovementSystem)} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;

    registrar.tagged(INITIALIZABLE).single(tokens.MoveCoordinatorSystem, MoveCoordinatorSystem, [
        tokens.EventBus,
        tokens.EntityManager,
        tokens.BlockerSystem, // Depends on another system registered here
        tokens.MovementSystem  // Depends on another system registered here
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.MoveCoordinatorSystem)} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;


    // --- Systems with Shutdown() (Tagged with both INITIALIZABLE and SHUTDOWNABLE) ---
    const initializableAndShutdownable = [...INITIALIZABLE, ...SHUTDOWNABLE];
    const tagsString = initializableAndShutdownable.join(', '); // For logging

    registrar.tagged(initializableAndShutdownable).single(tokens.CombatSystem, CombatSystem, [
        tokens.EventBus, tokens.EntityManager, tokens.GameDataRepository
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.CombatSystem)} tagged with ${tagsString}.`);
    registrationCount++;

    registrar.tagged(initializableAndShutdownable).single(tokens.WorldPresenceSystem, WorldPresenceSystem, [
        tokens.EventBus, tokens.EntityManager
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.WorldPresenceSystem)} tagged with ${tagsString}.`);
    registrationCount++;

    registrar.tagged(initializableAndShutdownable).single(tokens.PerceptionSystem, PerceptionSystem, [
        tokens.EventBus, tokens.EntityManager
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.PerceptionSystem)} tagged with ${tagsString}.`);
    registrationCount++;

    registrar.tagged(initializableAndShutdownable).single(tokens.NotificationUISystem, NotificationUISystem, [
        tokens.EventBus, tokens.GameDataRepository
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.NotificationUISystem)} tagged with ${tagsString}.`);
    registrationCount++;

    registrar.tagged(initializableAndShutdownable).single(tokens.OpenableSystem, OpenableSystem, [
        tokens.EventBus, tokens.EntityManager
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.OpenableSystem)} tagged with ${tagsString}.`);
    registrationCount++;

    registrar.tagged(initializableAndShutdownable).single(tokens.HealthSystem, HealthSystem, [
        tokens.EventBus, tokens.EntityManager, tokens.GameDataRepository
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.HealthSystem)} tagged with ${tagsString}.`);
    registrationCount++;

    registrar.tagged(initializableAndShutdownable).single(tokens.StatusEffectSystem, StatusEffectSystem, [
        tokens.EventBus, tokens.EntityManager, tokens.GameDataRepository
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.StatusEffectSystem)} tagged with ${tagsString}.`);
    registrationCount++;

    registrar.tagged(initializableAndShutdownable).single(tokens.LockSystem, LockSystem, [
        tokens.EventBus, tokens.EntityManager
    ]);
    logger.debug(`Core Systems Registration: Registered ${String(tokens.LockSystem)} tagged with ${tagsString}.`);
    registrationCount++;


    // --- Register ActionDiscoverySystem against its Interface Token using singletonFactory ---
    // Tagged INITIALIZABLE. Add SHUTDOWNABLE if it gets a shutdown() method.
    registrar.tagged(INITIALIZABLE).singletonFactory(tokens.IActionDiscoverySystem, (c) => new ActionDiscoverySystem({
        gameDataRepository: c.resolve(tokens.GameDataRepository),
        entityManager: c.resolve(tokens.EntityManager),
        actionValidationService: c.resolve(tokens.ActionValidationService),
        logger: c.resolve(tokens.ILogger),
        formatActionCommandFn: formatActionCommand, // Direct function reference
        getEntityIdsForScopesFn: () => new Set() // Placeholder - ensure this is correct
    }));
    logger.debug(`Core Systems Registration: Registered ${String(tokens.IActionDiscoverySystem)} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;


    // --- VVVVVV CORRECTED REGISTRATION BLOCK VVVVVV ---
    // Register PlayerTurnHandler (Singleton due to event subscription & destroy() method)
    // Tagged SHUTDOWNABLE because it needs cleanup via destroy().
    // Use singletonFactory to handle the object constructor parameter correctly.
    registrar.tagged(SHUTDOWNABLE).singletonFactory(tokens.PlayerTurnHandler, (c) =>
        new PlayerTurnHandler({
            logger: c.resolve(tokens.ILogger),
            actionDiscoverySystem: c.resolve(tokens.IActionDiscoverySystem),
            commandProcessor: c.resolve(tokens.ICommandProcessor),
            worldContext: c.resolve(tokens.IWorldContext),
            entityManager: c.resolve(tokens.EntityManager),
            gameDataRepository: c.resolve(tokens.GameDataRepository),
            promptOutputPort: c.resolve(tokens.IPromptOutputPort),
            turnEndPort: c.resolve(tokens.ITurnEndPort),
            playerPromptService: c.resolve(tokens.PlayerPromptService),
            commandInputPort: c.resolve(tokens.ICommandInputPort),
            commandOutcomeInterpreter: c.resolve(tokens.CommandOutcomeInterpreter),
            safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher)
        })
    );
    logger.debug(`Core Systems Registration: Registered ${tokens.PlayerTurnHandler}.`);
    registrationCount++;

    // Register AITurnHandler (Singleton appropriate, constructor takes object)
    // Not tagged SHUTDOWNABLE as it currently has no destroy() method.
    registrar.singletonFactory(tokens.AITurnHandler, (c) => new AITurnHandler({
        logger: c.resolve(tokens.ILogger),
        commandProcessor: c.resolve(tokens.ICommandProcessor),
        actionDiscoverySystem: c.resolve(tokens.IActionDiscoverySystem),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        worldContext: c.resolve(tokens.IWorldContext),
        turnEndPort: c.resolve(tokens.ITurnEndPort)      // <-- this was missing
    }));
    logger.debug(`Core Systems Registration: Registered ${tokens.AITurnHandler}.`);
    registrationCount++;


    // Register TurnHandlerResolver (Singleton is appropriate)
    // No specific tags needed unless it requires init/shutdown hooks later.
    registrar.singletonFactory(tokens.TurnHandlerResolver, (c) => new TurnHandlerResolver({
        logger: c.resolve(tokens.ILogger),
        playerTurnHandler: c.resolve(tokens.PlayerTurnHandler),
        aiTurnHandler: c.resolve(tokens.AITurnHandler)
    }));
    registrationCount++;


    // --- Register TurnManager AFTER its dependencies ---
    // Tagged as INITIALIZABLE
    /** @type {ITurnManager} */ // Add type hint for clarity
    registrar.tagged(INITIALIZABLE).singletonFactory(tokens.ITurnManager, (c) => new TurnManager({
        turnOrderService: c.resolve(tokens.ITurnOrderService),
        entityManager: c.resolve(tokens.EntityManager),
        logger: c.resolve(tokens.ILogger),
        dispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        turnHandlerResolver: c.resolve(tokens.TurnHandlerResolver)
    }));
    registrationCount++;

    // Final log message using the incremented counter
    logger.info(`Core Systems Registration: Completed registering ${registrationCount} systems, handlers, and services, tagging relevant ones with '${INITIALIZABLE[0]}' and '${SHUTDOWNABLE[0]}'.`);
}

// --- FILE END ---
