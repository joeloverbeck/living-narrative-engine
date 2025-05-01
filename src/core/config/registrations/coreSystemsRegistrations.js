// src/core/config/registrations/coreSystemsRegistrations.js
// (Entire file provided as requested)

/**
 * @fileoverview Registers core game logic systems, particularly those needing initialization or shutdown.
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../../interfaces/ITurnOrderService.js').ITurnOrderService} ITurnOrderService */
/** @typedef {import('../../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../interfaces/eventBus.js').EventBus} EventBus */ // Assuming EventBus type definition exists
/** @typedef {import('../../interfaces/IGameStateManager.js').IGameStateManager} IGameStateManager */
/** @typedef {import('../../interfaces/IActionExecutor.js').IActionExecutor} IActionExecutor */
/** @typedef {import('../../interfaces/gameDataRepository.js').GameDataRepository} GameDataRepository */ // Assuming type definition exists
/** @typedef {import('../../../services/conditionEvaluationService.js').ConditionEvaluationService} ConditionEvaluationService */ // Assuming type definition exists
/** @typedef {import('../../../services/itemTargetResolverService.js').ItemTargetResolverService} ItemTargetResolverService */ // Assuming type definition exists
/** @typedef {import('../../../services/actionValidationService.js').ActionValidationService} ActionValidationService */ // Assuming type definition exists


// --- System Imports ---
import GameRuleSystem from '../../../systems/gameRuleSystem.js';
import EquipmentEffectSystem from '../../../systems/equipmentEffectSystem.js';
import EquipmentSlotSystem from '../../../systems/equipmentSlotSystem.js';
import InventorySystem from '../../../systems/inventorySystem.js';
import CombatSystem from '../../../systems/combatSystem.js';
import DeathSystem from '../../../systems/deathSystem.js';
import MovementSystem from '../../../systems/movementSystem.js';
import WorldPresenceSystem from '../../../systems/worldPresenceSystem.js';
import ItemUsageSystem from '../../../systems/itemUsageSystem.js';
import {NotificationUISystem} from '../../../systems/notificationUISystem.js';
import BlockerSystem from '../../../systems/blockerSystem.js';
import MoveCoordinatorSystem from '../../../systems/moveCoordinatorSystem.js';
import OpenableSystem from '../../../systems/openableSystem.js';
import HealthSystem from '../../../systems/healthSystem.js';
import StatusEffectSystem from '../../../systems/statusEffectSystem.js';
import LockSystem from '../../../systems/lockSystem.js';
import PerceptionSystem from '../../../systems/perceptionSystem.js';
import {ActionDiscoverySystem} from '../../../systems/actionDiscoverySystem.js'; // Concrete Class Import
import TurnManager from '../../turnManager.js';


// --- DI & Helper Imports ---
import {tokens} from '../tokens.js';
import {Registrar} from '../../dependencyInjection/registrarHelpers.js';
import {formatActionCommand} from '../../../services/actionFormatter.js';
import {INITIALIZABLE, SHUTDOWNABLE} from "../tags.js";

