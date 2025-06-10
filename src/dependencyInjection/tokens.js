// src/dependencyInjection/tokens.js
// --- FILE START ---
/**
 * @file Centralized repository for Dependency Injection (DI) keys/tokens.
 * Using tokens instead of raw strings prevents typos and aids refactoring.
 */

/**
 * A frozen object containing all unique keys used for registering and resolving
 * services and dependencies within the application's DI container.
 * Using Object.freeze prevents accidental modification.
 *
 * @typedef {string} DiToken
 * @property {DiToken} ILogger - Token for the core logging service.
 * @property {DiToken} EventBus - Token for the central event bus (legacy).
 * @property {DiToken} IDataFetcher - Token for the data fetching service.
 * @property {DiToken} IConfiguration - Token for static configuration access.
 * @property {DiToken} IPathResolver - Token for resolving data paths.
 * @property {DiToken} ISchemaValidator - Token for validating data against schemas.
 * @property {DiToken} IDataRegistry - Token for storing loaded game data.
 * @property {DiToken} ISpatialIndexManager - Token for managing the spatial index.
 * @property {DiToken} IReferenceResolver - Token for the reference resolution service.
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
 * @property {DiToken} SpeechBubbleRenderer - Token for the component rendering speech bubbles with portraits.
 * @property {DiToken} TitleRenderer - Token for the component rendering the main H1 title.
 * @property {DiToken} InputStateController - Token for the component controlling input field state.
 * @property {DiToken} LocationRenderer - Token for the component rendering location details.
 * @property {DiToken} InventoryPanel - Token for the component managing the inventory panel UI.
 * @property {DiToken} ActionButtonsRenderer - Token for the component rendering available action buttons.
 * @property {DiToken} PerceptionLogRenderer - Token for the component rendering perception logs.
 * @property {DiToken} DomUiFacade - Token for the facade aggregating all UI components.
 * @property {DiToken} SaveGameUI - Token for the Save Game UI component.
 * @property {DiToken} LoadGameUI - Token for the Load Game UI component.
 * @property {DiToken} LlmSelectionModal - Token for the LLM Selection Modal UI component.
 * @property {DiToken} EngineUIManager - Token for the service managing UI updates from GameEngine events.
 * @property {DiToken} DomRenderer - Token for the legacy DOM rendering class (deprecated).
 * @property {DiToken} CurrentTurnActorRenderer - Token for the component displaying the current turn actor's portrait and name.
 * @property {DiToken} ProcessingIndicatorController - Token for the component managing the processing/thinking indicator.
 * @property {DiToken} ChatAlertRenderer - Token for the component that renders warnings and errors in the chat panel.
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
 * @property {DiToken} ReferenceResolver - Token for the reference resolution service (implementation).
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
 * @property {DiToken} PlayerPromptService - Token for the service managing player action prompting (implementation).
 * @property {DiToken} CommandOutcomeInterpreter - Token for the service interpreting command outcomes (implementation).
 * @property {DiToken} PlaytimeTracker - Token for the service managing player playtime.
 * @property {DiToken} GamePersistenceService - Token for the game state persistence service.
 * @property {DiToken} EntityDisplayDataProvider - Token for the service providing entity display data.
 * @property {DiToken} AlertRouter - Token for the service that routes alerts to the UI or console.
 *
 * --- Core Service Interfaces ---
 * @property {DiToken} ISafeEventDispatcher - Token for the safe event dispatching utility interface.
 * @property {DiToken} IValidatedEventDispatcher - Token for dispatching validated events interface.
 * @property {DiToken} IActionExecutor - Token for executing game actions interface.
 * @property {DiToken} IWorldContext - Token for managing the overall world context interface.
 * @property {DiToken} ICommandParser - Token for parsing player commands interface.
 * @property {DiToken} ICommandProcessor - Token for the command processing service interface.
 * @property {DiToken} IActionDiscoveryService - Token for the action discovery system interface.
 * @property {DiToken} IInputHandler - Token for handling player input interface.
 * @property {DiToken} ITurnOrderService - Token for the turn order management service interface.
 * @property {DiToken} ITurnManager - Token for the turn management service interface.
 * @property {DiToken} ITurnContext - Token for accessing context specific to the current turn. // <<< ENSURED THIS IS PRESENT AND NOT COMMENTED
 * @property {DiToken} IPromptOutputPort - Token for the prompt output port interface.
 * @property {DiToken} ITurnEndPort - Token for the turn end port interface.
 * @property {DiToken} IPlayerPromptService - Token for the player prompt service interface.
 * @property {DiToken} ICommandOutcomeInterpreter - Token for the command outcome interpreter interface.
 * @property {DiToken} IEntityManager - Token for the entity manager interface.
 * @property {DiToken} IGameDataRepository - Token for the game data repository interface.
 * @property {DiToken} ISaveLoadService - Token for the save/load service interface.
 * @property {DiToken} IStorageProvider - Token for the storage provider interface.
 * @property {DiToken} IInitializationService - Token for the game initialization service interface.
 * @property {DiToken} LLMAdapter - Token for the LLM adapter service interface.
 *
 * --- Initialization & Orchestration ---
 * @property {DiToken} WorldInitializer - Token for initializing the game world.
 * @property {DiToken} SystemInitializer - Token for initializing tagged systems.
 * @property {DiToken} ShutdownService - Token for the main shutdown orchestration service.
 * @property {DiToken} GameLoop - Token for the main game loop.
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
 *
 * // ***** ADDITIONS FOR PROMPTBUILDER REFACTORING START *****
 * @property {DiToken} IConfigurationProvider - Token for the LLM configuration provider interface.
 * @property {DiToken} LLMConfigService - Token for the LLM configuration management service.
 * @property {DiToken} PlaceholderResolver - Token for the placeholder resolution utility.
 * @property {DiToken} StandardElementAssembler - Token for the standard prompt element assembler.
 * @property {DiToken} PerceptionLogAssembler - Token for the perception log element assembler.
 * // ***** ADDITIONS FOR PROMPTBUILDER REFACTORING END *****
 * @property {DiToken} IPromptStaticContentService - Token for the service providing static prompt content.
 * @property {DiToken} IPerceptionLogFormatter - Token for the perception log formatting service.
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
  IReferenceResolver: 'IReferenceResolver',

  // --- External Dependencies / Environment ---
  WindowDocument: 'WindowDocument',
  outputDiv: 'outputDiv', // Legacy/Direct access
  inputElement: 'inputElement', // Legacy/Direct access
  titleElement: 'titleElement', // Legacy/Direct access

  // --- DOM UI Layer (Refactored) ---
  IDocumentContext: 'IDocumentContext',
  DomElementFactory: 'DomElementFactory',
  SpeechBubbleRenderer: 'SpeechBubbleRenderer',
  TitleRenderer: 'TitleRenderer',
  InputStateController: 'InputStateController',
  LocationRenderer: 'LocationRenderer',
  ActionButtonsRenderer: 'ActionButtonsRenderer',
  PerceptionLogRenderer: 'PerceptionLogRenderer',
  DomUiFacade: 'DomUiFacade',
  SaveGameUI: 'SaveGameUI',
  LoadGameUI: 'LoadGameUI',
  LlmSelectionModal: 'LlmSelectionModal',
  EngineUIManager: 'EngineUIManager',
  CurrentTurnActorRenderer: 'CurrentTurnActorRenderer',
  ProcessingIndicatorController: 'ProcessingIndicatorController',
  ChatAlertRenderer: 'ChatAlertRenderer',
  ActionResultRenderer: 'ActionResultRenderer',

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
  GameDataRepository: 'GameDataRepository',
  EntityManager: 'EntityManager',
  ReferenceResolver: 'ReferenceResolver',
  TargetResolutionService: 'TargetResolutionService',
  JsonLogicEvaluationService: 'JsonLogicEvaluationService',
  ActionValidationContextBuilder: 'ActionValidationContextBuilder',
  PrerequisiteEvaluationService: 'PrerequisiteEvaluationService',
  DomainContextCompatibilityChecker: 'DomainContextCompatibilityChecker',
  ActionValidationService: 'ActionValidationService',
  TurnHandlerResolver: 'TurnHandlerResolver',
  PlayerTurnHandler: 'PlayerTurnHandler',
  AITurnHandler: 'AITurnHandler',
  PlayerPromptService: 'PlayerPromptService',
  CommandOutcomeInterpreter: 'CommandOutcomeInterpreter',
  PlaytimeTracker: 'PlaytimeTracker',
  GamePersistenceService: 'GamePersistenceService',
  EntityDisplayDataProvider: 'EntityDisplayDataProvider',
  AlertRouter: 'AlertRouter',

  // Core Service Interfaces
  ISafeEventDispatcher: 'ISafeEventDispatcher',
  IValidatedEventDispatcher: 'IValidatedEventDispatcher',
  IWorldContext: 'IWorldContext',
  ICommandParser: 'ICommandParser',
  ICommandProcessor: 'ICommandProcessor',
  IActionDiscoveryService: 'IActionDiscoveryService',
  IInputHandler: 'IInputHandler',
  ITurnOrderService: 'ITurnOrderService',
  ITurnManager: 'ITurnManager',
  ITurnContext: 'ITurnContext',
  IPromptOutputPort: 'IPromptOutputPort',
  ITurnEndPort: 'ITurnEndPort',
  IPlayerPromptService: 'IPlayerPromptService',
  ICommandOutcomeInterpreter: 'ICommandOutcomeInterpreter',
  IEntityManager: 'IEntityManager',
  IGameDataRepository: 'IGameDataRepository',
  ISaveLoadService: 'ISaveLoadService',
  IStorageProvider: 'IStorageProvider',
  IInitializationService: 'IInitializationService',
  LLMAdapter: 'LLMAdapter',

  // Initialization & Orchestration
  WorldInitializer: 'WorldInitializer',
  SystemInitializer: 'SystemInitializer',
  ShutdownService: 'ShutdownService',
  GameLoop: 'GameLoop',

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
  SystemMoveEntityHandler: 'SystemMoveEntityHandler',
  GetTimestampHandler: 'GetTimestampHandler',
  ResolveDirectionHandler: 'ResolveDirectionHandler',
  RebuildLeaderListCacheHandler: 'RebuildLeaderListCacheHandler',
  CheckFollowCycleHandler: 'CheckFollowCycleHandler',
  AddPerceptionLogEntryHandler: 'AddPerceptionLogEntryHandler',
  QueryEntitiesHandler: 'QueryEntitiesHandler',
  HasComponentHandler: 'HasComponentHandler',
  ModifyArrayFieldHandler: 'ModifyArrayFieldHandler',

  // --- Turn System Factories ---
  ITurnStateFactory: 'ITurnStateFactory',
  IAIPlayerStrategyFactory: 'IAIPlayerStrategyFactory',
  ITurnContextFactory: 'ITurnContextFactory',

  // --- Service Interfaces for AITurnHandler dependencies (if not already defined) ---
  IPromptBuilder: 'IPromptBuilder',
  IAIGameStateProvider: 'IAIGameStateProvider',
  IAIPromptContentProvider: 'IAIPromptContentProvider',
  IAIPromptPipeline: 'IAIPromptPipeline',
  IHttpClient: 'IHttpClient',
  ILLMResponseProcessor: 'ILLMResponseProcessor',
  IAIFallbackActionFactory: 'IAIFallbackActionFactory',

  // --- Concrete Service Tokens (if needed for direct registration before interface mapping) ---
  PromptBuilder: 'PromptBuilder',
  AIGameStateProvider: 'AIGameStateProvider',
  AIPromptContentProvider: 'AIPromptContentProvider',
  LLMResponseProcessor: 'LLMResponseProcessor',

  IConfigurationProvider: 'IConfigurationProvider',
  LLMConfigService: 'LLMConfigService',
  PlaceholderResolver: 'PlaceholderResolver',
  StandardElementAssembler: 'StandardElementAssembler',
  PerceptionLogAssembler: 'PerceptionLogAssembler',
  ThoughtsSectionAssembler: 'ThoughtsSectionAssembler',
  NotesSectionAssembler: 'NotesSectionAssembler',
  GoalsSectionAssembler: 'GoalsSectionAssembler',
  IPromptStaticContentService: 'IPromptStaticContentService',
  IPerceptionLogFormatter: 'IPerceptionLogFormatter',
  IGameStateValidationServiceForPrompting:
    'IGameStateValidationServiceForPrompting',

  // --- AI Game State Providers (New) ---
  IEntitySummaryProvider: 'IEntitySummaryProvider',
  IActorStateProvider: 'IActorStateProvider',
  IPerceptionLogProvider: 'IPerceptionLogProvider',
  IAvailableActionsProvider: 'IAvailableActionsProvider',
  ILocationSummaryProvider: 'ILocationSummaryProvider',
  IActorDataExtractor: 'IActorDataExtractor',
});
// --- FILE END ---
