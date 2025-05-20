// src/core/config/tokens.js

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
 * @property {DiToken} EventBus - Token for the central event bus (legacy).
 * @property {DiToken} IDataFetcher - Token for the data fetching service.
 * @property {DiToken} IConfiguration - Token for static configuration access.
 * @property {DiToken} IPathResolver - Token for resolving data paths.
 * @property {DiToken} ISchemaValidator - Token for validating data against schemas.
 * @property {DiToken} IDataRegistry - Token for storing loaded game data.
 * @property {DiToken} ISpatialIndexManager - Token for managing the spatial index.
 *
 * --- External Dependencies / Environment ---
 * @property {DiToken} WindowDocument - Token for the browser's global `document` object.
 * @property {DiToken} outputDiv - Token for the main output HTML element (legacy/direct access).
 * @property {DiToken} inputElement - Token for the command input HTML element (legacy/direct access).
 * @property {DiToken} titleElement - Token for the title HTML element (legacy/direct access).
 *
 * --- DOM UI Layer (Refactored) ---
 * @property {DiToken} IDocumentContext - Token for the DOM access abstraction service.
 * @property {DiToken} DomElementFactory - Token for the utility creating DOM elements.
 * @property {DiToken} UiMessageRenderer - Token for the component rendering UI messages/echoes.
 * @property {DiToken} TitleRenderer - Token for the component rendering the main H1 title.
 * @property {DiToken} InputStateController - Token for the component controlling input field state.
 * @property {DiToken} LocationRenderer - Token for the component rendering location details.
 * @property {DiToken} InventoryPanel - Token for the component managing the inventory panel UI.
 * @property {DiToken} ActionButtonsRenderer - Token for the component rendering available action buttons.
 * @property {DiToken} PerceptionLogRenderer - Token for the component rendering perception logs. // <<< ADDED
 * @property {DiToken} DomUiFacade - Token for the facade aggregating all UI components.
 * @property {DiToken} DomRenderer - Token for the legacy DOM rendering class (deprecated).
 *
 * --- Loaders ---
 * @property {DiToken} SchemaLoader - Token for the schema loading service.
 * @property {DiToken} ManifestLoader - Token for the manifest loading service (deprecated?).
 * @property {DiToken} RuleLoader - Token for the rule loading service.
 * @property {DiToken} ComponentDefinitionLoader - Token for loading component definitions.
 * @property {DiToken} ActionLoader - Token for the action loading service.
 * @property {DiToken} EventLoader - Token for the event loading service.
 * @property {DiToken} EntityLoader - Token for loading entity definitions.
 * @property {DiToken} WorldLoader - Token for orchestrating world data loading.
 * @property {DiToken} GameConfigLoader - Token for loading the main game configuration file.
 * @property {DiToken} ModManifestLoader - Token for loading mod manifests.
 *
 * --- Core Services & Managers (Implementations - some will be replaced by Interface Tokens below) ---
 * @property {DiToken} GameDataRepository - Token for accessing registered game data (implementation).
 * @property {DiToken} EntityManager - Token for managing game entities and components (implementation).
 * @property {DiToken} TargetResolutionService - Token for resolving action targets.
 * @property {DiToken} JsonLogicEvaluationService - Token for evaluating JsonLogic rules.
 * @property {DiToken} ActionValidationContextBuilder - Token for building action validation contexts.
 * @property {DiToken} PrerequisiteEvaluationService - Token for evaluating action/quest prerequisites.
 * @property {DiToken} DomainContextCompatibilityChecker - Token for checking domain context compatibility.
 * @property {DiToken} ActionValidationService - Token for validating actions.
 * @property {DiToken} PayloadValueResolverService - Token for resolving payload values.
 * @property {DiToken} TurnHandlerResolver - Token for the service that resolves the correct turn handler.
 * @property {DiToken} PlayerTurnHandler - Token for the player-specific turn handler implementation.
 * @property {DiToken} AITurnHandler - Token for the AI-specific turn handler implementation.
 * @property {DiToken} SystemServiceRegistry - Token for the registry mapping system IDs to services.
 * @property {DiToken} SystemDataRegistry - Token for the registry mapping system IDs to data sources.
 * @property {DiToken} PlayerPromptService - Token for the service managing player action prompting (implementation).
 * @property {DiToken} CommandOutcomeInterpreter - Token for the service interpreting command outcomes (implementation).
 * @property {DiToken} SubscriptionLifecycleManager - Token for managing subscription lifecycles (implementation).
 * @property {DiToken} PerceptionUpdateService - Token for the service updating perception logs.
 *
 * --- Core Service Interfaces ---
 * @property {DiToken} ISafeEventDispatcher - Token for the safe event dispatching utility interface.
 * @property {DiToken} IValidatedEventDispatcher - Token for dispatching validated events interface.
 * @property {DiToken} IActionExecutor - Token for executing game actions interface.
 * @property {DiToken} IWorldContext - Token for managing the overall world context interface.
 * @property {DiToken} ICommandParser - Token for parsing player commands interface.
 * @property {DiToken} ICommandProcessor - Token for the command processing service interface.
 * @property {DiToken} IActionDiscoverySystem - Token for the action discovery system interface.
 * @property {DiToken} IInputHandler - Token for handling player input interface.
 * @property {DiToken} ITurnOrderService - Token for the turn order management service interface.
 * @property {DiToken} ITurnManager - Token for the turn management service interface.
 * @property {DiToken} ICommandInputPort - Token for the command input port interface.
 * @property {DiToken} IPromptOutputPort - Token for the prompt output port interface.
 * @property {DiToken} ITurnEndPort - Token for the turn end port interface.
 * @property {DiToken} IPlayerPromptService - Token for the player prompt service interface.
 * @property {DiToken} ICommandOutcomeInterpreter - Token for the command outcome interpreter interface.
 * @property {DiToken} IEntityManager - Token for the entity manager interface.
 * @property {DiToken} IGameDataRepository - Token for the game data repository interface.
 *
 * --- Initialization & Orchestration ---
 * @property {DiToken} WorldInitializer - Token for initializing the game world.
 * @property {DiToken} SystemInitializer - Token for initializing tagged systems.
 * @property {DiToken} InitializationService - Token for the main initialization orchestration service.
 * @property {DiToken} ShutdownService - Token for the main shutdown orchestration service.
 * @property {DiToken} GameLoop - Token for the main game loop.
 * @property {DiToken} InputSetupService - Token for setting up input handling.
 *
 *
 * --- Logic/Interpretation Layer ---
 * @property {DiToken} OperationRegistry - Token for the operation handler registry service.
 * @property {DiToken} OperationInterpreter - Token for the operation interpreter service.
 * @property {DiToken} SystemLogicInterpreter - Token for the system logic interpreter service.
 *
 * --- Operation Handlers (Registered within Interpreter bundle) ---
 * @property {DiToken} DispatchEventHandler - Token for the 'DISPATCH_EVENT' operation handler.
 * @property {DiToken} LogHandler - Token for the 'LOG' operation handler.
 * @property {DiToken} ModifyComponentHandler - Token for the 'MODIFY_COMPONENT' operation handler.
 * @property {DiToken} AddComponentHandler - Token for the 'ADD_COMPONENT' operation handler.
 * @property {DiToken} RemoveComponentHandler - Token for the 'REMOVE_COMPONENT' operation handler.
 * @property {DiToken} QueryComponentHandler - Token for the 'QUERY_COMPONENT' operation handler.
 * @property {DiToken} SetVariableHandler - Token for the 'SET_VARIABLE' operation handler.
 * @property {DiToken} QuerySystemDataHandler - Token for the 'QUERY_SYSTEM_DATA' operation handler.
 */
