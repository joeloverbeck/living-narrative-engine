// src/domUI/entityLifecycleMonitor.js

import { RendererBase } from './rendererBase.js';

/**
 * @typedef {import('../interfaces/ILogger').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('./domElementFactory.js').default} DomElementFactory
 */

/**
 * @typedef {object} EntityLifecycleEvent
 * @property {string} type - The event type
 * @property {object} payload - The event payload
 */

/**
 * Monitors and displays entity lifecycle events (creation, destruction, component changes)
 * in a scrollable panel for debugging purposes.
 *
 * @augments {RendererBase}
 */
export class EntityLifecycleMonitor extends RendererBase {
  /**
   * @private
   * @type {HTMLElement}
   */
  #container;

  /**
   * @private
   * @type {HTMLElement}
   */
  #eventList;

  /**
   * @private
   * @type {number}
   */
  #maxEntries = 50;

  /**
   * @private
   * @type {DomElementFactory}
   */
  #domElementFactory;

  /**
   * @private
   * @type {number}
   */
  #eventCounter = 0;

  /**
   * @private
   * @type {Set<number>}
   */
  #pendingAnimations = new Set();

  /**
   * Creates an instance of EntityLifecycleMonitor.
   *
   * @param {object} dependencies - Required services and factories.
   * @param {ILogger} dependencies.logger - The logger instance.
   * @param {IDocumentContext} dependencies.documentContext - The document context abstraction.
   * @param {IValidatedEventDispatcher} dependencies.validatedEventDispatcher - The validated event dispatcher.
   * @param {DomElementFactory} dependencies.domElementFactory - The DOM element factory.
   */
  constructor({
    logger,
    documentContext,
    validatedEventDispatcher,
    domElementFactory,
  }) {
    super({ logger, documentContext, validatedEventDispatcher });

    this.#domElementFactory = domElementFactory;

    // Find or create the container element
    this.#container = this.documentContext.query('#entity-lifecycle-monitor');
    if (!this.#container) {
      this.logger.warn(
        `${this._logPrefix} Container element '#entity-lifecycle-monitor' not found.`
      );
      return;
    }

    // Create the event list element
    this.#eventList = this.#domElementFactory?.ul?.('entity-event-list') ?? 
      this.documentContext.create('ul');
    this.#eventList.classList.add('entity-event-list');
    this.#container.appendChild(this.#eventList);

    // Subscribe to entity lifecycle events
    this._subscribe('core:entity_created', this.#handleEntityCreated.bind(this));
    this._subscribe('core:entity_removed', this.#handleEntityRemoved.bind(this));
    this._subscribe('core:component_added', this.#handleComponentAdded.bind(this));
    this._subscribe('core:component_removed', this.#handleComponentRemoved.bind(this));
    this._subscribe('core:display_entity_components', this.#handleDisplayComponents.bind(this));

    this.logger.debug(`${this._logPrefix} Initialized.`);
  }

  /**
   * Handles entity creation events.
   *
   * @private
   * @param {EntityLifecycleEvent} event - The event object.
   */
  #handleEntityCreated(event) {
    const { instanceId, definitionId, wasReconstructed } = event.payload || {};
    const reconstructedText = wasReconstructed ? ' (reconstructed)' : '';
    const message = `Entity created: ${instanceId} from ${definitionId}${reconstructedText}`;
    this.#addEventEntry(message, 'entity-created');
  }

  /**
   * Handles entity removal events.
   *
   * @private
   * @param {EntityLifecycleEvent} event - The event object.
   */
  #handleEntityRemoved(event) {
    const { instanceId } = event.payload || {};
    const message = `Entity removed: ${instanceId}`;
    this.#addEventEntry(message, 'entity-removed');
  }

  /**
   * Handles component addition events.
   *
   * @private
   * @param {EntityLifecycleEvent} event - The event object.
   */
  #handleComponentAdded(event) {
    const { entity, componentTypeId, oldComponentData } = event.payload || {};
    const entityId = entity?.id || 'unknown';
    const updateType = oldComponentData !== undefined ? 'updated' : 'added';
    const message = `Component ${updateType}: ${componentTypeId} on ${entityId}`;
    this.#addEventEntry(message, 'component-added');
  }

  /**
   * Handles component removal events.
   *
   * @private
   * @param {EntityLifecycleEvent} event - The event object.
   */
  #handleComponentRemoved(event) {
    const { entity, componentTypeId } = event.payload || {};
    const entityId = entity?.id || 'unknown';
    const message = `Component removed: ${componentTypeId} from ${entityId}`;
    this.#addEventEntry(message, 'component-removed');
  }

  /**
   * Handles display entity components events.
   *
   * @private
   * @param {EntityLifecycleEvent} event - The event object.
   */
  #handleDisplayComponents(event) {
    const { entityId, components } = event.payload || {};
    const componentCount = Object.keys(components || {}).length;
    const componentList = Object.keys(components || {}).join(', ');
    const message = `Entity ${entityId} has ${componentCount} components: ${componentList}`;
    this.#addEventEntry(message, 'display-components');
  }

