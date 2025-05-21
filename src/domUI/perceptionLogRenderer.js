// src/domUI/perceptionLogRenderer.js

import {RendererBase} from './rendererBase.js';
import {PERCEPTION_LOG_COMPONENT_ID} from "../constants/componentIds.js";
// Assuming component IDs might be imported, but for now, we'll define it locally
// import { PERCEPTION_LOG_COMPONENT_ID } from '../constants/componentIds.js';

/**
 * @typedef {import('../core/interfaces/ILogger').ILogger} ILogger
 * @typedef {import('./IDocumentContext').IDocumentContext} IDocumentContext
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').UnsubscribeFn} UnsubscribeFn
 * @typedef {import('./domElementFactory').default} DomElementFactory
 * @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 * @typedef {import('../entities/entity').default} Entity
 */

/**
 * @typedef {object} CoreTurnStartedPayload
 * @property {import('../core/interfaces/CommonTypes').NamespacedId} entityId
 * @property {'player'|'ai'} entityType
 */

/**
 * @typedef {object} CoreTurnStartedEvent
 * @property {string} type - The event type name (e.g., 'core:turn_started').
 * @property {CoreTurnStartedPayload} payload - The payload of the event.
 */

/**
 * Represents a single log entry object as stored in the component.
 * @typedef {object} LogEntryObject
 * @property {string} descriptionText - The human-readable summary of the event.
 * @property {string} timestamp - When the event occurred.
 * @property {string} perceptionType - The category of the perceived event.
 * @property {import('../core/interfaces/CommonTypes').NamespacedId} actorId - The ID of the entity that caused the event.
 * @property {import('../core/interfaces/CommonTypes').NullableNamespacedId} [targetId] - Optional. The ID of the primary target of the event.
 * @property {Array<import('../core/interfaces/CommonTypes').NamespacedId>} [involvedEntities] - Optional. Other entities involved.
 * @property {import('../core/interfaces/CommonTypes').NamespacedId} [eventId] - Optional. Unique ID for the log entry or originating event.
 */

/**
 * Represents the data structure for the perception log component.
 * @typedef {object} PerceptionLogComponentData
 * @property {number} maxEntries - Maximum number of entries to retain.
 * @property {LogEntryObject[]} logEntries - An array of perception log objects.
 */

const PERCEPTION_LOG_LIST_ID = 'perception-log-list';

/**
 * Renders perception logs for the current actor into the perception log panel.
 * Subscribes to 'core:turn_started' to update based on the current actor.
 */
export class PerceptionLogRenderer extends RendererBase {
    /** @private @type {HTMLElement | null} */
    #logListElement = null;
    /** @private @type {DomElementFactory} */
    #domElementFactory;
    /** @private @type {IEntityManager} */
    #entityManager;
    /** @private @type {Array<UnsubscribeFn|undefined>} */
    #subscriptions = [];
    /** @private @readonly */
    _EVENT_TYPE_SUBSCRIBED = 'core:turn_started';
    /** @private @type {string | null} */
    #currentActorId = null;


    constructor({
                    logger,
                    documentContext,
                    validatedEventDispatcher,
                    domElementFactory,
                    entityManager,
                    // containerElement // Optional: if we pass the #perception-log-widget directly
                }) {
        super({logger, documentContext, validatedEventDispatcher});

        if (!domElementFactory || typeof domElementFactory.create !== 'function') {
            const errMsg = `${this._logPrefix} 'domElementFactory' dependency is missing or invalid.`;
            this.logger.error(errMsg);
            throw new Error(errMsg);
        }
        this.#domElementFactory = domElementFactory;

        if (!entityManager || typeof entityManager.getEntityInstance !== 'function') {
            const errMsg = `${this._logPrefix} 'entityManager' dependency is missing or invalid.`;
            this.logger.error(errMsg);
            throw new Error(errMsg);
        }
        this.#entityManager = entityManager;

        this.#logListElement = this.documentContext.query(`#${PERCEPTION_LOG_LIST_ID}`);
        if (!this.#logListElement) {
            this.logger.error(`${this._logPrefix} Could not find '#${PERCEPTION_LOG_LIST_ID}' element. Perception logs will not be displayed.`);
        } else {
            this.logger.debug(`${this._logPrefix} Attached to log list element:`, this.#logListElement);
        }

        this.#subscribeToEvents();
        this.render([]); // Initial render (empty state)
    }

    /** @private */
    #subscribeToEvents() {
        if (!this.validatedEventDispatcher || typeof this.validatedEventDispatcher.subscribe !== 'function') {
            this.logger.error(`${this._logPrefix} ValidatedEventDispatcher not available or 'subscribe' method is missing.`);
            return;
        }
        const unsubscribeFn = this.validatedEventDispatcher.subscribe(
            this._EVENT_TYPE_SUBSCRIBED,
            this.#handleTurnStarted.bind(this)
        );

        if (typeof unsubscribeFn === 'function') {
            this.#subscriptions.push(unsubscribeFn);
            this.logger.debug(`${this._logPrefix} Subscribed to VED event '${this._EVENT_TYPE_SUBSCRIBED}'.`);
        } else {
            this.logger.error(`${this._logPrefix} Failed to subscribe to VED event '${this._EVENT_TYPE_SUBSCRIBED}'. Expected an unsubscribe function.`);
        }
    }

    /**
     * Handles the 'core:turn_started' event.
     * Fetches the current actor's perception logs and renders them.
     * @private
     * @param {CoreTurnStartedEvent} event - The event object from VED.
     */
    #handleTurnStarted(event) {
        this.logger.debug(`${this._logPrefix} Received '${event.type}' event. Payload:`, event.payload);

