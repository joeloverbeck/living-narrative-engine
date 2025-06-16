// src/domUI/perceptionLogRenderer.js

import { BaseListDisplayComponent } from './baseListDisplayComponent.js';
import { PERCEPTION_LOG_COMPONENT_ID } from '../constants/componentIds.js';
import { TURN_STARTED_ID } from '../constants/eventIds.js';
import createMessageElement from './helpers/createMessageElement.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('./domElementFactory.js').default} DomElementFactory
 * @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 * @typedef {import('../entities/entity.js').default} Entity
 */

/**
 * @typedef {object} CoreTurnStartedPayload
 * @property {import('../interfaces/CommonTypes').NamespacedId} entityId - The ID of the entity whose turn has started.
 * @property {'player'|'ai'} entityType - The type of the entity.
 */

/**
 * @typedef {object} CoreTurnStartedEvent
 * @property {string} type - The event type name (e.g., 'core:turn_started').
 * @property {CoreTurnStartedPayload} payload - The payload of the event.
 */

/**
 * Represents a single log entry object as stored in the perception log component.
 *
 * @typedef {object} LogEntryObject
 * @property {string} descriptionText - The human-readable summary of the event.
 * @property {string} timestamp - When the event occurred.
 * @property {string} perceptionType - The category of the perceived event.
 * @property {import('../interfaces/CommonTypes').NamespacedId} actorId - The ID of the entity that caused the event.
 * @property {import('../interfaces/CommonTypes').NullableNamespacedId} [targetId] - Optional. The ID of the primary target of the event.
 * @property {Array<import('../interfaces/CommonTypes').NamespacedId>} [involvedEntities] - Optional. Other entities involved.
 * @property {import('../interfaces/CommonTypes').NamespacedId} [eventId] - Optional. Unique ID for the log entry or originating event.
 */

/**
 * Represents the data structure for the perception log component.
 *
 * @typedef {object} PerceptionLogComponentData
 * @property {number} maxEntries - Maximum number of entries to retain.
 * @property {LogEntryObject[]} logEntries - An array of perception log objects.
 */

/**
 * Renders perception logs for the current actor into the perception log panel.
 * Extends BaseListDisplayComponent to handle list rendering and DOM binding.
 * Subscribes to 'core:turn_started' to update based on the current actor.
 *
 * @augments {BaseListDisplayComponent<LogEntryObject>}
 */
export class PerceptionLogRenderer extends BaseListDisplayComponent {
  /**
   * @private
   * @type {IEntityManager}
   */
  #entityManager;

  /**
   * @private
   * @type {string | null}
   */
  #currentActorId = null;

