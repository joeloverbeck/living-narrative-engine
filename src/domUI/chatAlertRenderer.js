/**
 * @file This module is in charge of displaying warning and error messages in the chat panel.
 * @see src/domUI/chatAlertRenderer.js
 */

import { BoundDomRendererBase } from './boundDomRendererBase.js';
import { Throttler } from '../alerting/throttler.js';
import { generateKey } from '../utils/throttleUtils.js';
// Import the centralized utility function.
import { getUserFriendlyMessage } from '../alerting/statusCodeMapper.js';

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
    super({
      logger,
      documentContext,
      validatedEventDispatcher: safeEventDispatcher,
      elementsConfig: {
        scrollContainer: { selector: '#outputDiv', required: true },
        chatPanel: { selector: '#message-list', required: false },
      },
      scrollContainerKey: 'scrollContainer',
      contentContainerKey: 'chatPanel',
      domElementFactory,
    });

    // --- Dependency Validation ---
    if (!alertRouter) {
      throw new Error(`${this._logPrefix} AlertRouter dependency is required.`);
    }

    this.#safeEventDispatcher = safeEventDispatcher;
    this.#alertRouter = alertRouter;

    // --- Throttler Instantiation ---
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
    this._subscribe('core:display_warning', this.#handleWarning.bind(this));
    this._subscribe('core:display_error', this.#handleError.bind(this));

    this.logger.debug(`${this._logPrefix} Initialized.`);
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
   * @param {string} config.displayMessage The main, unescaped message for the user.
   * @param {string | null} config.developerDetails The unescaped technical details for developers.
   */
  #createAndAppendBubble({ type, displayMessage, developerDetails }) {
    this.#alertIdCounter++;
    const messageId = `alert-msg-${this.#alertIdCounter}`;
    const detailsId = `alert-details-${this.#alertIdCounter}`;

    const isError = type === 'error';
    const bubbleClass = isError ? 'chat-errorBubble' : 'chat-warningBubble';
    const icon = isError ? '❌' : '⚠️';
    const title = isError ? 'Error' : 'Warning';
    const role = isError ? 'alert' : 'status';
    const ariaLive = isError ? 'assertive' : 'polite';

    const bubbleElement = this.domElementFactory.create('li', {
      cls: `chat-alert ${bubbleClass}`,
      attrs: { role, 'aria-live': ariaLive },
    });
    if (!bubbleElement) return;

    const iconElement = this.domElementFactory.span('chat-alert-icon', icon);
    if (iconElement) {
      iconElement.setAttribute('aria-hidden', 'true');
      bubbleElement.appendChild(iconElement);
      const srText = this.domElementFactory.span('visually-hidden', title);
      if (srText) bubbleElement.appendChild(srText);
    }

    const contentWrapper = this.domElementFactory.div('chat-alert-content');
    if (!contentWrapper) return;

    const titleElement = this.domElementFactory.create('strong', {
      cls: 'chat-alert-title',
      text: title,
    });
    if (titleElement) contentWrapper.appendChild(titleElement);

    const messageElement = this.domElementFactory.p('chat-alert-message');
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
        const toggleBtn = this.domElementFactory.create('button', {
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

    if (developerDetails) {
      const detailsContainer = this.domElementFactory.div('chat-alert-details');
      if (detailsContainer) {
        const toggleBtn = this.domElementFactory.create('button', {
          text: 'Developer details',
          cls: 'chat-alert-toggle',
          attrs: {
            'aria-expanded': 'false',
            'aria-controls': detailsId,
            'data-toggle-type': 'details',
          },
        });

        const preElement = this.domElementFactory.create('pre', {
          cls: 'chat-alert-details-content',
          id: detailsId,
        });
        preElement.hidden = true;

        const codeElement = this.domElementFactory.create('code', {
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
    this.scrollToBottom();
  }

  /**
   * Extracts a developer-focused details string from a raw details object.
   * This is kept because it handles non-HTTP errors (e.g., standard Error objects)
   * more robustly than the basic `devDetails` from the utility.
   *
   * @private
   * @param {any} details The raw details object from the event payload.
   * @returns {string | null} A details string or null if not applicable.
   */
  #extractDeveloperDetails(details) {
    if (!details) return null;

    if (details instanceof Error && typeof details.stack === 'string') {
      return details.stack;
    }

    if (typeof details === 'object' && typeof details.statusCode === 'number') {
      const parts = [];
      if (details.statusCode) parts.push(`Status Code: ${details.statusCode}`);
      if (details.url) parts.push(`URL: ${details.url}`);
      // The `raw` property can be an object or a string.
      if (details.raw) {
        const rawDetails =
          typeof details.raw === 'object'
            ? JSON.stringify(details.raw, null, 2)
            : details.raw;
        parts.push(`Details: ${rawDetails}`);
      }
      if (details.stack) {
        parts.push(`\nStack Trace:\n${details.stack}`);
      }
      return parts.join('\n');
    }

    if (typeof details === 'string' || typeof details === 'number') {
      return String(details);
    }

    if (typeof details === 'object' && Object.keys(details).length > 0) {
      try {
        return JSON.stringify(details, null, 2);
      } catch (e) {
        return 'Could not serialize details object.';
      }
    }

    return null;
  }

  /**
   * Shared logic for handling warning and error alert events.
   *
   * @private
   * @param {'warning' | 'error'} type The type of alert to process.
   * @param {IEvent<DisplayWarningPayload | DisplayErrorPayload>} event The event object containing alert details.
   */
  #handleAlert(type, event) {
    const { message, details } = event.payload;

    const { displayMessage: messageFromDetails } = getUserFriendlyMessage(
      details,
      message
    );

    const displayMessage = message || messageFromDetails;
    const developerDetails = this.#extractDeveloperDetails(details);

    if (!this.#hasPanel) {
      const consoleMessage = `[UI ${type.toUpperCase()}] ${displayMessage}${
        developerDetails ? ` | Details: ${developerDetails}` : ''
      }`;
      if (type === 'warning') {
        this.logger.warn(consoleMessage);
      } else {
        this.logger.error(consoleMessage);
      }
      return;
    }

    const key = generateKey(displayMessage, details);
    const throttler =
      type === 'warning' ? this.#warningThrottler : this.#errorThrottler;
    const shouldRender = throttler.allow(key, {
      message: displayMessage,
      details: details,
    });

    if (!shouldRender) {
      return;
    }

    this.#createAndAppendBubble({
      type,
      displayMessage,
      developerDetails,
    });
  }

  /**
   * Handles the 'core:display_warning' event.
   *
   * @private
   * @param {IEvent<DisplayWarningPayload>} event The event object containing the warning details.
   */
  #handleWarning(event) {
    this.#handleAlert('warning', event);
  }

  /**
   * Handles the 'core:display_error' event.
   *
   * @private
   * @param {IEvent<DisplayErrorPayload>} event The event object containing the error details.
   */
  #handleError(event) {
    this.#handleAlert('error', event);
  }
}
