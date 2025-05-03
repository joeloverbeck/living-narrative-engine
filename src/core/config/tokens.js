// src/core/config/tokens.js
// --- FILE START (Entire file content as requested) ---

/**
 * @fileoverview Centralized repository for Dependency Injection (DI) keys/tokens.
 * Using tokens instead of raw strings prevents typos and aids refactoring.
 */

/**
 * A frozen object containing all unique keys used for registering and resolving
 * services and dependencies within the application's DI container.
 * Using Object.freeze prevents accidental modification.
 *
 * @typedef {string} DiToken
 *
 * @property {DiToken} ILogger - Token for the core logging service.
 * @property {DiToken} outputDiv - Token for the main output HTML element.
 * @property {DiToken} inputElement - Token for the command input HTML element.
 * @property {DiToken} titleElement - Token for the title HTML element.
 * @property {DiToken} EventBus - Token for the central event bus.
 * @property {DiToken} IDataFetcher - Token for the data fetching service.
 * @property {DiToken} IConfiguration - Token for static configuration access.
 * @property {DiToken} IPathResolver - Token for resolving data paths.
 * @property {DiToken} ISchemaValidator - Token for validating data against schemas.
 * @property {DiToken} IDataRegistry - Token for storing loaded game data.
 * @property {DiToken} ISpatialIndexManager - Token for managing the spatial index.
 * @property {DiToken} SchemaLoader - Token for the schema loading service.
 * @property {DiToken} ManifestLoader - Token for the manifest loading service.
 * @property {DiToken} RuleLoader - Token for the rule loading service.
 * @property {DiToken} ComponentDefinitionLoader - Token for loading component definitions.
 * @property {DiToken} ActionLoader - Token for the action loading service.
 * @property {DiToken} EventLoader - Token for the event loading service.
 * @property {DiToken} EntityLoader - Token for loading entity definitions.
 * @property {DiToken} WorldLoader - Token for orchestrating world data loading.
 * @property {DiToken} GameConfigLoader - Token for loading the main game configuration file.
 * @property {DiToken} ModManifestLoader - Token for loading mod manifests.
 * @property {DiToken} GameDataRepository - Token for accessing registered game data.
 * @property {DiToken} EntityManager - Token for managing game entities and components.
 * @property {DiToken} DomRenderer - Token for rendering game output to the DOM.
 * @property {DiToken} ConditionEvaluationService - Token for evaluating conditions.
 * @property {DiToken} ItemTargetResolverService - Token for resolving item targets.
 * @property {DiToken} TargetResolutionService - Token for resolving action targets.
 * @property {DiToken} JsonLogicEvaluationService - Token for evaluating JsonLogic rules.
 * @property {DiToken} ActionValidationContextBuilder - Token for building action validation contexts.
 * @property {DiToken} PrerequisiteEvaluationService - Token for evaluating action/quest prerequisites.
 * @property {DiToken} DomainContextCompatibilityChecker - Token for checking domain context compatibility.
 * @property {DiToken} ActionValidationService - Token for validating actions.
 * @property {DiToken} PayloadValueResolverService - Token for resolving payload values.
 * @property {DiToken} ICommandProcessor - Token for the command processing service interface.
 * @property {DiToken} TurnHandlerResolver - Token for the service that resolves the correct turn handler.
 * @property {DiToken} PlayerTurnHandler - Token for the player-specific turn handler implementation.
 * @property {DiToken} AITurnHandler - Token for the AI-specific turn handler implementation.
 *
 * --- Core Interface Tokens ---
 * @property {DiToken} IValidatedEventDispatcher - Token for dispatching validated events interface.
 * @property {DiToken} IActionExecutor - Token for executing game actions interface.
 * @property {DiToken} IWorldContext - Token for managing the overall world context interface.
 * @property {DiToken} ICommandParser - Token for parsing player commands interface.
 * @property {DiToken} IActionDiscoverySystem - Token for the action discovery system interface.
 * @property {DiToken} IInputHandler - Token for handling player input interface.
 *
 * @property {DiToken} ITurnOrderService - Token for the turn order management service interface.
 * @property {DiToken} ITurnManager - Token for the turn management service interface.
 * @property {DiToken} QuestPrerequisiteService - Token for quest prerequisite logic.
 * @property {DiToken} QuestRewardService - Token for quest reward logic.
 * @property {DiToken} ObjectiveEventListenerService - Token for listening to events for objectives.
 * @property {DiToken} ObjectiveStateCheckerService - Token for checking objective states.
 * // REMOVED: GameStateInitializer JSDoc property
 * @property {DiToken} WorldInitializer - Token for initializing the game world.
 * @property {DiToken} SystemInitializer - Token for initializing tagged systems.
 * @property {DiToken} InitializationService - Token for the main initialization orchestration service.
 * @property {DiToken} ShutdownService - Token for the main shutdown orchestration service.
 * @property {DiToken} GameLoop - Token for the main game loop.
 * @property {DiToken} InputSetupService - Token for setting up input handling.
 * @property {DiToken} SystemServiceRegistry - Token for the registry mapping system IDs to services.
 * @property {DiToken} SystemDataRegistry - Token for the registry mapping system IDs to data sources.
 * @property {DiToken} GameRuleSystem - Token for the game rule system.
 * @property {DiToken} EquipmentEffectSystem - Token for the equipment effect system.
 * @property {DiToken} EquipmentSlotSystem - Token for the equipment slot system.
 * @property {DiToken} InventorySystem - Token for the inventory system.
 * @property {DiToken} CombatSystem - Token for the combat system.
 * @property {DiToken} DeathSystem - Token for the death system.
 * @property {DiToken} WorldPresenceSystem - Token for the world presence system.
 * @property {DiToken} ItemUsageSystem - Token for the item usage system.
 * @property {DiToken} BlockerSystem - Token for the blocker system.
 * @property {DiToken} MovementSystem - Token for the movement system.
 * @property {DiToken} MoveCoordinatorSystem - Token for the move coordinator system.
 * @property {DiToken} QuestSystem - Token for the quest system.
 * @property {DiToken} QuestStartTriggerSystem - Token for the quest start trigger system.
 * @property {DiToken} PerceptionSystem - Token for the perception system.
 * @property {DiToken} NotificationUISystem - Token for the notification UI system.
 * @property {DiToken} OpenableSystem - Token for the openable system.
 * @property {DiToken} HealthSystem - Token for the health system.
 * @property {DiToken} StatusEffectSystem - Token for the status effect system.
 * @property {DiToken} LockSystem - Token for the lock system.
 * @property {DiToken} OperationRegistry - Token for the operation handler registry service.
 * @property {DiToken} OperationInterpreter - Token for the operation interpreter service.
 * @property {DiToken} SystemLogicInterpreter - Token for the system logic interpreter service.
 * @property {DiToken} DispatchEventHandler - Token for the 'DISPATCH_EVENT' operation handler.
 * @property {DiToken} LogHandler - Token for the 'LOG' operation handler.
 * @property {DiToken} ModifyComponentHandler - Token for the 'MODIFY_COMPONENT' operation handler.
 * @property {DiToken} AddComponentHandler - Token for the 'ADD_COMPONENT' operation handler.
 * @property {DiToken} RemoveComponentHandler - Token for the 'REMOVE_COMPONENT' operation handler.
 * @property {DiToken} QueryComponentHandler - Token for the 'QUERY_COMPONENT' operation handler.
 * @property {DiToken} ModifyDomElementHandler - Token for the 'MODIFY_DOM_ELEMENT' operation handler.
 * @property {DiToken} AppendUiMessageHandler - Token for the 'APPEND_UI_MESSAGE' operation handler.
 * @property {DiToken} SetVariableHandler - Token for the 'SET_VARIABLE' operation handler.
 * @property {DiToken} QuerySystemDataHandler - Token for the 'QUERY_SYSTEM_DATA' operation handler.
 */
