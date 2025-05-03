// src/domUI/rendererBase.js

/**
 * @typedef {import('../core/interfaces/ILogger').ILogger} ILogger
 * @typedef {import('./IDocumentContext').IDocumentContext} IDocumentContext
 * @typedef {import('../core/interfaces/IValidatedEventDispatcher').IValidatedEventDispatcher} IValidatedEventDispatcher
 */

/**
 * @abstract
 * @class RendererBase
 * @description Base class for UI renderers to reduce boilerplate. Provides common dependencies.
 */
export class RendererBase {
    /** @protected @type {ILogger} */
    logger;
    /** @protected @type {IDocumentContext} */
    doc;
    /** @protected @type {IValidatedEventDispatcher} */
    ved; // Changed from eventBus to ved

    /**
     * @param {ILogger} logger - The logger instance.
     * @param {IDocumentContext} doc - The document context.
     * @param {IValidatedEventDispatcher} ved - The validated event dispatcher.
     */
    constructor(logger, doc, ved) {
        if (this.constructor === RendererBase) {
            throw new Error("Abstract classes can't be instantiated.");
        }
        // Type assertions/checks for required dependencies
        if (!logger) throw new Error(`${this.constructor.name}: Logger dependency is missing.`);
        if (!doc) throw new Error(`${this.constructor.name}: DocumentContext dependency is missing.`);
        if (!ved) throw new Error(`${this.constructor.name}: ValidatedEventDispatcher dependency is missing.`);

        this.logger = logger;
        this.doc = doc;
        this.ved = ved; // Changed from eventBus to ved
        this.logger.debug(`[${this.constructor.name}] Initialized.`);
    }

    dispose() {
        this.logger.debug(`[${this.constructor.name}] Disposing.`);
        // Base cleanup if any
    }
}