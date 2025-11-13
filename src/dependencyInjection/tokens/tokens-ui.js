import { freeze } from '../../utils/cloneUtils.js';

/**
 * @file UI-related DI tokens.
 * @typedef {string} DiToken
 */

/**
 * Tokens for UI and DOM interactions.
 *
 * @type {Readonly<Record<string, DiToken>>}
 */
export const uiTokens = freeze({
  WindowDocument: 'WindowDocument',
  outputDiv: 'outputDiv',
  inputElement: 'inputElement',
  IDocumentContext: 'IDocumentContext',
  DomElementFactory: 'DomElementFactory',
  IUserPrompt: 'IUserPrompt',
  SpeechBubbleRenderer: 'SpeechBubbleRenderer',
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
  ActorParticipationController: 'ActorParticipationController',
  EntityLifecycleMonitor: 'EntityLifecycleMonitor',
  VisualizerState: 'VisualizerState',
  AnatomyLoadingDetector: 'AnatomyLoadingDetector',
  VisualizerStateController: 'VisualizerStateController',
  PortraitModalRenderer: 'PortraitModalRenderer',
  PerceptibleEventSenderController: 'PerceptibleEventSenderController',
  // Anatomy Renderer Components
  LayoutEngine: 'LayoutEngine',
  RadialLayoutStrategy: 'RadialLayoutStrategy',
  SVGRenderer: 'SVGRenderer',
  InteractionController: 'InteractionController',
  ViewportManager: 'ViewportManager',
  VisualizationComposer: 'VisualizationComposer',
  // Thematic Direction Generator
  ThematicDirectionController: 'ThematicDirectionController',
  TurnOrderTickerRenderer: 'TurnOrderTickerRenderer',
});
