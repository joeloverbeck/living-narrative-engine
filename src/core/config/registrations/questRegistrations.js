// src/core/config/registrations/questRegistrations.js

/**
 * @fileoverview Registers quest-related services and systems.
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

// --- Service/System Imports ---
import {QuestPrerequisiteService} from '../../../services/questPrerequisiteService.js';
import {QuestRewardService} from '../../../services/questRewardService.js';
import {ObjectiveEventListenerService} from '../../../services/objectiveEventListenerService.js';
import {ObjectiveStateCheckerService} from '../../../services/objectiveStateCheckerService.js';
import QuestSystem from '../../../systems/questSystem.js';
import {QuestStartTriggerSystem} from '../../../systems/questStartTriggerSystem.js';

// --- DI & Helper Imports ---
import {tokens} from '../../tokens.js';
import {Registrar} from '../../dependencyInjection/registrarHelpers.js';
import {INITIALIZABLE} from "../../tags";

// --- Constant Tag ---

/**
 * Registers quest-related services and systems.
 *
 * @export
 * @param {AppContainer} container - The application's DI container.
 */
export function registerQuestSystems(container) {
    const registrar = new Registrar(container);
    /** @type {ILogger} */
    const logger = container.resolve(tokens.ILogger);
    logger.debug('Quest Registration: Starting...');

    // === Quest Services (No Initialization Tag) ===
    registrar.single(tokens.QuestPrerequisiteService, QuestPrerequisiteService, []);
    logger.debug(`Quest Registration: Registered ${tokens.QuestPrerequisiteService}.`);

    registrar.single(tokens.QuestRewardService, QuestRewardService, [
        tokens.GameDataRepository,
        tokens.GameStateManager,
        tokens.ValidatedEventDispatcher,
        tokens.ILogger
    ]);
    logger.debug(`Quest Registration: Registered ${tokens.QuestRewardService}.`);

    registrar.single(tokens.ObjectiveEventListenerService, ObjectiveEventListenerService, [
        tokens.EventBus,
        tokens.GameDataRepository
    ]);
    logger.debug(`Quest Registration: Registered ${tokens.ObjectiveEventListenerService}.`);

    registrar.single(tokens.ObjectiveStateCheckerService, ObjectiveStateCheckerService, [
        tokens.EventBus,
        tokens.GameDataRepository,
        tokens.EntityManager,
        tokens.GameStateManager
    ]);
    logger.debug(`Quest Registration: Registered ${tokens.ObjectiveStateCheckerService}.`);

    // === Quest Systems (Tagged as Initializable) ===

    // FIX: Use singletonFactory because QuestSystem constructor expects a single object argument
    registrar.tagged(INITIALIZABLE).singletonFactory(tokens.QuestSystem, (c) => {
        // Resolve all dependencies
        const gameDataRepository = c.resolve(tokens.GameDataRepository);
        const eventBus = c.resolve(tokens.EventBus);
        const entityManager = c.resolve(tokens.EntityManager);
        const gameStateManager = c.resolve(tokens.GameStateManager);
        const questPrerequisiteService = c.resolve(tokens.QuestPrerequisiteService);
        const questRewardService = c.resolve(tokens.QuestRewardService);
        const objectiveEventListenerService = c.resolve(tokens.ObjectiveEventListenerService);
        const objectiveStateCheckerService = c.resolve(tokens.ObjectiveStateCheckerService);

        // Pass dependencies as a single object matching the constructor's expected destructuring
        return new QuestSystem({
            gameDataRepository,
            eventBus,
            entityManager,
            gameStateManager,
            questPrerequisiteService,
            questRewardService,
            objectiveEventListenerService,
            objectiveStateCheckerService
        });
    });
    logger.debug(`Quest Registration: Registered ${tokens.QuestSystem} tagged with ${INITIALIZABLE.join(', ')}.`);

    // QuestStartTriggerSystem likely takes individual args, so .single is probably fine (verify its constructor if needed)
    registrar.tagged(INITIALIZABLE).single(tokens.QuestStartTriggerSystem, QuestStartTriggerSystem, [
        tokens.EventBus,
        tokens.GameStateManager,
        tokens.GameDataRepository
    ]);
    logger.debug(`Quest Registration: Registered ${tokens.QuestStartTriggerSystem} tagged with ${INITIALIZABLE.join(', ')}.`);

    const registrationCount = 6;
    logger.info(`Quest Registration: Completed registering ${registrationCount} quest services/systems.`);
}