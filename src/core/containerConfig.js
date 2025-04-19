// src/core/containerConfig.js

// --- Import all necessary classes ---
import EventBus from './eventBus.js';
import DomRenderer from './domRenderer.js';
import EntityManager from '../entities/entityManager.js';
import GameStateManager from './gameStateManager.js';
import CommandParser from './commandParser.js';
import ActionExecutor from '../actions/actionExecutor.js'; // Keep this
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
import {ActionDiscoverySystem} from '../systems/actionDiscoverySystem.js';

// Services (Core Services from ticket)
import AjvSchemaValidator from './services/ajvSchemaValidator.js';
import ConsoleLogger from './services/consoleLogger.js';
import DefaultPathResolver from './services/defaultPathResolver.js';
import {GameDataRepository} from './services/gameDataRepository.js';
import GenericContentLoader from './services/genericContentLoader.js';
import InMemoryDataRegistry from './services/inMemoryDataRegistry.js';
import ManifestLoader from './services/manifestLoader.js';
import RuntimeEventTypeValidator from './services/runtimeEventTypeValidator.js';
import SchemaLoader from './services/schemaLoader.js';
import WorkspaceDataFetcher from './services/workspaceDataFetcher.js';
import StaticConfiguration from './services/staticConfiguration.js';
import WorldLoader from './services/worldLoader.js';
import * as eventTypes from '../types/eventTypes.js';

