// src/domUI/domMutationService.js
/**
 * @fileoverview Service implementation for performing generic DOM mutations.
 */

// Assuming setPropertyByPath exists in utils based on original DomRenderer comments
import {setPropertyByPath} from '../utils/domUtils.js'; // Adjust path if necessary

/** @typedef {import('../core/interfaces/ILogger').ILogger} ILogger */
/** @typedef {import('./IDocumentContext').IDocumentContext} IDocumentContext */
/** @typedef {import('./IDomMutationService').IDomMutationService} IDomMutationService */

/** @typedef {import('./IDomMutationService').DomMutationResult} DomMutationResult */

/**
 * Service responsible for applying generic mutations to DOM elements based on
 * selectors and property paths. Uses an injected DocumentContext for DOM access.
 *
 * @implements {IDomMutationService}
 */
export class DomMutationService {
    /** @protected @type {ILogger} */
    logger;
    /** @protected @type {IDocumentContext} */
    documentContext;
    /** @protected @readonly @type {string} */
    _logPrefix = '[DomMutationService]';

    /**
     * Creates an instance of DomMutationService.
     * @param {object} dependencies
     * @param {ILogger} dependencies.logger - Logging service.
     * @param {IDocumentContext} dependencies.documentContext - Document access service.
     */
    constructor({logger, documentContext}) {
        if (!logger || typeof logger.debug !== 'function') {
            throw new Error(`${this._logPrefix} Logger dependency is missing or invalid.`);
        }
        if (!documentContext || typeof documentContext.query !== 'function' || typeof documentContext.create !== 'function' || typeof documentContext.document === 'undefined') {
            // Added check for .document getter needed for querySelectorAll
            throw new Error(`${this._logPrefix} DocumentContext dependency is missing or invalid (requires query, create, document getter).`);
        }
        this.logger = logger;
        this.documentContext = documentContext;
        this.logger.debug(`${this._logPrefix} Initialized.`);
    }

    /**
     * Mutates properties of DOM elements matching a selector within the correct document context.
     * Checks for document availability before attempting mutation.
     * Includes direct handling for 'textContent' and 'innerHTML'.
     *
     * @param {string} selector - The CSS selector to query for elements.
     * @param {string} propertyPath - Dot-notation path to the property to set (e.g., 'style.color', 'dataset.value', 'textContent').
     * @param {*} value - The value to set the property to.
     * @returns {DomMutationResult} - Object indicating total elements found, how many were modified, and how many failed.
     */
    mutate(selector, propertyPath, value) {
        // Use document context from injected service
        const doc = this.documentContext.document; // Assumes DocumentContext provides access to the underlying document
        if (!doc) {
            this.logger.warn(`${this._logPrefix}: Cannot mutate elements for selector "${selector}", document context is not available.`);
            return {count: 0, modified: 0, failed: 0};
        }

        let totalFound = 0;
        let successCount = 0;
        let elements;
        try {
            // Use querySelectorAll from the underlying document object
            elements = doc.querySelectorAll(selector);
        } catch (error) {
            this.logger.error(`${this._logPrefix}: Invalid selector "${selector}".`, error);
            return {count: 0, modified: 0, failed: 0};
        }

        totalFound = elements.length;
        if (totalFound === 0) {
            this.logger.debug(`${this._logPrefix}: Selector "${selector}" found no elements in the current document context.`);
            return {count: 0, modified: 0, failed: 0};
        }

        elements.forEach(element => {
            try {
                // Direct property checks first
                if (propertyPath === 'textContent') {
                    if (element.textContent !== value) {
                        element.textContent = value;
                        successCount++;
                    }
                } else if (propertyPath === 'innerHTML') {
                    // Use with caution due to XSS risks if value is user-controlled
                    if (element.innerHTML !== value) {
                        element.innerHTML = value;
                        successCount++;
                    }
                } else {
                    // Use utility for nested properties
                    // Assuming setPropertyByPath returns true if changed, false otherwise
                    const changed = setPropertyByPath(element, propertyPath, value);
                    if (changed) {
                        successCount++;
                    }
                }
            } catch (error) {
                this.logger.error(`${this._logPrefix}: Failed to set property "${propertyPath}" on element matched by "${selector}". Value: ${JSON.stringify(value)}`, error);
                // Note: Failure to set increments the 'failed' count implicitly later.
            }
        });

        const modifiedCount = successCount;
        // Failed count includes elements found but not modified (due to error or value already matching)
        const failedCount = totalFound - successCount;

        // Refined logging based on outcome
        if (failedCount > 0 && modifiedCount > 0) { // Some succeeded, some failed/unchanged
            this.logger.warn(`${this._logPrefix}: Encountered ${failedCount} issue(s) or unchanged value(s) while setting property "${propertyPath}" for selector "${selector}". ${modifiedCount} succeeded out of ${totalFound}.`);
        } else if (failedCount > 0 && modifiedCount === 0) { // All failed or unchanged
            this.logger.warn(`${this._logPrefix}: Failed to modify or value already set for property "${propertyPath}" on all ${totalFound} element(s) matching "${selector}".`);
        } else if (modifiedCount > 0 && failedCount === 0) { // All succeeded
            this.logger.debug(`${this._logPrefix}: Successfully modified property "${propertyPath}" on ${modifiedCount} element(s) matching "${selector}"`);
        } else if (totalFound > 0 && modifiedCount === 0 && failedCount === 0) {
            // This case *shouldn't* happen with the current logic (failedCount would be > 0 if unchanged)
            // but adding for completeness. It implies elements were found but the loop didn't run or properties didn't exist?
            this.logger.debug(`${this._logPrefix}: Found ${totalFound} element(s) for selector "${selector}", but none were modified (property "${propertyPath}" might already have the target value or path invalid?).`);
        }
        // else: totalFound === 0 was handled earlier.


        return {
            count: totalFound,
            modified: modifiedCount,
            // Return the count of elements found but *not* successfully modified
            failed: failedCount
        };
    }

    /**
     * Dispose method for cleanup (if needed in the future).
     */
    dispose() {
        this.logger.debug(`${this._logPrefix} Disposing.`);
        // Add any specific cleanup logic for this service if required
    }
}