        if (!event.payload || !event.payload.entityId) {
            this.logger.warn(`${this._logPrefix} '${event.type}' event is missing entityId. Clearing perception log display.`);
            this.#currentActorId = null;
            this.renderMessage('No current actor specified.');
            return;
        }

        const actorId = event.payload.entityId;
        this.#currentActorId = actorId;

        try {
            const actorEntity = this.#entityManager.getEntityInstance(actorId);
            if (!actorEntity) {
                this.logger.warn(`${this._logPrefix} Actor entity '${actorId}' not found. Cannot display perception logs.`);
                this.renderMessage(`Actor '${actorId}' not found.`);
                return;
            }

            if (!actorEntity.hasComponent(PERCEPTION_LOG_COMPONENT_ID)) {
                this.logger.info(`${this._logPrefix} Actor '${actorId}' does not have a '${PERCEPTION_LOG_COMPONENT_ID}' component.`);
                this.renderMessage('No perception log for this actor.');
                return;
            }

            /** @type {PerceptionLogComponentData | undefined} */
            const perceptionData = actorEntity.getComponentData(PERCEPTION_LOG_COMPONENT_ID);

            // CRITICAL FIX: Use 'logEntries' instead of 'entries'
            if (!perceptionData || !Array.isArray(perceptionData.logEntries) || perceptionData.logEntries.length === 0) {
                this.logger.info(`${this._logPrefix} Actor '${actorId}' has '${PERCEPTION_LOG_COMPONENT_ID}' component, but its 'logEntries' are empty or malformed.`);
                this.renderMessage('Perception log is empty.');
                return;
            }

            // CRITICAL FIX: Pass 'perceptionData.logEntries'
            this.render(perceptionData.logEntries);

        } catch (error) {
            this.logger.error(`${this._logPrefix} Error processing '${event.type}' for entity '${actorId}':`, error);
            this.renderMessage('Error retrieving perception logs.');
        }
    }

    /**
     * Clears the content of the log list element.
     * @private
     */
    #clearList() {
        if (this.#logListElement) {
            while (this.#logListElement.firstChild) {
                this.#logListElement.removeChild(this.#logListElement.firstChild);
            }
        }
    }

    /**
     * Scrolls the log list element to the bottom.
     * @private
     */
    #scrollToBottom() {
        if (this.#logListElement) {
            this.#logListElement.scrollTop = this.#logListElement.scrollHeight;
        }
    }

    /**
     * Renders a single placeholder message in the log list.
     * @param {string} message - The message to display.
     */
    renderMessage(message) {
        if (!this.#logListElement || !this.#domElementFactory) {
            this.logger.warn(`${this._logPrefix} Cannot render message, list element or factory missing.`);
            return;
        }
        this.#clearList();
        const li = this.#domElementFactory.li('empty-log-message', message);
        if (li) {
            this.#logListElement.appendChild(li);
        } else {
            this.logger.warn(`${this._logPrefix} Failed to create list item for empty message.`);
            this.#logListElement.textContent = message; // Fallback
        }
        this.#scrollToBottom();
    }

    /**
     * Renders the array of perception log entries.
     * @param {LogEntryObject[]} logEntries - An array of log entry objects.
     */
    render(logEntries) {
        if (!this.#logListElement) {
            this.logger.error(`${this._logPrefix} Cannot render logs, #logListElement is not available.`);
            return;
        }
        if (!this.#domElementFactory) {
            this.logger.error(`${this._logPrefix} Cannot render logs, domElementFactory is not available.`);
            this.#clearList(); // Clear even if we can't render new items properly
            this.#logListElement.textContent = '(Log renderer misconfigured)';
            return;
        }

        this.#clearList();

        if (!logEntries || logEntries.length === 0) {
            this.renderMessage(this.#currentActorId ? 'Perception log is empty.' : 'No actor selected.');
            return;
        }

        logEntries.forEach(entry => {
            // CRITICAL FIX: Check if entry is an object and access entry.descriptionText
            if (entry && typeof entry.descriptionText === 'string') {
                const li = this.#domElementFactory.li(undefined, entry.descriptionText);
                if (li) {
                    // Optional: Add more details as a title attribute for hover info
                    let title = `Time: ${entry.timestamp}\nType: ${entry.perceptionType}\nActor: ${entry.actorId}`;
                    if (entry.targetId) title += `\nTarget: ${entry.targetId}`;
                    li.title = title;
                    this.#logListElement.appendChild(li);
                } else {
                    this.logger.warn(`${this._logPrefix} Failed to create LI element for log entry: "${String(entry.descriptionText).substring(0, 50)}..."`);
                    const textNode = this.documentContext.document?.createTextNode(entry.descriptionText);
                    if (textNode) this.#logListElement.appendChild(textNode); // Fallback
                }
            } else if (typeof entry === 'string') { // Fallback for unexpected old string format
                this.logger.warn(`${this._logPrefix} Log entry was a string, not an object: "${entry.substring(0, 50)}..."`);
                const li = this.#domElementFactory.li(undefined, entry);
                if (li) this.#logListElement.appendChild(li);
            } else {
                this.logger.warn(`${this._logPrefix} Skipping malformed log entry object:`, entry);
            }
        });

        this.#scrollToBottom();
        this.logger.debug(`${this._logPrefix} Rendered ${logEntries.length} perception log entries.`);
    }

    dispose() {
        this.logger.debug(`${this._logPrefix} Disposing subscriptions.`);
        this.#subscriptions.forEach(unsubscribeFn => {
            if (typeof unsubscribeFn === 'function') {
                unsubscribeFn();
            }
        });
        this.#subscriptions = [];
        this.#logListElement = null; // Clear reference
        this.#currentActorId = null;
        super.dispose();
        this.logger.info(`${this._logPrefix} PerceptionLogRenderer disposed.`);
    }
}