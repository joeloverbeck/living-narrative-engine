// src/domUI/chatAlertRenderer.js

import { BoundDomRendererBase } from './boundDomRendererBase.js';
import { escapeHtml } from '../utils/rendererUtils.js';
import { Throttler } from '../alerting/throttler.js';
import { generateKey } from '../alerting/throttleUtils.js';

/**
 * @typedef {import('../interfaces/ILogger').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('./domElementFactory.js').default} DomElementFactory
 * @typedef {import('../alerting/alertRouter.js').default} AlertRouter
 */

/**
 * @class ChatAlertRenderer
 * @augments {BoundDomRendererBase}
 * @description Renders warning and error alerts directly within the main chat/message panel.
 * It detects the presence of the chat panel and signals its readiness to the AlertRouter,
 * preventing alerts from being flushed to the console when a UI target is available.
 * Implements text truncation with "Show more/less" toggles for long messages.
 * It also throttles duplicate alerts to avoid flooding the UI.
 */
export class ChatAlertRenderer extends BoundDomRendererBase {
  /** @private @type {AlertRouter} */
  #alertRouter;
  /** @private @type {DomElementFactory} */
  #domElementFactory;
  /** @private @type {ISafeEventDispatcher} */
  #safeEventDispatcher;
  /** @private @type {Throttler} */
  #warningThrottler;
  /** @private @type {Throttler} */
  #errorThrottler;
  /** @private @type {boolean} */
  #hasPanel = false;
  /** @private @type {number} */
  #alertIdCounter = 0;

  /** @private @readonly @type {number} */
  static MESSAGE_TRUNCATION_LIMIT = 200;
  /** @private @readonly @type {number} */
  static DETAILS_TRUNCATION_LIMIT = 100;

  /**
   * Creates an instance of ChatAlertRenderer.
   *
   * @param {object} dependencies The dependencies for the renderer.
   * @param {ILogger} dependencies.logger The logger instance.
   * @param {IDocumentContext} dependencies.documentContext The document context abstraction.
   * @param {ISafeEventDispatcher} dependencies.safeEventDispatcher The safe event dispatcher.
   * @param {DomElementFactory} dependencies.domElementFactory The factory for creating DOM elements.
   * @param {AlertRouter} dependencies.alertRouter The router that directs alerts.
   * @throws {Error} If any of the required dependencies are missing.
   */
  constructor({
    logger,
    documentContext,
    safeEventDispatcher,
    domElementFactory,
    alertRouter,
  }) {
    // **FIX**: Pass the safe dispatcher to the parent under the key it expects.
    super({
      logger,
      documentContext,
      validatedEventDispatcher: safeEventDispatcher,
      elementsConfig: {
        chatPanel: { selector: '#message-list', required: false },
      },
    });

    // --- Dependency Validation ---
    if (!safeEventDispatcher) {
      throw new Error(
        `${this._logPrefix} ISafeEventDispatcher dependency is required.`
      );
    }
    if (!alertRouter) {
      throw new Error(`${this._logPrefix} AlertRouter dependency is required.`);
    }
    if (!domElementFactory) {
      throw new Error(
        `${this._logPrefix} DomElementFactory dependency is required.`
      );
    }

    this.#safeEventDispatcher = safeEventDispatcher;
    this.#alertRouter = alertRouter;
    this.#domElementFactory = domElementFactory;

    // --- Throttler Instantiation ---
    // **FIX**: Use the explicitly requested safe dispatcher.
    this.#warningThrottler = new Throttler(
      this.#safeEventDispatcher,
      'warning'
    );
    this.#errorThrottler = new Throttler(this.#safeEventDispatcher, 'error');

    // --- DOM Detection and Readiness Notification ---
    this.#hasPanel = !!this.elements.chatPanel;

    if (this.#hasPanel) {
      this.logger.debug(
        `${this._logPrefix} Chat panel found. Notifying AlertRouter that UI is ready.`
      );
      this.#alertRouter.notifyUIReady();
      this._addDomListener(
        this.elements.chatPanel,
        'click',
        this.#handleToggleClick.bind(this)
      );
    } else {
      this.logger.warn(
        `${this._logPrefix} Chat panel ('#message-list') not found. This renderer will not display any alerts.`
      );
    }