  /**
   * Creates an instance of PerceptionLogRenderer.
   *
   * @param {object} dependencies - Required services and factories.
   * @param {ILogger} dependencies.logger - The logger instance.
   * @param {IDocumentContext} dependencies.documentContext - The document context abstraction.
   * @param {IValidatedEventDispatcher} dependencies.validatedEventDispatcher - The validated event dispatcher.
   * @param {DomElementFactory} dependencies.domElementFactory - The DOM element factory.
   * @param {IEntityManager} dependencies.entityManager - The entity manager instance.
   */
  constructor({
    logger,
    documentContext,
    validatedEventDispatcher,
    domElementFactory,
    entityManager,
  }) {
    const elementsConfig = {
      listContainerElement: {
        selector: '#perception-log-list',
        required: true,
        expectedType: HTMLUListElement,
      },
    };

    super({
      logger,
      documentContext,
      validatedEventDispatcher,
      domElementFactory,
      elementsConfig,
      scrollContainerKey: 'listContainerElement',
      contentContainerKey: 'listContainerElement',
      entityManager,
    });

    if (
      !entityManager ||
      typeof entityManager.getEntityInstance !== 'function'
    ) {
      const errMsg = `${this._logPrefix} 'entityManager' dependency is missing or invalid.`;
      this.logger.error(errMsg);
      throw new Error(errMsg);
    }
    this.#entityManager = entityManager;

    this.#currentActorId = null;

    this._subscribe(TURN_STARTED_ID, this.#handleTurnStarted.bind(this));
    this.logger.debug(
      `${this._logPrefix} Subscribed to VED event '${TURN_STARTED_ID}'.`
    );

    this.logger.debug(`${this._logPrefix} Initialized.`);
  }

  /**
   * Public getter for currentActorId (for testing)
   *
   * @returns {string | null} The ID of the actor whose perceptions are displayed.
   */
  get '#currentActorId'() {
    return this.#currentActorId;
  }

  /**
   * Public setter for currentActorId (for testing)
   *
   * @param {string | null} value - The actor ID to display logs for.
   */
  set '#currentActorId'(value) {
    this.#currentActorId = value;
  }

  /**
   * Fetches perception log data for the current actor.
   *
   * @protected
   * @override
   * @returns {Promise<LogEntryObject[]> | LogEntryObject[]} An array of log entry objects or an empty array.
   */
  _getListItemsData() {
    this.logger.debug(
      `${this._logPrefix} _getListItemsData called. Current actor ID: ${this.#currentActorId}`
    );
    if (!this.#currentActorId) {
      return [];
    }

    try {
      const actorEntity = this.#entityManager.getEntityInstance(
        this.#currentActorId
      );
      if (!actorEntity) {
        this.logger.warn(
          `${this._logPrefix} Actor entity '${this.#currentActorId}' not found in _getListItemsData.`
        );
        return [];
      }

      if (!actorEntity.hasComponent(PERCEPTION_LOG_COMPONENT_ID)) {
        this.logger.debug(
          `${this._logPrefix} Actor '${this.#currentActorId}' does not have a '${PERCEPTION_LOG_COMPONENT_ID}' component.`
        );
        return [];
      }

      const perceptionData = actorEntity.getComponentData(
        PERCEPTION_LOG_COMPONENT_ID
      );

      if (
        !perceptionData ||
        !Array.isArray(perceptionData.logEntries) ||
        perceptionData.logEntries.length === 0
      ) {
        this.logger.debug(
          `${this._logPrefix} Actor '${this.#currentActorId}' has '${PERCEPTION_LOG_COMPONENT_ID}' component, but 'logEntries' are empty or malformed.`
        );
        return [];
      }

      this.logger.debug(
        `${this._logPrefix} Successfully fetched ${perceptionData.logEntries.length} log entries for actor '${this.#currentActorId}'.`
      );
      return perceptionData.logEntries;
    } catch (error) {
      this.logger.error(
        `${this._logPrefix} Error fetching perception log data for actor '${this.#currentActorId}':`,
        error
      );
      return [];
    }
  }

