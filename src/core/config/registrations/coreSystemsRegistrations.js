// src/core/config/registrations/coreSystemsRegistrations.js

/**
 * @fileoverview Registers core game logic systems, particularly those needing initialization.
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

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
// REMOVED: import QuestSystem from '../../../systems/questSystem.js';
import {NotificationUISystem} from '../../../systems/notificationUISystem.js';
// REMOVED: import {QuestStartTriggerSystem} from '../../../systems/questStartTriggerSystem.js';
import BlockerSystem from '../../../systems/blockerSystem.js';
import MoveCoordinatorSystem from '../../../systems/moveCoordinatorSystem.js';
import OpenableSystem from '../../../systems/openableSystem.js';
import HealthSystem from '../../../systems/healthSystem.js';
import StatusEffectSystem from '../../../systems/statusEffectSystem.js';
import LockSystem from '../../../systems/lockSystem.js';
import PerceptionSystem from '../../../systems/perceptionSystem.js';
import {ActionDiscoverySystem} from '../../../systems/actionDiscoverySystem.js';
import WelcomeMessageService from '../../../services/welcomeMessageService.js'; // Included as it's tagged

// --- DI & Helper Imports ---
import {tokens} from '../../tokens.js';
import {Registrar} from '../../dependencyInjection/registrarHelpers.js';
import {formatActionCommand} from '../../../services/actionFormatter.js';
import {INITIALIZABLE} from "../../tags"; // Needed by ActionDiscoverySystem factory

/**
 * Registers core game systems tagged as initializable.
 * Excludes quest-related systems which are registered separately.
 *
 * @export
 * @param {AppContainer} container - The application's DI container.
 */
