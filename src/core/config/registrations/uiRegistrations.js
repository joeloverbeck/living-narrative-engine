// src/core/config/registrations/uiRegistrations.js

/**
 * @fileoverview Registers UI-related services and dependencies with the AppContainer.
 * This version reflects the refactoring of DomRenderer into individual components
 * and the update of InputHandler's dependency.
 */

// --- Core & Service Imports ---
import {tokens} from '../tokens.js';
import {Registrar} from '../registrarHelpers.js';
import InputHandler from '../../inputHandler.js'; // Legacy Input Handler (Updated Dependency)

// --- NEW DOM UI Component Imports ---
import {
    UiMessageRenderer,
    TitleRenderer,
    InputStateController,
    LocationRenderer,
    InventoryPanel,
    ActionButtonsRenderer,
    DomUiFacade,
    // Base utilities
    DomElementFactory,
    DocumentContext
} from '../../../domUI/index.js'; // Use index for cleaner imports

// --- JSDoc Imports ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../interfaces/IInputHandler.js').IInputHandler} IInputHandler */
/** @typedef {import('../../../domUI/IDocumentContext').IDocumentContext} IDocumentContext */

// REMOVED: EventBus typedef specifically for InputHandler

/**
 * Registers UI-specific dependencies after the DomRenderer refactor.
 * - Registers individual renderers/controllers.
 * - Registers the DomUiFacade under its own token.
 * - Registers the InputHandler with its updated dependency.
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

    // UiMessageRenderer (Handles messages/echoes)
    registrar.single(tokens.UiMessageRenderer, UiMessageRenderer, [
        tokens.ILogger,
        tokens.IDocumentContext,
        tokens.IValidatedEventDispatcher,
        tokens.DomElementFactory
    ]);
    logger.debug(`UI Registrations: Registered ${tokens.UiMessageRenderer}.`);

    // TitleRenderer (Manages H1 title)
    registrar.singletonFactory(tokens.TitleRenderer, c => new TitleRenderer({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        titleElement: c.resolve(tokens.titleElement) // Inject the specific H1 element
    }));
    logger.debug(`UI Registrations: Registered ${tokens.TitleRenderer}.`);

    // InputStateController (Manages input enabled/disabled state)
    registrar.singletonFactory(tokens.InputStateController, c => new InputStateController({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        inputElement: c.resolve(tokens.inputElement) // Inject the specific INPUT element
    }));
    logger.debug(`UI Registrations: Registered ${tokens.InputStateController}.`);

    // LocationRenderer (Renders location details)
    registrar.singletonFactory(tokens.LocationRenderer, c => new LocationRenderer({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        domElementFactory: c.resolve(tokens.DomElementFactory),
        containerElement: c.resolve(tokens.outputDiv) // Inject outputDiv as the container
    }));
    logger.debug(`UI Registrations: Registered ${tokens.LocationRenderer}.`);

    // InventoryPanel (Manages inventory UI)
    registrar.singletonFactory(tokens.InventoryPanel, c => {
        const docContext = c.resolve(tokens.IDocumentContext);
        const inventoryContainer = docContext.query('#game-container');
        if (!inventoryContainer) {
            logger.warn(`UI Registrations: Could not find '#game-container' element for InventoryPanel. Panel might not attach correctly.`);
        }
        return new InventoryPanel({
            logger: c.resolve(tokens.ILogger),
            documentContext: docContext,
            validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
            domElementFactory: c.resolve(tokens.DomElementFactory),
            containerElement: inventoryContainer
        });
    });
    logger.debug(`UI Registrations: Registered ${tokens.InventoryPanel}.`);

    // ActionButtonsRenderer (Renders action buttons)
    registrar.singletonFactory(tokens.ActionButtonsRenderer, c => {
        const docContext = c.resolve(tokens.IDocumentContext);
        const buttonsContainer = docContext.query('#action-buttons');
        if (!buttonsContainer) {
            logger.warn(`UI Registrations: Could not find '#action-buttons' element for ActionButtonsRenderer. Buttons will not be rendered.`);
        }
        return new ActionButtonsRenderer({
            logger: c.resolve(tokens.ILogger),
            documentContext: docContext,
            validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
            domElementFactory: c.resolve(tokens.DomElementFactory),
            actionButtonsContainer: buttonsContainer
        });
    });
    logger.debug(`UI Registrations: Registered ${tokens.ActionButtonsRenderer}.`);

    // --- 3. Register Facade ---
    registrar.single(tokens.DomUiFacade, DomUiFacade, [
        tokens.ActionButtonsRenderer,
        tokens.InventoryPanel,
        tokens.LocationRenderer,
        tokens.TitleRenderer,
        tokens.InputStateController,
        tokens.UiMessageRenderer
    ]);
    logger.info(`UI Registrations: Registered ${tokens.DomUiFacade} under its own token.`);

    // --- 4. Legacy Input Handler (Dependency Updated) ---
    // Now uses ValidatedEventDispatcher instead of EventBus.
    registrar.singletonFactory(tokens.IInputHandler, (c) => new InputHandler(
        c.resolve(tokens.inputElement),       // Direct input element
        undefined,                            // Command callback (can be set later)
        c.resolve(tokens.IValidatedEventDispatcher) // *** UPDATED DEPENDENCY ***
    ));
    // Updated warning message
    logger.warn(`UI Registrations: Registered InputHandler against ${tokens.IInputHandler} token (uses IValidatedEventDispatcher).`);

    // --- 5. Removed Registrations ---
    logger.info('UI Registrations: Deprecated registrations (DomRenderer, DomMutationService) removed.');

    logger.info('UI Registrations: Complete.');
}