// src/domUI/rendererBase.js

/**
 * @file Base class for UI renderers providing common dependencies and automated cleanup.
 */

/** @typedef {import('../interfaces/ILogger').ILogger} ILogger */
/** @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext */
/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../interfaces/IEventSubscription').IEventSubscription} IEventSubscription */

/**
 * @typedef {object} ManagedDomListener
 * @property {EventTarget} element - The DOM element the listener is attached to.
 * @property {string} eventType - The event type string.
 * @property {Function} handler - The event handler function.
 * @property {boolean | object} [options] - Optional event listener options.
 */

/**
 * @abstract
 * @class RendererBase
 * @description Base class for UI renderers to reduce boilerplate. Provides common dependencies
 * like logger, document context, and event dispatcher. It also includes helper methods
 * for managing VED subscriptions and DOM event listeners, with automatic cleanup
 * in its `dispose` method. Derived classes should use `_addSubscription` and
 * `_addDomListener` to register their event handlers for automated cleanup.
 */
export class RendererBase {
  logger;
  documentContext;
  validatedEventDispatcher;
  /**
   * @protected
   * @readonly
   * @type {string} - Log prefix derived from the concrete class name. e.g., "[MyRenderer]"
   */
  _logPrefix;

  /**
   * @private
   * @type {Array<() => void>}
   * Stores VED unsubscribe functions.
   */
  _managedVedEventSubscriptions = [];

  /**
   * @private
   * @type {Array<ManagedDomListener>}
   * Stores details of managed DOM event listeners.
   */
  _managedDomListeners = [];

  /**
   * Initializes the base renderer with required dependencies.
   * Throws errors if any dependency is missing.
   * Logs initialization upon successful setup.
   *
   * @param {object} deps - The dependencies object.
   * @param {ILogger} deps.logger - The logger instance. Must not be null or undefined.
   * @param {IDocumentContext} deps.documentContext - The document context abstraction. Must not be null or undefined.
   * @param {IValidatedEventDispatcher} deps.validatedEventDispatcher - The validated event dispatcher. Must not be null or undefined.
   * @throws {Error} If the class is instantiated directly (it's abstract).
   * @throws {Error} If logger, documentContext, or ved dependencies are missing.
   */
  constructor({ logger, documentContext, validatedEventDispatcher }) {
    const className = this.constructor.name;

    if (className === 'RendererBase') {
      throw new Error(
        "Abstract class 'RendererBase' cannot be instantiated directly."
      );
    }

    if (!logger || typeof logger.debug !== 'function') {
      throw new Error(`${className}: Logger dependency is missing or invalid.`);
    }
    if (
      !documentContext ||
      typeof documentContext.query !== 'function' ||
      typeof documentContext.create !== 'function'
    ) {
      throw new Error(
        `${className}: DocumentContext dependency is missing or invalid.`
      );
    }
    if (
      !validatedEventDispatcher ||
      typeof validatedEventDispatcher.dispatch !== 'function' ||
      typeof validatedEventDispatcher.subscribe !== 'function'
    ) {
      throw new Error(
        `${className}: ValidatedEventDispatcher dependency is missing or invalid.`
      );
    }

    this.logger = logger;
    this.documentContext = documentContext;
    this.validatedEventDispatcher = validatedEventDispatcher;
    this._logPrefix = `[${className}]`;

    this._managedVedEventSubscriptions = [];
    this._managedDomListeners = [];

    this.logger.debug(`${this._logPrefix} Initialized.`);
  }

  /**
   * Adds a VED subscription's unsubscribe function to the managed list for automatic cleanup.
   *
   * @protected
   * @param {(() => void) | IEventSubscription | undefined} unsubscribeFn - The function returned by `validatedEventDispatcher.subscribe()` or an object with an unsubscribe method.
   */
  _addSubscription(unsubscribeFn) {
    if (unsubscribeFn && typeof unsubscribeFn === 'function') {
      this._managedVedEventSubscriptions.push(unsubscribeFn);
    } else if (
      unsubscribeFn &&
      typeof unsubscribeFn.unsubscribe === 'function'
    ) {
      this._managedVedEventSubscriptions.push(() =>
        unsubscribeFn.unsubscribe()
      );
    } else {
      this.logger.warn(
        `${this._logPrefix} Attempted to add invalid VED unsubscribe function.`
      );
    }
  }