export const tokens = Object.freeze({
    // Core Interfaces/Abstractions & Externals
    ILogger: 'ILogger',
    EventBus: 'EventBus', // Legacy
    IDataFetcher: 'IDataFetcher',
    IConfiguration: 'IConfiguration',
    IPathResolver: 'IPathResolver',
    ISchemaValidator: 'ISchemaValidator',
    IDataRegistry: 'IDataRegistry',
    ISpatialIndexManager: 'ISpatialIndexManager',

    // --- External Dependencies / Environment ---
    WindowDocument: 'WindowDocument',
    outputDiv: 'outputDiv', // Legacy/Direct access
    inputElement: 'inputElement', // Legacy/Direct access
    titleElement: 'titleElement', // Legacy/Direct access

    // --- DOM UI Layer (Refactored) ---
    IDocumentContext: 'IDocumentContext',
    DomElementFactory: 'DomElementFactory',
    UiMessageRenderer: 'UiMessageRenderer',
    TitleRenderer: 'TitleRenderer',
    InputStateController: 'InputStateController',
    LocationRenderer: 'LocationRenderer',
    InventoryPanel: 'InventoryPanel',
    ActionButtonsRenderer: 'ActionButtonsRenderer',
    PerceptionLogRenderer: 'PerceptionLogRenderer', // <<< ADDED
    DomUiFacade: 'DomUiFacade',

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

    // Core Services & Managers (Concrete Implementations - some may be deprecated for interface tokens)
    GameDataRepository: 'GameDataRepository', // Concrete class token
    EntityManager: 'EntityManager',           // Concrete class token
    TargetResolutionService: 'TargetResolutionService',
    JsonLogicEvaluationService: 'JsonLogicEvaluationService',
    ActionValidationContextBuilder: 'ActionValidationContextBuilder',
    PrerequisiteEvaluationService: 'PrerequisiteEvaluationService',
    DomainContextCompatibilityChecker: 'DomainContextCompatibilityChecker',
    ActionValidationService: 'ActionValidationService',
    TurnHandlerResolver: 'TurnHandlerResolver',
    PlayerTurnHandler: 'PlayerTurnHandler',
    AITurnHandler: 'AITurnHandler',
    SystemServiceRegistry: 'SystemServiceRegistry',
    SystemDataRegistry: 'SystemDataRegistry',
    PlayerPromptService: 'PlayerPromptService',         // Concrete class token
    CommandOutcomeInterpreter: 'CommandOutcomeInterpreter', // Concrete class token
    SubscriptionLifecycleManager: 'SubscriptionLifecycleManager', // Concrete class token
    PerceptionUpdateService: 'PerceptionUpdateService', // <<< ADDED TOKEN (already present from previous user request, good)

    // Core Service Interfaces
    ISafeEventDispatcher: 'ISafeEventDispatcher',
    IValidatedEventDispatcher: 'IValidatedEventDispatcher',
    IActionExecutor: 'IActionExecutor',
    IWorldContext: 'IWorldContext',
    ICommandParser: 'ICommandParser',
    ICommandProcessor: 'ICommandProcessor',
    IActionDiscoverySystem: 'IActionDiscoverySystem',
    IInputHandler: 'IInputHandler', // May become obsolete
    ITurnOrderService: 'ITurnOrderService',
    ITurnManager: 'ITurnManager',
    ITurnContext: 'ITurnContext',
    ICommandInputPort: 'ICommandInputPort',
    IPromptOutputPort: 'IPromptOutputPort',
    ITurnEndPort: 'ITurnEndPort',
    IPlayerPromptService: 'IPlayerPromptService',             // Interface token
    ICommandOutcomeInterpreter: 'ICommandOutcomeInterpreter', // Interface token
    IEntityManager: 'IEntityManager',                         // Interface token
    IGameDataRepository: 'IGameDataRepository',             // Interface token


    // Initialization & Orchestration
    WorldInitializer: 'WorldInitializer',
    SystemInitializer: 'SystemInitializer',
    InitializationService: 'InitializationService',
    ShutdownService: 'ShutdownService',
    GameLoop: 'GameLoop',
    InputSetupService: 'InputSetupService',


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
    SetVariableHandler: 'SetVariableHandler',
    QuerySystemDataHandler: 'QuerySystemDataHandler',
});
// --- FILE END ---