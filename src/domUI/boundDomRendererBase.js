// src/domUI/boundDomRendererBase.js

import { RendererBase } from './rendererBase.js';

/**
 * @typedef {import('../interfaces/ILogger').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 */

/**
 * @typedef {object} ElementConfigEntry
 * @property {string} selector - The CSS selector for the DOM element.
 * @property {boolean} [required=true] - Whether the element is required. If true and not found, an error is logged.
 * If false and not found, a warning is logged. Defaults to true.
 * @property {Function} [expectedType] - Optional. A constructor (e.g., HTMLButtonElement, HTMLInputElement)
 * to check the `instanceof` the found element.
 */

/**
 * @typedef {Object.<string, ElementConfigEntry | string>} ElementsConfig
 * An object where keys are descriptive names for elements (e.g., 'submitButton', 'listContainer')
 * and values are either an ElementConfigEntry object or a string (CSS selector, implies required: true).
 * e.g.,
 * {
 * listContainer: { selector: '#my-list', required: true, expectedType: HTMLUListElement },
 * addButton: { selector: '.add-item-btn', required: false },
 * titleDisplay: '#main-title' // Shorthand for { selector: '#main-title', required: true }
 * }
 */

/**
 * @abstract
 * @class BoundDomRendererBase
 * @extends RendererBase
 * @description Base class for UI renderers that automates the binding of DOM elements
 * based on a configuration object. It queries for elements upon construction and
 * stores them in a `this.elements` object.
 */
export class BoundDomRendererBase extends RendererBase {
    /**
     * Stores the bound DOM elements.
     * @protected
     * @type {Object.<string, HTMLElement|null>}
     */
    elements;

    /**
     * Initializes the base renderer and binds DOM elements.
     *
     * @param {object} params - The parameters object.
     * @param {ILogger} params.logger - The logger instance.
     * @param {IDocumentContext} params.documentContext - The document context abstraction.
     * @param {IValidatedEventDispatcher} params.validatedEventDispatcher - The validated event dispatcher.
     * @param {ElementsConfig} params.elementsConfig - Configuration for binding DOM elements.
     * @throws {Error} If `elementsConfig` is not provided or is not an object.
     */
    constructor({
                    logger,
                    documentContext,
                    validatedEventDispatcher,
                    elementsConfig
                }) {
        super({ logger, documentContext, validatedEventDispatcher });

        if (!elementsConfig || typeof elementsConfig !== 'object') {
            const errorMsg = `${this._logPrefix} 'elementsConfig' must be provided as an object.`;
            this.logger.error(errorMsg);
            throw new Error(errorMsg); // Or handle more gracefully depending on desired strictness
        }

        this.elements = {};
        this._bindElements(elementsConfig);
    }

    /**
     * Processes the elementsConfig to query and store DOM elements.
     * @private
     * @param {ElementsConfig} elementsConfig - The configuration object for elements.
     */
    _bindElements(elementsConfig) {
        for (const key in elementsConfig) {
            if (Object.prototype.hasOwnProperty.call(elementsConfig, key)) {
                const configValue = elementsConfig[key];
                let entry;

                if (typeof configValue === 'string') {
                    // Shorthand: configValue is a selector string, defaults apply
                    entry = {
                        selector: configValue,
                        required: true, // Default for shorthand
                    };
                } else if (typeof configValue === 'object' && configValue !== null && typeof configValue.selector === 'string') {
                    // Full config object
                    entry = {
                        ...configValue,
                        required: configValue.required !== undefined ? configValue.required : true, // Default required to true
                    };
                } else {
                    this.logger.warn(`${this._logPrefix} Invalid configuration for element key '${key}'. Skipping.`, {configValue});
                    this.elements[key] = null; // Ensure key exists even if invalid config
                    continue;
                }

                const { selector, required, expectedType } = entry;
                let foundElement = null;

                try {
                    foundElement = this.documentContext.query(selector);
                } catch (error) {
                    this.logger.error(`${this._logPrefix} Error querying for element '${key}' with selector '${selector}':`, error);
                    if (required) {
                        // Consider re-throwing or setting a critical error state if query itself fails for a required element
                    }
                }

                this.elements[key] = foundElement;

                if (foundElement) {
                    this.logger.debug(`${this._logPrefix} Successfully bound element '${key}' to selector '${selector}'.`);
                    if (expectedType && !(foundElement instanceof expectedType)) {
                        this.logger.warn(
                            `${this._logPrefix} Element '${key}' (selector: '${selector}') was found but is not of expected type '${expectedType.name}'. Found type: '${foundElement.constructor.name}'.`,
                            { element: foundElement }
                        );
                        // Depending on strictness, could nullify this.elements[key] or throw
                    }
                } else {
                    const message = `${this._logPrefix} Element '${key}' with selector '${selector}' not found.`;
                    if (required) {
                        this.logger.error(message + " (Required)");
                        // Consider throwing an error here to halt initialization if a critical element is missing
                        // throw new Error(message + " (Required)");
                    } else {
                        this.logger.warn(message + " (Optional)");
                    }
                }
            }
        }
    }

    /**
     * Dispose method. Calls super.dispose() for base class cleanup.
     * Derived classes can override this to add their own specific disposal logic,
     * ensuring they also call super.dispose().
     */
    dispose() {
        super.dispose(); // Handles VED/DOM listener cleanup if those are added to RendererBase
        this.elements = {}; // Clear references to DOM elements
        this.logger.debug(`${this._logPrefix} Bound DOM elements cleared.`);
    }
}