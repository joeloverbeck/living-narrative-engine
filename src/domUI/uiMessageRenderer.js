// src/domUI/uiMessageRenderer.js
import { BoundDomRendererBase } from './boundDomRendererBase.js';
// DomElementFactory is not explicitly imported if only used via this.#domElementFactory,
// but good practice to keep it if it was there or if type hints are desired.
// import DomElementFactory from './domElementFactory.js';
import {
  ACTION_FAILED_ID,
  DISPLAY_MESSAGE_ID,
  SYSTEM_ERROR_OCCURRED_ID,
} from '../constants/eventIds.js';

/**
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('../interfaces/ILogger').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('./domElementFactory.js').default} DomElementFactory // Ensure this is the correct path for DomElementFactory
 * @typedef {import('../interfaces/IEventSubscription').IEventSubscription} IEventSubscription
 * @typedef {import('../interfaces/IEvent.js').IEvent} IEvent
 */

/**
 * @typedef {'info'|'warning'|'error'|'success'|'combat'|'combat_hit'|'combat_critical'|'sound'|'prompt'|'internal'|'debug'|'echo'|'fatal'|'speech'} MessageType
 */

/**
 * @typedef {object} DisplayMessagePayload
 * @property {string} message The message content to display to the user.
 * @property {MessageType} [type='info'] A category hint for the message.
 * @property {boolean} [allowHtml=false] If true, the message content will be treated as HTML.
 */

/**
 * Renders player-facing messages (info, echo, fatal, etc.) and wires
 * itself to the VED so tests can invoke the same code paths.
 *
 * @augments BoundDomRendererBase
 */
export class UiMessageRenderer extends BoundDomRendererBase {
  /** @type {DomElementFactory|null}           */
  #domElementFactory;
  // #subscriptions array is removed, _addSubscription from RendererBase is used.
  // #messageList and #outputDivElement private caches are removed, use this.elements.

  /**
   * Creates a UIMessageRenderer.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {ILogger} deps.logger - Logger instance.
   * @param {IDocumentContext} deps.documentContext - DOM abstraction.
   * @param {IValidatedEventDispatcher} deps.validatedEventDispatcher - Event dispatcher.
   * @param {DomElementFactory|null} [deps.domElementFactory] - Optional element factory.
   */
  constructor({
    logger,
    documentContext,
    validatedEventDispatcher,
    domElementFactory = null,
  }) {
    const elementsConfig = {
      outputDivElement: { selector: '#outputDiv', required: true }, // Used for scrolling and as potential parent
      messageList: { selector: '#message-list', required: false }, // Will be created if not found
    };

    super({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig,
    });

    if (!domElementFactory || typeof domElementFactory.create !== 'function') {
      this.logger.error(
        `${this._logPrefix} DomElementFactory dependency is missing or invalid.`
      );
      this.#domElementFactory = null;
    } else {
      this.#domElementFactory = domElementFactory;
    }

    // Logic from #ensureMessageList moved here, after this.elements is populated by super()
    if (
      !this.elements.messageList &&
      this.elements.outputDivElement &&
      this.#domElementFactory
    ) {
      this.logger.info(
        `${this._logPrefix} #message-list element not found by selector. Attempting to create it inside #outputDivElement.`
      );
      const createdMessageList = this.#domElementFactory.create('ul', {
        id: 'message-list',
        attrs: { 'aria-live': 'polite' },
      });

