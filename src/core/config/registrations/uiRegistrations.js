// src/core/config/registrations/uiRegistrations.js

/**
 * @fileoverview Registers UI-related services and dependencies with the AppContainer.
 */

import DomRenderer from '../../domRenderer.js';
import InputHandler from '../../inputHandler.js'; // Concrete Class Import
import {tokens} from '../tokens.js';
import {Registrar} from '../../dependencyInjection/registrarHelpers.js';

/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../domRenderer.js').default} DomRenderer */

/** @typedef {import('../../inputHandler.js').default} InputHandler */

/**
 * Registers UI-specific dependencies like DOM elements, DomRenderer, and InputHandler.
 *
 * @export
 * @param {AppContainer} container - The application's DI container.
 * @param {object} uiElements - An object containing references to essential UI elements.
 * @param {HTMLElement} uiElements.outputDiv - The main output display element.
 * @param {HTMLInputElement} uiElements.inputElement - The user command input element.
 * @param {HTMLElement} uiElements.titleElement - The element displaying the game title or area.
 */
export function registerUI(container, {outputDiv, inputElement, titleElement}) {
    const registrar = new Registrar(container);
    const logger = container.resolve(tokens.ILogger); // Resolve logger for potential use here
    logger.info('UI Registrations: Starting...');

    // --- 0. Register External Dependencies (UI elements) ---
    // Use registrar.instance for existing objects provided externally.
    registrar.instance(tokens.outputDiv, outputDiv);
    registrar.instance(tokens.inputElement, inputElement);
    registrar.instance(tokens.titleElement, titleElement);
    logger.info('UI Registrations: Registered DOM element instances.');

    // --- 1. Renderer ---
    // Register DomRenderer as a singleton using the registrar helper.
    // Dependencies: outputDiv, inputElement, titleElement, EventBus, ValidatedEventDispatcher, ILogger
    registrar.single(tokens.DomRenderer, DomRenderer, [
        tokens.outputDiv,
        tokens.inputElement,
        tokens.titleElement,
        tokens.EventBus,
        tokens.IValidatedEventDispatcher, // Use interface token if available
        tokens.ILogger
    ]);
    logger.info('UI Registrations: Registered DomRenderer.');

    // --- 2. Input Handler --- // MODIFIED
    // Register InputHandler against its Interface Token.
    // Note: The original registration passed `null` as the second argument explicitly.
    // We use singletonFactory to replicate this specific constructor call pattern.
    // Dependencies: inputElement, EventBus
    registrar.singletonFactory(tokens.IInputHandler, (c) => new InputHandler(
        c.resolve(tokens.inputElement),
        null, // Explicitly passing null as per original code
        c.resolve(tokens.EventBus)
    ));
    logger.info('UI Registrations: Registered InputHandler against IInputHandler token.');

    logger.info('UI Registrations: Complete.');
}