  /**
   * Adds a DOM event listener and stores its details for automatic removal on dispose.
   * The component should provide a pre-bound handler if its `this` context is needed.
   *
   * @protected
   * @param {EventTarget} element - The DOM element to attach the listener to.
   * @param {string} eventType - The event type string (e.g., 'click').
   * @param {Function} handler - The event handler function.
   * @param {boolean | object} [options] - Optional event listener options (capture, once, passive).
   */
  _addDomListener(element, eventType, handler, options) {
    if (
      !element ||
      typeof element.addEventListener !== 'function' ||
      typeof element.removeEventListener !== 'function'
    ) {
      this.logger.warn(
        `${this._logPrefix} Attempted to add DOM listener to invalid element for event type '${eventType}'.`,
        { element }
      );
      return;
    }
    if (typeof handler !== 'function') {
      this.logger.warn(
        `${this._logPrefix} Attempted to add DOM listener with invalid handler for event type '${eventType}'.`,
        { handler }
      );
      return;
    }

    element.addEventListener(eventType, handler, options);
    this._managedDomListeners.push({ element, eventType, handler, options });
    this.logger.debug(
      `${this._logPrefix} Added DOM listener for '${eventType}' on element.`,
      { elementPath: getElementPath(element) }
    );
  }

  /**
   * Base dispose method. Cleans up all managed VED subscriptions and DOM event listeners.
   * Logs the disposal action. Derived classes should call `super.dispose()` if they override this.
   */
  dispose() {
    this.logger.debug(
      `${this._logPrefix} Starting disposal: Unsubscribing VED events and removing DOM listeners.`
    );

    // Unsubscribe from VED events
    if (this._managedVedEventSubscriptions.length > 0) {
      this.logger.debug(
        `${this._logPrefix} Unsubscribing ${this._managedVedEventSubscriptions.length} VED event subscriptions.`
      );
      this._managedVedEventSubscriptions.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch (error) {
          this.logger.warn(
            `${this._logPrefix} Error during VED unsubscription:`,
            error
          );
        }
      });
      this._managedVedEventSubscriptions = [];
    } else {
      this.logger.debug(
        `${this._logPrefix} No VED event subscriptions to unsubscribe.`
      );
    }

    // Remove DOM listeners
    if (this._managedDomListeners.length > 0) {
      this.logger.debug(
        `${this._logPrefix} Removing ${this._managedDomListeners.length} DOM event listeners.`
      );
      this._managedDomListeners.forEach(
        ({ element, eventType, handler, options }) => {
          try {
            element.removeEventListener(eventType, handler, options);
          } catch (error) {
            this.logger.warn(
              `${this._logPrefix} Error removing DOM listener for '${eventType}':`,
              error,
              { elementPath: getElementPath(element) }
            );
          }
        }
      );
      this._managedDomListeners = [];
    } else {
      this.logger.debug(`${this._logPrefix} No DOM event listeners to remove.`);
    }

    this.logger.debug(
      `${this._logPrefix} Finished automated cleanup. Base dispose complete.`
    );
  }
}

/**
 * Helper function to get a string path for a DOM element, for logging purposes.
 *
 * @param {EventTarget} el - Element to build a path for.
 * @returns {string} Unique-ish CSS-like path for logging.
 */
function getElementPath(el) {
  if (!(el instanceof Element)) return 'Non-Element Target';
  const path = [];
  let currentEl = el;
  while (currentEl) {
    let entry = currentEl.tagName.toLowerCase();
    if (currentEl.id) {
      entry += `#${currentEl.id}`;
    } else if (currentEl.className && typeof currentEl.className === 'string') {
      entry += `.${currentEl.className
        .split(' ')
        .filter((c) => c)
        .join('.')}`;
    }
    path.unshift(entry);
    if (currentEl.parentElement) {
      currentEl = currentEl.parentElement;
    } else {
      break; // Reached top or detached element
    }
    if (path.length >= 5) {
      // Limit path length for brevity
      path.unshift('...');
      break;
    }
  }
  return path.join(' > ');
}