  /**
   * Adds an event entry to the display list.
   *
   * @private
   * @param {string} message - The message to display.
   * @param {string} className - The CSS class for styling the entry.
   */
  #addEventEntry(message, className) {
    if (!this.#eventList) {
      return;
    }

    // Create the list item
    const li = this.#domElementFactory?.li?.(className) ?? 
      this.documentContext.create('li');
    li.classList.add(className, 'entity-event-entry');
    
    // Add timestamp
    const timestamp = new Date().toLocaleTimeString();
    const timeSpan = this.documentContext.create('span');
    timeSpan.classList.add('event-timestamp');
    timeSpan.textContent = `[${timestamp}] `;
    
    // Add message
    const messageSpan = this.documentContext.create('span');
    messageSpan.classList.add('event-message');
    messageSpan.textContent = message;
    
    li.appendChild(timeSpan);
    li.appendChild(messageSpan);
    
    // Calculate animation delay based on pending animations
    const currentEventId = this.#eventCounter++;
    const animationDelay = this.#pendingAnimations.size * 100; // 100ms between events
    
    // Initially hide the element for staggered animation
    li.style.animationDelay = `${animationDelay}ms`;
    
    // Track this animation
    this.#pendingAnimations.add(currentEventId);
    
    // Remove from pending animations after animation completes
    setTimeout(() => {
      this.#pendingAnimations.delete(currentEventId);
    }, animationDelay + 400); // 400ms is the animation duration
    
    // Add to list
    this.#eventList.appendChild(li);

    // Limit the number of entries
    while (this.#eventList.children.length > this.#maxEntries) {
      const firstChild = this.#eventList.firstChild;
      // Remove animation to prevent flickering
      firstChild.style.animation = 'none';
      this.#eventList.removeChild(firstChild);
    }

    // Scroll to bottom after a slight delay to ensure smooth animation
    setTimeout(() => {
      this.#container.scrollTop = this.#container.scrollHeight;
    }, animationDelay + 200);
  }

  /**
   * Clears all event entries from the display.
   *
   * @public
   */
  clearEvents() {
    if (this.#eventList) {
      this.#eventList.innerHTML = '';
    }
  }

  /**
   * Disposes of resources.
   *
   * @override
   */
  dispose() {
    this.logger.debug(`${this._logPrefix} Disposing EntityLifecycleMonitor.`);
    super.dispose();
    if (this.#eventList && this.#eventList.parentNode) {
      this.#eventList.parentNode.removeChild(this.#eventList);
    }
    this.#pendingAnimations.clear();
    this.#container = null;
    this.#eventList = null;
    this.logger.debug(`${this._logPrefix} EntityLifecycleMonitor disposed.`);
  }
}