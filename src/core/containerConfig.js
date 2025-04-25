// src/core/containerConfig.js

// --- Import all necessary classes ---
// (Imports remain the same as provided in the prompt, including PrerequisiteEvaluationService and ActionValidationContextBuilder as they are needed elsewhere or by PES)
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
import {ActionValidationService} from "../services/actionValidationService.js";
import TargetResolutionService from '../services/targetResolutionService.js';
import PayloadValueResolverService from '../services/payloadValueResolverService.js';
import ValidatedEventDispatcher from "../services/validatedEventDispatcher.js";
import SystemInitializer from './initializers/systemInitializer.js';
import JsonLogicEvaluationService from '../logic/jsonLogicEvaluationService.js';
import {formatActionCommand} from '../services/actionFormatter.js';
import ComponentDefinitionLoader from "./services/componentDefinitionLoader.js";
import {DomainContextCompatibilityChecker} from '../validation/domainContextCompatibilityChecker.js';
import InputSetupService from './setup/inputSetupService.js';
import RuleLoader from "./services/ruleLoader.js";
import SystemLogicInterpreter from '../logic/systemLogicInterpreter.js';
import OperationInterpreter from '../logic/operationInterpreter.js';

// --- PrerequisiteEvaluationService import needed for registration ---
import {PrerequisiteEvaluationService} from '../services/prerequisiteEvaluationService.js';
// --- ActionValidationContextBuilder needed by PES ---
import {ActionValidationContextBuilder} from '../services/actionValidationContextBuilder.js';


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
    container.register('IDataFetcher', () => new WorkspaceDataFetcher(), {lifecycle: 'singleton'});
    container.register('IConfiguration', () => new StaticConfiguration(), {lifecycle: 'singleton'});
    container.register('IPathResolver', (c) => new DefaultPathResolver(c.resolve('IConfiguration')), {lifecycle: 'singleton'});
    container.register('ISchemaValidator', () => new AjvSchemaValidator(), {lifecycle: 'singleton'});
    container.register('IDataRegistry', () => new InMemoryDataRegistry(), {lifecycle: 'singleton'});

    // --- 3. Data Loaders (Depend on core services) ---
    container.register('SchemaLoader', (c) => new SchemaLoader(c.resolve('IConfiguration'), c.resolve('IPathResolver'), c.resolve('IDataFetcher'), c.resolve('ISchemaValidator'), c.resolve('ILogger')), {lifecycle: 'singleton'});
    container.register('ManifestLoader', (c) => new ManifestLoader(c.resolve('IConfiguration'), c.resolve('IPathResolver'), c.resolve('IDataFetcher'), c.resolve('ISchemaValidator'), c.resolve('ILogger')), {lifecycle: 'singleton'});
    container.register('RuleLoader', (c) => new RuleLoader(
        c.resolve('IPathResolver'),
        c.resolve('IDataFetcher'),
        c.resolve('ISchemaValidator'),
        c.resolve('IDataRegistry'),
        c.resolve('ILogger')
    ), { lifecycle: 'singleton' });
    logger.info("ContainerConfig: Registered RuleLoader (with IDataRegistry dependency).");
    container.register('GenericContentLoader', (c) => new GenericContentLoader(c.resolve('IConfiguration'), c.resolve('IPathResolver'), c.resolve('IDataFetcher'), c.resolve('ISchemaValidator'), c.resolve('IDataRegistry'), c.resolve('ILogger')), {lifecycle: 'singleton'});
    container.register('ComponentDefinitionLoader', (c) => new ComponentDefinitionLoader(c.resolve('IConfiguration'), c.resolve('IPathResolver'), c.resolve('IDataFetcher'), c.resolve('ISchemaValidator'), c.resolve('IDataRegistry'), c.resolve('ILogger')), {lifecycle: 'singleton'});

    // --- 4. World Orchestrator & Data Access ---
    container.register(
        'WorldLoader',
        (c) =>
            new WorldLoader(
                c.resolve('IDataRegistry'),
                c.resolve('ILogger'),
                c.resolve('SchemaLoader'),
                c.resolve('ManifestLoader'),
                c.resolve('GenericContentLoader'),
                c.resolve('ComponentDefinitionLoader'),
                c.resolve('RuleLoader'),
                c.resolve('ISchemaValidator'),
                c.resolve('IConfiguration')
            ),
        {lifecycle: 'singleton'}
    );
    container.register('GameDataRepository', (c) => new GameDataRepository(c.resolve('IDataRegistry'), c.resolve('ILogger')), {lifecycle: 'singleton'});

    // --- 5. Entity Manager ---
    container.register('EntityManager', (c) => {
        c.resolve('ILogger').info("ContainerConfig: Creating EntityManager instance...");
        const entityManager = new EntityManager(c.resolve('GameDataRepository'));
        c.resolve('ILogger').info("ContainerConfig: EntityManager instance created.");
        return entityManager;
    }, {lifecycle: 'singleton'});


    // --- 6. Renderer ---
    container.register('DomRenderer', (c) => new DomRenderer(c.resolve('outputDiv'), c.resolve('inputElement'), c.resolve('titleElement'), c.resolve('EventBus'), c.resolve('ValidatedEventDispatcher'), c.resolve('ILogger')), {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered DomRenderer (with ValidatedEventDispatcher and ILogger).");


    // --- 7. Core Game Logic Services ---
    container.register('ConditionEvaluationService', (c) => new ConditionEvaluationService({entityManager: c.resolve('EntityManager')}), {lifecycle: 'singleton'});
    container.register('ItemTargetResolverService', (c) => new ItemTargetResolverService({
        entityManager: c.resolve('EntityManager'),
        validatedDispatcher: c.resolve('ValidatedEventDispatcher'),
        conditionEvaluationService: c.resolve('ConditionEvaluationService'),
        logger: c.resolve('ILogger')
    }), {lifecycle: 'singleton'});
    container.register('TargetResolutionService', (c) => new TargetResolutionService(), {lifecycle: 'singleton'});
    container.register('JsonLogicEvaluationService', (c) => new JsonLogicEvaluationService({logger: c.resolve('ILogger')}), {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered JsonLogicEvaluationService.");

    // --- Register ActionValidationContextBuilder FIRST (as needed by PES) ---
    container.register('ActionValidationContextBuilder', (c) => {
        logger.info("ContainerConfig: Creating ActionValidationContextBuilder instance...");
        const builder = new ActionValidationContextBuilder({
            entityManager: c.resolve('EntityManager'), logger: c.resolve('ILogger')
        });
        logger.info("ContainerConfig: ActionValidationContextBuilder instance created.");
        return builder;
    }, {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered ActionValidationContextBuilder.");


    // --- PrerequisiteEvaluationService registration (Needs ActionValidationContextBuilder) ---
    // Status: Correct - No change needed here for Refactor-AVS-3.4
    container.register('PrerequisiteEvaluationService', (c) => {
        logger.info("ContainerConfig: Creating PrerequisiteEvaluationService instance with required dependencies...");
        const service = new PrerequisiteEvaluationService({
            logger: c.resolve('ILogger'),
            jsonLogicEvaluationService: c.resolve('JsonLogicEvaluationService'),
            actionValidationContextBuilder: c.resolve('ActionValidationContextBuilder') // <<< KEPT (PES needs this)
        });
        logger.info("ContainerConfig: PrerequisiteEvaluationService instance created (with ActionValidationContextBuilder).");
        return service;
    }, {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered PrerequisiteEvaluationService (with ActionValidationContextBuilder).");


    container.register('DomainContextCompatibilityChecker', (c) => new DomainContextCompatibilityChecker({logger: c.resolve('ILogger')}), {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered DomainContextCompatibilityChecker.");


    // --- Action Validation Service (Refactored Dependency Injection) ---
    // Status: Updated as per Refactor-AVS-3.4
    container.register('ActionValidationService', (c) => {
        // --- Refactor-AVS-3.4: Update log message ---
        logger.info("ContainerConfig: Creating ActionValidationService instance with updated dependencies (removing context creation responsibility)...");
        // --- End Refactor-AVS-3.4 ---
        const service = new ActionValidationService({
            entityManager: c.resolve('EntityManager'),
            logger: c.resolve('ILogger'),
            domainContextCompatibilityChecker: c.resolve('DomainContextCompatibilityChecker'),
            prerequisiteEvaluationService: c.resolve('PrerequisiteEvaluationService'), // --- Refactor-AVS-3.4: REMOVE dependency as per ticket ---
            // actionValidationContextBuilder: c.resolve('ActionValidationContextBuilder') // <<< REMOVED (AC4)
            // --- End Refactor-AVS-3.4 ---
        });
        // --- Refactor-AVS-3.4: Update log message ---
        // Updated log message to reflect the change
        logger.info("ContainerConfig: ActionValidationService instance created (without context creation dependency).");
        // --- End Refactor-AVS-3.4 ---
        return service;
    }, {lifecycle: 'singleton'});
    // --- Refactor-AVS-3.4: Update log message ---
    // Updated log message to reflect the change
    logger.info("ContainerConfig: Registered ActionValidationService (without context creation dependency)."); // AC4
    // --- End Refactor-AVS-3.4 ---


    container.register('PayloadValueResolverService', (c) => new PayloadValueResolverService({logger: c.resolve('ILogger')}), {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered PayloadValueResolverService.");
    container.register('ValidatedEventDispatcher', (c) => new ValidatedEventDispatcher({
        eventBus: c.resolve('EventBus'),
        gameDataRepository: c.resolve('GameDataRepository'),
        schemaValidator: c.resolve('ISchemaValidator'),
        logger: c.resolve('ILogger')
    }), {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered ValidatedEventDispatcher.");
    container.register('WelcomeMessageService', (c) => new WelcomeMessageService({
        eventBus: c.resolve('EventBus'),
        gameDataRepository: c.resolve('GameDataRepository'),
        validatedDispatcher: c.resolve('ValidatedEventDispatcher'),
        logger: c.resolve('ILogger')
    }), {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered WelcomeMessageService.");

    // --- 8. Action Executor ---
    container.register('ActionExecutor', (c) => new ActionExecutor({
        gameDataRepository: c.resolve('GameDataRepository'),
        targetResolutionService: c.resolve('TargetResolutionService'),
        actionValidationService: c.resolve('ActionValidationService'),
        payloadValueResolverService: c.resolve('PayloadValueResolverService'),
        eventBus: c.resolve('EventBus'),
        logger: c.resolve('ILogger'),
        validatedDispatcher: c.resolve('ValidatedEventDispatcher')
    }), {lifecycle: 'singleton'});
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
    container.register('GameStateInitializer', (c) => new GameStateInitializer({
        entityManager: c.resolve('EntityManager'),
        gameStateManager: c.resolve('GameStateManager'),
        gameDataRepository: c.resolve('GameDataRepository'),
        validatedDispatcher: c.resolve('ValidatedEventDispatcher'),
        logger: c.resolve('ILogger')
    }), {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered GameStateInitializer (updated dependencies).");
    container.register('WorldInitializer', (c) => new WorldInitializer({
        entityManager: c.resolve('EntityManager'),
        gameStateManager: c.resolve('GameStateManager'),
        gameDataRepository: c.resolve('GameDataRepository')
    }), {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered WorldInitializer.");
    container.register('SystemInitializer', c => new SystemInitializer(c, c.resolve('ILogger')), {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered SystemInitializer.");

    // --- 13. Game Loop & Input Setup ---
    // Register ActionDiscoverySystem *before* GameLoop needs it directly
    container.register('ActionDiscoverySystem', (c) => new ActionDiscoverySystem({
        gameDataRepository: c.resolve('GameDataRepository'),
        entityManager: c.resolve('EntityManager'),
        actionValidationService: c.resolve('ActionValidationService'), // Resolves the AVS instance configured above
        logger: c.resolve('ILogger'),
        formatActionCommandFn: formatActionCommand, // Assuming getEntityIdsForScopes is imported or defined elsewhere
        getEntityIdsForScopesFn: () => new Set() // Placeholder - Needs correct function reference
    }), {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered ActionDiscoverySystem.");

    // Register InputHandler *before* GameLoop needs it directly
    container.register('InputHandler', (c) => new InputHandler(c.resolve('inputElement'), null, c.resolve('EventBus')), {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered InputHandler.");

    // Register Game Loop
    container.register('GameLoop', (c) => new GameLoop({
        gameStateManager: c.resolve('GameStateManager'),
        inputHandler: c.resolve('InputHandler'), // Resolve InputHandler here
        commandParser: c.resolve('CommandParser'),
        actionExecutor: c.resolve('ActionExecutor'),
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'),
        gameDataRepository: c.resolve('GameDataRepository'),
        actionDiscoverySystem: c.resolve('ActionDiscoverySystem'), // Resolve ADS here
        validatedDispatcher: c.resolve('ValidatedEventDispatcher'),
        logger: c.resolve('ILogger')
    }), {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered GameLoop.");

    container.register('InputSetupService', (c) => new InputSetupService({
        container: c, // Pass the container itself
        logger: c.resolve('ILogger'),
        validatedDispatcher: c.resolve('ValidatedEventDispatcher'),
        gameLoop: c.resolve('GameLoop') // GameLoop is already registered
    }), {lifecycle: 'singleton'});
    logger.info("ContainerConfig: Registered InputSetupService.");


    // --- 14. Core Systems ---
    // (System registrations remain the same)
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
        eventBus: c.resolve('EventBus'), entityManager: c.resolve('EntityManager')
    }), {lifecycle: 'singleton'});
    container.register('WorldPresenceSystem', (c) => new WorldPresenceSystem({
        eventBus: c.resolve('EventBus'), entityManager: c.resolve('EntityManager')
    }), {lifecycle: 'singleton'});
    container.register('ItemUsageSystem', (c) => new ItemUsageSystem({
        eventBus: c.resolve('EventBus'),
        entityManager: c.resolve('EntityManager'),
        conditionEvaluationService: c.resolve('ConditionEvaluationService'),
        itemTargetResolverService: c.resolve('ItemTargetResolverService'),
        gameDataRepository: c.resolve('GameDataRepository')
    }), {lifecycle: 'singleton'});
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
        eventBus: c.resolve('EventBus'), entityManager: c.resolve('EntityManager')
    }), {lifecycle: 'singleton'});
    container.register('NotificationUISystem', (c) => new NotificationUISystem({
        eventBus: c.resolve('EventBus'), gameDataRepository: c.resolve('GameDataRepository')
    }), {lifecycle: 'singleton'});
    container.register('OpenableSystem', (c) => new OpenableSystem({
        eventBus: c.resolve('EventBus'), entityManager: c.resolve('EntityManager')
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
        eventBus: c.resolve('EventBus'), entityManager: c.resolve('EntityManager')
    }), {lifecycle: 'singleton'});

    // --- AC1 (Dependency Injection): Register OperationInterpreter ---
    container.register('OperationInterpreter', (c) => {
        logger.info("ContainerConfig: Creating OperationInterpreter instance...");
        const interpreter = new OperationInterpreter({
            logger: c.resolve('ILogger')
            // Add other dependencies here if OperationInterpreter needs them later
        });
        logger.info("ContainerConfig: OperationInterpreter instance created.");
        return interpreter;
    }, { lifecycle: 'singleton' });
    logger.info("ContainerConfig: Registered OperationInterpreter.");


    // --- Modify SystemLogicInterpreter Registration ---
    // --- AC1 (Dependency Injection): Inject OperationInterpreter ---
    container.register('SystemLogicInterpreter', (c) => {
        logger.info("ContainerConfig: Creating SystemLogicInterpreter instance (with OperationInterpreter dependency)...");
        // Resolve all required dependencies for SystemLogicInterpreter
        const deps = {
            logger: c.resolve('ILogger'),
            eventBus: c.resolve('EventBus'),
            dataRegistry: c.resolve('IDataRegistry'),
            jsonLogicEvaluationService: c.resolve('JsonLogicEvaluationService'),
            entityManager: c.resolve('EntityManager'),
            operationInterpreter: c.resolve('OperationInterpreter') // <-- Inject the new dependency
        };
        logger.debug("ContainerConfig: Dependencies resolved for SystemLogicInterpreter:", Object.keys(deps));
        const interpreter = new SystemLogicInterpreter(deps);
        logger.info("ContainerConfig: SystemLogicInterpreter instance created.");
        return interpreter;
    }, { lifecycle: 'singleton' });
    logger.info("ContainerConfig: Registered SystemLogicInterpreter (with OperationInterpreter).");

    logger.info("ContainerConfig: Service registration complete.");
}
