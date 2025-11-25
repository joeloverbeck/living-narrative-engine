import { freeze } from '../../utils/cloneUtils.js';

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
  CharacterDataXmlBuilder: 'CharacterDataXmlBuilder',
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
  PromptTemplateService: 'PromptTemplateService',
  PromptDataFormatter: 'PromptDataFormatter',
  IPromptStaticContentService: 'IPromptStaticContentService',
  IPerceptionLogFormatter: 'IPerceptionLogFormatter',
  IGameStateValidationServiceForPrompting:
    'IGameStateValidationServiceForPrompting',
  IEntitySummaryProvider: 'IEntitySummaryProvider',
  IActorStateProvider: 'IActorStateProvider',
  IPerceptionLogProvider: 'IPerceptionLogProvider',
  IAvailableActionsProvider: 'IAvailableActionsProvider',
  ILocationSummaryProvider: 'ILocationSummaryProvider',
  IActorDataExtractor: 'IActorDataExtractor',
  ILLMDecisionProvider: 'ILLMDecisionProvider',
  LlmJsonService: 'LlmJsonService',
  NotesSectionAssembler: 'NotesSectionAssembler',
  StandardElementAssembler: 'StandardElementAssembler',
  PerceptionLogAssembler: 'PerceptionLogAssembler',
  ThoughtsSectionAssembler: 'ThoughtsSectionAssembler',
  PlaceholderResolver: 'PlaceholderResolver',
  ILLMConfigurationManager: 'ILLMConfigurationManager',
  ILLMRequestExecutor: 'ILLMRequestExecutor',
  ILLMErrorMapper: 'ILLMErrorMapper',
  ITokenEstimator: 'ITokenEstimator',
  XmlElementBuilder: 'XmlElementBuilder',
});
