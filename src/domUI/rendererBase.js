// src/domUI/RendererBase.js
/**
 * @fileoverview Abstract base class for UI renderers.
 * Provides common dependencies (logger, event dispatcher, document context)
 * and helper methods like a standardized logging prefix.
 */

// --- Import Interfaces ---
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */

/** @typedef {import('./IDocumentContext').IDocumentContext} IDocumentContext */

/**
 * Abstract base class for UI rendering components.
 * Ensures essential dependencies are injected and provides common utilities.
 * Child classes must implement their specific rendering logic.
 */
class RendererBase {
    /** @protected @type {ILogger} */
    _logger;
    /** @protected @type {ValidatedEventDispatcher} */
    _ved;
    /** @protected @type {IDocumentContext} */
    _docContext;

    /**
     * Creates an instance of a RendererBase-derived class.
     * @param {object} dependencies - The required dependencies.
     * @param {ILogger} dependencies.logger - Service for logging messages.
     * @param {ValidatedEventDispatcher} dependencies.ved - Service for dispatching validated events.
     * @param {IDocumentContext} dependencies.docContext - Service for interacting with the document.
     * @throws {Error} If any dependency is missing or invalid.
     */
    constructor({logger, ved, docContext}) {
        // --- Dependency Validation ---
        if (!logger || typeof logger.info !== 'function' || typeof logger.warn !== 'function' || typeof logger.error !== 'function') {
            throw new Error(`${this.constructor.name} requires a valid ILogger instance.`);
        }
        if (!ved || typeof ved.dispatchValidated !== 'function') {
            throw new Error(`${this.constructor.name} requires a valid ValidatedEventDispatcher instance.`);
        }
        // Check for the core methods of IDocumentContext
        if (!docContext || typeof docContext.query !== 'function' || typeof docContext.create !== 'function') {
            throw new Error(`${this.constructor.name} requires a valid IDocumentContext instance.`);
        }

        this._logger = logger;
        this._ved = ved;
        this._docContext = docContext;

        this._logger.debug(`${this._logPrefix} Initialized.`);
    }

    /**
     * Protected getter for the logger instance.
     * @protected
     * @returns {ILogger}
     */
    get logger() {
        return this._logger;
    }

    /**
     * Protected getter for the ValidatedEventDispatcher instance.
     * @protected
     * @returns {ValidatedEventDispatcher}
     */
    get ved() {
        return this._ved;
    }

    /**
     * Protected getter for the IDocumentContext instance.
     * @protected
     * @returns {IDocumentContext}
     */
    get doc() {
        return this._docContext;
    }

    /**
     * Generates a standardized log prefix string based on the class name.
     * Example: "[Ui::MyRenderer]"
     * @protected
     * @returns {string} The formatted log prefix.
     */
    get _logPrefix() {
        return `[Ui::${this.constructor.name}]`;
    }
}

export default RendererBase;