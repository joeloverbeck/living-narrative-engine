// src/core/containerConfig.js

// --- Import all necessary classes ---
import EventBus from './eventBus.js';
import DomRenderer from './domRenderer.js';
import EntityManager from '../entities/entityManager.js';
import GameStateManager from './gameStateManager.js';
import CommandParser from './commandParser.js';
import ActionExecutor from '../actions/actionExecutor.js';
import InputHandler from './inputHandler.js';
import GameLoop from './gameLoop.js';

// Systems
import EquipmentEffectSystem from '../systems/equipmentEffectSystem.js';
import EquipmentSlotSystem from '../systems/equipmentSlotSystem.js';
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
import TriggerDispatcher from "../systems/triggerDispatcher.js";
import GameRuleSystem from "../systems/gameRuleSystem.js";
import MoveCoordinatorSystem from '../systems/moveCoordinatorSystem.js';
import OpenableSystem from '../systems/openableSystem.js';
import HealthSystem from "../systems/healthSystem.js";
import StatusEffectSystem from "../systems/statusEffectSystem.js";
import LockSystem from "../systems/lockSystem.js";
import PerceptionSystem from '../systems/perceptionSystem.js';

// Services (Core Services from ticket)
import AjvSchemaValidator from './services/ajvSchemaValidator.js';
import ConsoleLogger from './services/consoleLogger.js';
import DefaultPathResolver from './services/defaultPathResolver.js';
import {GameDataRepository} from './services/gameDataRepository.js'; // Verified Import (AC5)
import GenericContentLoader from './services/genericContentLoader.js';
import InMemoryDataRegistry from './services/inMemoryDataRegistry.js';
import ManifestLoader from './services/manifestLoader.js';
import RuntimeEventTypeValidator from './services/runtimeEventTypeValidator.js';
import SchemaLoader from './services/schemaLoader.js';
import WorkspaceDataFetcher from './services/workspaceDataFetcher.js';
import StaticConfiguration from './services/staticConfiguration.js';
import WorldLoader from './services/worldLoader.js'; // Verified Import (AC5)
import * as eventTypes from '../types/eventTypes.js'; // Import event types for validator initialization

