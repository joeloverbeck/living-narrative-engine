// src/domUI/currentTurnActorRenderer.js

// JSDoc Imports
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./IDocumentContext.js').IDocumentContext} IDocumentContext */
/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */

import {TURN_STARTED_ID} from "../constants/eventIds.js"; //
import {NAME_COMPONENT_ID, PORTRAIT_COMPONENT_ID} from "../constants/componentIds.js"; //


const DEFAULT_ACTOR_NAME = 'N/A'; //

export class CurrentTurnActorRenderer {
    /** @type {ILogger} */
    #logger;
    /** @type {IDocumentContext} */
    #documentContext;
    /** @type {IValidatedEventDispatcher} */
    #eventDispatcher;
    /** @type {IEntityManager} */
    #entityManager;

    /** @type {HTMLElement | null} */ // Changed HTMLImageElement to HTMLElement for the container
    #actorVisualsElement; // Added for the container div
    /** @type {HTMLImageElement | null} */
    #actorImageElement;
    /** @type {HTMLElement | null} */
    #actorNameElement;

    /**
     * @param {object} dependencies
     * @param {ILogger} dependencies.logger
     * @param {IDocumentContext} dependencies.documentContext
     * @param {IValidatedEventDispatcher} dependencies.validatedEventDispatcher
     * @param {IEntityManager} dependencies.entityManager
     */
    constructor({logger, documentContext, validatedEventDispatcher, entityManager}) {
        this.#logger = logger;
        this.#documentContext = documentContext;
        this.#eventDispatcher = validatedEventDispatcher;
        this.#entityManager = entityManager;

        this.#logger.info('CurrentTurnActorRenderer: Initializing...');

        // Query for the elements within the specific panel for robustness
        const panelElement = this.#documentContext.query('#current-turn-actor-panel');
        if (panelElement) {
            this.#actorVisualsElement = panelElement.querySelector('.actor-visuals');
            this.#actorImageElement = panelElement.querySelector('#current-actor-image');
            this.#actorNameElement = panelElement.querySelector('.actor-name-display');
        } else {
            // Fallback to global query if panel not found (less robust)
            this.#actorVisualsElement = this.#documentContext.query('.actor-visuals'); // Assuming it's unique enough or first
            this.#actorImageElement = this.#documentContext.query('#current-actor-image');
            this.#actorNameElement = this.#documentContext.query('.actor-name-display'); // Assuming it's unique enough or first
            if (!this.#actorVisualsElement || !this.#actorImageElement || !this.#actorNameElement) {
                this.#logger.warn('CurrentTurnActorRenderer: Could not find panelElement, and global query failed for some elements.');
            }
        }


        if (!this.#actorVisualsElement || !this.#actorImageElement || !this.#actorNameElement) {
            this.#logger.error('CurrentTurnActorRenderer: Could not find one or more required DOM elements (#current-turn-actor-panel .actor-visuals, #current-actor-image, .actor-name-display). Panel will not function correctly.');
            return;
        }
        this.#resetPanel(); // Initialize to default state

        try {
            this.#eventDispatcher.subscribe(
                TURN_STARTED_ID,
                this.handleTurnStarted.bind(this)
            );
            this.#logger.info(`CurrentTurnActorRenderer: Initialized and subscribed to ${TURN_STARTED_ID}.`);
        } catch (error) {
            this.#logger.error(`CurrentTurnActorRenderer: Failed to subscribe to ${TURN_STARTED_ID}.`, error);
        }
    }

    handleTurnStarted(eventWrapper) {
        const actualPayload = eventWrapper.payload;

        if (!actualPayload || typeof actualPayload.entityId !== 'string' || !actualPayload.entityId) {
            this.#logger.warn(`CurrentTurnActorRenderer: Received ${TURN_STARTED_ID} event. Expected entityId string in .payload.entityId was missing or invalid. Resetting panel.`, {receivedData: eventWrapper});
            this.#resetPanel();
            return;
        }

        const entityId = actualPayload.entityId;
        this.#logger.debug(`CurrentTurnActorRenderer: Handling ${TURN_STARTED_ID} for entityId: ${entityId}`);
        const entity = this.#entityManager.getEntityInstance(entityId);

        if (!entity) {
            this.#logger.warn(`CurrentTurnActorRenderer: Entity not found for ID: ${entityId} from ${TURN_STARTED_ID} event. Resetting panel.`);
            this.#resetPanel();
            return;
        }

        this.#updateActorInfo(entity);
    }

    #updateActorInfo(entity) {
        if (!this.#actorVisualsElement || !this.#actorImageElement || !this.#actorNameElement) {
            this.#logger.warn('CurrentTurnActorRenderer: DOM elements not available for update.');
            return;
        }

        const nameComponent = entity.getComponentData(NAME_COMPONENT_ID);
        const actorName = nameComponent?.text || DEFAULT_ACTOR_NAME;
        this.#actorNameElement.textContent = actorName;
        this.#actorImageElement.alt = actorName !== DEFAULT_ACTOR_NAME ? `Portrait of ${actorName}` : 'Current Actor Portrait';

        const portraitComponent = entity.getComponentData(PORTRAIT_COMPONENT_ID);
        if (portraitComponent && portraitComponent.imagePath && typeof portraitComponent.imagePath === 'string') {
            const modId = this.#getModIdFromDefinitionId(entity.definitionId);
            if (!modId) {
                this.#logger.warn(`CurrentTurnActorRenderer: Could not extract modId from definitionId '${entity.definitionId}' for entity '${entity.id}'. Cannot load portrait.`);
                this.#actorVisualsElement.style.display = 'none'; // Hide container
                this.#actorImageElement.style.display = 'none'; // Hide image just in case
                this.#actorImageElement.src = '';
                return;
            }

            const imageUrl = `/data/mods/${modId}/${portraitComponent.imagePath}`;
            this.#logger.debug(`CurrentTurnActorRenderer: Setting portrait for ${actorName} to ${imageUrl}`);

            this.#actorVisualsElement.style.display = 'flex'; // Show container (it uses display:flex in CSS)
            this.#actorImageElement.src = imageUrl;
            this.#actorImageElement.style.display = 'block'; // Make image visible
        } else {
            this.#logger.debug(`CurrentTurnActorRenderer: No portrait component or imagePath for ${actorName} (Entity ID: ${entity.id}). Hiding image and visuals container.`);
            this.#actorVisualsElement.style.display = 'none'; // Hide container
            this.#actorImageElement.style.display = 'none'; // Hide image
            this.#actorImageElement.src = '';
        }
    }

    #resetPanel() {
        if (!this.#actorVisualsElement || !this.#actorImageElement || !this.#actorNameElement) return;
        this.#actorNameElement.textContent = DEFAULT_ACTOR_NAME;

        this.#actorVisualsElement.style.display = 'none'; // Hide container on reset
        this.#actorImageElement.style.display = 'none';   // Hide image on reset
        this.#actorImageElement.src = '';
        this.#actorImageElement.alt = 'Current Actor Portrait';
        this.#logger.debug('CurrentTurnActorRenderer: Panel reset to default state.');
    }

    #getModIdFromDefinitionId(definitionId) {
        if (!definitionId || typeof definitionId !== 'string') {
            this.#logger.warn(`CurrentTurnActorRenderer: Invalid definitionId received: ${definitionId}`);
            return null;
        }
        const parts = definitionId.split(':');
        if (parts.length > 1 && parts[0]) {
            return parts[0];
        }
        this.#logger.warn(`CurrentTurnActorRenderer: Could not parse modId from definitionId '${definitionId}'. Expected format 'modId:entityName'.`);
        return null;
    }
}