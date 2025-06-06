// src/domUI/chatAlertRenderer.js

import { BoundDomRendererBase } from './boundDomRendererBase.js';

/**
 * @typedef {import('../interfaces/ILogger').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('./domElementFactory.js').default} DomElementFactory
 * @typedef {import('../events/alertRouter.js').default} AlertRouter
 * @typedef {import('../events/alertMessageFormatter.js').default} AlertMessageFormatter
 */

/**
 * @class ChatAlertRenderer
 * @extends {BoundDomRendererBase}
 * @description Renders warning and error alerts directly within the main chat/message panel.
 * It detects the presence of the chat panel and signals its readiness to the AlertRouter,
 * preventing alerts from being flushed to the console when a UI target is available.
 */
export class ChatAlertRenderer extends BoundDomRendererBase {
  /**
   * The router that directs alerts to appropriate handlers.
   * @private
   * @type {AlertRouter}
   */
  #alertRouter;

  /**
   * The formatter for creating user-friendly alert messages.
   * @private
   * @type {AlertMessageFormatter}
   */
  #alertMessageFormatter;

  /**
   * Flag indicating if the chat panel DOM element was found.
   * @private
   * @type {boolean}
   */
  #hasPanel = false;

  /**
   * Creates an instance of ChatAlertRenderer.
   * @param {object} dependencies The dependencies for the renderer.
   * @param {ILogger} dependencies.logger The logger instance.
   * @param {IDocumentContext} dependencies.documentContext The document context abstraction.
   * @param {IValidatedEventDispatcher} dependencies.validatedEventDispatcher The validated event dispatcher.
   * @param {DomElementFactory} dependencies.domElementFactory The factory for creating DOM elements.
   * @param {AlertRouter} dependencies.alertRouter The router that directs alerts.
   * @param {AlertMessageFormatter} dependencies.alertMessageFormatter The formatter for creating alert messages.
   * @throws {Error} If any of the required dependencies are missing.
   */
  constructor({
    logger,
    documentContext,
    validatedEventDispatcher,
    domElementFactory,
    alertRouter,
    alertMessageFormatter,
  }) {
    super({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig: {
        chatPanel: { selector: '#message-list', required: false },
      },
    });

    // --- Dependency Validation ---
    if (!alertRouter) {
      throw new Error(`${this._logPrefix} AlertRouter dependency is required.`);
    }
    if (!alertMessageFormatter) {
      throw new Error(
        `${this._logPrefix} AlertMessageFormatter dependency is required.`
      );
    }
    // domElementFactory is expected to be needed for the full implementation
    if (!domElementFactory) {
      throw new Error(
        `${this._logPrefix} DomElementFactory dependency is required.`
      );
    }

    this.#alertRouter = alertRouter;
    this.#alertMessageFormatter = alertMessageFormatter;

    // --- DOM Detection and Readiness Notification ---
    this.#hasPanel = !!this.elements.chatPanel;

    if (this.#hasPanel) {
      this.logger.debug(
        `${this._logPrefix} Chat panel found. Notifying AlertRouter that UI is ready.`
      );
      // Crucially, signal that this UI component is ready to handle alerts.
      this.#alertRouter.notifyUIReady();
    } else {
      this.logger.warn(
        `${this._logPrefix} Chat panel ('#message-list') not found. This renderer will not display any alerts.`
      );
    }

    // --- Event Subscriptions ---
    this._addSubscription(
      this.validatedEventDispatcher.subscribe(
        'ui:display_warning',
        this.#handleWarning.bind(this)
      )
    );
    this._addSubscription(
      this.validatedEventDispatcher.subscribe(
        'ui:display_error',
        this.#handleError.bind(this)
      )
    );

    this.logger.debug(`${this._logPrefix} Initialized.`);
  }

  /**
   * Handles the 'ui:display_warning' event. This is a placeholder for future implementation.
   * @private
   * @param {IEvent<DisplayWarningPayload>} event The event object containing the warning details.
   * @todo Implement the rendering logic for warnings in the chat panel.
   */
  #handleWarning(event) {
    if (!this.#hasPanel) {
      return; // Do nothing if the target panel doesn't exist.
    }
    // Note: Full implementation will be in a subsequent ticket.
    this.logger.debug(
      `${this._logPrefix} Placeholder: Received warning to display:`,
      event.payload
    );
  }

  /**
   * Handles the 'ui:display_error' event. This is a placeholder for future implementation.
   * @private
   * @param {IEvent<DisplayErrorPayload>} event The event object containing the error details.
   * @todo Implement the rendering logic for errors in the chat panel.
   */
  #handleError(event) {
    if (!this.#hasPanel) {
      return; // Do nothing if the target panel doesn't exist.
    }
    // Note: Full implementation will be in a subsequent ticket.
    this.logger.debug(
      `${this._logPrefix} Placeholder: Received error to display:`,
      event.payload
    );
  }
}
