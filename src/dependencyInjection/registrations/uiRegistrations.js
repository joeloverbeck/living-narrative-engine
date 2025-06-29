// src/dependencyInjection/registrations/uiRegistrations.js
// --- FILE START ---
/**
 * @file Registers UI-related services and dependencies with the AppContainer.
 * This version reflects the refactoring of DomRenderer into individual components
 * and the update of InputHandler's dependency.
 */

// --- Core & Service Imports ---
import { tokens } from '../tokens.js';
import { Registrar, registerWithLog } from '../../utils/registrarHelpers.js';
import InputHandler from '../../input/inputHandler.js'; // Legacy Input Handler (Updated Dependency)
import GlobalKeyHandler from '../../input/globalKeyHandler.js';
import AlertRouter from '../../alerting/alertRouter.js';

// --- NEW DOM UI Component Imports ---
import {
  SpeechBubbleRenderer,
  TitleRenderer,
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
} from '../../domUI/index.js';
import SaveGameUI from '../../domUI/saveGameUI.js';
import LoadGameUI from '../../domUI/loadGameUI.js';
import { EngineUIManager } from '../../domUI'; // Corrected import path if EngineUIManager is also in domUI/index.js or directly from its file

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
 * @param {HTMLElement} uiElements.titleElement - Title element.
 * @param {Document} uiElements.document - The global document.
 * @param {ILogger} logger - Logger instance.
 * @returns {void}
 */
