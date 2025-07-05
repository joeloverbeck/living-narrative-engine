import { freeze } from '../../utils';

/**
 * @file AI-specific DI tokens.
 * @typedef {string} DiToken
 */

/**
 * Tokens used by the AI subsystems.
 *
 * @type {Readonly<Record<string, DiToken>>}
 */
export const aiTokens = freeze({
  LLMAdapter: 'LLMAdapter',
  ILLMChooser: 'ILLMChooser',
  IActionIndexer: 'IActionIndexer',
  ITurnActionFactory: 'ITurnActionFactory',
  ITurnStateFactory: 'ITurnStateFactory',
  TurnStrategyFactory: 'TurnStrategyFactory',
  AIStrategyFactory: 'AIStrategyFactory',
  ITurnContextFactory: 'ITurnContextFactory',
  HumanStrategyFactory: 'HumanStrategyFactory',
  IPromptBuilder: 'IPromptBuilder',
  IAIGameStateProvider: 'IAIGameStateProvider',
  IAIPromptContentProvider: 'IAIPromptContentProvider',
  IAIPromptPipeline: 'IAIPromptPipeline',
  IHttpClient: 'IHttpClient',
  ILLMResponseProcessor: 'ILLMResponseProcessor',
  IAIFallbackActionFactory: 'IAIFallbackActionFactory',
  PromptBuilder: 'PromptBuilder',
  AIGameStateProvider: 'AIGameStateProvider',
  AIPromptContentProvider: 'AIPromptContentProvider',
  LLMResponseProcessor: 'LLMResponseProcessor',
  ActionIndexingService: 'ActionIndexingService',
  IConfigurationProvider: 'IConfigurationProvider',
  LlmConfigManager: 'LlmConfigManager',
  PlaceholderResolver: 'PlaceholderResolver',
  ExecutionPlaceholderResolver: 'ExecutionPlaceholderResolver',
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
  IEntitySummaryProvider: 'IEntitySummaryProvider',
  IActorStateProvider: 'IActorStateProvider',
  IPerceptionLogProvider: 'IPerceptionLogProvider',
  IAvailableActionsProvider: 'IAvailableActionsProvider',
  ILocationSummaryProvider: 'ILocationSummaryProvider',
  IActorDataExtractor: 'IActorDataExtractor',
  ILLMDecisionProvider: 'ILLMDecisionProvider',
  LlmJsonService: 'LlmJsonService',
});
