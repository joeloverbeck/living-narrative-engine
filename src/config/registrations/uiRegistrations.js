// src/core/config/registrations/uiRegistrations.js
/**
 * @fileoverview Registers UI-related services and dependencies with the AppContainer.
 * This version reflects the refactoring of DomRenderer into individual components
 * and the update of InputHandler's dependency.
 */

// --- Core & Service Imports ---
import {tokens} from '../tokens.js';
import {Registrar} from '../registrarHelpers.js';
import InputHandler from '../../input/inputHandler.js'; // Legacy Input Handler (Updated Dependency)

// --- NEW DOM UI Component Imports ---
import {
    UiMessageRenderer,
    TitleRenderer,
    InputStateController,
    LocationRenderer,
    InventoryPanel,
    ActionButtonsRenderer,
    PerceptionLogRenderer,
    DomUiFacade,
    LlmSelectionModal, // <<< ADDED IMPORT for LlmSelectionModal
    // Base utilities
    DomElementFactory,
    DocumentContext
} from '../../domUI/index.js';
import SaveGameUI from "../../domUI/saveGameUI.js";
import LoadGameUI from "../../domUI/loadGameUI.js";
import {EngineUIManager} from '../../domUI/engineUIManager.js';

// --- JSDoc Imports ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/IInputHandler.js').IInputHandler} IInputHandler */
/** @typedef {import('../../domUI/IDocumentContext.js').IDocumentContext} IDocumentContext */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/IDataRegistry.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/ISaveLoadService.js').ISaveLoadService} ISaveLoadService */
/** @typedef {import('../../turns/interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter */ // <<< ADDED for LlmSelectionModal


/**
 * Registers UI-specific dependencies after the DomRenderer refactor.
 * - Registers individual renderers/controllers.
 * - Registers the DomUiFacade under its own token.
 * - Registers the InputHandler with its updated dependency.
 * - Registers the new EngineUIManager.
 * - Registers the LlmSelectionModal. // <<< ADDED
 *
 * @export
 * @param {AppContainer} container - The application's DI container.
 * @param {object} uiElements - An object containing references to essential UI elements passed from bootstrap.
 * @param {HTMLElement} uiElements.outputDiv - The main output area element.
 * @param {HTMLInputElement} uiElements.inputElement - The user command input element.
 * @param {HTMLElement} uiElements.titleElement - The title display element.
 * @param {Document} uiElements.document - The global document object.
 */