/**
 * Registers core game systems tagged as initializable and/or shutdownable.
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
    registrar.tagged(INITIALIZABLE).single(tokens.GameRuleSystem, GameRuleSystem, [
        tokens.EventBus, tokens.IGameStateManager, tokens.IActionExecutor, tokens.EntityManager, tokens.GameDataRepository
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.GameRuleSystem} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;

    registrar.tagged(INITIALIZABLE).single(tokens.EquipmentEffectSystem, EquipmentEffectSystem, [
        tokens.EventBus, tokens.EntityManager, tokens.GameDataRepository
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.EquipmentEffectSystem} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;

    registrar.tagged(INITIALIZABLE).single(tokens.EquipmentSlotSystem, EquipmentSlotSystem, [
        tokens.EventBus, tokens.EntityManager, tokens.GameDataRepository
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.EquipmentSlotSystem} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;

    registrar.tagged(INITIALIZABLE).single(tokens.InventorySystem, InventorySystem, [
        tokens.EventBus, tokens.EntityManager, tokens.GameDataRepository, tokens.IGameStateManager
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.InventorySystem} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;

    registrar.tagged(INITIALIZABLE).single(tokens.DeathSystem, DeathSystem, [
        tokens.EventBus, tokens.EntityManager
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.DeathSystem} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;

    registrar.tagged(INITIALIZABLE).single(tokens.ItemUsageSystem, ItemUsageSystem, [
        tokens.EventBus, tokens.EntityManager, tokens.ConditionEvaluationService, tokens.ItemTargetResolverService, tokens.GameDataRepository
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.ItemUsageSystem} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;

    registrar.tagged(INITIALIZABLE).single(tokens.BlockerSystem, BlockerSystem, [
        tokens.EventBus, tokens.EntityManager
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.BlockerSystem} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;

    registrar.tagged(INITIALIZABLE).single(tokens.MovementSystem, MovementSystem, [
        tokens.EventBus, tokens.EntityManager
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.MovementSystem} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;

    registrar.tagged(INITIALIZABLE).single(tokens.MoveCoordinatorSystem, MoveCoordinatorSystem, [
        tokens.EventBus,
        tokens.EntityManager,
        tokens.BlockerSystem, // Depends on another system registered here
        tokens.MovementSystem  // Depends on another system registered here
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.MoveCoordinatorSystem} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;

    // --- Systems with Shutdown() (Tagged with both INITIALIZABLE and SHUTDOWNABLE) ---
    const initializableAndShutdownable = [...INITIALIZABLE, ...SHUTDOWNABLE];
    const tagsString = initializableAndShutdownable.join(', '); // For logging

    registrar.tagged(initializableAndShutdownable).single(tokens.CombatSystem, CombatSystem, [
        tokens.EventBus, tokens.EntityManager, tokens.GameDataRepository
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.CombatSystem} tagged with ${tagsString}.`);
    registrationCount++;

    registrar.tagged(initializableAndShutdownable).single(tokens.WorldPresenceSystem, WorldPresenceSystem, [
        tokens.EventBus, tokens.EntityManager
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.WorldPresenceSystem} tagged with ${tagsString}.`);
    registrationCount++;

    registrar.tagged(initializableAndShutdownable).single(tokens.PerceptionSystem, PerceptionSystem, [
        tokens.EventBus, tokens.EntityManager
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.PerceptionSystem} tagged with ${tagsString}.`);
    registrationCount++;

    registrar.tagged(initializableAndShutdownable).single(tokens.NotificationUISystem, NotificationUISystem, [
        tokens.EventBus, tokens.GameDataRepository
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.NotificationUISystem} tagged with ${tagsString}.`);
    registrationCount++;

    registrar.tagged(initializableAndShutdownable).single(tokens.OpenableSystem, OpenableSystem, [
        tokens.EventBus, tokens.EntityManager
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.OpenableSystem} tagged with ${tagsString}.`);
    registrationCount++;

    registrar.tagged(initializableAndShutdownable).single(tokens.HealthSystem, HealthSystem, [
        tokens.EventBus, tokens.EntityManager, tokens.GameDataRepository
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.HealthSystem} tagged with ${tagsString}.`);
    registrationCount++;

    registrar.tagged(initializableAndShutdownable).single(tokens.StatusEffectSystem, StatusEffectSystem, [
        tokens.EventBus, tokens.EntityManager, tokens.GameDataRepository
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.StatusEffectSystem} tagged with ${tagsString}.`);
    registrationCount++;

    registrar.tagged(initializableAndShutdownable).single(tokens.LockSystem, LockSystem, [
        tokens.EventBus, tokens.EntityManager
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.LockSystem} tagged with ${tagsString}.`);
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
    logger.debug(`Core Systems Registration: Registered ${tokens.IActionDiscoverySystem} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;

    // --- MODIFIED: Register TurnManager tagged as INITIALIZABLE ---
    /**
     * Registers the TurnManager as a singleton factory, tagged as initializable.
     * @type {ITurnManager}
     */
    registrar.tagged(INITIALIZABLE).singletonFactory(tokens.ITurnManager, (c) => new TurnManager({
        turnOrderService: c.resolve(tokens.ITurnOrderService),
        entityManager: c.resolve(tokens.EntityManager),
        logger: c.resolve(tokens.ILogger),
        dispatcher: c.resolve(tokens.IValidatedEventDispatcher)
    }));
    logger.debug(`Core Systems Registration: Registered ${tokens.ITurnManager} tagged with ${INITIALIZABLE.join(', ')}.`);
    registrationCount++;


    // Final log message using the incremented counter
    logger.info(`Core Systems Registration: Completed registering ${registrationCount} systems and services, tagging relevant ones with '${INITIALIZABLE[0]}' and '${SHUTDOWNABLE[0]}'.`);
}