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
 */

/**
 * @class ChatAlertRenderer
 * @extends {BoundDomRendererBase}
 * @description Renders warning and error alerts directly within the main chat/message panel.
 * It detects the presence of the chat panel and signals its readiness to the AlertRouter,
 * preventing alerts from being flushed to the console when a UI target is available.
 * Implements text truncation with "Show more/less" toggles for long messages.
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
   * A counter to generate unique IDs for ARIA attributes.
   * @private
   * @type {number}
   */
  #alertIdCounter = 0;

  /**
   * The character limit before a display message is truncated.
   * @private
   * @readonly
   * @type {number}
   */
  static MESSAGE_TRUNCATION_LIMIT = 200;

  /**
   * The character limit before developer details are considered long.
   * Per the ticket, this is a consideration, but details are always collapsible.
   * @private
   * @readonly
   * @type {number}
   */
  static DETAILS_TRUNCATION_LIMIT = 100;

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
      this.#alertRouter.notifyUIReady();
      // Use event delegation for all toggle clicks within the panel
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
   * Handles click events on the chat panel, delegating to toggle handlers
   * if a toggle button was the event target.
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
      developerDetails: developerDetails ? escapeHtml(developerDetails) : null,
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
      developerDetails: developerDetails ? escapeHtml(developerDetails) : null,
    });
  }
}