  /**
   * Renders a single perception-log entry with Parchment-Fantasy markup.
   * Distinguishes three kinds of lines:
   *   – SPEECH: `<Name> says:` prefix
   *   – ACTION: whole line wrapped in *asterisks*
   *   – GENERIC: everything else
   * Each gets a class so CSS can paint it pretty.
   */
  _renderListItem(logEntry, _itemIndex, _listData) {
    if (
      !logEntry ||
      typeof logEntry !== 'object' ||
      typeof logEntry.descriptionText !== 'string'
    ) {
      this.logger.warn(
        `${this._logPrefix} malformed log entry, skipped:`,
        logEntry
      );
      return null;
    }

    const text = logEntry.descriptionText.trim();
    let liClass = 'log-generic';
    let innerFragments = [];

    // 1️⃣ Speech («Alice says: Hello»)
    const speechMatch = text.match(/^([^:]+?)\s+says:\s*(.+)$/i);
    if (speechMatch) {
      liClass = 'log-speech';
      const [_, speaker, utterance] = speechMatch;
      innerFragments.push(
        `<span class="speaker-cue">${speaker} says:</span> ${this.#escapeHtml(
          utterance
        )}`
      );
    } else if (/^\*[^*]+\*$/.test(text)) {
      // 2️⃣ Pure action line («*Draws sword*»)
      liClass = 'log-action';
      innerFragments.push(
        `<span class="action-text">${this.#escapeHtml(
          text.replace(/^\*|\*$/g, '')
        )}</span>`
      );
    } else {
      // 3️⃣ Generic line («Jon has arrived at Tavern»)
      innerFragments.push(this.#escapeHtml(text));
    }

    const li =
      this.domElementFactory?.li?.(liClass) ??
      this.documentContext.create('li');
    li.classList.add(liClass);
    li.innerHTML = innerFragments.join('');
    li.title = `Time: ${logEntry.timestamp}`;

    return li;
  }

  /**
   * Mildly paranoid HTML escape helper.
   */
  #escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Provides the message to display when the perception log list is empty.
   *
   * @protected
   * @override
   * @returns {string | HTMLElement} The message or element to display for an empty list.
   */
  _getEmptyListMessage() {
    if (!this.#currentActorId) {
      return 'No actor selected.';
    }

    try {
      const actorEntity = this.#entityManager.getEntityInstance(
        this.#currentActorId
      );
      if (!actorEntity) {
        return `Actor '${this.#currentActorId}' not found. Cannot display perception log.`;
      }

      if (!actorEntity.hasComponent(PERCEPTION_LOG_COMPONENT_ID)) {
        return 'No perception log component for this actor.';
      }

      const perceptionData = actorEntity.getComponentData(
        PERCEPTION_LOG_COMPONENT_ID
      );
      if (
        !perceptionData ||
        !Array.isArray(perceptionData.logEntries) ||
        perceptionData.logEntries.length === 0
      ) {
        return 'Perception log is empty.';
      }
    } catch (error) {
      this.logger.error(
        `${this._logPrefix} Error in _getEmptyListMessage:`,
        error
      );
    }

    return 'No actor selected.';
  }

  /**
   * Called after the list has been rendered. Scrolls to bottom.
   *
   * @protected
   * @override
   * @param {LogEntryObject[] | null} _listData - The data that was rendered.
   * @param {HTMLElement} _container - The list container element.
   */
  _onListRendered(_listData, _container) {
    this.logger.debug(
      `${this._logPrefix} _onListRendered called. Scrolling to bottom.`
    );
    this.scrollToBottom();
  }

  /**
   * Handles the 'core:turn_started' event.
   * Made available for testing.
   *
   * @param {CoreTurnStartedEvent} event - The event object from VED.
   * @returns {void}
   */
  '#handleTurnStarted'(event) {
    this.logger.debug(
      `${this._logPrefix} #handleTurnStarted received '${event.type}' event. Payload:`,
      event.payload
    );

    if (
      !event.payload ||
      typeof event.payload.entityId !== 'string' ||
      !event.payload.entityId
    ) {
      this.logger.warn(
        `${this._logPrefix} '${event.type}' event is missing entityId or entityId is invalid. Clearing current actor and refreshing list.`
      );
      this.#currentActorId = null;
    } else {
      this.#currentActorId = event.payload.entityId;
      this.logger.debug(
        `${this._logPrefix} Current actor ID set to: ${this.#currentActorId}`
      );
    }

    this.refreshList().catch((error) => {
      this.logger.error(
        `${this._logPrefix} Error during refreshList in #handleTurnStarted:`,
        error
      );
      if (this.elements.listContainerElement) {
        const pError = createMessageElement(
          this.domElementFactory,
          'error-message',
          'Error updating perception log.'
        );
        this.elements.listContainerElement.innerHTML = '';
        this.elements.listContainerElement.appendChild(pError);
      }
    });
  }

  /**
   * Private method that actually handles the turn started event.
   *
   * @private
   * @param {CoreTurnStartedEvent} event - The event object from VED.
   * @returns {void}
   */
  #handleTurnStarted(event) {
    return this['#handleTurnStarted'](event);
  }

  /**
   * Disposes of resources.
   *
   * @override
   */
  dispose() {
    this.logger.debug(`${this._logPrefix} Disposing PerceptionLogRenderer.`);
    super.dispose();
    this.#currentActorId = null;
    this.logger.debug(`${this._logPrefix} PerceptionLogRenderer disposed.`);
  }
}
