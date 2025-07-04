// src/domUI/boundDomRendererBase.js

import { RendererBase } from './rendererBase.js';

/**
 * @typedef {import('../interfaces/ILogger').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('./domElementFactory.js').default} DomElementFactory
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
 * @typedef {{ [key: string]: ElementConfigEntry | string }} ElementsConfig
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
 * @augments RendererBase
 * @description Base class for UI renderers that automates the binding of DOM elements
 * based on a configuration object. It queries for elements upon construction and
 * stores them in a `this.elements` object.
 */
export class BoundDomRendererBase extends RendererBase {
  /**
   * Stores the bound DOM elements.
   *
   * @protected
   * @type {{ [key: string]: HTMLElement | null }}
   */
  elements;

  /**
   * Stores the default keys used when calling {@link BoundDomRendererBase#scrollToBottom}.
   * These may be omitted if a subclass never needs the auto-scroll helper.
   *
   * @protected
   * @type {string | null}
   */
  _defaultScrollContainerKey = null;

  /**
   * Stores the default content container key used when scrolling.
   *
   * @protected
   * @type {string | null}
   */
  _defaultContentContainerKey = null;

  /**
   * Optional factory for creating DOM elements.
   *
   * @protected
   * @type {DomElementFactory | null}
   */
  domElementFactory = null;

  /**
   * Initializes the base renderer and binds DOM elements.
   *
   * @param {object} params - The parameters object.
   * @param {ILogger} params.logger - The logger instance.
   * @param {IDocumentContext} params.documentContext - The document context abstraction.
   * @param {IValidatedEventDispatcher} params.validatedEventDispatcher - The validated event dispatcher.
   * @param {ElementsConfig} params.elementsConfig - Configuration for binding DOM elements.
   * @param {string} [params.scrollContainerKey] - Default key in `elementsConfig` used when scrolling.
   * @param {string} [params.contentContainerKey] - Default content container key used when scrolling.
   * @param {DomElementFactory} [params.domElementFactory] - Optional factory for creating DOM elements.
   * @throws {Error} If `elementsConfig` is not provided or is not an object.
   */
  constructor({
    logger,
    documentContext,
    validatedEventDispatcher,
    elementsConfig,
    scrollContainerKey = null,
    contentContainerKey = null,
    domElementFactory = null,
  }) {
    super({ logger, documentContext, validatedEventDispatcher });

    if (!elementsConfig || typeof elementsConfig !== 'object') {
      const errorMsg = `${this._logPrefix} 'elementsConfig' must be provided as an object.`;
      this.logger.error(errorMsg);
      throw new Error(errorMsg); // Or handle more gracefully depending on desired strictness
    }

    this.elements = {};
    this._bindElements(elementsConfig);
    this._defaultScrollContainerKey = scrollContainerKey;
    this._defaultContentContainerKey = contentContainerKey;

    if (domElementFactory) {
      if (typeof domElementFactory.create !== 'function') {
        this.logger.error(
          `${this._logPrefix} 'domElementFactory' must expose a create() method.`
        );
      } else {
        this.domElementFactory = domElementFactory;
      }
    }
  }

  /**
   * Processes the elementsConfig to query and store DOM elements.
   *
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
        } else if (
          typeof configValue === 'object' &&
          configValue !== null &&
          typeof configValue.selector === 'string'
        ) {
          // Full dependencyInjection object
          entry = {
            ...configValue,
            required:
              configValue.required !== undefined ? configValue.required : true, // Default required to true
          };
        } else {
          this.logger.warn(
            `${this._logPrefix} Invalid configuration for element key '${key}'. Skipping.`,
            { configValue }
          );
          this.elements[key] = null; // Ensure key exists even if invalid dependencyInjection
          continue;
        }

        const { selector, required, expectedType } = entry;
        let foundElement = null;

        try {
          foundElement = this.documentContext.query(selector);
        } catch (error) {
          this.logger.error(
            `${this._logPrefix} Error querying for element '${key}' with selector '${selector}':`,
            error
          );
          if (required) {
            // Consider re-throwing or setting a critical error state if query itself fails for a required element
          }
        }

        this.elements[key] = foundElement;

        if (foundElement) {
          this.logger.debug(
            `${this._logPrefix} Successfully bound element '${key}' to selector '${selector}'.`
          );
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
            this.logger.error(message + ' (Required)');
            // Consider throwing an error here to halt initialization if a critical element is missing
            // throw new Error(message + " (Required)");
          } else {
            this.logger.warn(message + ' (Optional)');
          }
        }
      }
    }
  }

  /**
   * Scrolls a designated scroll container to the bottom. This is a utility
   * for components that add content to a scrollable panel, like a chat or log.
   *
   * It prioritizes scrolling the element mapped to `scrollContainerKey`.
   * If that fails or is not present, it attempts a fallback by scrolling the
   * last child of the element mapped to `contentContainerKey` into view.
   *
   * @protected
   * @param {string} scrollContainerKey - The key in `this.elements` for the primary scrollable container (e.g., 'outputDivElement').
   * @param {string} contentContainerKey - The key in `this.elements` for the content container, used for fallback scrolling (e.g., 'messageList').
   */
  _scrollToPanelBottom(scrollContainerKey, contentContainerKey) {
    const scrollContainer = this.elements[scrollContainerKey];
    if (
      scrollContainer &&
      typeof scrollContainer.scrollTop !== 'undefined' &&
      typeof scrollContainer.scrollHeight !== 'undefined'
    ) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    } else {
      this.logger.warn(
        `${this._logPrefix} Could not scroll primary container '${scrollContainerKey}'. Attempting fallback on '${contentContainerKey}'.`
      );

      const contentContainer = this.elements[contentContainerKey];
      if (
        contentContainer &&
        contentContainer.lastElementChild && // Use lastElementChild to ignore text/comment nodes
        typeof contentContainer.lastElementChild.scrollIntoView === 'function'
      ) {
        contentContainer.lastElementChild.scrollIntoView({
          behavior: 'auto',
          block: 'end',
        });
        this.logger.debug(
          `${this._logPrefix} Fallback: Scrolled last element in '${contentContainerKey}' into view.`
        );
      } else {
        this.logger.warn(
          `${this._logPrefix} Fallback scroll method also failed for '${contentContainerKey}' or it's empty.`
        );
      }
    }
  }

  /**
   * Convenience wrapper that delegates to `_scrollToPanelBottom`.
   *
   * @protected
   * @param {string} scrollKey - Key for the scroll container in `this.elements`.
   * @param {string} contentKey - Key for the content container for fallback scrolling.
   */
  scrollToBottom(
    scrollKey = this._defaultScrollContainerKey,
    contentKey = this._defaultContentContainerKey
  ) {
    if (!scrollKey || !contentKey) {
      this.logger.warn(
        `${this._logPrefix} scrollToBottom called without valid keys.`
      );
      return;
    }
    this._scrollToPanelBottom(scrollKey, contentKey);
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