      if (createdMessageList) {
        this.elements.outputDivElement.appendChild(createdMessageList);
        this.elements.messageList = createdMessageList; // Assign to this.elements
        this.logger.info(
          `${this._logPrefix} #message-list created dynamically inside #outputDivElement and assigned to this.elements.messageList.`
        );
      } else {
        this.logger.error(
          `${this._logPrefix} Failed to create #message-list element dynamically using #domElementFactory.`
        );
        // this.elements.messageList remains null
      }
    } else if (!this.elements.messageList && !this.elements.outputDivElement) {
      this.logger.error(
        `${this._logPrefix} Cannot ensure #message-list exists: #outputDivElement (required container) also not found in this.elements.`
      );
    } else if (this.elements.messageList) {
      this.logger.debug(
        `${this._logPrefix} #message-list element found and bound via BoundDomRendererBase.`
      );
      // Ensure outputDivElement is correctly associated if messageList was found independently
      if (
        this.elements.outputDivElement &&
        this.elements.messageList.parentElement !==
          this.elements.outputDivElement
      ) {
        this.logger.warn(
          `${this._logPrefix} Found #message-list is not a child of the bound #outputDivElement. Scrolling behavior might be unexpected if #outputDivElement is not the intended scroll container for #message-list.`
        );
      } else if (
        !this.elements.outputDivElement &&
        this.elements.messageList.parentElement
      ) {
        // If outputDivElement wasn't found by its specific selector, but messageList has a parent,
        // we might infer the scroll container. However, outputDivElement is 'required: true',
        // so BoundDomRendererBase would have logged an error if it wasn't found.
        // This scenario implies #outputDiv has a different ID or structure.
        this.logger.debug(
          `${this._logPrefix} #outputDivElement not initially bound, but #message-list has a parent. Primary scroll target will be this.elements.outputDivElement if it later becomes available through other means, or fallback to messageList's parent/body.`
        );
      }
    }

    // VED subscriptions using _addSubscription from RendererBase
    this._addSubscription(
      this.validatedEventDispatcher.subscribe(
        DISPLAY_MESSAGE_ID,
        this.#onShow.bind(this)
      )
    );
    this._addSubscription(
      this.validatedEventDispatcher.subscribe(
        SYSTEM_ERROR_OCCURRED_ID,
        this.#onShowFatal.bind(this)
      )
    );
    this._addSubscription(
      this.validatedEventDispatcher.subscribe(
        ACTION_FAILED_ID, // Assuming this is the correct event for echoing failed actions.
        this.#onCommandEcho.bind(this)
      )
    );

    this.logger.debug(`${this._logPrefix} Subscribed to VED events.`);

    // Test hooks are removed as direct access to private members is bad practice.
    // Tests should verify behavior through public methods or by checking VED subscriptions.
  }

  //----------------------------------------------------------------------
  // Private helpers
  //----------------------------------------------------------------------

  // #ensureMessageList() method is removed. Its logic is in the constructor.

  /** Scroll the #outputDivElement (actual scroll container) to bottom. */
  #scrollToBottom() {
    if (
      this.elements.outputDivElement &&
      typeof this.elements.outputDivElement.scrollTop !== 'undefined' &&
      typeof this.elements.outputDivElement.scrollHeight !== 'undefined'
    ) {
      this.elements.outputDivElement.scrollTop =
        this.elements.outputDivElement.scrollHeight;
    } else {
      this.logger.warn(
        `${this._logPrefix} Could not scroll #outputDivElement. Element or properties missing from this.elements. Attempting fallback scroll on #messageList.`
      );
      if (
        this.elements.messageList &&
        this.elements.messageList.lastChild &&
        typeof this.elements.messageList.lastChild.scrollIntoView === 'function'
      ) {
        this.elements.messageList.lastChild.scrollIntoView({
          behavior: 'auto',
          block: 'end',
        });
        this.logger.debug(
          `${this._logPrefix} Fallback: Scrolled last message in #messageList into view.`
        );
      } else {
        this.logger.warn(
          `${this._logPrefix} Fallback scroll method also failed for #messageList or it's empty.`
        );
      }
    }
  }

  //----------------------------------------------------------------------
  // Public API
  //----------------------------------------------------------------------

  /**
   * Push a message into the list.
   *
   * @param {string} text - Message text to render.
   * @param {MessageType} [type] - Message severity type.
   * @param {boolean} [allowHtml] - Whether to treat text as HTML.
   */
  render(text, type = 'info', allowHtml = false) {
    if (
      !this.elements.messageList ||
      typeof this.elements.messageList.appendChild !== 'function'
    ) {
      this.logger.error(
        `${this._logPrefix} Cannot render message: this.elements.messageList is invalid, not found, or unappendable.`
      );
      return;
    }
    if (!this.#domElementFactory) {
      this.logger.error(
        `${this._logPrefix} Cannot render message: DomElementFactory is missing.`
      );
      return;
    }

    const li = this.#domElementFactory.li(null); // Pass null for cls if no default class needed at creation
    if (!li) {
      this.logger.error(
        `${this._logPrefix} Failed to create message item (li) element using DomElementFactory.`
      );
      return;
    }

    li.classList.add('message');
    li.classList.add(`message-${type}`);

    if (allowHtml) {
      li.innerHTML = text;
    } else {
      li.textContent = text;
    }

    this.elements.messageList.appendChild(li);
    this.#scrollToBottom();
    this.logger.debug(
      `${this._logPrefix} Rendered message: ${type} - ${String(text).substring(0, 50)}`
    );
  }

  //----------------------------------------------------------------------
  // VED handlers
  //----------------------------------------------------------------------

  /**
   * Handles the 'textUI:display_message' event.
   *
   * @param {IEvent<DisplayMessagePayload>} eventObject The full event object delivered by the event bus.
   */
  #onShow(eventObject) {
    if (
      eventObject &&
      eventObject.payload &&
      typeof eventObject.payload.message === 'string'
    ) {
      const message = eventObject.payload.message;
      const type = eventObject.payload.type || 'info';
      const allowHtml = eventObject.payload.allowHtml || false;
      this.render(message, type, allowHtml);
    } else {
      this.logger.warn(
        `${this._logPrefix} Received invalid or malformed 'textUI:display_message' event object.`,
        eventObject
      );
    }
  }

  /**
   * Handles the SYSTEM_ERROR_OCCURRED_ID event.
   *
   * @param {IEvent<any>} eventObject The full event object.
   */
  #onShowFatal(eventObject) {
    const payload = eventObject?.payload;
    if (!payload || typeof payload.message !== 'string') {
      this.logger.error(
        `${this._logPrefix} Received invalid ${SYSTEM_ERROR_OCCURRED_ID} payload.`,
        eventObject
      );
      this.render('An unspecified fatal system error occurred.', 'fatal');
      return;
    }
    let msg = payload.message;
    if (payload.details?.raw) msg += `\nDetails: ${payload.details.raw}`;
    this.logger.error(`${this._logPrefix} Fatal error displayed: ${msg}`); // Log before render as render also logs
    this.render(msg, 'fatal');
  }

  /**
   * Handles 'core:action_failed' for command echo.
   *
   * @param {IEvent<any>} eventObject The full event object.
   */
  #onCommandEcho(eventObject) {
    const payload = eventObject?.payload;
    if (
      payload &&
      typeof payload.originalInput === 'string' &&
      payload.originalInput.trim()
    ) {
      this.render(`> ${payload.originalInput}`, 'echo');
    } else if (
      payload &&
      payload.command &&
      typeof payload.command === 'string' &&
      payload.command.trim()
    ) {
      // Fallback for events that might use 'command' instead of 'originalInput'
      this.logger.info(
        `${this._logPrefix} Echoing 'command' field from event as 'originalInput' was missing or empty.`
      );
      this.render(`> ${payload.command}`, 'echo');
    } else {
      this.logger.warn(
        `${this._logPrefix} Received command echo event (e.g., core:action_failed) without valid originalInput or command.`,
        eventObject
      );
    }
  }

  //----------------------------------------------------------------------
  // Cleanup
  //----------------------------------------------------------------------

  dispose() {
    this.logger.debug(`${this._logPrefix} Disposing UiMessageRenderer.`);
    // VED subscriptions managed by _addSubscription are cleaned up by super.dispose().
    // DOM elements in this.elements are cleared by BoundDomRendererBase's dispose.
    super.dispose();
    // No need to nullify #domElementFactory, #messageList, #outputDivElement, or #subscriptions
    // as they are either constructor-injected and not owned, or managed by the base class.
    this.logger.info(`${this._logPrefix} UiMessageRenderer disposed.`);
  }
}