// Other Services (Existing application services)
import ConditionEvaluationService from "../services/conditionEvaluationService.js";
import {QuestPrerequisiteService} from '../services/questPrerequisiteService.js';
import {QuestRewardService} from '../services/questRewardService.js';
import {ObjectiveEventListenerService} from '../services/objectiveEventListenerService.js';
import {ObjectiveStateCheckerService} from '../services/objectiveStateCheckerService.js';
import GameStateInitializer from './gameStateInitializer.js';
import WorldInitializer from './worldInitializer.js';
import {ItemTargetResolverService} from '../services/itemTargetResolver.js';


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

    // --- 2. New Core Services (Lower Level) ---
    // These don't usually depend on many other game systems, but might depend on each other
    container.register('ILogger', () => new ConsoleLogger(), {lifecycle: 'singleton'});
    container.register('IDataFetcher', () => new WorkspaceDataFetcher(), {lifecycle: 'singleton'});
    container.register('IConfiguration', () => new StaticConfiguration(), {lifecycle: 'singleton'});
    container.register('IPathResolver', (c) => new DefaultPathResolver(c.resolve('IConfiguration')), {lifecycle: 'singleton'});
    container.register('ISchemaValidator', () => new AjvSchemaValidator(), {lifecycle: 'singleton'});
    container.register('IEventTypeValidator', (c) => {
        const validator = new RuntimeEventTypeValidator();
        validator.initialize(eventTypes);
        c.resolve('ILogger').info("Initialized RuntimeEventTypeValidator with event types.");
        return validator;
    }, {lifecycle: 'singleton'});
    container.register('IDataRegistry', () => new InMemoryDataRegistry(), {lifecycle: 'singleton'});

    // --- 3. Data Loaders (Depend on core services) ---
    container.register('SchemaLoader', (c) => new SchemaLoader(c.resolve('IConfiguration'), c.resolve('IPathResolver'), c.resolve('IDataFetcher'), c.resolve('ISchemaValidator'), c.resolve('ILogger')), {lifecycle: 'singleton'});

    container.register('ManifestLoader', (c) => new ManifestLoader(c.resolve('IConfiguration'), c.resolve('IPathResolver'), c.resolve('IDataFetcher'), c.resolve('ISchemaValidator'), c.resolve('ILogger')), {lifecycle: 'singleton'});

    container.register('GenericContentLoader', (c) => new GenericContentLoader(c.resolve('IConfiguration'), c.resolve('IPathResolver'), c.resolve('IDataFetcher'), c.resolve('ISchemaValidator'), c.resolve('IEventTypeValidator'), c.resolve('IDataRegistry'), c.resolve('ILogger')), {lifecycle: 'singleton'});

    // --- 4. World Orchestrator & Data Access ---
    // Registered in SUB-02
    container.register('WorldLoader', (c) => new WorldLoader(
        c.resolve('IDataRegistry'),
        c.resolve('ILogger'),
        c.resolve('SchemaLoader'),
        c.resolve('ManifestLoader'),
        c.resolve('GenericContentLoader'),
        c.resolve('ISchemaValidator'),
        c.resolve('IConfiguration')
    ), {lifecycle: 'singleton'});
    container.register('GameDataRepository', (c) => new GameDataRepository(c.resolve('IDataRegistry'), c.resolve('ILogger')), {lifecycle: 'singleton'}); // Pass logger if needed

    // --- 5. Entity Manager ---
    // *** [REFACTOR-014-SUB-11] Updated ***
    container.register('EntityManager', (c) => {
        c.resolve('ILogger').info("ContainerConfig: Creating EntityManager instance...");
        // Change 'GameDataRepository' to 'GameDataRepository' and verify EntityManager constructor/internals
        const entityManager = new EntityManager(c.resolve('GameDataRepository')); // <-- UPDATED
        c.resolve('ILogger').info("ContainerConfig: EntityManager instance created.");
        return entityManager;
    }, {lifecycle: 'singleton'});

    // --- 6. Renderer ---
    container.register('DomRenderer', (c) => new DomRenderer(c.resolve('outputDiv'), c.resolve('inputElement'), c.resolve('titleElement'), c.resolve('EventBus')), {lifecycle: 'singleton'});

    // --- 7. Core Game Logic Services ---
    // *** [REFACTOR-014-SUB-11] Check if GameDataRepository is needed ***
    container.register('ConditionEvaluationService', (c) => new ConditionEvaluationService({
        entityManager: c.resolve('EntityManager'), // Potentially needs GameDataRepository if evaluating against base definitions
        // gameDataRepository: c.resolve('GameDataRepository') // Uncomment if needed
    }), {lifecycle: 'singleton'});

    // *** [REFACTOR-014-SUB-11] Check if GameDataRepository is needed ***
    container.register('ItemTargetResolverService', (c) => new ItemTargetResolverService({
        entityManager: c.resolve('EntityManager'),
        eventBus: c.resolve('EventBus'),
        conditionEvaluationService: c.resolve('ConditionEvaluationService')
        // Potentially needs GameDataRepository? Unlikely.
    }), {lifecycle: 'singleton'});

    // --- 8. Action Executor ---
    // No GameDataRepository dependency here
    container.register('ActionExecutor', (c) => {
        c.resolve('ILogger').info("ContainerConfig: Creating ActionExecutor instance...");
        const actionExecutor = new ActionExecutor();
        c.resolve('ILogger').info("ContainerConfig: ActionExecutor instance created.");
        return actionExecutor;
    }, {lifecycle: 'singleton'});

    // --- 9. State Manager ---
    // No GameDataRepository dependency here
    container.register('GameStateManager', () => new GameStateManager(), {lifecycle: 'singleton'});

    // --- 10. Command Parser ---
    // *** [REFACTOR-014-SUB-11] Updated ***
    container.register('CommandParser', (c) => new CommandParser(// Change 'GameDataRepository' to 'GameDataRepository' and verify CommandParser constructor/internals
        c.resolve('GameDataRepository')
    ), {lifecycle: 'singleton'});

    // --- 11. Quest Services ---
    // *** [REFACTOR-014-SUB-11] Check if GameDataRepository is needed ***
    container.register('QuestPrerequisiteService', () => new QuestPrerequisiteService(/* Dependencies? Maybe GameDataRepository if checking definitions? */), {lifecycle: 'singleton'});

    // *** [REFACTOR-014-SUB-11] Updated ***
    container.register('QuestRewardService', (c) => new QuestRewardService({
        // Change 'gameDataRepository' key and resolve 'GameDataRepository'
        // Verify QuestRewardService constructor/internals
        gameDataRepository: c.resolve('GameDataRepository'), // <-- UPDATED key and value
        eventBus: c.resolve('EventBus'), gameStateManager: c.resolve('GameStateManager')
    }), {lifecycle: 'singleton'});

    // *** [REFACTOR-014-SUB-11] Updated ***
    container.register('ObjectiveEventListenerService', (c) => new ObjectiveEventListenerService({
        eventBus: c.resolve('EventBus'), // Change 'gameDataRepository' key and resolve 'GameDataRepository'
        // Verify ObjectiveEventListenerService constructor/internals
        gameDataRepository: c.resolve('GameDataRepository') // <-- UPDATED key and value
    }), {lifecycle: 'singleton'});

    // *** [REFACTOR-014-SUB-11] Updated ***
    container.register('ObjectiveStateCheckerService', (c) => new ObjectiveStateCheckerService({
        eventBus: c.resolve('EventBus'), // Change 'gameDataRepository' key and resolve 'GameDataRepository'
        // Verify ObjectiveStateCheckerService constructor/internals
        gameDataRepository: c.resolve('GameDataRepository'), // <-- UPDATED key and value
        entityManager: c.resolve('EntityManager'), gameStateManager: c.resolve('GameStateManager')
    }), {lifecycle: 'singleton'});

    // --- 12. Game State Initializer Service ---
    // *** [REFACTOR-014-SUB-11] Updated ***
    container.register('GameStateInitializer', (c) => new GameStateInitializer({
        entityManager: c.resolve('EntityManager'),
        gameStateManager: c.resolve('GameStateManager'), // Change 'gameDataRepository' key and resolve 'GameDataRepository'
        // Verify GameStateInitializer constructor/internals
        gameDataRepository: c.resolve('GameDataRepository') // <-- UPDATED key and value
    }), {lifecycle: 'singleton'});

    // --- 13. World Initializer Service ---
    // *** [REFACTOR-014-SUB-11] Updated ***
    container.register('WorldInitializer', (c) => new WorldInitializer({
        entityManager: c.resolve('EntityManager'),
        gameStateManager: c.resolve('GameStateManager'), // Change 'gameDataRepository' key and resolve 'GameDataRepository'
        // Verify WorldInitializer constructor/internals (NOTE: Requires significant internal changes)
        gameDataRepository: c.resolve('GameDataRepository') // <-- UPDATED key and value
    }), {lifecycle: 'singleton'});

    // --- 14. Core Systems ---
    // *** NOTE: Most systems below have had their GameDataRepository dependency updated to GameDataRepository ***

    // *** [REFACTOR-014-SUB-11] Updated ***
    container.register('TriggerDispatcher', (c) => new TriggerDispatcher({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'), // Change 'gameDataRepository' key and resolve 'GameDataRepository'
        gameDataRepository: c.resolve('GameDataRepository') // <-- UPDATED key and value
    }), {lifecycle: 'singleton'});

    // *** [REFACTOR-014-SUB-11] Updated ***
    container.register('GameRuleSystem', (c) => new GameRuleSystem({
        eventBus: c.resolve('EventBus'),
        gameStateManager: c.resolve('GameStateManager'),
        actionExecutor: c.resolve('ActionExecutor'),
        entityManager: c.resolve('EntityManager'), // Change 'gameDataRepository' key and resolve 'GameDataRepository'
        gameDataRepository: c.resolve('GameDataRepository') // <-- UPDATED key and value
    }), {lifecycle: 'singleton'});

    // *** [REFACTOR-014-SUB-11] Updated ***
    container.register('EquipmentEffectSystem', (c) => new EquipmentEffectSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'), // Change 'gameDataRepository' key and resolve 'GameDataRepository'
        gameDataRepository: c.resolve('GameDataRepository') // <-- UPDATED key and value
    }), {lifecycle: 'singleton'});

    // *** [REFACTOR-014-SUB-11] Updated ***
    container.register('EquipmentSlotSystem', (c) => new EquipmentSlotSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'), // Change 'gameDataRepository' key and resolve 'GameDataRepository'
        gameDataRepository: c.resolve('GameDataRepository') // <-- UPDATED key and value
    }), {lifecycle: 'singleton'});

    // *** [REFACTOR-014-SUB-11] Updated ***
    container.register('InventorySystem', (c) => new InventorySystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'), // Change 'gameDataRepository' key and resolve 'GameDataRepository'
        gameDataRepository: c.resolve('GameDataRepository'), // <-- UPDATED key and value
        gameStateManager: c.resolve('GameStateManager')
    }), {lifecycle: 'singleton'});

    // *** [REFACTOR-014-SUB-11] Updated ***
    container.register('CombatSystem', (c) => new CombatSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'), // Change 'gameDataRepository' key and resolve 'GameDataRepository'
        gameDataRepository: c.resolve('GameDataRepository') // <-- UPDATED key and value
    }), {lifecycle: 'singleton'});

    // No GameDataRepository dep...
    container.register('DeathSystem', (c) => new DeathSystem({
        eventBus: c.resolve('EventBus'), entityManager: c.resolve('EntityManager')
    }), {lifecycle: 'singleton'});
    container.register('WorldPresenceSystem', (c) => new WorldPresenceSystem({
        eventBus: c.resolve('EventBus'), entityManager: c.resolve('EntityManager')
    }), {lifecycle: 'singleton'});

    // *** [REFACTOR-014-SUB-11] Updated ***
    container.register('ItemUsageSystem', (c) => new ItemUsageSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'),
        conditionEvaluationService: c.resolve('ConditionEvaluationService'),
        itemTargetResolverService: c.resolve('ItemTargetResolverService'), // Change 'gameDataRepository' key and resolve 'GameDataRepository'
        gameDataRepository: c.resolve('GameDataRepository') // <-- UPDATED key and value
    }), {lifecycle: 'singleton'});

    // No GameDataRepository dep...
    container.register('BlockerSystem', (c) => new BlockerSystem({
        eventBus: c.resolve('EventBus'), entityManager: c.resolve('EntityManager')
    }), {lifecycle: 'singleton'});
    container.register('MovementSystem', (c) => new MovementSystem({
        eventBus: c.resolve('EventBus'), entityManager: c.resolve('EntityManager')
    }), {lifecycle: 'singleton'});
    container.register('MoveCoordinatorSystem', (c) => new MoveCoordinatorSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'),
        blockerSystem: c.resolve('BlockerSystem'),
        movementSystem: c.resolve('MovementSystem')
    }), {lifecycle: 'singleton'});

    // *** [REFACTOR-014-SUB-11] Updated ***
    container.register('QuestSystem', (c) => new QuestSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'),
        gameStateManager: c.resolve('GameStateManager'),
        questPrerequisiteService: c.resolve('QuestPrerequisiteService'),
        questRewardService: c.resolve('QuestRewardService'),
        objectiveEventListenerService: c.resolve('ObjectiveEventListenerService'),
        objectiveStateCheckerService: c.resolve('ObjectiveStateCheckerService'), // Change 'gameDataRepository' key and resolve 'GameDataRepository'
        gameDataRepository: c.resolve('GameDataRepository') // <-- UPDATED key and value
    }), {lifecycle: 'singleton'});

    // *** [REFACTOR-014-SUB-11] Updated ***
    container.register('QuestStartTriggerSystem', (c) => new QuestStartTriggerSystem({
        eventBus: c.resolve('EventBus'),
        gameStateManager: c.resolve('GameStateManager'), // Change 'gameDataRepository' key and resolve 'GameDataRepository'
        gameDataRepository: c.resolve('GameDataRepository') // <-- UPDATED key and value
    }), {lifecycle: 'singleton'});

    // No GameDataRepository dep... (PerceptionSystem doesn't show a DM dep in its constructor/usage)
    container.register('PerceptionSystem', (c) => new PerceptionSystem({
        eventBus: c.resolve('EventBus'), entityManager: c.resolve('EntityManager')
    }), {lifecycle: 'singleton'});

    // *** [REFACTOR-014-SUB-11] Updated ***
    container.register('NotificationUISystem', (c) => new NotificationUISystem({
        eventBus: c.resolve('EventBus'), // Change 'gameDataRepository' key and resolve 'GameDataRepository'
        gameDataRepository: c.resolve('GameDataRepository') // <-- UPDATED key and value
    }), {lifecycle: 'singleton'});

    // No GameDataRepository dep...
    container.register('OpenableSystem', (c) => new OpenableSystem({
        eventBus: c.resolve('EventBus'), entityManager: c.resolve('EntityManager')
    }), {lifecycle: 'singleton'});

    // *** [REFACTOR-014-SUB-11] Updated ***
    container.register('HealthSystem', (c) => new HealthSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'), // Change 'gameDataRepository' key and resolve 'GameDataRepository'
        gameDataRepository: c.resolve('GameDataRepository') // <-- UPDATED key and value
    }), {lifecycle: 'singleton'});

    // *** [REFACTOR-014-SUB-11] Updated ***
    container.register('StatusEffectSystem', (c) => new StatusEffectSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'), // Change 'gameDataRepository' key and resolve 'GameDataRepository'
        gameDataRepository: c.resolve('GameDataRepository') // <-- UPDATED key and value
    }), {lifecycle: 'singleton'});

    // No GameDataRepository dep...
    container.register('LockSystem', (c) => new LockSystem({
        eventBus: c.resolve('EventBus'), entityManager: c.resolve('EntityManager')
    }), {lifecycle: 'singleton'});

    // --- 15. Input Handler ---
    // No GameDataRepository dependency here
    container.register('InputHandler', (c) => new InputHandler(c.resolve('inputElement'), null, c.resolve('EventBus')), {lifecycle: 'singleton'});

    // --- 16. Game Loop ---
    // Updated in SUB-05 to use GameDataRepository - Requires dependencies updated first!
    container.register('GameLoop', (c) => new GameLoop({
        gameStateManager: c.resolve('GameStateManager'),
        inputHandler: c.resolve('InputHandler'),
        commandParser: c.resolve('CommandParser'), // Depends on CommandParser update
        actionExecutor: c.resolve('ActionExecutor'),
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'), // Depends on EntityManager update
        gameDataRepository: c.resolve('GameDataRepository'), // Already correct
    }), {lifecycle: 'singleton'});


    container.resolve('ILogger').info("ContainerConfig: Service registration complete.");
}
