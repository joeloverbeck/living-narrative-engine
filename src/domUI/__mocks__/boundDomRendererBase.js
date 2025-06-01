// src/domUI/__mocks__/boundDomRendererBase.js

const mockAddDomListener = jest.fn();
const mockSuperDestroy = jest.fn();

const BoundDomRendererBase = jest.fn().mockImplementation(function ({
                                                                        logger,
                                                                        documentContext,
                                                                        elementsConfig,
                                                                        // validatedEventDispatcher is passed but not used by this mock's constructor directly
                                                                    }) {
    this.logger = logger;
    this.documentContext = documentContext;
    this.elementsConfig = elementsConfig;
    this.elements = {};
    this._logPrefix = `[${this.constructor.name}]`; // Add logPrefix for consistency if any mock logic uses it

    // Populate elements using documentContext.query (changed from querySelector)
    if (elementsConfig && documentContext && typeof documentContext.query === 'function') {
        for (const key in elementsConfig) {
            if (Object.prototype.hasOwnProperty.call(elementsConfig, key)) {
                const configValue = elementsConfig[key];
                let selector;

                if (typeof configValue === 'string') {
                    selector = configValue;
                } else if (typeof configValue === 'object' && configValue !== null && typeof configValue.selector === 'string') {
                    selector = configValue.selector;
                } else {
                    if (this.logger && typeof this.logger.warn === 'function') {
                        this.logger.warn(`${this._logPrefix || '[MockedBoundDomRendererBase]'} Invalid configuration for element key '${key}'. Skipping.`);
                    }
                    this.elements[key] = null;
                    continue;
                }

                try {
                    const el = documentContext.query(selector);
                    if (el) {
                        this.elements[key] = el;
                    } else {
                        this.elements[key] = null; // Explicitly set to null if not found
                        if (this.logger && typeof this.logger.debug === 'function') { // Or warn/error based on 'required' if mock was more complex
                            // this.logger.debug(`${this._logPrefix || '[MockedBoundDomRendererBase]'} Element '${key}' with selector '${selector}' not found.`);
                        }
                    }
                } catch (error) {
                    if (this.logger && typeof this.logger.error === 'function') {
                        this.logger.error(`${this._logPrefix || '[MockedBoundDomRendererBase]'} Error querying for element '${key}' with selector '${selector}':`, error);
                    }
                    this.elements[key] = null;
                }
            }
        }
    } else {
        // Log if critical parts for element binding are missing
        if (this.logger && typeof this.logger.warn === 'function') {
            if (!elementsConfig) this.logger.warn(`${this._logPrefix || '[MockedBoundDomRendererBase]'} elementsConfig not provided.`);
            if (!documentContext) this.logger.warn(`${this._logPrefix || '[MockedBoundDomRendererBase]'} documentContext not provided.`);
            else if (typeof documentContext.query !== 'function') this.logger.warn(`${this._logPrefix || '[MockedBoundDomRendererBase]'} documentContext.query is not a function.`);
        }
    }

    this._addDomListener = mockAddDomListener;
    this.destroy = mockSuperDestroy; // This will be super.destroy for BaseModalRenderer

    // Expose mock functions for test assertions/clearing
    BoundDomRendererBase._mockAddDomListener = mockAddDomListener;
    BoundDomRendererBase._mockSuperDestroy = mockSuperDestroy;
});

module.exports = {BoundDomRendererBase};