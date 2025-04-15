// src/core/containerConfig.js

// --- Import all necessary classes ---
import EventBus from './eventBus.js';
import DomRenderer from './domRenderer.js';
import DataManager from './dataManager.js';
import EntityManager from '../entities/entityManager.js';
import GameStateManager from './gameStateManager.js';
import CommandParser from './commandParser.js';
import ActionExecutor from '../actions/actionExecutor.js';
import InputHandler from './inputHandler.js';
import GameLoop from './gameLoop.js';

// Systems
import EquipmentSystem from '../systems/equipmentSystem.js';
import InventorySystem from '../systems/inventorySystem.js';
import CombatSystem from '../systems/combatSystem.js';
import DeathSystem from "../systems/deathSystem.js";
import MovementSystem from "../systems/movementSystem.js";
import WorldPresenceSystem from "../systems/worldPresenceSystem.js";
import ItemUsageSystem from "../systems/itemUsageSystem.js";
import QuestSystem from '../systems/questSystem.js';
import {NotificationUISystem} from "../systems/notificationUISystem.js";
import {QuestStartTriggerSystem} from "../systems/questStartTriggerSystem.js";
import BlockerSystem from '../systems/blockerSystem.js';
import GenericTriggerSystem from "../systems/genericTriggerSystem.js";
import GameRuleSystem from "../systems/gameRuleSystem.js";
import MoveCoordinatorSystem from '../systems/moveCoordinatorSystem.js';

// Services
import ConditionEvaluationService from "../services/conditionEvaluationService.js";
import EffectExecutionService from "../services/effectExecutionService.js";
import {QuestPrerequisiteService} from '../services/questPrerequisiteService.js';
import {QuestRewardService} from '../services/questRewardService.js';
import {ObjectiveEventListenerService} from '../services/objectiveEventListenerService.js';
import {ObjectiveStateCheckerService} from '../services/objectiveStateCheckerService.js';
import GameStateInitializer from './gameStateInitializer.js';
import WorldInitializer from './worldInitializer.js';
import {ItemTargetResolverService} from '../services/itemTargetResolver.js'; // Adjust path if necessary


/** @typedef {import('../core/appContainer.js').default} AppContainer */

/**
 * Registers all core services, systems, and managers with the AppContainer.
 * The order of registration matters for clarity and potentially for implicit dependency resolution.
 * @param {AppContainer} container - The application's DI container.
 * @param {object} uiElements - UI elements needed by some services (Renderer, InputHandler).
 * @param {HTMLElement} uiElements.outputDiv
 * @param {HTMLInputElement} uiElements.inputElement
 * @param {HTMLHeadingElement} uiElements.titleElement
 */