export function registerCoreSystems(container) {
    const registrar = new Registrar(container);
    /** @type {ILogger} */
    const logger = container.resolve(tokens.ILogger);
    logger.debug('Core Systems Registration: Starting...');

    // --- Systems (Tagged as Initializable) ---

    registrar.tagged(INITIALIZABLE).single(tokens.GameRuleSystem, GameRuleSystem, [
        tokens.EventBus, tokens.GameStateManager, tokens.ActionExecutor, tokens.EntityManager, tokens.GameDataRepository
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.GameRuleSystem} tagged with ${INITIALIZABLE.join(', ')}.`);

    registrar.tagged(INITIALIZABLE).single(tokens.EquipmentEffectSystem, EquipmentEffectSystem, [
        tokens.EventBus, tokens.EntityManager, tokens.GameDataRepository
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.EquipmentEffectSystem} tagged with ${INITIALIZABLE.join(', ')}.`);

    registrar.tagged(INITIALIZABLE).single(tokens.EquipmentSlotSystem, EquipmentSlotSystem, [
        tokens.EventBus, tokens.EntityManager, tokens.GameDataRepository
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.EquipmentSlotSystem} tagged with ${INITIALIZABLE.join(', ')}.`);

    registrar.tagged(INITIALIZABLE).single(tokens.InventorySystem, InventorySystem, [
        tokens.EventBus, tokens.EntityManager, tokens.GameDataRepository, tokens.GameStateManager
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.InventorySystem} tagged with ${INITIALIZABLE.join(', ')}.`);

    registrar.tagged(INITIALIZABLE).single(tokens.CombatSystem, CombatSystem, [
        tokens.EventBus, tokens.EntityManager, tokens.GameDataRepository
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.CombatSystem} tagged with ${INITIALIZABLE.join(', ')}.`);

    registrar.tagged(INITIALIZABLE).single(tokens.DeathSystem, DeathSystem, [
        tokens.EventBus, tokens.EntityManager
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.DeathSystem} tagged with ${INITIALIZABLE.join(', ')}.`);

    registrar.tagged(INITIALIZABLE).single(tokens.WorldPresenceSystem, WorldPresenceSystem, [
        tokens.EventBus, tokens.EntityManager
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.WorldPresenceSystem} tagged with ${INITIALIZABLE.join(', ')}.`);

    registrar.tagged(INITIALIZABLE).single(tokens.ItemUsageSystem, ItemUsageSystem, [
        tokens.EventBus, tokens.EntityManager, tokens.ConditionEvaluationService, tokens.ItemTargetResolverService, tokens.GameDataRepository
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.ItemUsageSystem} tagged with ${INITIALIZABLE.join(', ')}.`);

    registrar.tagged(INITIALIZABLE).single(tokens.BlockerSystem, BlockerSystem, [
        tokens.EventBus, tokens.EntityManager
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.BlockerSystem} tagged with ${INITIALIZABLE.join(', ')}.`);

    registrar.tagged(INITIALIZABLE).single(tokens.MovementSystem, MovementSystem, [
        tokens.EventBus, tokens.EntityManager
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.MovementSystem} tagged with ${INITIALIZABLE.join(', ')}.`);


    registrar.tagged(INITIALIZABLE).single(tokens.MoveCoordinatorSystem, MoveCoordinatorSystem, [
        tokens.EventBus,
        tokens.EntityManager,
        tokens.BlockerSystem, // Depends on another system registered here
        tokens.MovementSystem  // Depends on another system registered here
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.MoveCoordinatorSystem} tagged with ${INITIALIZABLE.join(', ')}.`);

    // REMOVED: QuestSystem registration
    // REMOVED: QuestStartTriggerSystem registration

    registrar.tagged(INITIALIZABLE).single(tokens.PerceptionSystem, PerceptionSystem, [
        tokens.EventBus, tokens.EntityManager
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.PerceptionSystem} tagged with ${INITIALIZABLE.join(', ')}.`);

    registrar.tagged(INITIALIZABLE).single(tokens.NotificationUISystem, NotificationUISystem, [
        tokens.EventBus, tokens.GameDataRepository
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.NotificationUISystem} tagged with ${INITIALIZABLE.join(', ')}.`);

    registrar.tagged(INITIALIZABLE).single(tokens.OpenableSystem, OpenableSystem, [
        tokens.EventBus, tokens.EntityManager
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.OpenableSystem} tagged with ${INITIALIZABLE.join(', ')}.`);

    registrar.tagged(INITIALIZABLE).single(tokens.HealthSystem, HealthSystem, [
        tokens.EventBus, tokens.EntityManager, tokens.GameDataRepository
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.HealthSystem} tagged with ${INITIALIZABLE.join(', ')}.`);

    registrar.tagged(INITIALIZABLE).single(tokens.StatusEffectSystem, StatusEffectSystem, [
        tokens.EventBus, tokens.EntityManager, tokens.GameDataRepository
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.StatusEffectSystem} tagged with ${INITIALIZABLE.join(', ')}.`);

    registrar.tagged(INITIALIZABLE).single(tokens.LockSystem, LockSystem, [
        tokens.EventBus, tokens.EntityManager
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.LockSystem} tagged with ${INITIALIZABLE.join(', ')}.`);


    // Special cases (Services/Systems that also need initialization)
    registrar.tagged(INITIALIZABLE).single(tokens.WelcomeMessageService, WelcomeMessageService, [
        tokens.EventBus,
        tokens.GameDataRepository,
        tokens.ValidatedEventDispatcher,
        tokens.ILogger
    ]);
    logger.debug(`Core Systems Registration: Registered ${tokens.WelcomeMessageService} tagged with ${INITIALIZABLE.join(', ')}.`);

    // Use singletonFactory for ActionDiscoverySystem due to function dependencies
    registrar.tagged(INITIALIZABLE).singletonFactory(tokens.ActionDiscoverySystem, (c) => new ActionDiscoverySystem({
        gameDataRepository: c.resolve(tokens.GameDataRepository),
        entityManager: c.resolve(tokens.EntityManager),
        actionValidationService: c.resolve(tokens.ActionValidationService),
        logger: c.resolve(tokens.ILogger),
        formatActionCommandFn: formatActionCommand, // Direct function reference
        getEntityIdsForScopesFn: () => new Set() // Placeholder as before - ensure this is correct for your app
    }));
    logger.debug(`Core Systems Registration: Registered ${tokens.ActionDiscoverySystem} tagged with ${INITIALIZABLE.join(', ')}.`);


    // UPDATE COUNT: Original count was 21. Removing 2 systems -> 19.
    const registrationCount = 19; // Define the correct count
    // FIX: Use the registrationCount variable in the log message
    logger.info(`Core Systems Registration: Completed registering ${registrationCount} systems tagged with '${INITIALIZABLE[0]}'.`);
}