// Other Services (Existing application services)
import ConditionEvaluationService from "../services/conditionEvaluationService.js";
import {QuestPrerequisiteService} from '../services/questPrerequisiteService.js';
import {QuestRewardService} from '../services/questRewardService.js';
import {ObjectiveEventListenerService} from '../services/objectiveEventListenerService.js';
import {ObjectiveStateCheckerService} from '../services/objectiveStateCheckerService.js';
import GameStateInitializer from './gameStateInitializer.js';
import WorldInitializer from './worldInitializer.js';
import {ItemTargetResolverService} from '../services/itemTargetResolver.js';
import {ActionValidationService} from "../services/actionValidationService.js";
import TargetResolutionService from '../services/targetResolutionService.js';
import PayloadValueResolverService from '../services/payloadValueResolverService.js';
import {formatActionCommand} from '../services/actionFormatter.js';


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
    const logger = new ConsoleLogger(); // Instantiate logger early for use during registration
    logger.info("ContainerConfig: Starting service registration...");
    container.register('ILogger', () => logger, {lifecycle: 'singleton'}); // Register the logger instance

    // --- 0. Register External Dependencies (UI elements) ---
    container.register('outputDiv', () => outputDiv, {lifecycle: 'singleton'});
    container.register('inputElement', () => inputElement, {lifecycle: 'singleton'});
    container.register('titleElement', () => titleElement, {lifecycle: 'singleton'});

    // --- 1. Event Bus (Fundamental) ---
    container.register('EventBus', () => new EventBus(), {lifecycle: 'singleton'});

    // --- 2. New Core Services (Lower Level) ---
    // ILogger is already registered above
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
    container.register('WorldLoader', (c) => new WorldLoader(
        c.resolve('IDataRegistry'),
        c.resolve('ILogger'),
        c.resolve('SchemaLoader'),
        c.resolve('ManifestLoader'),
        c.resolve('GenericContentLoader'),
        c.resolve('ISchemaValidator'),
        c.resolve('IConfiguration')
    ), {lifecycle: 'singleton'});
    container.register('GameDataRepository', (c) => new GameDataRepository(c.resolve('IDataRegistry'), c.resolve('ILogger')), {lifecycle: 'singleton'});

    // --- 5. Entity Manager ---
    container.register('EntityManager', (c) => {
        c.resolve('ILogger').info("ContainerConfig: Creating EntityManager instance...");
        const entityManager = new EntityManager(c.resolve('GameDataRepository'));
        c.resolve('ILogger').info("ContainerConfig: EntityManager instance created.");
        return entityManager;
    }, {lifecycle: 'singleton'});

    // --- 6. Renderer ---
    container.register('DomRenderer', (c) => new DomRenderer(c.resolve('outputDiv'), c.resolve('inputElement'), c.resolve('titleElement'), c.resolve('EventBus')), {lifecycle: 'singleton'});

    // --- 7. Core Game Logic Services ---
    container.register('ConditionEvaluationService', (c) => new ConditionEvaluationService({
        entityManager: c.resolve('EntityManager'),
        // gameDataRepository: c.resolve('GameDataRepository') // Uncomment if needed later
    }), {lifecycle: 'singleton'});

    container.register('ItemTargetResolverService', (c) => new ItemTargetResolverService({
        entityManager: c.resolve('EntityManager'),
        eventBus: c.resolve('EventBus'),
        conditionEvaluationService: c.resolve('ConditionEvaluationService')
    }), {lifecycle: 'singleton'});

    // +++ ADD TargetResolutionService Registration +++
    container.register('TargetResolutionService', (c) => {
        c.resolve('ILogger').info("ContainerConfig: Creating TargetResolutionService instance...");
        // Assuming TargetResolutionService constructor currently takes no args based on provided code.
        // If it needed dependencies later (e.g., EntityManager), inject them here.
        const service = new TargetResolutionService();
        c.resolve('ILogger').info("ContainerConfig: TargetResolutionService instance created.");
        return service;
    }, {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered TargetResolutionService."); // Use logger instance

    // --- Action Validation Service ---
    container.register('ActionValidationService', (c) => new ActionValidationService({
        entityManager: c.resolve('EntityManager'),
        gameDataRepository: c.resolve('GameDataRepository'),
        logger: c.resolve('ILogger')
    }), {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered ActionValidationService."); // Use logger instance

    container.register('PayloadValueResolverService', (c) => {
        const serviceLogger = c.resolve('ILogger');
        serviceLogger.info("ContainerConfig: Creating PayloadValueResolverService instance...");
        const service = new PayloadValueResolverService({logger: serviceLogger}); // Pass logger
        serviceLogger.info("ContainerConfig: PayloadValueResolverService instance created.");
        return service;
    }, {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered PayloadValueResolverService.");

    // --- 8. Action Executor ---
    container.register('ActionExecutor', (c) => {
        const resolvedLogger = c.resolve('ILogger'); // Resolve once
        resolvedLogger.info("ContainerConfig: Resolving dependencies for ActionExecutor...");

        // Resolve all required dependencies
        const gameDataRepository = c.resolve('GameDataRepository');
        const targetResolutionService = c.resolve('TargetResolutionService');
        const actionValidationService = c.resolve('ActionValidationService');
        const payloadValueResolverService = c.resolve('PayloadValueResolverService'); // <<<--- RESOLVE new service
        const eventBus = c.resolve('EventBus');

        resolvedLogger.info("ContainerConfig: Creating ActionExecutor instance with dependencies...");
        // Pass dependencies as an object to the constructor
        const actionExecutor = new ActionExecutor({
            gameDataRepository,
            targetResolutionService,
            actionValidationService,
            payloadValueResolverService, // <<<--- PASS new service instance
            eventBus,
            logger: resolvedLogger // Pass the resolved logger
        });

        resolvedLogger.info("ContainerConfig: ActionExecutor instance created.");
        return actionExecutor;
    }, {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered ActionExecutor.");


    // --- 9. State Manager ---
    container.register('GameStateManager', () => new GameStateManager(), {lifecycle: 'singleton'});

    // --- 10. Command Parser ---
    container.register('CommandParser', (c) => new CommandParser(
        c.resolve('GameDataRepository')
    ), {lifecycle: 'singleton'});

    // --- 11. Quest Services ---
    container.register('QuestPrerequisiteService', () => new QuestPrerequisiteService(), {lifecycle: 'singleton'});
    container.register('QuestRewardService', (c) => new QuestRewardService({
        gameDataRepository: c.resolve('GameDataRepository'),
        eventBus: c.resolve('EventBus'), gameStateManager: c.resolve('GameStateManager')
    }), {lifecycle: 'singleton'});
    container.register('ObjectiveEventListenerService', (c) => new ObjectiveEventListenerService({
        eventBus: c.resolve('EventBus'),
        gameDataRepository: c.resolve('GameDataRepository')
    }), {lifecycle: 'singleton'});
    container.register('ObjectiveStateCheckerService', (c) => new ObjectiveStateCheckerService({
        eventBus: c.resolve('EventBus'),
        gameDataRepository: c.resolve('GameDataRepository'),
        entityManager: c.resolve('EntityManager'), gameStateManager: c.resolve('GameStateManager')
    }), {lifecycle: 'singleton'});

    // --- 12. Game State Initializer Service ---
    container.register('GameStateInitializer', (c) => new GameStateInitializer({
        entityManager: c.resolve('EntityManager'),
        gameStateManager: c.resolve('GameStateManager'),
        gameDataRepository: c.resolve('GameDataRepository')
    }), {lifecycle: 'singleton'});

    // --- 13. World Initializer Service ---
    container.register('WorldInitializer', (c) => new WorldInitializer({
        entityManager: c.resolve('EntityManager'),
        gameStateManager: c.resolve('GameStateManager'),
        gameDataRepository: c.resolve('GameDataRepository')
    }), {lifecycle: 'singleton'});

    // --- 14. Core Systems ---
    // (Registrations for other systems remain unchanged from the input, assuming they are correct)
    container.register('TriggerDispatcher', (c) => new TriggerDispatcher({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'),
        gameDataRepository: c.resolve('GameDataRepository')
    }), {lifecycle: 'singleton'});
    container.register('GameRuleSystem', (c) => new GameRuleSystem({
        eventBus: c.resolve('EventBus'),
        gameStateManager: c.resolve('GameStateManager'),
        actionExecutor: c.resolve('ActionExecutor'),
        entityManager: c.resolve('EntityManager'),
        gameDataRepository: c.resolve('GameDataRepository')
    }), {lifecycle: 'singleton'});
    container.register('EquipmentEffectSystem', (c) => new EquipmentEffectSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'),
        gameDataRepository: c.resolve('GameDataRepository')
    }), {lifecycle: 'singleton'});
    container.register('EquipmentSlotSystem', (c) => new EquipmentSlotSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'),
        gameDataRepository: c.resolve('GameDataRepository')
    }), {lifecycle: 'singleton'});
    container.register('InventorySystem', (c) => new InventorySystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'),
        gameDataRepository: c.resolve('GameDataRepository'),
        gameStateManager: c.resolve('GameStateManager')
    }), {lifecycle: 'singleton'});
    container.register('CombatSystem', (c) => new CombatSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'),
        gameDataRepository: c.resolve('GameDataRepository')
    }), {lifecycle: 'singleton'});
    container.register('DeathSystem', (c) => new DeathSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager')
    }), {lifecycle: 'singleton'});
    container.register('WorldPresenceSystem', (c) => new WorldPresenceSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager')
    }), {lifecycle: 'singleton'});
    container.register('ItemUsageSystem', (c) => new ItemUsageSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'),
        conditionEvaluationService: c.resolve('ConditionEvaluationService'),
        itemTargetResolverService: c.resolve('ItemTargetResolverService'),
        gameDataRepository: c.resolve('GameDataRepository')
    }), {lifecycle: 'singleton'});
    container.register('BlockerSystem', (c) => new BlockerSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager')
    }), {lifecycle: 'singleton'});
    container.register('MovementSystem', (c) => new MovementSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager')
    }), {lifecycle: 'singleton'});
    container.register('MoveCoordinatorSystem', (c) => new MoveCoordinatorSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'),
        blockerSystem: c.resolve('BlockerSystem'),
        movementSystem: c.resolve('MovementSystem')
    }), {lifecycle: 'singleton'});
    container.register('QuestSystem', (c) => new QuestSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'),
        gameStateManager: c.resolve('GameStateManager'),
        questPrerequisiteService: c.resolve('QuestPrerequisiteService'),
        questRewardService: c.resolve('QuestRewardService'),
        objectiveEventListenerService: c.resolve('ObjectiveEventListenerService'),
        objectiveStateCheckerService: c.resolve('ObjectiveStateCheckerService'),
        gameDataRepository: c.resolve('GameDataRepository')
    }), {lifecycle: 'singleton'});
    container.register('QuestStartTriggerSystem', (c) => new QuestStartTriggerSystem({
        eventBus: c.resolve('EventBus'),
        gameStateManager: c.resolve('GameStateManager'),
        gameDataRepository: c.resolve('GameDataRepository')
    }), {lifecycle: 'singleton'});
    container.register('PerceptionSystem', (c) => new PerceptionSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager')
    }), {lifecycle: 'singleton'});
    container.register('NotificationUISystem', (c) => new NotificationUISystem({
        eventBus: c.resolve('EventBus'),
        gameDataRepository: c.resolve('GameDataRepository')
    }), {lifecycle: 'singleton'});
    container.register('OpenableSystem', (c) => new OpenableSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager')
    }), {lifecycle: 'singleton'});
    container.register('HealthSystem', (c) => new HealthSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'),
        gameDataRepository: c.resolve('GameDataRepository')
    }), {lifecycle: 'singleton'});
    container.register('StatusEffectSystem', (c) => new StatusEffectSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'),
        gameDataRepository: c.resolve('GameDataRepository')
    }), {lifecycle: 'singleton'});
    container.register('LockSystem', (c) => new LockSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager')
    }), {lifecycle: 'singleton'});
    container.register('ActionDiscoverySystem', (c) => new ActionDiscoverySystem({
        gameDataRepository: c.resolve('GameDataRepository'),
        entityManager: c.resolve('EntityManager'),
        actionValidationService: c.resolve('ActionValidationService'),
        logger: c.resolve('ILogger'),
        formatActionCommandFn: formatActionCommand
    }), {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered ActionDiscoverySystem."); // Use logger instance


    // --- 15. Input Handler ---
    container.register('InputHandler', (c) => new InputHandler(c.resolve('inputElement'), null, c.resolve('EventBus')), {lifecycle: 'singleton'});

    // --- 16. Game Loop ---
    container.register('GameLoop', (c) => new GameLoop({
        gameStateManager: c.resolve('GameStateManager'),
        inputHandler: c.resolve('InputHandler'),
        commandParser: c.resolve('CommandParser'),
        actionExecutor: c.resolve('ActionExecutor'),
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'),
        gameDataRepository: c.resolve('GameDataRepository'),
        actionDiscoverySystem: c.resolve('ActionDiscoverySystem'),
        logger: c.resolve('ILogger')
    }), {lifecycle: 'singleton'});


    logger.info("ContainerConfig: Service registration complete."); // Use logger instance
}