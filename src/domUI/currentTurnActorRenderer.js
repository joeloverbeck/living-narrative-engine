// src/domUI/currentTurnActorRenderer.js

// JSDoc Imports
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext */
/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../entities/entityDisplayDataProvider.js').EntityDisplayDataProvider} EntityDisplayDataProvider */
/** @typedef {import('../entities/entity.js').default} Entity */

import { BoundDomRendererBase } from './boundDomRendererBase.js'; // Adjusted path
import { TURN_STARTED_ID } from '../constants/eventIds.js';
// NAME_COMPONENT_ID and PORTRAIT_COMPONENT_ID are no longer directly used here
// import {NAME_COMPONENT_ID, PORTRAIT_COMPONENT_ID} from "../constants/componentIds.js";
import { DEFAULT_ACTOR_NAME } from './uiDefaults.js';

export class CurrentTurnActorRenderer extends BoundDomRendererBase {
  /** @type {EntityDisplayDataProvider} */
  #entityDisplayDataProvider;

  // DOM element references are now in this.elements via BoundDomRendererBase
  // #actorVisualsElement;
  // #actorImageElement;
  // #actorNameElement;

  /**
   * Creates a renderer that updates the UI with information about the actor
   * whose turn is currently active.
   *
   * @param {object} dependencies - Runtime dependencies for this renderer.
   * @param {ILogger} dependencies.logger - Logging utility for diagnostics.
   * @param {IDocumentContext} dependencies.documentContext - Abstraction over the DOM.
   * @param {IValidatedEventDispatcher} dependencies.validatedEventDispatcher - Dispatcher for validated events.
   * @param {IEntityManager} dependencies._entityManager - Manager used for entity lookups.
   * @param {EntityDisplayDataProvider} dependencies.entityDisplayDataProvider - Provides display data such as names and portraits.
   */
  constructor({
    logger,
    documentContext,
    validatedEventDispatcher,
    _entityManager,
    entityDisplayDataProvider,
  }) {
    const elementsConfig = {
      actorVisualsElement: {
        selector: '#current-turn-actor-panel .actor-visuals',
        required: true,
      },
      actorImageElement: {
        selector: '#current-turn-actor-panel #current-actor-image',
        required: true,
        expectedType: HTMLImageElement,
      },
      actorNameElement: {
        selector: '#current-turn-actor-panel .actor-name-display',
        required: true,
      },
    };

    super({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig,
    }); // Call super with elementsConfig

    if (!entityDisplayDataProvider) {
      this.logger.error(
        `${this._logPrefix} EntityDisplayDataProvider dependency is missing.`
      );
      throw new Error(
        `${this._logPrefix} EntityDisplayDataProvider dependency is missing.`
      );
    }
    this.#entityDisplayDataProvider = entityDisplayDataProvider;

    this.logger.debug(`${this._logPrefix} Initializing...`); // Moved after super and EDDP check

    // Check if elements were bound correctly by BoundDomRendererBase
    if (
      !this.elements.actorVisualsElement ||
      !this.elements.actorImageElement ||
      !this.elements.actorNameElement
    ) {
      this.logger.error(
        `${this._logPrefix} One or more required DOM elements not bound by BoundDomRendererBase. Panel will not function correctly.`
      );
      // No return here, as resetPanel will log further if elements are null
    }

    this.#resetPanel(); // Initialize to default state

    try {
      // Use _addSubscription from RendererBase (via BoundDomRendererBase)
      this._addSubscription(
        this.validatedEventDispatcher.subscribe(
          TURN_STARTED_ID,
          this.handleTurnStarted.bind(this)
        )
      );
      this.logger.debug(
        `${this._logPrefix} Initialized and subscribed to ${TURN_STARTED_ID}.`
      );
    } catch (error) {
      this.logger.error(
        `${this._logPrefix} Failed to subscribe to ${TURN_STARTED_ID}.`,
        error
      );
    }
  }

  handleTurnStarted(eventWrapper) {
    const actualPayload = eventWrapper.payload;

    if (
      !actualPayload ||
      typeof actualPayload.entityId !== 'string' ||
      !actualPayload.entityId
    ) {
      this.logger.warn(
        `${this._logPrefix} Received ${TURN_STARTED_ID} event. Expected entityId string in .payload.entityId was missing or invalid. Resetting panel.`,
        { receivedData: eventWrapper }
      );
      this.#resetPanel();
      return;
    }

    const entityId = actualPayload.entityId;
    this.logger.debug(
      `${this._logPrefix} Handling ${TURN_STARTED_ID} for entityId: ${entityId}`
    );

    // Use EntityDisplayDataProvider to get name and portrait path
    const actorName = this.#entityDisplayDataProvider.getEntityName(
      entityId,
      DEFAULT_ACTOR_NAME
    );
    const portraitPath =
      this.#entityDisplayDataProvider.getEntityPortraitPath(entityId);

    this.#updateActorInfo(actorName, portraitPath);
  }

  #updateActorInfo(actorName, portraitPath) {
    // Access elements via this.elements
    if (
      !this.elements.actorVisualsElement ||
      !this.elements.actorImageElement ||
      !this.elements.actorNameElement
    ) {
      this.logger.warn(
        `${this._logPrefix} DOM elements not available for update (this.elements is not fully populated).`
      );
      return;
    }

    this.elements.actorNameElement.textContent = actorName;
    this.elements.actorImageElement.alt =
      actorName !== DEFAULT_ACTOR_NAME
        ? `Portrait of ${actorName}`
        : 'Current Actor Portrait';

    if (portraitPath) {
      this.logger.debug(
        `${this._logPrefix} Setting portrait for ${actorName} to ${portraitPath}`
      );
      this.elements.actorVisualsElement.style.display = 'flex';
      this.elements.actorImageElement.src = portraitPath;
      this.elements.actorImageElement.style.display = 'block';
    } else {
      this.logger.debug(
        `${this._logPrefix} No portrait path for ${actorName}. Hiding image and visuals container.`
      );
      this.elements.actorVisualsElement.style.display = 'none';
      this.elements.actorImageElement.style.display = 'none';
      this.elements.actorImageElement.src = '';
    }
  }

  #resetPanel() {
    // Access elements via this.elements
    if (
      !this.elements.actorVisualsElement ||
      !this.elements.actorImageElement ||
      !this.elements.actorNameElement
    ) {
      this.logger.debug(
        `${this._logPrefix} Cannot reset panel: one or more DOM elements from this.elements are null. This might be normal during initial construction if elements are not found.`
      );
      return;
    }
    this.elements.actorNameElement.textContent = DEFAULT_ACTOR_NAME;
    this.elements.actorVisualsElement.style.display = 'none';
    this.elements.actorImageElement.style.display = 'none';
    this.elements.actorImageElement.src = '';
    this.elements.actorImageElement.alt = 'Current Actor Portrait';
    this.logger.debug(`${this._logPrefix} Panel reset to default state.`);
  }

  // #getModIdFromDefinitionId is removed as this logic is now in EntityDisplayDataProvider

  // dispose() method is inherited from RendererBase (via BoundDomRendererBase)
  // and will automatically handle VED unsubscriptions added via _addSubscription.
  // No custom dispose logic needed here unless there were other manual subscriptions or resources.
}