export function registerCoreServices(container, {outputDiv, inputElement, titleElement}) {
    console.log("ContainerConfig: Starting service registration...");

    // --- 0. Register External Dependencies (UI elements) ---
    container.register('outputDiv', () => outputDiv, {lifecycle: 'singleton'});
    container.register('inputElement', () => inputElement, {lifecycle: 'singleton'});
    container.register('titleElement', () => titleElement, {lifecycle: 'singleton'});

    // --- 1. Event Bus (Fundamental) ---
    container.register('EventBus', () => new EventBus(), {lifecycle: 'singleton'});

    // --- 2. Renderer (Needs EventBus & UI Elements) ---
    container.register('DomRenderer', (c) => new DomRenderer(
        c.resolve('outputDiv'),
        c.resolve('inputElement'),
        c.resolve('titleElement'),
        c.resolve('EventBus')
    ), {lifecycle: 'singleton'});

    // --- 3. Data Manager (Async loading handled separately) ---
    container.register('DataManager', () => new DataManager(), {lifecycle: 'singleton'});

    // --- 4. Entity Manager ---
    container.register('EntityManager', (c) => {
        console.log("ContainerConfig: Creating EntityManager instance...");
        const entityManager = new EntityManager(c.resolve('DataManager'));
        console.log("ContainerConfig: EntityManager instance created. Components will be registered later.");
        return entityManager;
    }, {lifecycle: 'singleton'});

    // --- 4b. Core Services (needed by systems) ---
    container.register('ConditionEvaluationService', (c) => new ConditionEvaluationService({
        entityManager: c.resolve('EntityManager')
    }), {lifecycle: 'singleton'});

    // REMOVED (Cleanup Step 6): Old TargetResolutionService Registration
    // container.register('TargetResolutionService', () => new TargetResolutionService(), {lifecycle: 'singleton'});

    // ADDED: Register New Service (Task 3)
    container.register('ItemTargetResolverService', (c) => new ItemTargetResolverService({
        entityManager: c.resolve('EntityManager'),
        eventBus: c.resolve('EventBus'),
        conditionEvaluationService: c.resolve('ConditionEvaluationService')
    }), {lifecycle: 'singleton'});


    container.register('EffectExecutionService', () => new EffectExecutionService(), {lifecycle: 'singleton'});

    // --- 5. Action Executor ---
    container.register('ActionExecutor', () => {
        console.log("ContainerConfig: Creating ActionExecutor instance...");
        const actionExecutor = new ActionExecutor();
        console.log("ContainerConfig: ActionExecutor instance created. Handlers will be registered later.");
        return actionExecutor;
    }, {lifecycle: 'singleton'});

    // --- 6. State Manager ---
    container.register('GameStateManager', () => new GameStateManager(), {lifecycle: 'singleton'});

    // --- 7. Command Parser ---
    container.register('CommandParser', (c) => new CommandParser(
        c.resolve('DataManager')
    ), {lifecycle: 'singleton'});

    // --- 8. Quest Services ---
    container.register('QuestPrerequisiteService', () => new QuestPrerequisiteService(), {lifecycle: 'singleton'});

    container.register('QuestRewardService', (c) => new QuestRewardService({
        dataManager: c.resolve('DataManager'),
        eventBus: c.resolve('EventBus'),
        gameStateManager: c.resolve('GameStateManager')
    }), {lifecycle: 'singleton'});

    container.register('ObjectiveEventListenerService', (c) => new ObjectiveEventListenerService({
        eventBus: c.resolve('EventBus'),
        dataManager: c.resolve('DataManager')
    }), {lifecycle: 'singleton'});

    container.register('ObjectiveStateCheckerService', (c) => new ObjectiveStateCheckerService({
        eventBus: c.resolve('EventBus'),
        dataManager: c.resolve('DataManager'),
        entityManager: c.resolve('EntityManager'),
        gameStateManager: c.resolve('GameStateManager')
    }), {lifecycle: 'singleton'});

    // --- 8b. Game State Initializer Service ---
    container.register('GameStateInitializer', (c) => new GameStateInitializer({
        entityManager: c.resolve('EntityManager'),
        gameStateManager: c.resolve('GameStateManager'),
        dataManager: c.resolve('DataManager')
    }), {lifecycle: 'singleton'});

    // --- 8c. World Initializer Service ---
    container.register('WorldInitializer', (c) => new WorldInitializer({
        entityManager: c.resolve('EntityManager'),
        gameStateManager: c.resolve('GameStateManager'),
        dataManager: c.resolve('DataManager')
    }), {lifecycle: 'singleton'});

    // --- 9. Core Systems ---
    // Register systems in a logical order, though DI handles resolution timing.
    // Grouping related systems can improve readability.

    // Base Systems
    container.register('GenericTriggerSystem', (c) => new GenericTriggerSystem({
        eventBus: c.resolve('EventBus'),
        dataManager: c.resolve('DataManager'),
        entityManager: c.resolve('EntityManager'),
    }), {lifecycle: 'singleton'});

    container.register('GameRuleSystem', (c) => new GameRuleSystem({
        eventBus: c.resolve('EventBus'),
        gameStateManager: c.resolve('GameStateManager'),
        actionExecutor: c.resolve('ActionExecutor'),
        entityManager: c.resolve('EntityManager'),
        dataManager: c.resolve('DataManager')
    }), {lifecycle: 'singleton'});

    // Entity State & Interaction Systems
    container.register('EquipmentSystem', (c) => new EquipmentSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'),
        dataManager: c.resolve('DataManager')
    }), {lifecycle: 'singleton'});

    container.register('InventorySystem', (c) => new InventorySystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'),
        dataManager: c.resolve('DataManager'),
        gameStateManager: c.resolve('GameStateManager')
    }), {lifecycle: 'singleton'});

    container.register('CombatSystem', (c) => new CombatSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'),
        dataManager: c.resolve('DataManager')
    }), {lifecycle: 'singleton'});

    container.register('DeathSystem', (c) => new DeathSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'),
    }), {lifecycle: 'singleton'});

    container.register('WorldPresenceSystem', (c) => new WorldPresenceSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager')
    }), {lifecycle: 'singleton'});

    // UPDATED: ItemUsageSystem Registration (Task 4)
    container.register('ItemUsageSystem', (c) => new ItemUsageSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'),
        dataManager: c.resolve('DataManager'),
        conditionEvaluationService: c.resolve('ConditionEvaluationService'),
        itemTargetResolverService: c.resolve('ItemTargetResolverService'),
        effectExecutionService: c.resolve('EffectExecutionService')
    }), {lifecycle: 'singleton'});

    // Movement Related Systems (Register dependencies first)
    container.register('BlockerSystem', (c) => new BlockerSystem({
        eventBus: c.resolve('EventBus'), // Still needed internally, even if not subscribing to move_attempted
        entityManager: c.resolve('EntityManager')
    }), {lifecycle: 'singleton'});

    container.register('MovementSystem', (c) => new MovementSystem({
        eventBus: c.resolve('EventBus'), // Needed to dispatch entity_moved
        entityManager: c.resolve('EntityManager'),
    }), {lifecycle: 'singleton'});

    container.register('MoveCoordinatorSystem', (c) => new MoveCoordinatorSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'),
        blockerSystem: c.resolve('BlockerSystem'),
        movementSystem: c.resolve('MovementSystem')
    }), {lifecycle: 'singleton'});

    // Quest Systems
    container.register('QuestSystem', (c) => new QuestSystem({
        dataManager: c.resolve('DataManager'),
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'),
        gameStateManager: c.resolve('GameStateManager'),
        questPrerequisiteService: c.resolve('QuestPrerequisiteService'),
        questRewardService: c.resolve('QuestRewardService'),
        objectiveEventListenerService: c.resolve('ObjectiveEventListenerService'),
        objectiveStateCheckerService: c.resolve('ObjectiveStateCheckerService')
    }), {lifecycle: 'singleton'});

    container.register('QuestStartTriggerSystem', (c) => new QuestStartTriggerSystem({
        eventBus: c.resolve('EventBus'),
        dataManager: c.resolve('DataManager'),
        gameStateManager: c.resolve('GameStateManager'),
    }), {lifecycle: 'singleton'});

    // UI Systems
    container.register('NotificationUISystem', (c) => new NotificationUISystem({
        eventBus: c.resolve('EventBus'),
        dataManager: c.resolve('DataManager'),
    }), {lifecycle: 'singleton'});


    // --- 10. Input Handler ---
    container.register('InputHandler', (c) => new InputHandler(
        c.resolve('inputElement'),
        null, // Callback MUST be set by the consumer (GameEngine) after resolving
        c.resolve('EventBus')
    ), {lifecycle: 'singleton'});


    // --- 11. Game Loop ---
    container.register('GameLoop', (c) => new GameLoop({
        dataManager: c.resolve('DataManager'),
        entityManager: c.resolve('EntityManager'),
        gameStateManager: c.resolve('GameStateManager'),
        inputHandler: c.resolve('InputHandler'),
        commandParser: c.resolve('CommandParser'),
        actionExecutor: c.resolve('ActionExecutor'),
        eventBus: c.resolve('EventBus')
    }), {lifecycle: 'singleton'});

    console.log("ContainerConfig: Service registration complete.");
}