    // --- Event Subscriptions ---
    // **FIX**: Use the safe dispatcher for subscriptions for consistency.
    this._addSubscription(
      this.#safeEventDispatcher.subscribe(
        'ui:display_warning',
        this.#handleWarning.bind(this)
      )
    );
    this._addSubscription(
      this.#safeEventDispatcher.subscribe(
        'ui:display_error',
        this.#handleError.bind(this)
      )
    );

    this.logger.debug(`${this._logPrefix} Initialized.`);
  }

  // ... rest of the class methods (createAndAppendBubble, handleWarning, etc.) are unchanged ...
  /**
   * Scrolls the chat panel to the bottom to ensure the latest message is visible.
   *
   * @private
   */
  #scrollToBottom() {
    if (this.elements.chatPanel) {
      this.elements.chatPanel.scrollTop = this.elements.chatPanel.scrollHeight;
    }
  }

  /**
   * Handles click events on the chat panel, delegating to toggle handlers
   * if a toggle button was the event target.
   *
   * @private
   * @param {MouseEvent} event The click event.
   */
  #handleToggleClick(event) {
    const button = event.target.closest('.chat-alert-toggle');
    if (!button) {
      return;
    }

    const toggleType = button.dataset.toggleType;
    if (toggleType === 'message') {
      this.#toggleMessageText(button);
    } else if (toggleType === 'details') {
      this.#toggleDetailsVisibility(button);
    }
  }

  /**
   * Toggles the text content of a message paragraph between its truncated and full versions.
   *
   * @private
   * @param {HTMLButtonElement} button The toggle button that was clicked.
   */
  #toggleMessageText(button) {
    const messageElement = this.documentContext.query(
      `#${button.getAttribute('aria-controls')}`
    );
    if (!messageElement) {
      this.logger.warn(
        `${this._logPrefix} Could not find message element for toggle button.`
      );
      return;
    }

    const isExpanded = button.getAttribute('aria-expanded') === 'true';
    if (isExpanded) {
      // Collapse the text
      messageElement.textContent = messageElement.dataset.truncatedText;
      button.textContent = 'Show more';
      button.setAttribute('aria-expanded', 'false');
    } else {
      // Expand the text
      messageElement.textContent = messageElement.dataset.fullText;
      button.textContent = 'Show less';
      button.setAttribute('aria-expanded', 'true');
    }
  }

  /**
   * Toggles the visibility of the developer details section.
   *
   * @private
   * @param {HTMLButtonElement} button The toggle button that was clicked.
   */
  #toggleDetailsVisibility(button) {
    const detailsContent = this.documentContext.query(
      `#${button.getAttribute('aria-controls')}`
    );
    if (!detailsContent) {
      this.logger.warn(
        `${this._logPrefix} Could not find details content for toggle button.`
      );
      return;
    }

    const isExpanded = button.getAttribute('aria-expanded') === 'true';
    detailsContent.hidden = isExpanded;
    button.setAttribute('aria-expanded', !isExpanded);
  }

  /**
   * Creates and appends an alert bubble to the chat panel.
   *
   * @private
   * @param {object} config
   * @param {'warning' | 'error'} config.type The type of alert.
   * @param {string} config.displayMessage The main, already-escaped message for the user.
   * @param {string | null} config.developerDetails The already-escaped technical details for developers.
   */
  #createAndAppendBubble({ type, displayMessage, developerDetails }) {
    this.#alertIdCounter++;
    const messageId = `alert-msg-${this.#alertIdCounter}`;
    const detailsId = `alert-details-${this.#alertIdCounter}`;

    const isError = type === 'error';
    // MODIFIED: Use camelCase class names to match the new centralized CSS module.
    const bubbleClass = isError ? 'chat-errorBubble' : 'chat-warningBubble';
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
      const srText = this.#domElementFactory.span('visually-hidden', title);
      if (srText) bubbleElement.appendChild(srText);
    }

    const contentWrapper = this.#domElementFactory.div('chat-alert-content');
    if (!contentWrapper) return;

    const titleElement = this.#domElementFactory.create('strong', {
      cls: 'chat-alert-title',
      text: title,
    });
    if (titleElement) contentWrapper.appendChild(titleElement);

    // --- Message Truncation Logic ---
    const messageElement = this.#domElementFactory.p('chat-alert-message');
    if (messageElement) {
      messageElement.id = messageId;
      let isTruncated = false;
      if (displayMessage.length > ChatAlertRenderer.MESSAGE_TRUNCATION_LIMIT) {
        isTruncated = true;
        const truncated =
          displayMessage.substring(
            0,
            ChatAlertRenderer.MESSAGE_TRUNCATION_LIMIT
          ) + '…';
        messageElement.textContent = truncated;
        messageElement.dataset.fullText = displayMessage;
        messageElement.dataset.truncatedText = truncated;
      } else {
        messageElement.textContent = displayMessage;
      }
      contentWrapper.appendChild(messageElement);

      if (isTruncated) {
        const toggleBtn = this.#domElementFactory.create('button', {
          text: 'Show more',
          cls: 'chat-alert-toggle',
          attrs: {
            'aria-expanded': 'false',
            'aria-controls': messageId,
            'data-toggle-type': 'message',
          },
        });
        if (toggleBtn) contentWrapper.appendChild(toggleBtn);
      }
    }

    // --- Developer Details Collapsible Section ---
    if (developerDetails) {
      const detailsContainer = this.#domElementFactory.div(
        'chat-alert-details-container'
      );
      if (detailsContainer) {
        const toggleBtn = this.#domElementFactory.create('button', {
          text: 'Developer details',
          cls: 'chat-alert-toggle',
          attrs: {
            'aria-expanded': 'false',
            'aria-controls': detailsId,
            'data-toggle-type': 'details',
          },
        });

        const preElement = this.#domElementFactory.create('pre', {
          cls: 'chat-alert-details', // Let CSS handle visibility via [hidden]
          id: detailsId,
        });
        preElement.hidden = true; // Hidden by default

        const codeElement = this.#domElementFactory.create('code', {
          text: developerDetails,
        });
        if (codeElement) preElement.appendChild(codeElement);

        if (toggleBtn) detailsContainer.appendChild(toggleBtn);
        if (preElement) detailsContainer.appendChild(preElement);
        contentWrapper.appendChild(detailsContainer);
      }
    }

    bubbleElement.appendChild(contentWrapper);
    this.elements.chatPanel.appendChild(bubbleElement);
    this.#scrollToBottom();
  }

  /**
   * Creates a user-friendly message from raw details when none is provided.
   *
   * @private
   * @param {any} details The raw details object from the event payload.
   * @returns {string} A user-facing message.
   */
  #getUserFriendlyMessage(details) {
    if (!details || typeof details !== 'object') {
      return 'An unknown warning/error occurred.';
    }

    switch (details.statusCode) {
      case 401:
      case 403:
        return 'Authentication failed. Please check your credentials or permissions.';
      case 404:
        return 'The requested resource could not be found.';
      case 500:
        return 'An unexpected server error occurred. Please try again later.';
      case 503:
        return 'Service temporarily unavailable. Please retry in a moment.';
      default:
        return details.message || 'An unexpected error occurred.';
    }
  }

  /**
   * Extracts a developer-focused details string from a raw details object.
   *
   * @private
   * @param {any} details The raw details object from the event payload.
   * @returns {string | null} A details string or null if not applicable.
   */
  #extractDeveloperDetails(details) {
    if (!details || typeof details !== 'object') {
      return details === null ? 'null' : `Malformed details: ${typeof details}`;
    }

    if (typeof details.statusCode === 'number') {
      const parts = [details.statusCode];
      if (details.raw) parts.push(details.raw);
      if (details.url) parts.push(`at ${details.url}`);
      return parts.join(' ');
    }

    return null;
  }

  /**
   * Handles the 'ui:display_warning' event.
   *
   * @private
   * @param {IEvent<DisplayWarningPayload>} event The event object containing the warning details.
   */
  #handleWarning(event) {
    const { message, details } = event.payload;

    const canonicalMessage = message || this.#getUserFriendlyMessage(details);
    const displayMessage = canonicalMessage;
    const developerDetails = this.#extractDeveloperDetails(details);

    if (!this.#hasPanel) {
      const consoleMessage = `[UI WARNING] ${displayMessage}${
        developerDetails ? ` | Details: ${developerDetails}` : ''
      }`;
      this.logger.warn(consoleMessage);
      return;
    }

    // --- Throttling Logic ---
    const escapedMessage = escapeHtml(displayMessage);
    const key = generateKey(escapedMessage, details);
    const shouldRender = this.#warningThrottler.allow(key, {
      message: canonicalMessage,
      details: details,
    });

    if (!shouldRender) {
      return; // Suppress the alert
    }
    // --- End Throttling Logic ---

    this.#createAndAppendBubble({
      type: 'warning',
      displayMessage: escapedMessage,
      developerDetails: developerDetails ? escapeHtml(developerDetails) : null,
    });
  }

  /**
   * Handles the 'ui:display_error' event.
   *
   * @private
   * @param {IEvent<DisplayErrorPayload>} event The event object containing the error details.
   */
  #handleError(event) {
    const { message, details } = event.payload;

    const canonicalMessage = message || this.#getUserFriendlyMessage(details);
    const displayMessage = canonicalMessage;
    const developerDetails = this.#extractDeveloperDetails(details);

    if (!this.#hasPanel) {
      const consoleMessage = `[UI ERROR] ${displayMessage}${
        developerDetails ? ` | Details: ${developerDetails}` : ''
      }`;
      this.logger.error(consoleMessage);
      return;
    }

    // --- Throttling Logic ---
    const escapedMessage = escapeHtml(displayMessage);
    const key = generateKey(escapedMessage, details);
    const shouldRender = this.#errorThrottler.allow(key, {
      message: canonicalMessage,
      details: details,
    });

    if (!shouldRender) {
      return; // Suppress the alert
    }
    // --- End Throttling Logic ---

    this.#createAndAppendBubble({
      type: 'error',
      displayMessage: escapedMessage,
      developerDetails: developerDetails ? escapeHtml(developerDetails) : null,
    });
  }
}
