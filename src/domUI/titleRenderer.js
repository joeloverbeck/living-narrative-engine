// src/dom-ui/TitleRenderer.js
import {RendererBase} from './rendererBase.js';

/**
 * @typedef {import('../core/interfaces/ILogger').ILogger} ILogger
 * @typedef {import('./IDocumentContext').IDocumentContext} IDocumentContext
 * @typedef {import('../core/interfaces/IValidatedEventDispatcher').IValidatedEventDispatcher} IValidatedEventDispatcher
 */

/**
 * Manages the content of the main H1 title element.
 */
export class TitleRenderer extends RendererBase {
    /**
     * The H1 element whose text content will be managed.
     * @private
     * @type {HTMLHeadingElement}
     */
    #titleElement;

    /**
     * Creates an instance of TitleRenderer.
     *
     * @param {object} deps - Dependencies object.
     * @param {ILogger} deps.logger - The logger instance.
     * @param {IDocumentContext} deps.documentContext - The document context.
     * @param {IValidatedEventDispatcher} deps.validatedEventDispatcher - The event dispatcher.
     * @param {HTMLElement | null} deps.titleElement - The root H1 element to manage. Must be an H1.
     * @throws {Error} If dependencies are invalid or titleElement is not a valid H1.
     */
    constructor({logger, documentContext, validatedEventDispatcher, titleElement}) {
        // Pass base dependencies to RendererBase constructor
        super({logger, documentContext, validatedEventDispatcher});

        // --- Validate specific titleElement dependency ---
        // Check if it exists and is an ELEMENT_NODE (type 1)
        if (!titleElement || titleElement.nodeType !== 1) {
            const errMsg = `${this._logPrefix} 'titleElement' dependency is missing or not a valid DOM element.`;
            this.logger.error(errMsg);
            throw new Error(errMsg);
        }
        // Check if it's specifically an H1 element
        // Using tagName check for reliability across environments (like JSDOM)
        if (titleElement.tagName !== 'H1') {
            const errMsg = `${this._logPrefix} 'titleElement' must be an H1 element, but received '${titleElement.tagName}'.`;
            this.logger.error(errMsg, {element: titleElement});
            throw new Error(errMsg);
        }

        this.#titleElement = /** @type {HTMLHeadingElement} */ (titleElement);
        this.logger.debug(`${this._logPrefix} Attached to H1 element.`);

        // Note: This renderer currently does not subscribe to VED events itself.
        // It provides the `set` API for other services/renderers (or event handlers
        // elsewhere) to call. If direct subscription is needed later (e.g., for
        // initialization events), it can be added here following the pattern
        // in UiMessageRenderer.
    }

    /**
     * Sets the text content of the managed H1 element.
     *
     * @param {string} text - The text to display in the title.
     */
    set(text) {
        if (typeof text !== 'string') {
            this.logger.warn(`${this._logPrefix} Received non-string value in set():`, text);
            // Coerce to string to avoid errors, but log the issue.
            text = String(text);
        }

        if (this.#titleElement) {
            // Only update if text actually changes
            if (this.#titleElement.textContent !== text) {
                this.#titleElement.textContent = text;
                this.logger.debug(`${this._logPrefix} Title set to: "${text}"`);
            } else {
                this.logger.debug(`${this._logPrefix} Title already set to: "${text}", skipping update.`);
            }
        } else {
            // This case should theoretically not happen if constructor validation passed,
            // but included for robustness.
            this.logger.error(`${this._logPrefix} Cannot set title, internal #titleElement reference is lost.`);
        }
    }

    /**
     * Dispose method for cleanup (if needed in the future).
     * Currently just logs disposal.
     */
    dispose() {
        // No specific subscriptions or resources to clean up currently.
        super.dispose(); // Calls logger.debug in base class
    }
}

// Export the class as default or named, depending on project convention.
// Using named export to align with index.js pattern.
// export default TitleRenderer;