export const tokens = Object.freeze({
    // Core Interfaces/Abstractions & Externals
    ILogger: 'ILogger',
    outputDiv: 'outputDiv',
    inputElement: 'inputElement',
    titleElement: 'titleElement',
    EventBus: 'EventBus',
    IDataFetcher: 'IDataFetcher',
    IConfiguration: 'IConfiguration',
    IPathResolver: 'IPathResolver',
    ISchemaValidator: 'ISchemaValidator',
    IDataRegistry: 'IDataRegistry',
    ISpatialIndexManager: 'ISpatialIndexManager',
    WindowDocument: 'WindowDocument',
    IDocumentContext: 'IDocumentContext',
    DomElementFactory: 'DomElementFactory',
    UiMessageRenderer: 'UiMessageRenderer',

    // Loaders
    SchemaLoader: 'SchemaLoader',
    RuleLoader: 'RuleLoader',
    ComponentDefinitionLoader: 'ComponentDefinitionLoader',
    ActionLoader: 'ActionLoader',
    EventLoader: 'EventLoader',
    EntityLoader: 'EntityLoader',
    WorldLoader: 'WorldLoader',
    GameConfigLoader: 'GameConfigLoader',
    ModManifestLoader: 'ModManifestLoader',

    // Core Services & Managers (Implementations)
    GameDataRepository: 'GameDataRepository',
    EntityManager: 'EntityManager',
    DomRenderer: 'DomRenderer',
    ConditionEvaluationService: 'ConditionEvaluationService',
    ItemTargetResolverService: 'ItemTargetResolverService',
    TargetResolutionService: 'TargetResolutionService',
    JsonLogicEvaluationService: 'JsonLogicEvaluationService',
    ActionValidationContextBuilder: 'ActionValidationContextBuilder',
    PrerequisiteEvaluationService: 'PrerequisiteEvaluationService',
    DomainContextCompatibilityChecker: 'DomainContextCompatibilityChecker',
    ActionValidationService: 'ActionValidationService',
    PayloadValueResolverService: 'PayloadValueResolverService',
    // REMOVED: GameStateInitializer: 'GameStateInitializer',
    WorldInitializer: 'WorldInitializer',
    SystemInitializer: 'SystemInitializer',
    InitializationService: 'InitializationService',
    ShutdownService: 'ShutdownService',
    InputSetupService: 'InputSetupService',
    SystemServiceRegistry: 'SystemServiceRegistry',
    SystemDataRegistry: 'SystemDataRegistry',
    ICommandProcessor: 'ICommandProcessor',
    TurnHandlerResolver: 'TurnHandlerResolver',
    PlayerTurnHandler: 'PlayerTurnHandler',
    AITurnHandler: 'AITurnHandler',

    // Core Service Interfaces
    IValidatedEventDispatcher: 'IValidatedEventDispatcher',
    IActionExecutor: 'IActionExecutor',
    IWorldContext: 'IWorldContext',
    ICommandParser: 'ICommandParser',
    IActionDiscoverySystem: 'IActionDiscoverySystem',
    IInputHandler: 'IInputHandler',
    ITurnOrderService: 'ITurnOrderService',
    ITurnManager: 'ITurnManager',

    // Quest Services
    QuestPrerequisiteService: 'QuestPrerequisiteService',
    QuestRewardService: 'QuestRewardService',
    ObjectiveEventListenerService: 'ObjectiveEventListenerService',
    ObjectiveStateCheckerService: 'ObjectiveStateCheckerService',

    // Systems (Implementations)
    GameRuleSystem: 'GameRuleSystem',
    EquipmentEffectSystem: 'EquipmentEffectSystem',
    EquipmentSlotSystem: 'EquipmentSlotSystem',
    InventorySystem: 'InventorySystem',
    CombatSystem: 'CombatSystem',
    DeathSystem: 'DeathSystem',
    WorldPresenceSystem: 'WorldPresenceSystem',
    ItemUsageSystem: 'ItemUsageSystem',
    BlockerSystem: 'BlockerSystem',
    MovementSystem: 'MovementSystem',
    MoveCoordinatorSystem: 'MoveCoordinatorSystem',
    QuestSystem: 'QuestSystem',
    QuestStartTriggerSystem: 'QuestStartTriggerSystem',
    PerceptionSystem: 'PerceptionSystem',
    NotificationUISystem: 'NotificationUISystem',
    OpenableSystem: 'OpenableSystem',
    HealthSystem: 'HealthSystem',
    StatusEffectSystem: 'StatusEffectSystem',
    LockSystem: 'LockSystem',

    // Logic/Interpretation Layer
    OperationRegistry: 'OperationRegistry',
    OperationInterpreter: 'OperationInterpreter',
    SystemLogicInterpreter: 'SystemLogicInterpreter',

    // Operation Handlers (Registered within Interpreter bundle)
    DispatchEventHandler: 'DispatchEventHandler',
    LogHandler: 'LogHandler',
    ModifyComponentHandler: 'ModifyComponentHandler',
    AddComponentHandler: 'AddComponentHandler',
    RemoveComponentHandler: 'RemoveComponentHandler',
    QueryComponentHandler: 'QueryComponentHandler',
    ModifyDomElementHandler: 'ModifyDomElementHandler',
    AppendUiMessageHandler: 'AppendUiMessageHandler',
    SetVariableHandler: 'SetVariableHandler',
    QuerySystemDataHandler: 'QuerySystemDataHandler',
});