// src/core/containerConfig.js

// --- Import all necessary classes ---
import EventBus from '../../eventBus.js';
import DomRenderer from '../../domRenderer.js';
import DataManager from '../../dataManager.js';
import EntityManager from '../entities/entityManager.js';
import GameStateManager from '../../gameStateManager.js';
import CommandParser from '../../commandParser.js';
import ActionExecutor from '../actions/actionExecutor.js';
import InputHandler from '../../inputHandler.js';
import GameLoop from '../../gameLoop.js';

// Systems
import TriggerSystem from '../systems/triggerSystem.js';
import EquipmentSystem from '../systems/equipmentSystem.js';
import InventorySystem from '../systems/inventorySystem.js';
import CombatSystem from '../systems/combatSystem.js';
import DeathSystem from "../systems/deathSystem.js";
import MovementSystem from "../systems/movementSystem.js";
import WorldInteractionSystem from "../systems/worldInteractionSystem.js";
import ItemUsageSystem from "../systems/itemUsageSystem.js";
import DoorSystem from '../systems/doorSystem.js';
import QuestSystem from '../systems/questSystem.js';
import {NotificationUISystem} from "../systems/notificationUISystem.js";
import {QuestStartTriggerSystem} from "../systems/questStartTriggerSystem.js";

// Services
import ConditionEvaluationService from "../services/conditionEvaluationService.js";
import {TargetResolutionService} from "../services/targetResolutionService.js";
import EffectExecutionService from "../services/effectExecutionService.js";
import {QuestPrerequisiteService} from '../services/questPrerequisiteService.js';
import {QuestRewardService} from '../services/questRewardService.js';
import {ObjectiveEventListenerService} from '../services/objectiveEventListenerService.js';
import {ObjectiveStateCheckerService} from '../services/objectiveStateCheckerService.js';
import GameStateInitializer from './gameStateInitializer.js';
import WorldInitializer from './worldInitializer.js';

/** @typedef {import('../core/appContainer.js').default} AppContainer */

// --- Configuration Constants (Moved here from GameEngine) ---
// TODO: Ideally, load these from a dedicated config file/object later
const STARTING_PLAYER_ID = 'core:player';
const STARTING_LOCATION_ID = 'demo:room_entrance';

/**
 * Registers all core services, systems, and managers with the AppContainer.
 * The order of registration matters for clarity and potentially for implicit dependency resolution.
 * @param {AppContainer} container - The application's DI container.
 * @param {object} uiElements - UI elements needed by some services (Renderer, InputHandler).
 * @param {HTMLElement} uiElements.outputDiv
 * @param {HTMLInputElement} uiElements.inputElement
 * @param {HTMLHeadingElement} uiElements.titleElement
 */
