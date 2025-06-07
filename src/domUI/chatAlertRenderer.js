// src/domUI/chatAlertRenderer.js

import { BoundDomRendererBase } from './boundDomRendererBase.js';
import { escapeHtml } from '../utils/textUtils.js';

/**
 * @typedef {import('../interfaces/ILogger').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('./domElementFactory.js').default} DomElementFactory
 * @typedef {import('../alerting/alertRouter.js').default} AlertRouter
 * @typedef {import('../alerting/alertMessageFormatter.js').default} AlertMessageFormatter
 * @typedef {import('../events/event.js').IEvent} IEvent
 * @typedef {import('../models/data/common.js').DisplayWarningPayload} DisplayWarningPayload
 * @typedef {import('../models/data/common.js').DisplayErrorPayload} DisplayErrorPayload
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
   * The factory for creating DOM elements.
   * @private
   * @type {DomElementFactory}
   */
  #domElementFactory;

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
    if (!domElementFactory) {
      throw new Error(
        `${this._logPrefix} DomElementFactory dependency is required.`
      );
    }

    this.#alertRouter = alertRouter;
    this.#alertMessageFormatter = alertMessageFormatter;
    this.#domElementFactory = domElementFactory;

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
   * Scrolls the chat panel to the bottom to ensure the latest message is visible.
   * @private
   */
  #scrollToBottom() {
    if (this.elements.chatPanel) {
      this.elements.chatPanel.scrollTop = this.elements.chatPanel.scrollHeight;
    }
  }

  /**
   * Creates and appends an alert bubble to the chat panel.
   * @private
   * @param {object} config
   * @param {'warning' | 'error'} config.type The type of alert.
   * @param {string} config.displayMessage The main message for the user.
   * @param {string | null} config.developerDetails The technical details for developers.
   */
  #createAndAppendBubble({ type, displayMessage, developerDetails }) {
    const isError = type === 'error';
    const bubbleClass = isError ? 'chat-error-bubble' : 'chat-warning-bubble';
    const icon = isError ? '❌' : '⚠️';
    const title = isError ? 'Error' : 'Warning';
    const role = isError ? 'alert' : 'status';
    const ariaLive = isError ? 'assertive' : 'polite';

    const bubbleElement = this.#domElementFactory.create('li', {
      cls: `chat-alert ${bubbleClass}`,
      attrs: { role, 'aria-live': ariaLive },
    });
    if (!bubbleElement) return;

    const iconElement = this.#domElementFactory.span('chat-alert-icon', icon);
    if (iconElement) {
      iconElement.setAttribute('aria-hidden', 'true');
      bubbleElement.appendChild(iconElement);
    }

    const contentWrapper = this.#domElementFactory.div('chat-alert-content');
    if (!contentWrapper) return;

    const titleElement = this.#domElementFactory.create('strong', {
      cls: 'chat-alert-title',
      text: title,
    });
    if (titleElement) contentWrapper.appendChild(titleElement);

    const messageElement = this.#domElementFactory.p(
      'chat-alert-message',
      displayMessage
    );
    if (messageElement) contentWrapper.appendChild(messageElement);

    if (developerDetails) {
      const detailsContainer = this.#domElementFactory.create('details', {
        cls: 'chat-alert-details',
      });
      if (detailsContainer) {
        const summary = this.#domElementFactory.create('summary', {
          text: 'Details',
        });
        const code = this.#domElementFactory.create('code', {
          text: developerDetails,
        });
        if (summary) detailsContainer.appendChild(summary);
        if (code) detailsContainer.appendChild(code);
        contentWrapper.appendChild(detailsContainer);
      }
    }

    bubbleElement.appendChild(contentWrapper);

    this.elements.chatPanel.appendChild(bubbleElement);
    this.#scrollToBottom();
  }

  /**
   * Handles the 'ui:display_warning' event.
   * @private
   * @param {IEvent<DisplayWarningPayload>} event The event object containing the warning details.
   */
  #handleWarning(event) {
    const { details } = event.payload;
    const { displayMessage, developerDetails } =
      this.#alertMessageFormatter.format(details);

    if (!this.#hasPanel) {
      const consoleMessage = `[UI WARNING] ${displayMessage}${
        developerDetails ? ` | Details: ${developerDetails}` : ''
      }`;
      this.logger.warn(consoleMessage);
      return;
    }

    this.#createAndAppendBubble({
      type: 'warning',
      displayMessage: escapeHtml(displayMessage),
      developerDetails: escapeHtml(developerDetails),
    });
  }

  /**
   * Handles the 'ui:display_error' event.
   * @private
   * @param {IEvent<DisplayErrorPayload>} event The event object containing the error details.
   */
  #handleError(event) {
    const { details } = event.payload;
    const { displayMessage, developerDetails } =
      this.#alertMessageFormatter.format(details);

    if (!this.#hasPanel) {
      const consoleMessage = `[UI ERROR] ${displayMessage}${
        developerDetails ? ` | Details: ${developerDetails}` : ''
      }`;
      this.logger.error(consoleMessage);
      return;
    }

    this.#createAndAppendBubble({
      type: 'error',
      displayMessage: escapeHtml(displayMessage),
      developerDetails: escapeHtml(developerDetails),
    });
  }
}