export function registerDomElements(
  registrar,
  { outputDiv, inputElement, titleElement, document: doc },
  logger
) {
  registerWithLog(registrar, logger, 'instance', tokens.WindowDocument, doc);
  registerWithLog(registrar, logger, 'instance', tokens.outputDiv, outputDiv);
  registerWithLog(
    registrar,
    logger,
    'instance',
    tokens.inputElement,
    inputElement
  );
  registerWithLog(
    registrar,
    logger,
    'instance',
    tokens.titleElement,
    titleElement
  );

  registerWithLog(
    registrar,
    logger,
    'singletonFactory',
    tokens.IDocumentContext,
    (c) => new DocumentContext(c.resolve(tokens.WindowDocument))
  );

  registerWithLog(
    registrar,
    logger,
    'singletonFactory',
    tokens.DomElementFactory,
    (c) => new DomElementFactory(c.resolve(tokens.IDocumentContext))
  );

  registerWithLog(
    registrar,
    logger,
    'singletonFactory',
    tokens.IUserPrompt,
    () => new WindowUserPrompt()
  );

  registerWithLog(
    registrar,
    logger,
    'single',
    tokens.AlertRouter,
    AlertRouter,
    [tokens.ISafeEventDispatcher]
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
    logger,
    'single',
    tokens.SpeechBubbleRenderer,
    SpeechBubbleRenderer,
    [
      tokens.ILogger,
      tokens.IDocumentContext,
      tokens.IValidatedEventDispatcher,
      tokens.IEntityManager,
      tokens.DomElementFactory,
      tokens.EntityDisplayDataProvider,
    ]
  );

  registerWithLog(
    registrar,
    logger,
    'singletonFactory',
    tokens.TitleRenderer,
    (c) =>
      new TitleRenderer({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        titleElement: c.resolve(tokens.titleElement),
      })
  );

  registerWithLog(
    registrar,
    logger,
    'singletonFactory',
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
    }
  );

  registerWithLog(
    registrar,
    logger,
    'singletonFactory',
    tokens.ActionButtonsRenderer,
    (c) =>
      new ActionButtonsRenderer({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        domElementFactory: c.resolve(tokens.DomElementFactory),
        actionButtonsContainerSelector: '#action-buttons',
        sendButtonSelector: '#player-confirm-turn-button',
      })
  );

  registerWithLog(
    registrar,
    logger,
    'singletonFactory',
    tokens.PerceptionLogRenderer,
    (c) =>
      new PerceptionLogRenderer({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        domElementFactory: c.resolve(tokens.DomElementFactory),
        entityManager: c.resolve(tokens.IEntityManager),
      })
  );

  registerWithLog(
    registrar,
    logger,
    'singletonFactory',
    tokens.EntityLifecycleMonitor,
    (c) =>
      new EntityLifecycleMonitor({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        domElementFactory: c.resolve(tokens.DomElementFactory),
      })
  );

  registerWithLog(
    registrar,
    logger,
    'singletonFactory',
    tokens.SaveGameService,
    (c) =>
      new SaveGameService({
        logger: c.resolve(tokens.ILogger),
        userPrompt: c.resolve(tokens.IUserPrompt),
      })
  );

  registerWithLog(
    registrar,
    logger,
    'singletonFactory',
    tokens.SaveGameUI,
    (c) =>
      new SaveGameUI({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        domElementFactory: c.resolve(tokens.DomElementFactory),
        saveLoadService: c.resolve(tokens.ISaveLoadService),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        saveGameService: c.resolve(tokens.SaveGameService),
      })
  );

  registerWithLog(
    registrar,
    logger,
    'singletonFactory',
    tokens.LoadGameUI,
    (c) =>
      new LoadGameUI({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        domElementFactory: c.resolve(tokens.DomElementFactory),
        saveLoadService: c.resolve(tokens.ISaveLoadService),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        userPrompt: c.resolve(tokens.IUserPrompt),
      })
  );

  registerWithLog(
    registrar,
    logger,
    'singletonFactory',
    tokens.LlmSelectionModal,
    (c) =>
      new LlmSelectionModal({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        domElementFactory: c.resolve(tokens.DomElementFactory),
        llmAdapter: c.resolve(tokens.LLMAdapter),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
      })
  );

  registerWithLog(
    registrar,
    logger,
    'singletonFactory',
    tokens.CurrentTurnActorRenderer,
    (c) =>
      new CurrentTurnActorRenderer({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        entityManager: c.resolve(tokens.IEntityManager),
        entityDisplayDataProvider: c.resolve(tokens.EntityDisplayDataProvider),
      })
  );

  registerWithLog(
    registrar,
    logger,
    'singletonFactory',
    tokens.ChatAlertRenderer,
    (c) =>
      new ChatAlertRenderer({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        domElementFactory: c.resolve(tokens.DomElementFactory),
        alertRouter: c.resolve(tokens.AlertRouter),
      })
  );

  registerWithLog(
    registrar,
    logger,
    'singletonFactory',
    tokens.ActionResultRenderer,
    (c) =>
      new ActionResultRenderer({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        domElementFactory: c.resolve(tokens.DomElementFactory),
      })
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
    logger,
    'singletonFactory',
    tokens.InputStateController,
    (c) =>
      new InputStateController({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        inputElement: c.resolve(tokens.inputElement),
      })
  );

  registerWithLog(
    registrar,
    logger,
    'singletonFactory',
    tokens.GlobalKeyHandler,
    (c) =>
      new GlobalKeyHandler(
        c.resolve(tokens.WindowDocument),
        c.resolve(tokens.IValidatedEventDispatcher)
      )
  );

  registerWithLog(
    registrar,
    logger,
    'singletonFactory',
    tokens.ProcessingIndicatorController,
    (c) =>
      new ProcessingIndicatorController({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        domElementFactory: c.resolve(tokens.DomElementFactory),
      })
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
    logger,
    'single',
    tokens.DomUiFacade,
    DomUiFacade,
    [
      tokens.ActionButtonsRenderer,
      tokens.ActionResultRenderer,
      tokens.LocationRenderer,
      tokens.TitleRenderer,
      tokens.InputStateController,
      tokens.SpeechBubbleRenderer,
      tokens.PerceptionLogRenderer,
      tokens.SaveGameUI,
      tokens.LoadGameUI,
      tokens.LlmSelectionModal,
      tokens.EntityLifecycleMonitor,
    ]
  );

  registerWithLog(
    registrar,
    logger,
    'singletonFactory',
    tokens.EngineUIManager,
    (c) =>
      new EngineUIManager({
        eventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        domUiFacade: c.resolve(tokens.DomUiFacade),
        logger: c.resolve(tokens.ILogger),
      })
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
 * @param {HTMLElement} uiElements.titleElement - The title display element.
 * @param {Document} uiElements.document - The global document object.
 */
export function registerUI(
  container,
  { outputDiv, inputElement, titleElement, document: doc }
) {
  const registrar = new Registrar(container);
  /** @type {ILogger} */
  const logger = container.resolve(tokens.ILogger);
  logger.debug('UI Registrations: Starting (Refactored DOM UI)...');

  registerDomElements(
    registrar,
    { outputDiv, inputElement, titleElement, document: doc },
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

  container.resolve(tokens.GlobalKeyHandler);
  logger.debug(
    `UI Registrations: Eagerly instantiated ${tokens.GlobalKeyHandler}.`
  );

  logger.debug('UI Registrations: Complete.');
}

// --- FILE END ---
