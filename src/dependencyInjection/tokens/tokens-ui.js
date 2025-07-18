import { freeze } from '../../utils';

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
  titleElement: 'titleElement',
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
  VisualizerState: 'VisualizerState',
  AnatomyLoadingDetector: 'AnatomyLoadingDetector',
  VisualizerStateController: 'VisualizerStateController',
  // Anatomy Renderer Components
  LayoutEngine: 'LayoutEngine',
  RadialLayoutStrategy: 'RadialLayoutStrategy',
  SVGRenderer: 'SVGRenderer',
  InteractionController: 'InteractionController',
  ViewportManager: 'ViewportManager',
  VisualizationComposer: 'VisualizationComposer',
});
