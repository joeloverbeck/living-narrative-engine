// Filename: src/core/config/registrations/uiRegistrations.js
// ****** CORRECTED FILE ******

/**
 * @fileoverview Registers UI-related services and dependencies with the AppContainer.
 */

// --- Core & Service Imports ---
import {tokens} from '../tokens.js';
import {Registrar} from '../registrarHelpers.js';
import InputHandler from '../../inputHandler.js'; // Concrete Class Import

// --- NEW DOM UI Imports ---
import {UiMessageRenderer} from '../../../domUI/index.js';
import DomElementFactory from '../../../domUI/domElementFactory.js';
import BrowserDocumentContext from '../../../domUI/documentContext.js';

// --- OLD Imports ---
// VVVVVV ADDED IMPORT VVVVVV
import DomRenderer from '../../../domUI/domRenderer.js'; // Import the old DomRenderer
// ^^^^^^ ADDED IMPORT ^^^^^^

// --- JSDoc Imports ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../eventBus.js').default} EventBus */
/** @typedef {import('../../interfaces/IInputHandler.js').IInputHandler} IInputHandler */

/** @typedef {import('../../../domUI/IDocumentContext').IDocumentContext} IDocumentContext */

/**
 * Registers UI-specific dependencies.
 *
 * @export
 * @param {AppContainer} container - The application's DI container.
 * @param {object} uiElements - An object containing references to essential UI elements.
 * @param {HTMLElement} uiElements.outputDiv - The main output area element. // Added
 * @param {HTMLInputElement} uiElements.inputElement - The user command input element.
 * @param {HTMLElement} uiElements.titleElement - The title display element. // Added
 * @param {Document} uiElements.document - The global document object.
 */
// VVVVVV MODIFIED SIGNATURE VVVVVV
export function registerUI(container, {outputDiv, inputElement, titleElement, document: doc}) { // Added outputDiv, titleElement
// ^^^^^^ MODIFIED SIGNATURE ^^^^^^
    const registrar = new Registrar(container);
    /** @type {ILogger} */
    const logger = container.resolve(tokens.ILogger);
    logger.info('UI Registrations: Starting...');

    // --- 0. Register External Dependencies (DOM elements / document) ---
    // Registering the document itself for BrowserDocumentContext.
    registrar.instance(tokens.WindowDocument, doc);
    logger.info('UI Registrations: Registered window.document instance.');

    // VVVVVV ADDED REGISTRATIONS VVVVVV
    // Register direct element references needed by OLD DomRenderer and InputHandler
    registrar.instance(tokens.outputDiv, outputDiv);
    registrar.instance(tokens.inputElement, inputElement);
    registrar.instance(tokens.titleElement, titleElement);
    logger.info('UI Registrations: Registered direct DOM element instances (outputDiv, inputElement, titleElement).');
    // ^^^^^^ ADDED REGISTRATIONS ^^^^^^


    // --- NEW DOM UI Layer ---

    // 1. Document Context (Provides DOM access abstraction)
    registrar.singletonFactory(tokens.IDocumentContext, c =>
        new BrowserDocumentContext(c.resolve(tokens.WindowDocument)) // Inject the document
    );
    logger.info(`UI Registrations: Registered ${tokens.IDocumentContext}.`);

    // 2. DOM Element Factory (Utility for creating elements)
    registrar.singletonFactory(tokens.DomElementFactory, c =>
        new DomElementFactory(c.resolve(tokens.IDocumentContext)) // Depends on DocumentContext
    );
    logger.info(`UI Registrations: Registered ${tokens.DomElementFactory}.`);

    // 3. UI Message Renderer (Handles messages/echoes) - Ticket M-1.3
    // Uses single() because it's a class with dependencies passed directly to constructor
    registrar.single(tokens.UiMessageRenderer, UiMessageRenderer, [
        tokens.ILogger,                    // Dependency 1: logger
        tokens.IDocumentContext,            // Dependency 2: doc context
        tokens.IValidatedEventDispatcher,  // Dependency 3: ved
        tokens.DomElementFactory           // Dependency 4: factory
    ]);
    logger.info(`UI Registrations: Registered ${tokens.UiMessageRenderer} (using VED).`);

    // --- Register other new renderers here as they are created (e.g., TitleRenderer) ---
    // ...


    // --- OLD Input Handler ---
    // Register InputHandler against its Interface Token.
    // Assume it still needs direct element access and EventBus for now.
    registrar.singletonFactory(tokens.IInputHandler, (c) => new InputHandler(
        c.resolve(tokens.inputElement), // Direct input element
        null,
        c.resolve(tokens.EventBus)      // Assuming EventBus is registered elsewhere (e.g., infrastructure)
    ));
    logger.info(`UI Registrations: Registered InputHandler against ${tokens.IInputHandler} token.`);


    // --- OLD DomRenderer (Re-enabled temporarily for compatibility) ---
    // VVVVVV UNCOMMENTED BLOCK VVVVVV
    logger.warn('UI Registrations: Re-enabling deprecated DomRenderer registration for compatibility. Refactor ModifyDomElementHandler to remove this dependency.');
    registrar.single(tokens.DomRenderer, DomRenderer, [
        tokens.outputDiv,               // Needs direct element access
        tokens.inputElement,            // Needs direct element access
        tokens.titleElement,            // Needs direct element access
        tokens.EventBus,                // Assuming EventBus is registered elsewhere
        tokens.IValidatedEventDispatcher, // Assuming VED is registered elsewhere
        tokens.ILogger
    ]);
    logger.info('UI Registrations: Registered deprecated DomRenderer.');
    // ^^^^^^ UNCOMMENTED BLOCK ^^^^^^


    logger.info('UI Registrations: Complete.');
}