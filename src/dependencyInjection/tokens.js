/**
 * @file Centralized repository for Dependency Injection (DI) keys/tokens.
 * Using tokens instead of raw strings prevents typos and aids refactoring.
 */

import { freeze } from '../utils';

/**
 * A frozen object containing all unique keys used for registering and resolving
 * services and dependencies within the application's DI container.
 *
 * @typedef {string} DiToken
 * @property {DiToken} ILogger - Token for the core logging service.
 * @property {DiToken} EventBus - Token for the central event bus (legacy).
 * @property {DiToken} IEventBus - Token for the event bus interface.
 * @property {DiToken} IDataFetcher - Token for the data fetching service.
 * @property {DiToken} ITextDataFetcher - Token for the text data fetching service.
 * @property {DiToken} IConfiguration - Token for static configuration access.
 * @property {DiToken} IPathResolver - Token for resolving data paths.
 * @property {DiToken} ISchemaValidator - Token for a service that validates data against schemas.
 * @property {DiToken} IDataRegistry - Token for storing loaded game data.
 * @property {DiToken} ISpatialIndexManager - Token for managing the spatial index.
 * @property {DiToken} IReferenceResolver - Token for the reference resolution service.
 *
 * --- External Dependencies / Environment ---
 * @property {DiToken} WindowDocument - Token for the browser's global `document` object.
 * @property {DiToken} outputDiv - Token for the main output HTML element (legacy/direct access).
 * @property {DiToken} inputElement - Token for the command input HTML element (legacy/direct access).
 * @property {DiToken} titleElement - Token for the title HTML element (legacy/direct access).
 * @property {DiToken} ProxyUrl - Token for the LLM proxy server URL.
 *
 * --- DOM UI Layer (Refactored) ---
 * @property {DiToken} IDocumentContext - Token for the DOM access abstraction service.
 * @property {DiToken} DomElementFactory - Token for the utility creating DOM elements.
 * @property {DiToken} IUserPrompt - Token for the user prompt abstraction.
 * @property {DiToken} SpeechBubbleRenderer - Token for the component rendering speech bubbles with portraits.
 * @property {DiToken} TitleRenderer - Token for the component rendering the main H1 title.
 * @property {DiToken} InputStateController - Token for the component controlling input field state.
 * @property {DiToken} LocationRenderer - Token for the component rendering location details.
 * @property {DiToken} InventoryPanel - Token for the component managing the inventory panel UI.
 * @property {DiToken} ActionButtonsRenderer - Token for the component rendering available action buttons.
 * @property {DiToken} PerceptionLogRenderer - Token for the component rendering perception logs.
 * @property {DiToken} DomUiFacade - Token for the facade aggregating all UI components.
 * @property {DiToken} SaveGameService - Token for the service handling save operations.
 * @property {DiToken} SaveService - Token for the adapter used to save games.
 * @property {DiToken} SaveGameUI - Token for the Save Game UI component.
 * @property {DiToken} LoadService - Token for the adapter used to load games.
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
 * @property {DiToken} ComponentLoader - Token for loading component definitions.
 * @property {DiToken} ConditionLoader - Token for loading reusable condition definitions.
 * @property {DiToken} ActionLoader - Token for the action loading service.
 * @property {DiToken} EventLoader - Token for the event loading service.
 * @property {DiToken} MacroLoader - Token for the macro loading service.
 * @property {DiToken} EntityLoader - Token for loading entity definitions.
 * @property {DiToken} EntityInstanceLoader - Token for loading entity instances from world files or saves.
 * @property {DiToken} WorldLoader - Token for orchestrating world data loading.
 * @property {DiToken} GoalLoader - Token for the goal loading service.
 * @property {DiToken} ScopeLoader - Token for the scope loading service.
 * @property {DiToken} ModsLoader - Token for orchestrating world data loading.
 * @property {DiToken} GameConfigLoader - Token for loading the main game configuration file.
 * @property {DiToken} PromptTextLoader - Token for loading the core prompt text used by the AI system.
 * @property {DiToken} LlmConfigLoader - Token for loading LLM prompt configurations.
 * @property {DiToken} ModManifestLoader - Token for loading mod manifests.
 * @property {DiToken} ModDependencyValidator - Token for the mod dependency validator service.
 * @property {DiToken} ILoadCache - Token for the load cache service.
 *
 * --- Core Services & Managers (Implementations - some will be replaced by Interface Tokens below) ---
 * @property {DiToken} ScopeRegistry - Token for the scope definitions registry service.
 * @property {DiToken} GameDataRepository - Token for accessing registered game data (implementation).
 * @property {DiToken} EntityManager - Token for managing game entities and components (implementation).
 * @property {DiToken} SpatialIndexSynchronizer - Token for the service that keeps the spatial index in sync with entity events.
 * @property {DiToken} TargetResolutionService - Token for resolving action targets.
 * @property {DiToken} ReferenceResolver - Token for the reference resolution service (implementation).
 * @property {DiToken} JsonLogicEvaluationService - Token for evaluating JsonLogic rules.
 * @property {DiToken} ActionValidationContextBuilder - Token for building action validation contexts.
 * @property {DiToken} PrerequisiteEvaluationService - Token for evaluating action/quest prerequisites.
 * @property {DiToken} DomainContextCompatibilityChecker - Token for checking domain context compatibility.
 * @property {DiToken} ActionValidationService - Token for validating actions.
 * @property {DiToken} PayloadValueResolverService - Token for resolving payload values.
 * @property {DiToken} TurnHandlerResolver - Token for the service that resolves the correct turn handler.
 * @property {DiToken} ActorTurnHandler - Token for the unified actor turn handler implementation.
 * @property {DiToken} SystemServiceRegistry - Token for the registry mapping system IDs to services.
 * @property {DiToken} PlaytimeTracker - Token for the service managing player playtime.
 * @property {DiToken} ComponentCleaningService - Token for the service cleaning component data.
 * @property {DiToken} SaveFileRepository - Token for the save file repository service.
 * @property {DiToken} ISaveFileRepository - Token for the save file repository interface.
 * @property {DiToken} GameStateCaptureService - Token for the service capturing game state.
 * @property {DiToken} ManualSaveCoordinator - Token coordinating manual save preparation.
 * @property {DiToken} GamePersistenceService - Token for the game state persistence service.
 * @property {DiToken} EntityDisplayDataProvider - Token for the service providing entity display data.
 * @property {DiToken} AlertRouter - Token for the service that routes alerts to the UI or console.
 * @property {DiToken} LocationQueryService - Token for the service providing location-based entity queries.
 * @property {DiToken} LocationDisplayService - Token for the service providing display data for locations.
 * @property {DiToken} GameSessionManager - Token for the game session manager.
 * @property {DiToken} PersistenceCoordinator - Token coordinating persistence operations.
 *
 * --- Core Service Interfaces ---
 * @property {DiToken} ISafeEventDispatcher - Token for the safe event dispatching utility interface.
 * @property {DiToken} IValidatedEventDispatcher - Token for dispatching validated events interface.
 * @property {DiToken} IScopeRegistry - Token for the scope definitions registry interface.
 * @property {DiToken} IActionExecutor - Token for executing game actions interface.
 * @property {DiToken} IWorldContext - Token for managing the overall world context interface.
 * @property {DiToken} ICommandProcessor - Token for the command processing service interface.
 * @property {DiToken} IActionDiscoveryService - Token for the action discovery system interface.
 * @property {DiToken} ITargetResolutionService - Token for the target resolution service interface.
 * @property {DiToken} IInputHandler - Token for handling player input interface.
 * @property {DiToken} GlobalKeyHandler - Token for listening to global keyboard events.
 * @property {DiToken} ITurnOrderService - Token for the turn order management service interface.
 * @property {DiToken} ITurnManager - Token for the turn management service interface.
 * @property {DiToken} ITurnContext - Token for accessing context specific to the current turn. // <<< ENSURED THIS IS PRESENT AND NOT COMMENTED
 * @property {DiToken} IPromptOutputPort - Token for the prompt output port interface.
 * @property {DiToken} ITurnEndPort - Token for the turn end port interface.
 * @property {DiToken} IPromptCoordinator - Token for the player prompt service interface.
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
 * @property {DiToken} QueryComponentsHandler - Token for the 'QUERY_COMPONENTS' operation handler.
 * @property {DiToken} SetVariableHandler - Token for the 'SET_VARIABLE' operation handler.
 * @property {DiToken} EndTurnHandler - Token for the 'END_TURN' operation handler.
 * @property {DiToken} ModifyContextArrayHandler - Token for the 'MODIFY_CONTEXT_ARRAY' operation handler.
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
export const tokens = freeze({
  // Core Interfaces/Abstractions & Externals
  ILogger: 'ILogger',
  EventBus: 'EventBus', // Legacy
  IEventBus: 'IEventBus',
  IDataFetcher: 'IDataFetcher',
  ITextDataFetcher: 'ITextDataFetcher',
  IConfiguration: 'IConfiguration',
  IPathResolver: 'IPathResolver',
  ISchemaValidator: 'ISchemaValidator',
  IDataRegistry: 'IDataRegistry',
  ISpatialIndexManager: 'ISpatialIndexManager',
  // IReferenceResolver: 'IReferenceResolver', // Removed - service is deprecated

  // --- External Dependencies / Environment ---
  WindowDocument: 'WindowDocument',
  outputDiv: 'outputDiv', // Legacy/Direct access
  inputElement: 'inputElement', // Legacy/Direct access
  titleElement: 'titleElement', // Legacy/Direct access
  ProxyUrl: 'ProxyUrl',

  // --- DOM UI Layer (Refactored) ---
  IDocumentContext: 'IDocumentContext',
  DomElementFactory: 'DomElementFactory',
  IUserPrompt: 'IUserPrompt',
  SpeechBubbleRenderer: 'SpeechBubbleRenderer',
  TitleRenderer: 'TitleRenderer',
  InputStateController: 'InputStateController',
  LocationRenderer: 'LocationRenderer',
  ActionButtonsRenderer: 'ActionButtonsRenderer',
  PerceptionLogRenderer: 'PerceptionLogRenderer',
  DomUiFacade: 'DomUiFacade',
  SaveGameService: 'SaveGameService',
  SaveService: 'SaveService',
  SaveGameUI: 'SaveGameUI',
  LoadService: 'LoadService',
  LoadGameUI: 'LoadGameUI',
  LlmSelectionModal: 'LlmSelectionModal',
  EngineUIManager: 'EngineUIManager',
  CurrentTurnActorRenderer: 'CurrentTurnActorRenderer',
  ProcessingIndicatorController: 'ProcessingIndicatorController',
  ChatAlertRenderer: 'ChatAlertRenderer',
  ActionResultRenderer: 'ActionResultRenderer',
  EntityLifecycleMonitor: 'EntityLifecycleMonitor',

  // Loaders
  SchemaLoader: 'SchemaLoader',
  RuleLoader: 'RuleLoader',
  ComponentLoader: 'ComponentLoader',
  ConditionLoader: 'ConditionLoader',
  ActionLoader: 'ActionLoader',
  EventLoader: 'EventLoader',
  MacroLoader: 'MacroLoader',
  EntityLoader: 'EntityLoader',
  EntityInstanceLoader: 'EntityInstanceLoader',
  WorldLoader: 'WorldLoader',
  GoalLoader: 'GoalLoader',
  ScopeLoader: 'ScopeLoader',
  ModsLoader: 'ModsLoader',
  GameConfigLoader: 'GameConfigLoader',
  PromptTextLoader: 'PromptTextLoader',
  LlmConfigLoader: 'LlmConfigLoader',
  ModManifestLoader: 'ModManifestLoader',
  ModDependencyValidator: 'ModDependencyValidator',
  ILoadCache: 'ILoadCache',
  AnatomyRecipeLoader: 'AnatomyRecipeLoader',
  AnatomyBlueprintLoader: 'AnatomyBlueprintLoader',
  AnatomyPartLoader: 'AnatomyPartLoader',

  // Core Services & Managers (Concrete Implementations - some may be deprecated for interface tokens)
  GameDataRepository: 'GameDataRepository',
  EntityManager: 'EntityManager',
  SpatialIndexSynchronizer: 'SpatialIndexSynchronizer',
  // ReferenceResolver: 'ReferenceResolver', // Removed - service is deprecated
  JsonLogicEvaluationService: 'JsonLogicEvaluationService',
  ActionValidationContextBuilder: 'ActionValidationContextBuilder',
  PrerequisiteEvaluationService: 'PrerequisiteEvaluationService',
  TurnHandlerResolver: 'TurnHandlerResolver',
  ActorTurnHandler: 'ActorTurnHandler',
  PlaytimeTracker: 'PlaytimeTracker',
  ComponentCleaningService: 'ComponentCleaningService',
  SaveFileRepository: 'SaveFileRepository',
  SaveMetadataBuilder: 'SaveMetadataBuilder',
  ActiveModsManifestBuilder: 'ActiveModsManifestBuilder',
  GameStateCaptureService: 'GameStateCaptureService',
  ManualSaveCoordinator: 'ManualSaveCoordinator',
  GamePersistenceService: 'GamePersistenceService',
  EntityDisplayDataProvider: 'EntityDisplayDataProvider',
  AlertRouter: 'AlertRouter',
  ClosenessCircleService: 'ClosenessCircleService',
  LocationQueryService: 'LocationQueryService',
  LocationDisplayService: 'LocationDisplayService',
  GameSessionManager: 'GameSessionManager',
  PersistenceCoordinator: 'PersistenceCoordinator',
  BodyBlueprintFactory: 'BodyBlueprintFactory',
  GraphIntegrityValidator: 'GraphIntegrityValidator',
  BodyGraphService: 'BodyGraphService',
  AnatomyGenerationService: 'AnatomyGenerationService',
  AnatomyInitializationService: 'AnatomyInitializationService',

  // Core Service Interfaces
  ISafeEventDispatcher: 'ISafeEventDispatcher',
  IValidatedEventDispatcher: 'IValidatedEventDispatcher',
  IScopeRegistry: 'IScopeRegistry',
  IScopeEngine: 'IScopeEngine',
  IActionExecutor: 'IActionExecutor',
  IWorldContext: 'IWorldContext',
  ICommandProcessor: 'ICommandProcessor',
  IActionDiscoveryService: 'IActionDiscoveryService',
  ITargetResolutionService: 'ITargetResolutionService',
  ActionIndex: 'ActionIndex',
  ActionCandidateProcessor: 'ActionCandidateProcessor',
  IInputHandler: 'IInputHandler',
  GlobalKeyHandler: 'GlobalKeyHandler',
  ITurnOrderService: 'ITurnOrderService',
  ITurnManager: 'ITurnManager',
  ITurnContext: 'ITurnContext',
  IPromptOutputPort: 'IPromptOutputPort',
  ITurnEndPort: 'ITurnEndPort',
  IPromptCoordinator: 'IPromptCoordinator',
  ICommandOutcomeInterpreter: 'ICommandOutcomeInterpreter',
  IPlayerTurnEvents: 'IPlayerTurnEvents',
  IEntityManager: 'IEntityManager',
  IGameDataRepository: 'IGameDataRepository',
  ISaveFileRepository: 'ISaveFileRepository',
  ISaveLoadService: 'ISaveLoadService',
  IStorageProvider: 'IStorageProvider',
  IInitializationService: 'IInitializationService',
  LLMAdapter: 'LLMAdapter',

  // AI decision orchestration
  ILLMChooser: 'ILLMChooser',
  IActionIndexer: 'IActionIndexer',
  ITurnActionFactory: 'ITurnActionFactory',

  // --- Turn System Factories ---
  ITurnStateFactory: 'ITurnStateFactory',
  TurnStrategyFactory: 'TurnStrategyFactory',
  AIStrategyFactory: 'AIStrategyFactory',
  ITurnContextFactory: 'ITurnContextFactory',
  HumanStrategyFactory: 'HumanStrategyFactory',

  // --- Service Interfaces for AI actor turn handler dependencies (if not already defined) ---
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
  ActionIndexingService: 'ActionIndexingService',

  IConfigurationProvider: 'IConfigurationProvider',
  LLMConfigService: 'LLMConfigService',
  PlaceholderResolver: 'PlaceholderResolver',
  StandardElementAssembler: 'StandardElementAssembler',
  PerceptionLogAssembler: 'PerceptionLogAssembler',
  ThoughtsSectionAssembler: 'ThoughtsSectionAssembler',
  NotesSectionAssembler: 'NotesSectionAssembler',
  GoalsSectionAssembler: 'GoalsSectionAssembler',
  IndexedChoicesAssembler: 'IndexedChoicesAssembler',
  IPromptStaticContentService: 'IPromptStaticContentService',
  IPerceptionLogFormatter: 'IPerceptionLogFormatter',
  IGameStateValidationServiceForPrompting:
    'IGameStateValidationServiceForPrompting',
  AssemblerRegistry: 'AssemblerRegistry',

  // --- AI Game State Providers (New) ---
  IEntitySummaryProvider: 'IEntitySummaryProvider',
  IActorStateProvider: 'IActorStateProvider',
  IPerceptionLogProvider: 'IPerceptionLogProvider',
  IAvailableActionsProvider: 'IAvailableActionsProvider',
  ILocationSummaryProvider: 'ILocationSummaryProvider',
  IActorDataExtractor: 'IActorDataExtractor',

  // --- Utils ---
  assertValidEntity: 'assertValidEntity',

  // Core Builders
  ActionContextBuilder: 'ActionContextBuilder',
  TurnContextBuilder: 'TurnContextBuilder',

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
  DispatchSpeechHandler: 'DispatchSpeechHandler',
  DispatchPerceptibleEventHandler: 'DispatchPerceptibleEventHandler',
  LogHandler: 'LogHandler',
  ModifyComponentHandler: 'ModifyComponentHandler',
  AddComponentHandler: 'AddComponentHandler',
  RemoveComponentHandler: 'RemoveComponentHandler',
  QueryComponentHandler: 'QueryComponentHandler',
  QueryComponentsHandler: 'QueryComponentsHandler',
  SetVariableHandler: 'SetVariableHandler',
  EndTurnHandler: 'EndTurnHandler',
  SystemMoveEntityHandler: 'SystemMoveEntityHandler',
  GetTimestampHandler: 'GetTimestampHandler',
  GetNameHandler: 'GetNameHandler',
  RebuildLeaderListCacheHandler: 'RebuildLeaderListCacheHandler',
  CheckFollowCycleHandler: 'CheckFollowCycleHandler',
  EstablishFollowRelationHandler: 'EstablishFollowRelationHandler',
  BreakFollowRelationHandler: 'BreakFollowRelationHandler',
  AddPerceptionLogEntryHandler: 'AddPerceptionLogEntryHandler',
  QueryEntitiesHandler: 'QueryEntitiesHandler',
  HasComponentHandler: 'HasComponentHandler',
  ModifyArrayFieldHandler: 'ModifyArrayFieldHandler',
  ModifyContextArrayHandler: 'ModifyContextArrayHandler',
  IfCoLocatedHandler: 'IfCoLocatedHandler',
  MathHandler: 'MathHandler',
  RemoveFromClosenessCircleHandler: 'RemoveFromClosenessCircleHandler',
  AutoMoveFollowersHandler: 'AutoMoveFollowersHandler',
  MergeClosenessCircleHandler: 'MergeClosenessCircleHandler',

  // --- Actions ---
  TurnActionChoicePipeline: 'TurnActionChoicePipeline',
  ITurnDecisionProvider: 'ITurnDecisionProvider',
  ILLMDecisionProvider: 'ILLMDecisionProvider',
  IHumanDecisionProvider: 'IHumanDecisionProvider',
  IGoapDecisionProvider: 'IGoapDecisionProvider',

  // --- Phase-related services and processors ---
  ModLoadOrderResolver: 'ModLoadOrderResolver',
  ModManifestProcessor: 'ModManifestProcessor',
  ContentLoadManager: 'ContentLoadManager',
  WorldLoadSummaryLogger: 'WorldLoadSummaryLogger',
  SchemaPhase: 'SchemaPhase',
  GameConfigPhase: 'GameConfigPhase',
  ManifestPhase: 'ManifestPhase',
  ContentPhase: 'ContentPhase',
  WorldPhase: 'WorldPhase',
  SummaryPhase: 'SummaryPhase',

  // Scope DSL Services
  ScopeEngine: 'ScopeEngine',
  ScopeCache: 'ScopeCache',

  // --- Factory Functions ---
  TraceContextFactory: 'TraceContextFactory',
});
