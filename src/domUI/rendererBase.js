// src/domUI/rendererBase.js

/**
 * @fileoverview Base class for UI renderers providing common dependencies.
 */

/** @typedef {import('../core/interfaces/ILogger').ILogger} ILogger */
/** @typedef {import('./IDocumentContext').IDocumentContext} IDocumentContext */

/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */

/**
 * @abstract
 * @class RendererBase
 * @description Base class for UI renderers to reduce boilerplate. Provides common dependencies
 * like logger, document context, and event dispatcher. Ensures derived classes call super
 * with valid dependencies.
 */
export class RendererBase {
    /** @protected @type {ILogger} */
    logger;
    /** @protected @type {IDocumentContext} */
    documentContext;
    /** @protected @type {IValidatedEventDispatcher} */
    validatedEventDispatcher;
    /**
     * @protected
     * @readonly
     * @type {string} - Log prefix derived from the concrete class name. e.g., "[MyRenderer]"
     */
    _logPrefix; // Let's make the log prefix explicit

    /**
     * Initializes the base renderer with required dependencies.
     * Throws errors if any dependency is missing.
     * Logs initialization upon successful setup.
     *
     * @param {ILogger} logger - The logger instance. Must not be null or undefined.
     * @param {IDocumentContext} documentContext - The document context abstraction. Must not be null or undefined.
     * @param {IValidatedEventDispatcher} validatedEventDispatcher - The validated event dispatcher. Must not be null or undefined.
     * @throws {Error} If the class is instantiated directly (it's abstract).
     * @throws {Error} If logger, documentContext, or ved dependencies are missing.
     */
    constructor({logger, documentContext, validatedEventDispatcher}) {
        const className = this.constructor.name; // Get concrete class name

        if (className === 'RendererBase') {
            throw new Error("Abstract class 'RendererBase' cannot be instantiated directly.");
        }

        // --- FIX: More robust checks ---
        if (!logger || typeof logger.debug !== 'function') { // Basic check for logger presence and a method
            throw new Error(`${className}: Logger dependency is missing or invalid.`);
        }
        if (!documentContext || typeof documentContext.query !== 'function' || typeof documentContext.create !== 'function') { // Basic check for documentContext presence and methods
            throw new Error(`${className}: DocumentContext dependency is missing or invalid.`);
        }
        if (!validatedEventDispatcher || typeof validatedEventDispatcher.dispatchValidated !== 'function') { // Basic check for ved presence and a method
            throw new Error(`${className}: ValidatedEventDispatcher dependency is missing or invalid.`);
        }

        this.logger = logger;
        this.documentContext = documentContext;
        this.validatedEventDispatcher = validatedEventDispatcher;
        this._logPrefix = `[${className}]`; // Standardized log prefix

        // Use the prefix in the initialization log
        this.logger.debug(`${this._logPrefix} Initialized.`);
    }

    /**
     * Base dispose method for potential cleanup in derived classes.
     * Logs the disposal action.
     */
    dispose() {
        this.logger.debug(`${this._logPrefix} Disposing.`);
        // Base cleanup logic can be added here if needed in the future
        // e.g., removing event listeners setup by the base class
    }

    // --- Removed explicit getters ---
    // The properties logger, doc, ved are already public/protected
    // No need for explicit get() methods unless you want read-only access from outside
    // or specific logic within the getter.
}