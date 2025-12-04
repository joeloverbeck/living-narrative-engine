// src/dependencyInjection/registrations/uiRegistrations.js
// --- FILE START ---
/**
 * @file Registers UI-related services and dependencies with the AppContainer.
 * This version reflects the refactoring of DomRenderer into individual components
 * and the update of InputHandler's dependency.
 */

// --- Core & Service Imports ---
import { tokens } from '../tokens.js';
import { Registrar } from '../../utils/registrarHelpers.js';
import { registerWithLog } from '../../utils/registrarHelpers.js';
import InputHandler from '../../input/inputHandler.js'; // Legacy Input Handler (Updated Dependency)
import AlertRouter from '../../alerting/alertRouter.js';

// --- NEW DOM UI Component Imports ---
import {
  ActorParticipationController,
  SpeechBubbleRenderer,
  InputStateController,
  LocationRenderer,
  ActionButtonsRenderer,
  PerceptionLogRenderer,
  DomUiFacade,
  LlmSelectionModal,
  DomElementFactory,
  DocumentContext,
  CurrentTurnActorRenderer,
  ProcessingIndicatorController,
  ChatAlertRenderer,
  ActionResultRenderer,
  WindowUserPrompt,
  SaveGameService,
  EntityLifecycleMonitor,
  InjuryStatusPanel,
  DamageEventMessageRenderer,
  PromptPreviewModal,
} from '../../domUI/index.js';
import { VisualizerState } from '../../domUI/visualizer/VisualizerState.js';
import { AnatomyLoadingDetector } from '../../domUI/visualizer/AnatomyLoadingDetector.js';
import { VisualizerStateController } from '../../domUI/visualizer/VisualizerStateController.js';
import SaveGameUI from '../../domUI/saveGameUI.js';
import LoadGameUI from '../../domUI/loadGameUI.js';
import { PortraitModalRenderer } from '../../domUI/portraitModalRenderer.js';
import { EngineUIManager } from '../../domUI/engineUIManager.js';
import PerceptibleEventSenderController from '../../domUI/perceptibleEventSenderController.js';
import { TurnOrderTickerRenderer } from '../../domUI/turnOrderTickerRenderer.js';

// --- JSDoc Imports ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/IInputHandler.js').IInputHandler} IInputHandler */
/** @typedef {import('../../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/ISaveLoadService.js').ISaveLoadService} ISaveLoadService */
/** @typedef {import('../../entities/entityDisplayDataProvider.js').EntityDisplayDataProvider} EntityDisplayDataProvider */
/** @typedef {import('../../domUI/saveGameService.js').default} SaveGameService */

/** @typedef {import('../../turns/interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter */

/**
 * @description Registers DOM references and core utilities.
 * @param {Registrar} registrar - DI registrar.
 * @param {object} uiElements - UI elements from the bootstrapper.
 * @param {HTMLElement} uiElements.outputDiv - Output container.
 * @param {HTMLInputElement} uiElements.inputElement - Input element.
 * @param {Document} uiElements.document - The global document.
 * @param {ILogger} logger - Logger instance.
 * @returns {void}
 */
export function registerDomElements(
  registrar,
  { outputDiv, inputElement, document: doc },
  logger
) {
  registerWithLog(
    registrar,
    tokens.WindowDocument,
    doc,
    { lifecycle: 'singleton', isInstance: true },
    logger
  );
  registerWithLog(
    registrar,
    tokens.outputDiv,
    outputDiv,
    { lifecycle: 'singleton', isInstance: true },
    logger
  );
  registerWithLog(
    registrar,
    tokens.inputElement,
    inputElement,
    { lifecycle: 'singleton', isInstance: true },
    logger
  );

  registerWithLog(
    registrar,
    tokens.IDocumentContext,
    (c) => new DocumentContext(c.resolve(tokens.WindowDocument)),
    { lifecycle: 'singletonFactory' },
    logger
  );

  registerWithLog(
    registrar,
    tokens.DomElementFactory,
    (c) => new DomElementFactory(c.resolve(tokens.IDocumentContext)),
    { lifecycle: 'singletonFactory' },
    logger
  );

  registerWithLog(
    registrar,
    tokens.IUserPrompt,
    () => new WindowUserPrompt(),
    { lifecycle: 'singletonFactory' },
    logger
  );

  registerWithLog(
    registrar,
    tokens.AlertRouter,
    AlertRouter,
    { lifecycle: 'singleton', dependencies: [tokens.ISafeEventDispatcher] },
    logger
  );
}

