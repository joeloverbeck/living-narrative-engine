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
import SchemaLoader from './services/schemaLoader.js';
import WorkspaceDataFetcher from './services/workspaceDataFetcher.js';
import StaticConfiguration from './services/staticConfiguration.js';
import WorldLoader from './services/worldLoader.js';
import WelcomeMessageService from '../services/welcomeMessageService.js';

// Other Services (Existing application services)
import ConditionEvaluationService from "../services/conditionEvaluationService.js";
import {QuestPrerequisiteService} from '../services/questPrerequisiteService.js';
import {QuestRewardService} from '../services/questRewardService.js';
import {ObjectiveEventListenerService} from '../services/objectiveEventListenerService.js';
import {ObjectiveStateCheckerService} from '../services/objectiveStateCheckerService.js';
import GameStateInitializer from './gameStateInitializer.js';
import WorldInitializer from './worldInitializer.js';
import {ItemTargetResolverService} from '../services/itemTargetResolver.js';
import {ActionValidationService} from "../services/actionValidationService.js"; // <-- Existing import
import TargetResolutionService from '../services/targetResolutionService.js';
import PayloadValueResolverService from '../services/payloadValueResolverService.js';
import ValidatedEventDispatcher from "../services/validatedEventDispatcher.js";
import SystemInitializer from './initializers/systemInitializer.js';
import JsonLogicEvaluationService from '../logic/jsonLogicEvaluationService.js';
import {formatActionCommand} from '../services/actionFormatter.js';
import ComponentDefinitionLoader from "./services/componentDefinitionLoader.js";
import {ComponentRequirementChecker} from '../validation/componentRequirementChecker.js'; // <-- ADDED Import
import {DomainContextCompatibilityChecker} from '../validation/domainContextCompatibilityChecker.js'; // <-- Ensure this is imported
import {PrerequisiteChecker} from '../validation/prerequisiteChecker.js'; // <-- Ensure this is imported
// --- ADDED IMPORT --- (Ticket: Feat(Core): Register InputSetupService)
import InputSetupService from './setup/inputSetupService.js'; // <-- AC2: Import statement added

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
    container.register('IDataRegistry', () => new InMemoryDataRegistry(), {lifecycle: 'singleton'});

    // --- 3. Data Loaders (Depend on core services) ---
    container.register('SchemaLoader', (c) => new SchemaLoader(c.resolve('IConfiguration'), c.resolve('IPathResolver'), c.resolve('IDataFetcher'), c.resolve('ISchemaValidator'), c.resolve('ILogger')), {lifecycle: 'singleton'});
    container.register('ManifestLoader', (c) => new ManifestLoader(c.resolve('IConfiguration'), c.resolve('IPathResolver'), c.resolve('IDataFetcher'), c.resolve('ISchemaValidator'), c.resolve('ILogger')), {lifecycle: 'singleton'});
    container.register('GenericContentLoader', (c) => new GenericContentLoader(c.resolve('IConfiguration'), c.resolve('IPathResolver'), c.resolve('IDataFetcher'), c.resolve('ISchemaValidator'), c.resolve('IDataRegistry'), c.resolve('ILogger')), {lifecycle: 'singleton'});

    container.register('ComponentDefinitionLoader', (c) => {
        return new ComponentDefinitionLoader(
            c.resolve('IConfiguration'),
            c.resolve('IPathResolver'),
            c.resolve('IDataFetcher'),
            c.resolve('ISchemaValidator'),
            c.resolve('IDataRegistry'),
            c.resolve('ILogger')
        );
    }, {lifecycle: 'singleton'});

    // --- 4. World Orchestrator & Data Access ---
    container.register('WorldLoader', (c) => {
        // Resolve all existing dependencies
        const dataRegistry = c.resolve('IDataRegistry');
        const logger = c.resolve('ILogger');
        const schemaLoader = c.resolve('SchemaLoader');
        const manifestLoader = c.resolve('ManifestLoader');
        const genericContentLoader = c.resolve('GenericContentLoader');
        const componentDefinitionLoader = c.resolve('ComponentDefinitionLoader');
        const schemaValidator = c.resolve('ISchemaValidator');
        const configuration = c.resolve('IConfiguration');

        // Construct WorldLoader, passing dependencies in the correct order
        return new WorldLoader(
            dataRegistry,
            logger,
            schemaLoader,
            manifestLoader,
            genericContentLoader,
            componentDefinitionLoader,
            schemaValidator,
            configuration
        );
    }, {lifecycle: 'singleton'});
    container.register('GameDataRepository', (c) => new GameDataRepository(c.resolve('IDataRegistry'), c.resolve('ILogger')), {lifecycle: 'singleton'});

    // --- 5. Entity Manager ---
    container.register('EntityManager', (c) => {
        c.resolve('ILogger').info("ContainerConfig: Creating EntityManager instance...");
        const entityManager = new EntityManager(c.resolve('GameDataRepository'));
        c.resolve('ILogger').info("ContainerConfig: EntityManager instance created.");
        return entityManager;
    }, {lifecycle: 'singleton'});


    // --- 6. Renderer ---
    container.register('DomRenderer', (c) => new DomRenderer(
        c.resolve('outputDiv'),
        c.resolve('inputElement'),
        c.resolve('titleElement'),
        c.resolve('EventBus'),
        c.resolve('ValidatedEventDispatcher'), // Inject ValidatedEventDispatcher
        c.resolve('ILogger')                  // Inject ILogger
    ), {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered DomRenderer (with ValidatedEventDispatcher and ILogger).");


    // --- 7. Core Game Logic Services ---
    container.register('ConditionEvaluationService', (c) => new ConditionEvaluationService({
        entityManager: c.resolve('EntityManager'), // gameDataRepository: c.resolve('GameDataRepository') // Uncomment if needed later
    }), {lifecycle: 'singleton'});

    container.register('ItemTargetResolverService', (c) => {
        const resolvedLogger = c.resolve('ILogger');
        const validatedDispatcher = c.resolve('ValidatedEventDispatcher');
        resolvedLogger.info("ContainerConfig: Creating ItemTargetResolverService instance with dependencies...");
        return new ItemTargetResolverService({
            entityManager: c.resolve('EntityManager'),
            validatedDispatcher: validatedDispatcher,
            conditionEvaluationService: c.resolve('ConditionEvaluationService'), logger: resolvedLogger
        });
    }, {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered ItemTargetResolverService (with validated dispatcher and logger).");

    container.register('TargetResolutionService', (c) => {
        c.resolve('ILogger').info("ContainerConfig: Creating TargetResolutionService instance...");
        const service = new TargetResolutionService();
        c.resolve('ILogger').info("ContainerConfig: TargetResolutionService instance created.");
        return service;
    }, {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered TargetResolutionService.");

    container.register('JsonLogicEvaluationService', (c) => new JsonLogicEvaluationService({logger: c.resolve('ILogger')}), {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered JsonLogicEvaluationService.");

    // --- Register the Checkers ---
    container.register('ComponentRequirementChecker', (c) => new ComponentRequirementChecker({logger: c.resolve('ILogger')}), {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered ComponentRequirementChecker.");

    container.register('DomainContextCompatibilityChecker', (c) => new DomainContextCompatibilityChecker({logger: c.resolve('ILogger')}), {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered DomainContextCompatibilityChecker.");

    container.register('PrerequisiteChecker', (c) => new PrerequisiteChecker({
        jsonLogicEvaluationService: c.resolve('JsonLogicEvaluationService'), // PrerequisiteChecker needs JsonLogicEvaluationService
        entityManager: c.resolve('EntityManager'),                            // PrerequisiteChecker needs EntityManager
        logger: c.resolve('ILogger')
    }), {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered PrerequisiteChecker.");

    // --- Action Validation Service (UPDATED REGISTRATION according to Ticket 7 AC1) ---
    container.register('ActionValidationService', (c) => {
        logger.info("ContainerConfig: Creating ActionValidationService instance with direct dependencies...");
        const service = new ActionValidationService({
            entityManager: c.resolve('EntityManager'),                      // Directly needed
            logger: c.resolve('ILogger'),                                   // Directly needed
            componentRequirementChecker: c.resolve('ComponentRequirementChecker'), // Directly needed (Checker 1)
            domainContextCompatibilityChecker: c.resolve('DomainContextCompatibilityChecker'), // Directly needed (Checker 2)
            prerequisiteChecker: c.resolve('PrerequisiteChecker')           // Directly needed (Checker 3)
        });
        logger.info("ContainerConfig: ActionValidationService instance created.");
        return service;
    }, {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered ActionValidationService (Refactored Dependencies)."); // Updated log

    container.register('PayloadValueResolverService', (c) => {
        const serviceLogger = c.resolve('ILogger');
        serviceLogger.info("ContainerConfig: Creating PayloadValueResolverService instance...");
        const service = new PayloadValueResolverService({logger: serviceLogger});
        serviceLogger.info("ContainerConfig: PayloadValueResolverService instance created.");
        return service;
    }, {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered PayloadValueResolverService.");

    container.register('ValidatedEventDispatcher', (c) => new ValidatedEventDispatcher({
        eventBus: c.resolve('EventBus'),
        gameDataRepository: c.resolve('GameDataRepository'),
        schemaValidator: c.resolve('ISchemaValidator'),
        logger: c.resolve('ILogger')
    }), {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered ValidatedEventDispatcher.");

    container.register('WelcomeMessageService', (c) => {
        return new WelcomeMessageService({
            eventBus: c.resolve('EventBus'),
            gameDataRepository: c.resolve('GameDataRepository'),
            validatedDispatcher: c.resolve('ValidatedEventDispatcher'),
            logger: c.resolve('ILogger')
        });
    }, { lifecycle: 'singleton' }); // Register as singleton
    logger.info("ContainerConfig: Registered WelcomeMessageService.");

    // --- 8. Action Executor ---
    container.register('ActionExecutor', (c) => {
        const resolvedLogger = c.resolve('ILogger');
        resolvedLogger.info("ContainerConfig: Resolving dependencies for ActionExecutor...");
        const gameDataRepository = c.resolve('GameDataRepository');
        const targetResolutionService = c.resolve('TargetResolutionService');
        const actionValidationService = c.resolve('ActionValidationService');
        const payloadValueResolverService = c.resolve('PayloadValueResolverService');
        const schemaValidator = c.resolve('ISchemaValidator');
        const eventBus = c.resolve('EventBus');
        const validatedDispatcher = c.resolve('ValidatedEventDispatcher');
        resolvedLogger.info("ContainerConfig: Creating ActionExecutor instance with dependencies...");
        const actionExecutor = new ActionExecutor({
            gameDataRepository,
            targetResolutionService,
            actionValidationService,
            payloadValueResolverService,
            schemaValidator,
            eventBus,
            logger: resolvedLogger,
            validatedDispatcher: validatedDispatcher
        });
        resolvedLogger.info("ContainerConfig: ActionExecutor instance created.");
        return actionExecutor;
    }, {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered ActionExecutor.");


    // --- 9. State Manager ---
    container.register('GameStateManager', () => new GameStateManager(), {lifecycle: 'singleton'});

    // --- 10. Command Parser ---
    container.register('CommandParser', (c) => new CommandParser(c.resolve('GameDataRepository')), {lifecycle: 'singleton'});

    // --- 11. Quest Services ---
    container.register('QuestPrerequisiteService', () => new QuestPrerequisiteService(), {lifecycle: 'singleton'});
    container.register('QuestRewardService', (c) => new QuestRewardService({
        gameDataRepository: c.resolve('GameDataRepository'),
        gameStateManager: c.resolve('GameStateManager'),
        validatedDispatcher: c.resolve('ValidatedEventDispatcher'),
        logger: c.resolve('ILogger')
    }), {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered QuestRewardService (with ValidatedDispatcher and Logger).");
    container.register('ObjectiveEventListenerService', (c) => new ObjectiveEventListenerService({
        eventBus: c.resolve('EventBus'), gameDataRepository: c.resolve('GameDataRepository')
    }), {lifecycle: 'singleton'});
    container.register('ObjectiveStateCheckerService', (c) => new ObjectiveStateCheckerService({
        eventBus: c.resolve('EventBus'),
        gameDataRepository: c.resolve('GameDataRepository'),
        entityManager: c.resolve('EntityManager'),
        gameStateManager: c.resolve('GameStateManager')
    }), {lifecycle: 'singleton'});

    // --- 12. Game State & World Initializers ---
    // === TICKET 7.2 MODIFICATION START ===
    container.register('GameStateInitializer', (c) => new GameStateInitializer({
        entityManager: c.resolve('EntityManager'),
        gameStateManager: c.resolve('GameStateManager'),
        gameDataRepository: c.resolve('GameDataRepository'),
        // --- Added Dependencies ---
        validatedDispatcher: c.resolve('ValidatedEventDispatcher'),
        logger: c.resolve('ILogger')
        // --- End Added Dependencies ---
    }), {lifecycle: 'singleton'});
    // === TICKET 7.2 MODIFICATION END ===
    logger.info("ContainerConfig: Registered GameStateInitializer (updated dependencies)."); // Log message updated

    container.register('WorldInitializer', (c) => new WorldInitializer({
        entityManager: c.resolve('EntityManager'),
        gameStateManager: c.resolve('GameStateManager'),
        gameDataRepository: c.resolve('GameDataRepository')
    }), {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered WorldInitializer."); // Added log for consistency

    container.register(
        'SystemInitializer',
        c => new SystemInitializer(c, c.resolve('ILogger')),
        // Defaults to 'singleton' lifecycle
    );
    logger.info("ContainerConfig: Registered SystemInitializer."); // Added log for consistency

    // --- ADDED REGISTRATION --- (Ticket: Feat(Core): Register InputSetupService)
    // AC3: Located near other setup/initializer services
    // AC4: Added registration block
    container.register('InputSetupService', (c) => new InputSetupService({
        container: c, // Pass the container itself
        logger: c.resolve('ILogger'),
        validatedDispatcher: c.resolve('ValidatedEventDispatcher'),
        gameLoop: c.resolve('GameLoop')
    }), { lifecycle: 'singleton' });
    // AC5: Added log message
    logger.info("ContainerConfig: Registered InputSetupService.");


    // --- 14. Core Systems --- // Renumbered for clarity
    // (Registrations for other systems remain unchanged)
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
    logger.info("ContainerConfig: Registered ActionDiscoverySystem.");


    // --- 15. Input Handler --- // Renumbered for clarity
    container.register('InputHandler', (c) => new InputHandler(c.resolve('inputElement'), null, c.resolve('EventBus')), {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered InputHandler."); // Added log for consistency

    // --- 16. Game Loop --- // Renumbered for clarity
    container.register('GameLoop', (c) => new GameLoop({
        gameStateManager: c.resolve('GameStateManager'),
        inputHandler: c.resolve('InputHandler'),
        commandParser: c.resolve('CommandParser'),
        actionExecutor: c.resolve('ActionExecutor'),
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'),
        gameDataRepository: c.resolve('GameDataRepository'),
        actionDiscoverySystem: c.resolve('ActionDiscoverySystem'),
        validatedDispatcher: c.resolve('ValidatedEventDispatcher'),
        logger: c.resolve('ILogger')
    }), {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered GameLoop."); // Added log for consistency


    logger.info("ContainerConfig: Service registration complete.");
}