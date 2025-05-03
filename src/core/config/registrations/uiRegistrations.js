// src/core/config/registrations/uiRegistrations.js

/**
 * @fileoverview Registers UI-related services and dependencies with the AppContainer.
 */

// --- Core & Service Imports ---
import {tokens} from '../tokens.js';
import {Registrar} from '../registrarHelpers.js';
import InputHandler from '../../inputHandler.js'; // Concrete Class Import

// --- NEW DOM UI Imports ---
import {UiMessageRenderer} from '../../../domUI/uiMessageRenderer.js';
import DomElementFactory from '../../../domUI/domElementFactory.js';
import BrowserDocumentContext from '../../../domUI/documentContext.js'; // Assuming Browser implementation

// --- OLD Imports (To be removed later, keep for now if needed by other parts) ---
// import DomRenderer from '../../../domUI/domRenderer.js';

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
 * @param {HTMLInputElement} uiElements.inputElement - The user command input element.
 * @param {Document} uiElements.document - The global document object. // Added for BrowserDocumentContext
 */
export function registerUI(container, {inputElement, document: doc}) { // Added document
    const registrar = new Registrar(container);
    /** @type {ILogger} */
    const logger = container.resolve(tokens.ILogger);
    logger.info('UI Registrations: Starting...');

    // --- 0. Register External Dependencies (DOM elements / document) ---
    // We might not need to register individual elements if DocumentContext handles access.
    // Registering the document itself for BrowserDocumentContext.
    registrar.instance(tokens.WindowDocument, doc); // Use a specific token like 'windowDocument'
    logger.info('UI Registrations: Registered window.document instance.');

    // Keep these if InputHandler still directly uses them
    registrar.instance(tokens.inputElement, inputElement);
    // registrar.instance(tokens.outputDiv, outputDiv); // Likely replaced by DocumentContext use
    // registrar.instance(tokens.titleElement, titleElement); // Likely replaced by DocumentContext use


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
    registrar.single(tokens.UIMessageRenderer, UiMessageRenderer, [
        tokens.ILogger,                    // Dependency 1: logger
        tokens.IDocumentContext,            // Dependency 2: doc
        tokens.IValidatedEventDispatcher,  // Dependency 3: ved (Using VED now)
        tokens.DomElementFactory           // Dependency 4: factory
    ]);
    logger.info(`UI Registrations: Registered ${tokens.UIMessageRenderer} (using VED).`);

    // --- Register other new renderers here as they are created (e.g., TitleRenderer) ---
    // registrar.single(tokens.TitleRenderer, TitleRenderer, [...deps]);
    // registrar.single(tokens.InputStateController, InputStateController, [...deps]);
    // etc.


    // --- OLD Input Handler ---
    // Register InputHandler against its Interface Token. Uses EventBus for now.
    // Dependencies: inputElement, EventBus
    registrar.singletonFactory(tokens.IInputHandler, (c) => new InputHandler(
        c.resolve(tokens.inputElement), // Still needs direct input element access
        null, // Explicitly passing null as per original code
        c.resolve(tokens.EventBus) // Still using EventBus, maybe refactor later?
    ));
    logger.info(`UI Registrations: Registered InputHandler against ${tokens.IInputHandler} token (using EventBus).`);


    // --- OLD DomRenderer (Keep registration temporarily if needed, remove eventually) ---
    // logger.warn('UI Registrations: DomRenderer registration is deprecated and will be removed.');
    // registrar.single(tokens.DomRenderer, DomRenderer, [
    //     tokens.outputDiv, // These might become documentContext lookups
    //     tokens.inputElement,
    //     tokens.titleElement,
    //     tokens.EventBus, // Still using EventBus here
    //     tokens.IValidatedEventDispatcher, // Or maybe it used VED already? Check DomRenderer ctor
    //     tokens.ILogger
    // ]);
    // logger.info('UI Registrations: Registered deprecated DomRenderer (using EventBus).');


    logger.info('UI Registrations: Complete.');
}