/**
 * @description Registers renderer components.
 * @param {Registrar} registrar - DI registrar.
 * @param {ILogger} logger - Logger instance.
 * @returns {void}
 */
export function registerRenderers(registrar, logger) {
  registerWithLog(
    registrar,
    tokens.PortraitModalRenderer,
    (c) =>
      new PortraitModalRenderer({
        documentContext: c.resolve(tokens.IDocumentContext),
        domElementFactory: c.resolve(tokens.DomElementFactory),
        logger: c.resolve(tokens.ILogger),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );
  registerWithLog(
    registrar,
    tokens.SpeechBubbleRenderer,
    SpeechBubbleRenderer,
    {
      lifecycle: 'singleton',
      dependencies: [
        tokens.ILogger,
        tokens.IDocumentContext,
        tokens.IValidatedEventDispatcher,
        tokens.IEntityManager,
        tokens.DomElementFactory,
        tokens.EntityDisplayDataProvider,
        tokens.PortraitModalRenderer,
      ],
    },
    logger
  );

  registerWithLog(
    registrar,
    tokens.LocationRenderer,
    (c) => {
      const docContext = c.resolve(tokens.IDocumentContext);
      const resolvedLogger = c.resolve(tokens.ILogger);
      const locationContainer = docContext.query('#location-info-container');
      if (!locationContainer) {
        resolvedLogger.warn(
          `UI Registrations: Could not find '#location-info-container' element for LocationRenderer. Location details may not render.`
        );
      }
      return new LocationRenderer({
        logger: resolvedLogger,
        documentContext: docContext,
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        domElementFactory: c.resolve(tokens.DomElementFactory),
        entityManager: c.resolve(tokens.IEntityManager),
        entityDisplayDataProvider: c.resolve(tokens.EntityDisplayDataProvider),
        dataRegistry: c.resolve(tokens.IDataRegistry),
        containerElement: locationContainer,
      });
    },
    { lifecycle: 'singletonFactory' },
    logger
  );

  registerWithLog(
    registrar,
    tokens.ActionButtonsRenderer,
    (c) =>
      new ActionButtonsRenderer({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        domElementFactory: c.resolve(tokens.DomElementFactory),
        actionButtonsContainerSelector: '#action-buttons',
        sendButtonSelector: '#player-confirm-turn-button',
        actionCategorizationService: c.resolve(
          tokens.IActionCategorizationService
        ),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );

  registerWithLog(
    registrar,
    tokens.PerceptionLogRenderer,
    (c) =>
      new PerceptionLogRenderer({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        domElementFactory: c.resolve(tokens.DomElementFactory),
        entityManager: c.resolve(tokens.IEntityManager),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );

  // EntityLifecycleMonitor - DISABLED FOR PERFORMANCE
  // registerWithLog(
  //   registrar,
  //   tokens.EntityLifecycleMonitor,
  //   (c) =>
  //     new EntityLifecycleMonitor({
  //       logger: c.resolve(tokens.ILogger),
  //       documentContext: c.resolve(tokens.IDocumentContext),
  //       validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
  //       domElementFactory: c.resolve(tokens.DomElementFactory),
  //       entityManager: c.resolve(tokens.IEntityManager),
  //     }),
  //   { lifecycle: 'singletonFactory' },
  //   logger
  // );

  registerWithLog(
    registrar,
    tokens.SaveGameService,
    (c) =>
      new SaveGameService({
        logger: c.resolve(tokens.ILogger),
        userPrompt: c.resolve(tokens.IUserPrompt),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );

  registerWithLog(
    registrar,
    tokens.SaveGameUI,
    (c) =>
      new SaveGameUI({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        domElementFactory: c.resolve(tokens.DomElementFactory),
        saveLoadService: c.resolve(tokens.ISaveLoadService),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        saveGameService: c.resolve(tokens.SaveGameService),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );

  registerWithLog(
    registrar,
    tokens.LoadGameUI,
    (c) =>
      new LoadGameUI({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        domElementFactory: c.resolve(tokens.DomElementFactory),
        saveLoadService: c.resolve(tokens.ISaveLoadService),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        userPrompt: c.resolve(tokens.IUserPrompt),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );

  registerWithLog(
    registrar,
    tokens.LlmSelectionModal,
    (c) =>
      new LlmSelectionModal({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        domElementFactory: c.resolve(tokens.DomElementFactory),
        llmAdapter: c.resolve(tokens.LLMAdapter),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );

  registerWithLog(
    registrar,
    tokens.CurrentTurnActorRenderer,
    (c) =>
      new CurrentTurnActorRenderer({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        entityManager: c.resolve(tokens.IEntityManager),
        entityDisplayDataProvider: c.resolve(tokens.EntityDisplayDataProvider),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );

  registerWithLog(
    registrar,
    tokens.ChatAlertRenderer,
    (c) =>
      new ChatAlertRenderer({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        domElementFactory: c.resolve(tokens.DomElementFactory),
        alertRouter: c.resolve(tokens.AlertRouter),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );

  registerWithLog(
    registrar,
    tokens.ActionResultRenderer,
    (c) =>
      new ActionResultRenderer({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        domElementFactory: c.resolve(tokens.DomElementFactory),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );

  registerWithLog(
    registrar,
    tokens.TurnOrderTickerRenderer,
    (c) => {
      const docContext = c.resolve(tokens.IDocumentContext);
      const resolvedLogger = c.resolve(tokens.ILogger);

      // Query ticker container element
      const tickerContainerElement = docContext.query('#turn-order-ticker');

      if (!tickerContainerElement) {
        resolvedLogger.error(
          'UI Registrations: Could not find #turn-order-ticker element for TurnOrderTickerRenderer.'
        );
        throw new Error('Required DOM element #turn-order-ticker not found');
      }

      return new TurnOrderTickerRenderer({
        logger: resolvedLogger,
        documentContext: docContext,
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        domElementFactory: c.resolve(tokens.DomElementFactory),
        entityManager: c.resolve(tokens.IEntityManager),
        entityDisplayDataProvider: c.resolve(tokens.EntityDisplayDataProvider),
        tickerContainerElement,
      });
    },
    { lifecycle: 'singletonFactory' },
    logger
  );

  registerWithLog(
    registrar,
    tokens.InjuryStatusPanel,
    (c) =>
      new InjuryStatusPanel({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        injuryAggregationService: c.resolve(tokens.InjuryAggregationService),
        injuryNarrativeFormatterService: c.resolve(
          tokens.InjuryNarrativeFormatterService
        ),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );

  registerWithLog(
    registrar,
    tokens.DamageEventMessageRenderer,
    (c) =>
      new DamageEventMessageRenderer({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        domElementFactory: c.resolve(tokens.DomElementFactory),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );

  registerWithLog(
    registrar,
    tokens.PromptPreviewModal,
    (c) =>
      new PromptPreviewModal({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        domElementFactory: c.resolve(tokens.DomElementFactory),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );
}

/**
 * @description Registers controller components.
 * @param {Registrar} registrar
 * @param {ILogger} logger
 * @returns {void}
 */
export function registerControllers(registrar, logger) {
  registerWithLog(
    registrar,
    tokens.InputStateController,
    (c) =>
      new InputStateController({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        inputElement: c.resolve(tokens.inputElement),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );

  registerWithLog(
    registrar,
    tokens.ActorParticipationController,
    (c) =>
      new ActorParticipationController({
        eventBus: c.resolve(tokens.ISafeEventDispatcher),
        documentContext: c.resolve(tokens.IDocumentContext),
        logger: c.resolve(tokens.ILogger),
        entityManager: c.resolve(tokens.IEntityManager),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );

  registerWithLog(
    registrar,
    tokens.PerceptibleEventSenderController,
    (c) =>
      new PerceptibleEventSenderController({
        eventBus: c.resolve(tokens.ISafeEventDispatcher),
        documentContext: c.resolve(tokens.IDocumentContext),
        logger: c.resolve(tokens.ILogger),
        entityManager: c.resolve(tokens.IEntityManager),
        operationInterpreter: c.resolve(tokens.OperationInterpreter),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );

  registerWithLog(
    registrar,
    tokens.ProcessingIndicatorController,
    (c) =>
      new ProcessingIndicatorController({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        domElementFactory: c.resolve(tokens.DomElementFactory),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );

  registerWithLog(
    registrar,
    tokens.VisualizerState,
    (c) =>
      new VisualizerState({
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );

  registerWithLog(
    registrar,
    tokens.AnatomyLoadingDetector,
    (c) =>
      new AnatomyLoadingDetector({
        entityManager: c.resolve(tokens.IEntityManager),
        eventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );

  registerWithLog(
    registrar,
    tokens.VisualizerStateController,
    (c) =>
      new VisualizerStateController({
        visualizerState: c.resolve(tokens.VisualizerState),
        anatomyLoadingDetector: c.resolve(tokens.AnatomyLoadingDetector),
        eventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        entityManager: c.resolve(tokens.IEntityManager),
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );
}

/**
 * @description Registers the DomUiFacade and EngineUIManager.
 * @param {Registrar} registrar - DI registrar.
 * @param {ILogger} logger - Logger instance.
 * @returns {void}
 */
export function registerFacadeAndManager(registrar, logger) {
  registerWithLog(
    registrar,
    tokens.DomUiFacade,
    DomUiFacade,
    {
      lifecycle: 'singleton',
      dependencies: [
        tokens.ActionButtonsRenderer,
        tokens.ActionResultRenderer,
        tokens.LocationRenderer,
        tokens.InputStateController,
        tokens.SpeechBubbleRenderer,
        tokens.PerceptionLogRenderer,
        tokens.SaveGameUI,
        tokens.LoadGameUI,
        tokens.LlmSelectionModal,
        tokens.TurnOrderTickerRenderer,
        tokens.InjuryStatusPanel,
        tokens.PromptPreviewModal,
        // tokens.EntityLifecycleMonitor, // DISABLED FOR PERFORMANCE
      ],
    },
    logger
  );

  registerWithLog(
    registrar,
    tokens.EngineUIManager,
    (c) =>
      new EngineUIManager({
        eventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        domUiFacade: c.resolve(tokens.DomUiFacade),
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );
}

/**
 * @description Registers the legacy input handler.
 * @param {Registrar} registrar
 * @param {ILogger} logger
 * @returns {void}
 */
export function registerLegacyInputHandler(registrar, logger) {
  registrar.singletonFactory(
    tokens.IInputHandler,
    (c) =>
      new InputHandler(
        c.resolve(tokens.inputElement),
        undefined,
        c.resolve(tokens.IValidatedEventDispatcher),
        {
          document: c.resolve(tokens.WindowDocument),
          logger: c.resolve(tokens.ILogger),
        }
      )
  );
  logger.debug(
    `UI Registrations: Registered ${tokens.IInputHandler} (legacy) with VED.`
  );
}

/**
 * Registers UI-specific dependencies after the DomRenderer refactor.
 *
 * @export
 * @param {AppContainer} container - The application's DI container.
 * @param {object} uiElements - An object containing references to essential UI elements passed from bootstrap.
 * @param {HTMLElement} uiElements.outputDiv - The main output area element.
 * @param {HTMLInputElement} uiElements.inputElement - The user command input element.
 * @param {Document} uiElements.document - The global document object.
 */
export function registerUI(
  container,
  { outputDiv, inputElement, document: doc }
) {
  const registrar = new Registrar(container);
  /** @type {ILogger} */
  const logger = container.resolve(tokens.ILogger);
  logger.debug('UI Registrations: Starting (Refactored DOM UI)...');

  registerDomElements(
    registrar,
    { outputDiv, inputElement, document: doc },
    logger
  );
  registerRenderers(registrar, logger);
  registerControllers(registrar, logger);
  registerFacadeAndManager(registrar, logger);
  registerLegacyInputHandler(registrar, logger);

  // --- 6. Eagerly instantiate ChatAlertRenderer to ensure it subscribes to events on startup ---
  container.resolve(tokens.ChatAlertRenderer);
  logger.debug(
    `UI Registrations: Eagerly instantiated ${tokens.ChatAlertRenderer} to attach listeners.`
  );

  container.resolve(tokens.ActionResultRenderer);
  logger.debug(
    `UI Registrations: Eagerly instantiated ${tokens.ActionResultRenderer}.`
  );

  container.resolve(tokens.InjuryStatusPanel);
  logger.debug(
    `UI Registrations: Eagerly instantiated ${tokens.InjuryStatusPanel}.`
  );

  container.resolve(tokens.DamageEventMessageRenderer);
  logger.debug(
    `UI Registrations: Eagerly instantiated ${tokens.DamageEventMessageRenderer}.`
  );

  logger.debug('UI Registrations: Complete.');
}

// --- FILE END ---
