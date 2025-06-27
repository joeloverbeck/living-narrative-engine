// src/dependencyInjection/registrations/uiRegistrations.js
// --- FILE START ---
/**
 * @file Registers UI-related services and dependencies with the AppContainer.
 * This version reflects the refactoring of DomRenderer into individual components
 * and the update of InputHandler's dependency.
 */

// --- Core & Service Imports ---
import { tokens } from '../tokens.js';
import { Registrar } from '../registrarHelpers.js';
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
  registrar.instance(tokens.WindowDocument, doc);
  logger.debug('UI Registrations: Registered window.document instance.');
  registrar.instance(tokens.outputDiv, outputDiv);
  logger.debug('UI Registrations: Registered outputDiv instance.');
  registrar.instance(tokens.inputElement, inputElement);
  logger.debug('UI Registrations: Registered inputElement instance.');
  registrar.instance(tokens.titleElement, titleElement);
  logger.debug('UI Registrations: Registered titleElement instance.');

  registrar.singletonFactory(
    tokens.IDocumentContext,
    (c) => new DocumentContext(c.resolve(tokens.WindowDocument))
  );
  logger.debug(`UI Registrations: Registered ${tokens.IDocumentContext}.`);

  registrar.singletonFactory(
    tokens.DomElementFactory,
    (c) => new DomElementFactory(c.resolve(tokens.IDocumentContext))
  );
  logger.debug(`UI Registrations: Registered ${tokens.DomElementFactory}.`);

  registrar.singletonFactory(tokens.IUserPrompt, () => new WindowUserPrompt());
  logger.debug(`UI Registrations: Registered ${tokens.IUserPrompt}.`);

  registrar.single(tokens.AlertRouter, AlertRouter, [
    tokens.ISafeEventDispatcher,
  ]);
  logger.debug(`UI Registrations: Registered ${tokens.AlertRouter}.`);
}

/**
 * @description Registers renderer components.
 * @param {Registrar} registrar - DI registrar.
 * @param {ILogger} logger - Logger instance.
 * @returns {void}
 */
export function registerRenderers(registrar, logger) {
  registrar.single(tokens.SpeechBubbleRenderer, SpeechBubbleRenderer, [
    tokens.ILogger,
    tokens.IDocumentContext,
    tokens.IValidatedEventDispatcher,
    tokens.IEntityManager,
    tokens.DomElementFactory,
    tokens.EntityDisplayDataProvider,
  ]);
  logger.debug(`UI Registrations: Registered ${tokens.SpeechBubbleRenderer}.`);

  registrar.singletonFactory(
    tokens.TitleRenderer,
    (c) =>
      new TitleRenderer({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        titleElement: c.resolve(tokens.titleElement),
      })
  );
  logger.debug(`UI Registrations: Registered ${tokens.TitleRenderer}.`);

  registrar.singletonFactory(tokens.LocationRenderer, (c) => {
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
  });
  logger.debug(
    `UI Registrations: Registered ${tokens.LocationRenderer} with IEntityManager, IDataRegistry, and EntityDisplayDataProvider.`
  );

  registrar.singletonFactory(
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
  logger.debug(`UI Registrations: Registered ${tokens.ActionButtonsRenderer}.`);

  registrar.singletonFactory(
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
  logger.debug(`UI Registrations: Registered ${tokens.PerceptionLogRenderer}.`);

  registrar.singletonFactory(
    tokens.EntityLifecycleMonitor,
    (c) =>
      new EntityLifecycleMonitor({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        domElementFactory: c.resolve(tokens.DomElementFactory),
      })
  );
  logger.debug(
    `UI Registrations: Registered ${tokens.EntityLifecycleMonitor}.`
  );

  registrar.singletonFactory(
    tokens.SaveGameService,
    (c) =>
      new SaveGameService({
        logger: c.resolve(tokens.ILogger),
        userPrompt: c.resolve(tokens.IUserPrompt),
      })
  );
  logger.debug(`UI Registrations: Registered ${tokens.SaveGameService}.`);

  registrar.singletonFactory(
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
  logger.debug(`UI Registrations: Registered ${tokens.SaveGameUI}.`);

  registrar.singletonFactory(
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
  logger.debug(`UI Registrations: Registered ${tokens.LoadGameUI}.`);

  registrar.singletonFactory(
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
  logger.debug(`UI Registrations: Registered ${tokens.LlmSelectionModal}.`);

  registrar.singletonFactory(
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
  logger.debug(
    `UI Registrations: Registered ${tokens.CurrentTurnActorRenderer}.`
  );

  registrar.singletonFactory(
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
  logger.debug(`UI Registrations: Registered ${tokens.ChatAlertRenderer}.`);

  registrar.singletonFactory(
    tokens.ActionResultRenderer,
    (c) =>
      new ActionResultRenderer({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        domElementFactory: c.resolve(tokens.DomElementFactory),
      })
  );
  logger.debug(`UI Registrations: Registered ${tokens.ActionResultRenderer}.`);
}

/**
 * @description Registers controller components.
 * @param {Registrar} registrar
 * @param {ILogger} logger
 * @returns {void}
 */
export function registerControllers(registrar, logger) {
  registrar.singletonFactory(
    tokens.InputStateController,
    (c) =>
      new InputStateController({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        inputElement: c.resolve(tokens.inputElement),
      })
  );
  logger.debug(`UI Registrations: Registered ${tokens.InputStateController}.`);

  registrar.singletonFactory(
    tokens.GlobalKeyHandler,
    (c) =>
      new GlobalKeyHandler(
        c.resolve(tokens.WindowDocument),
        c.resolve(tokens.IValidatedEventDispatcher)
      )
  );
  logger.debug(`UI Registrations: Registered ${tokens.GlobalKeyHandler}.`);

  registrar.singletonFactory(
    tokens.ProcessingIndicatorController,
    (c) =>
      new ProcessingIndicatorController({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        domElementFactory: c.resolve(tokens.DomElementFactory),
      })
  );
  logger.debug(
    `UI Registrations: Registered ${tokens.ProcessingIndicatorController}.`
  );
}

/**
 * @description Registers the DomUiFacade and EngineUIManager.
 * @param {Registrar} registrar - DI registrar.
 * @param {ILogger} logger - Logger instance.
 * @returns {void}
 */
export function registerFacadeAndManager(registrar, logger) {
  registrar.single(tokens.DomUiFacade, DomUiFacade, [
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
  ]);
  logger.debug(
    `UI Registrations: Registered ${tokens.DomUiFacade} under its own token.`
  );

  registrar.singletonFactory(
    tokens.EngineUIManager,
    (c) =>
      new EngineUIManager({
        eventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        domUiFacade: c.resolve(tokens.DomUiFacade),
        logger: c.resolve(tokens.ILogger),
      })
  );
  logger.debug(`UI Registrations: Registered ${tokens.EngineUIManager}.`);
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
        c.resolve(tokens.IValidatedEventDispatcher)
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