export function registerCoreServices(container, { outputDiv, inputElement, titleElement }) {
    console.log("ContainerConfig: Starting service registration...");

    // --- 0. Register External Dependencies (UI elements) ---
    container.register('outputDiv', () => outputDiv, { lifecycle: 'singleton' });
    container.register('inputElement', () => inputElement, { lifecycle: 'singleton' });
    container.register('titleElement', () => titleElement, { lifecycle: 'singleton' });

    // --- 1. Event Bus (Fundamental) ---
    container.register('EventBus', () => new EventBus(), { lifecycle: 'singleton' });

    // --- 2. Renderer (Needs EventBus & UI Elements) ---
    container.register('DomRenderer', (c) => new DomRenderer(
        c.resolve('outputDiv'),
        c.resolve('inputElement'),
        c.resolve('titleElement'),
        c.resolve('EventBus')
    ), { lifecycle: 'singleton' });

    // --- 3. Data Manager (Async loading handled separately) ---
    container.register('DataManager', () => new DataManager(), { lifecycle: 'singleton' });
    // Note: dataManager.loadAllData() must be called *after* registration
    // but *before* systems relying on data are resolved. See GameEngine.#initialize.

    // --- 4. Entity Manager (Simplified Factory - No Component Registration Here) ---
    container.register('EntityManager', (c) => {
        console.log("ContainerConfig: Creating EntityManager instance...");
        // Factory now only handles instantiation and required dependency injection
        const entityManager = new EntityManager(c.resolve('DataManager'));
        // Component registration is now handled by RegistryInitializer after instantiation
        console.log("ContainerConfig: EntityManager instance created. Components will be registered later.");
        return entityManager;
    }, { lifecycle: 'singleton' });

    // --- 4b. Core Services (needed by systems) ---
    container.register('ConditionEvaluationService', (c) => new ConditionEvaluationService({
        entityManager: c.resolve('EntityManager') // Still depends on EntityManager instance
    }), { lifecycle: 'singleton' });

    container.register('TargetResolutionService', () => new TargetResolutionService(), { lifecycle: 'singleton' });

    container.register('EffectExecutionService', () => new EffectExecutionService(), { lifecycle: 'singleton' });

    // --- 5. Action Executor (Simplified Factory - No Handler Registration Here) ---
    container.register('ActionExecutor', () => {
        console.log("ContainerConfig: Creating ActionExecutor instance...");
        // Factory now only handles instantiation
        const actionExecutor = new ActionExecutor();
        // Action Handler registration is now handled by RegistryInitializer after instantiation
        console.log("ContainerConfig: ActionExecutor instance created. Handlers will be registered later.");
        return actionExecutor;
    }, { lifecycle: 'singleton' });

    // --- 6. State Manager ---
    container.register('GameStateManager', () => new GameStateManager(), { lifecycle: 'singleton' });

    // --- 7. Command Parser ---
    container.register('CommandParser', () => new CommandParser(), { lifecycle: 'singleton' });

    // --- 8. Quest Services (Some depend on others) ---
    container.register('QuestPrerequisiteService', () => new QuestPrerequisiteService(), { lifecycle: 'singleton' });

    container.register('QuestRewardService', (c) => new QuestRewardService({
        dataManager: c.resolve('DataManager'),
        eventBus: c.resolve('EventBus'),
        gameStateManager: c.resolve('GameStateManager')
    }), { lifecycle: 'singleton' });

    container.register('ObjectiveEventListenerService', (c) => new ObjectiveEventListenerService({
        eventBus: c.resolve('EventBus'),
        dataManager: c.resolve('DataManager')
    }), { lifecycle: 'singleton' });

    container.register('ObjectiveStateCheckerService', (c) => new ObjectiveStateCheckerService({
        eventBus: c.resolve('EventBus'),
        dataManager: c.resolve('DataManager'),
        entityManager: c.resolve('EntityManager'), // Depends on EntityManager instance
        gameStateManager: c.resolve('GameStateManager')
    }), { lifecycle: 'singleton' });

    // --- 8b. Game State Initializer Service ---
    // Depends on EntityManager, GameStateManager, DataManager
    // Register after these managers are registered.
    container.register('GameStateInitializer', (c) => new GameStateInitializer({
        entityManager: c.resolve('EntityManager'),
        gameStateManager: c.resolve('GameStateManager'),
        dataManager: c.resolve('DataManager'),
        // Pass the configuration values defined at the top of this file
        startingPlayerId: STARTING_PLAYER_ID,
        startingLocationId: STARTING_LOCATION_ID
    }), { lifecycle: 'singleton' }); // Singleton as it runs once per initialization

    // --- 8c. World Initializer Service ---
    // Depends on EntityManager, GameStateManager, DataManager
    // Runs *after* GameStateInitializer sets player/location
    container.register('WorldInitializer', (c) => new WorldInitializer({
        entityManager: c.resolve('EntityManager'),
        gameStateManager: c.resolve('GameStateManager'),
        dataManager: c.resolve('DataManager')
    }), { lifecycle: 'singleton' });

    // --- 9. Core Systems (Order can matter for dependencies, initialization happens post-resolution) ---
    // Systems depending on EntityManager or ActionExecutor will now get instances
    // whose registries are populated by RegistryInitializer before system initialization.

    container.register('TriggerSystem', (c) => new TriggerSystem({
        eventBus: c.resolve('EventBus'),
        dataManager: c.resolve('DataManager'),
        entityManager: c.resolve('EntityManager'), // Depends on EntityManager instance
        gameStateManager: c.resolve('GameStateManager'),
        actionExecutor: c.resolve('ActionExecutor') // Depends on ActionExecutor instance
    }), { lifecycle: 'singleton' });

    container.register('EquipmentSystem', (c) => new EquipmentSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'), // Depends on EntityManager instance
        dataManager: c.resolve('DataManager')
    }), { lifecycle: 'singleton' });

    container.register('InventorySystem', (c) => new InventorySystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'), // Depends on EntityManager instance
        dataManager: c.resolve('DataManager')
    }), { lifecycle: 'singleton' });

    container.register('CombatSystem', (c) => new CombatSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'), // Depends on EntityManager instance
        dataManager: c.resolve('DataManager')
    }), { lifecycle: 'singleton' });

    container.register('DeathSystem', (c) => new DeathSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'), // Depends on EntityManager instance
    }), { lifecycle: 'singleton' });

    container.register('MovementSystem', (c) => new MovementSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'), // Depends on EntityManager instance
    }), { lifecycle: 'singleton' });

    container.register('WorldInteractionSystem', (c) => new WorldInteractionSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager') // Depends on EntityManager instance
    }), { lifecycle: 'singleton' });

    container.register('ItemUsageSystem', (c) => new ItemUsageSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'), // Depends on EntityManager instance
        dataManager: c.resolve('DataManager'),
        conditionEvaluationService: c.resolve('ConditionEvaluationService'),
        targetResolutionService: c.resolve('TargetResolutionService'),
        effectExecutionService: c.resolve('EffectExecutionService')
    }), { lifecycle: 'singleton' });

    container.register('DoorSystem', (c) => new DoorSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager') // Depends on EntityManager instance
    }), { lifecycle: 'singleton' });

    container.register('QuestSystem', (c) => new QuestSystem({
        dataManager: c.resolve('DataManager'),
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'), // Depends on EntityManager instance
        gameStateManager: c.resolve('GameStateManager'),
        questPrerequisiteService: c.resolve('QuestPrerequisiteService'),
        questRewardService: c.resolve('QuestRewardService'),
        objectiveEventListenerService: c.resolve('ObjectiveEventListenerService'),
        objectiveStateCheckerService: c.resolve('ObjectiveStateCheckerService')
    }), { lifecycle: 'singleton' });

    container.register('QuestStartTriggerSystem', (c) => new QuestStartTriggerSystem({
        eventBus: c.resolve('EventBus'),
        dataManager: c.resolve('DataManager'),
        gameStateManager: c.resolve('GameStateManager'),
    }), { lifecycle: 'singleton' });

    container.register('NotificationUISystem', (c) => new NotificationUISystem({
        eventBus: c.resolve('EventBus'),
        dataManager: c.resolve('DataManager'),
    }), { lifecycle: 'singleton' });


    // --- 10. Input Handler (Needs EventBus, Command Callback configured in GameEngine) ---
    container.register('InputHandler', (c) => new InputHandler(
        c.resolve('inputElement'),
        null, // Callback MUST be set by the consumer (GameEngine) after resolving
        c.resolve('EventBus')
    ), { lifecycle: 'singleton' });


    // --- 11. Game Loop (Needs many core systems) ---
    container.register('GameLoop', (c) => new GameLoop({
        dataManager: c.resolve('DataManager'),
        entityManager: c.resolve('EntityManager'), // Depends on EntityManager instance
        gameStateManager: c.resolve('GameStateManager'),
        inputHandler: c.resolve('InputHandler'),
        commandParser: c.resolve('CommandParser'),
        actionExecutor: c.resolve('ActionExecutor'), // Depends on ActionExecutor instance
        eventBus: c.resolve('EventBus')
    }), { lifecycle: 'singleton' });

    console.log("ContainerConfig: Service registration complete.");
}