export function registerUI(container, {outputDiv, inputElement, titleElement, document: doc}) {
    const registrar = new Registrar(container);
    /** @type {ILogger} */
    const logger = container.resolve(tokens.ILogger);
    logger.info('UI Registrations: Starting (Refactored DOM UI)...');

    // --- 0. Register External Dependencies (DOM elements / document passed from bootstrap) ---
    registrar.instance(tokens.WindowDocument, doc);
    logger.debug('UI Registrations: Registered window.document instance.');
    registrar.instance(tokens.outputDiv, outputDiv);
    logger.debug('UI Registrations: Registered outputDiv instance.');
    registrar.instance(tokens.inputElement, inputElement);
    logger.debug('UI Registrations: Registered inputElement instance.');
    registrar.instance(tokens.titleElement, titleElement);
    logger.debug('UI Registrations: Registered titleElement instance.');

    // --- 1. Register Core UI Utilities ---
    registrar.singletonFactory(tokens.IDocumentContext, c =>
        new DocumentContext(c.resolve(tokens.WindowDocument))
    );
    logger.debug(`UI Registrations: Registered ${tokens.IDocumentContext}.`);

    registrar.singletonFactory(tokens.DomElementFactory, c =>
        new DomElementFactory(c.resolve(tokens.IDocumentContext))
    );
    logger.debug(`UI Registrations: Registered ${tokens.DomElementFactory}.`);

    // --- 2. Register Individual Renderers / Controllers / Services ---

    // UiMessageRenderer
    registrar.single(tokens.UiMessageRenderer, UiMessageRenderer, [
        tokens.ILogger,
        tokens.IDocumentContext,
        tokens.IValidatedEventDispatcher,
        tokens.DomElementFactory
    ]);
    logger.debug(`UI Registrations: Registered ${tokens.UiMessageRenderer}.`);

    // TitleRenderer
    registrar.singletonFactory(tokens.TitleRenderer, c => new TitleRenderer({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        titleElement: c.resolve(tokens.titleElement)
    }));
    logger.debug(`UI Registrations: Registered ${tokens.TitleRenderer}.`);

    // InputStateController
    registrar.singletonFactory(tokens.InputStateController, c => new InputStateController({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        inputElement: c.resolve(tokens.inputElement)
    }));
    logger.debug(`UI Registrations: Registered ${tokens.InputStateController}.`);

    // LocationRenderer
    registrar.singletonFactory(tokens.LocationRenderer, c => {
        const docContext = c.resolve(tokens.IDocumentContext);
        const resolvedLogger = c.resolve(tokens.ILogger);
        const locationContainer = docContext.query('#location-info-container');
        if (!locationContainer) {
            resolvedLogger.warn(`UI Registrations: Could not find '#location-info-container' element for LocationRenderer. Location details may not render.`);
        }
        return new LocationRenderer({
            logger: resolvedLogger,
            documentContext: docContext,
            validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
            domElementFactory: c.resolve(tokens.DomElementFactory),
            entityManager: c.resolve(tokens.IEntityManager),
            dataRegistry: c.resolve(tokens.IDataRegistry),
            containerElement: locationContainer
        });
    });
    logger.debug(`UI Registrations: Registered ${tokens.LocationRenderer} with IEntityManager and IDataRegistry.`);

    // InventoryPanel
    registrar.singletonFactory(tokens.InventoryPanel, c => {
        const docContext = c.resolve(tokens.IDocumentContext);
        const resolvedLogger = c.resolve(tokens.ILogger);
        const inventoryWidgetContainer = docContext.query('#inventory-widget');
        if (!inventoryWidgetContainer) {
            resolvedLogger.warn(`UI Registrations: Could not find '#inventory-widget' element for InventoryPanel. Panel might not attach correctly.`);
        }
        return new InventoryPanel({
            logger: resolvedLogger,
            documentContext: docContext,
            validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
            domElementFactory: c.resolve(tokens.DomElementFactory),
            containerElement: inventoryWidgetContainer
        });
    });
    logger.debug(`UI Registrations: Registered ${tokens.InventoryPanel}.`);

    // ActionButtonsRenderer
    registrar.singletonFactory(tokens.ActionButtonsRenderer, c => {
        const docContext = c.resolve(tokens.IDocumentContext);
        const resolvedLogger = c.resolve(tokens.ILogger);
        const buttonsContainer = docContext.query('#action-buttons');
        const sendButton = docContext.query('#player-confirm-turn-button');

        if (!buttonsContainer) {
            resolvedLogger.warn(`UI Registrations: Could not find '#action-buttons' element for ActionButtonsRenderer. Buttons will not be rendered.`);
        }

        return new ActionButtonsRenderer({
            logger: resolvedLogger,
            documentContext: docContext,
            validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
            domElementFactory: c.resolve(tokens.DomElementFactory),
            actionButtonsContainer: buttonsContainer,
            sendButtonElement: sendButton
        });
    });
    logger.debug(`UI Registrations: Registered ${tokens.ActionButtonsRenderer}.`);

    // PerceptionLogRenderer
    registrar.singletonFactory(tokens.PerceptionLogRenderer, c => {
        const resolvedLogger = c.resolve(tokens.ILogger);
        return new PerceptionLogRenderer({
            logger: resolvedLogger,
            documentContext: c.resolve(tokens.IDocumentContext),
            validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
            domElementFactory: c.resolve(tokens.DomElementFactory),
            entityManager: c.resolve(tokens.IEntityManager)
        });
    });
    logger.debug(`UI Registrations: Registered ${tokens.PerceptionLogRenderer}.`);

    // SaveGameUI
    registrar.singletonFactory(tokens.SaveGameUI, c => new SaveGameUI({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        domElementFactory: c.resolve(tokens.DomElementFactory),
        saveLoadService: c.resolve(tokens.ISaveLoadService)
    }));
    logger.debug(`UI Registrations: Registered ${tokens.SaveGameUI}.`);

    // LoadGameUI
    registrar.singletonFactory(tokens.LoadGameUI, c => new LoadGameUI({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        domElementFactory: c.resolve(tokens.DomElementFactory),
        saveLoadService: c.resolve(tokens.ISaveLoadService)
    }));
    logger.debug(`UI Registrations: Registered ${tokens.LoadGameUI}.`);

    // LlmSelectionModal <<< NEW REGISTRATION
    registrar.singletonFactory(tokens.LlmSelectionModal, c => new LlmSelectionModal({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        domElementFactory: c.resolve(tokens.DomElementFactory),
        llmAdapter: c.resolve(tokens.ILLMAdapter) // Assuming ILLMAdapter is registered
    }));
    logger.debug(`UI Registrations: Registered ${tokens.LlmSelectionModal}.`);


    // --- 3. Register Facade ---
    registrar.single(tokens.DomUiFacade, DomUiFacade, [
        tokens.ActionButtonsRenderer,
        tokens.InventoryPanel,
        tokens.LocationRenderer,
        tokens.TitleRenderer,
        tokens.InputStateController,
        tokens.UiMessageRenderer,
        tokens.PerceptionLogRenderer,
        tokens.SaveGameUI,
        tokens.LoadGameUI,
        tokens.LlmSelectionModal // <<< ADDED LlmSelectionModal to facade dependencies
    ]);
    logger.info(`UI Registrations: Registered ${tokens.DomUiFacade} under its own token.`);

    // --- 4. Register Engine UI Manager ---
    registrar.singletonFactory(tokens.EngineUIManager, c => new EngineUIManager({
        eventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        domUiFacade: c.resolve(tokens.DomUiFacade),
        logger: c.resolve(tokens.ILogger)
    }));
    logger.info(`UI Registrations: Registered ${tokens.EngineUIManager}.`);


    // --- 5. Legacy Input Handler (Dependency Updated) ---
    registrar.singletonFactory(tokens.IInputHandler, (c) => new InputHandler(
        c.resolve(tokens.inputElement),
        undefined,
        c.resolve(tokens.IValidatedEventDispatcher)
    ));
    logger.debug(`UI Registrations: Registered ${tokens.IInputHandler} (legacy) with VED.`);

    logger.info('UI Registrations: Complete.');
}

// --- FILE END ---