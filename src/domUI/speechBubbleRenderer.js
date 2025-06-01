// src/domUI/speechBubbleRenderer.js

import {BoundDomRendererBase} from './boundDomRendererBase.js'; // Adjusted path
import {DISPLAY_SPEECH_ID} from '../constants/eventIds.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 * @typedef {import('./domElementFactory.js').default} DomElementFactory
 * @typedef {import('../services/EntityDisplayDataProvider.js').EntityDisplayDataProvider} EntityDisplayDataProvider
 * @typedef {import('../core/interfaces/IEvent.js').IEvent} IEvent
 * @typedef {import('../entities/entity.js').default} Entity
 */

/**
 * @typedef {object} DisplaySpeechPayload
 * @property {string} entityId The ID of the entity that spoke.
 * @property {string} speechContent The text content of what the entity said.
 * @property {boolean} [allowHtml=false] If true, the speechContent will be treated as HTML.
 */

const DEFAULT_SPEAKER_NAME = 'Unknown Speaker';

export class SpeechBubbleRenderer extends BoundDomRendererBase {
    /** @private @type {IEntityManager} */
    #entityManager; // May still be needed for direct entity checks if EDDP doesn't cover all
    /** @private @type {DomElementFactory} */
    #domElementFactory;
    /** @private @type {EntityDisplayDataProvider} */
    #entityDisplayDataProvider;

    /**
     * The actual DOM element where speech bubbles will be appended.
     * Determined by the presence of #message-list or fallback to #outputDiv.
     * @private @type {HTMLElement|null}
     */
    effectiveSpeechContainer = null;

    /**
     * @param {object} dependencies
     * @param {ILogger} dependencies.logger
     * @param {IDocumentContext} dependencies.documentContext
     * @param {IValidatedEventDispatcher} dependencies.validatedEventDispatcher
     * @param {IEntityManager} dependencies.entityManager
     * @param {DomElementFactory} dependencies.domElementFactory
     * @param {EntityDisplayDataProvider} dependencies.entityDisplayDataProvider
     */
    constructor({
                    logger,
                    documentContext,
                    validatedEventDispatcher,
                    entityManager,
                    domElementFactory,
                    entityDisplayDataProvider
                }) {
        const elementsConfig = {
            outputDivElement: {selector: '#outputDiv', required: true}, // For scrolling
            speechContainer: {selector: '#message-list', required: false} // Optional, falls back to outputDiv
        };
        super({logger, documentContext, validatedEventDispatcher, elementsConfig});

        if (!entityManager) throw new Error(`${this._logPrefix} EntityManager dependency is required.`);
        if (!domElementFactory) throw new Error(`${this._logPrefix} DomElementFactory dependency is required.`);
        if (!entityDisplayDataProvider) throw new Error(`${this._logPrefix} EntityDisplayDataProvider dependency is required.`);

        this.#entityManager = entityManager;
        this.#domElementFactory = domElementFactory;
        this.#entityDisplayDataProvider = entityDisplayDataProvider;
        // this._logPrefix is set by RendererBase, but if we need it specifically:
        // this._logPrefix = '[SpeechBubbleRenderer]'; // No, it's already set.

        if (this.elements.speechContainer) {
            this.effectiveSpeechContainer = this.elements.speechContainer;
        } else if (this.elements.outputDivElement) {
            this.logger.warn(`${this._logPrefix} #message-list not found. Speech will be appended to #outputDiv.`);
            this.effectiveSpeechContainer = this.elements.outputDivElement;
        } else {
            // This case should ideally be prevented if outputDivElement is required and found,
            // or by BoundDomRendererBase logging an error if outputDivElement (required) isn't found.
            this.logger.error(`${this._logPrefix} Critical: Effective speech container (#message-list or #outputDiv) could not be determined as #outputDiv was also not found or bound.`);
            this.effectiveSpeechContainer = null;
        }

        // VED subscription using helper from RendererBase
        this._addSubscription(
            this.validatedEventDispatcher.subscribe(
                DISPLAY_SPEECH_ID,
                this.#onDisplaySpeech.bind(this)
            )
        );
        this.logger.debug(`${this._logPrefix} Initialized and subscribed to ${DISPLAY_SPEECH_ID}.`);
    }

    /**
     * Handles the 'textUI:display_speech' event.
     * @private
     * @param {IEvent<DisplaySpeechPayload>} eventObject - The event object.
     */
    #onDisplaySpeech(eventObject) {
        if (!eventObject || !eventObject.payload) {
            this.logger.warn(`${this._logPrefix} Received invalid 'textUI:display_speech' event object.`, eventObject);
            return;
        }
        const {entityId, speechContent, allowHtml = false} = eventObject.payload;
        if (typeof entityId !== 'string' || !entityId || typeof speechContent !== 'string') {
            this.logger.warn(`${this._logPrefix} Invalid payload for 'textUI:display_speech'.`, eventObject.payload);
            return;
        }
        this.renderSpeech(entityId, speechContent, allowHtml);
    }

    /**
     * Renders the speech bubble for a given entity and content.
     * @param {string} entityId - The ID of the entity speaking.
     * @param {string} speechContent - The content of the speech.
     * @param {boolean} [allowHtml=false] - Whether to treat speechContent as HTML.
     */
    renderSpeech(entityId, speechContent, allowHtml = false) {
        if (!this.effectiveSpeechContainer || !this.#domElementFactory) {
            this.logger.error(`${this._logPrefix} Cannot render speech: effectiveSpeechContainer or domElementFactory missing.`);
            return;
        }

        const speakerName = this.#entityDisplayDataProvider.getEntityName(entityId, DEFAULT_SPEAKER_NAME);
        const portraitPath = this.#entityDisplayDataProvider.getEntityPortraitPath(entityId);

        const speechEntryDiv = this.#domElementFactory.create('div', {cls: 'speech-entry'});
        const speechBubbleDiv = this.#domElementFactory.create('div', {cls: 'speech-bubble'});

        if (!speechEntryDiv || !speechBubbleDiv) {
            this.logger.error(`${this._logPrefix} Failed to create speech entry or bubble div.`);
            return;
        }

        const speakerIntroSpan = this.#domElementFactory.span('speech-speaker-intro');
        if (speakerIntroSpan) {
            speakerIntroSpan.textContent = `${speakerName} says: `;
            speechBubbleDiv.appendChild(speakerIntroSpan);
        }

        const quotedSpeechSpan = this.#domElementFactory.span('speech-quoted-text');
        if (quotedSpeechSpan) {
            if (speechContent && typeof speechContent === 'string') {
                const parts = speechContent.split(/(\*.*?\*)/g).filter(part => part.length > 0);
                quotedSpeechSpan.appendChild(this.documentContext.document.createTextNode('"'));
                parts.forEach(part => {
                    if (part.startsWith('*') && part.endsWith('*')) {
                        const actionSpan = this.#domElementFactory.span('speech-action-text');
                        if (actionSpan) {
                            actionSpan.textContent = part;
                            quotedSpeechSpan.appendChild(actionSpan);
                        }
                    } else {
                        if (allowHtml) {
                            const tempSpan = this.#domElementFactory.span(); // Create a temporary span
                            if (tempSpan) {
                                tempSpan.innerHTML = part; // Let browser parse HTML
                                while (tempSpan.firstChild) {
                                    quotedSpeechSpan.appendChild(tempSpan.firstChild); // Append parsed nodes
                                }
                            }
                        } else {
                            quotedSpeechSpan.appendChild(this.documentContext.document.createTextNode(part));
                        }
                    }
                });
                quotedSpeechSpan.appendChild(this.documentContext.document.createTextNode('"'));
            } else {
                if (allowHtml) {
                    quotedSpeechSpan.innerHTML = `"${speechContent || ''}"`;
                } else {
                    quotedSpeechSpan.textContent = `"${speechContent || ''}"`;
                }
            }
            speechBubbleDiv.appendChild(quotedSpeechSpan);
        }


        if (portraitPath) {
            const portraitImg = this.#domElementFactory.img(portraitPath, `Portrait of ${speakerName}`, 'speech-portrait');
            if (portraitImg) {
                speechEntryDiv.appendChild(portraitImg);
                speechEntryDiv.classList.add('has-portrait');
            } else {
                this.logger.warn(`${this._logPrefix} Failed to create portraitImg element.`);
                speechEntryDiv.classList.add('no-portrait'); // Fallback class
            }
        } else {
            speechEntryDiv.classList.add('no-portrait');
        }

        speechEntryDiv.appendChild(speechBubbleDiv);
        this.effectiveSpeechContainer.appendChild(speechEntryDiv);
        this.#scrollToBottom();
        this.logger.debug(`${this._logPrefix} Rendered speech for ${speakerName}.`);
    }

    /**
     * Scrolls the output/chat panel to the bottom.
     * Uses this.elements.outputDivElement provided by BoundDomRendererBase.
     * @private
     */
    #scrollToBottom() {
        // Use this.elements.outputDivElement from BoundDomRendererBase
        if (this.elements.outputDivElement && typeof this.elements.outputDivElement.scrollTop !== 'undefined') {
            this.elements.outputDivElement.scrollTop = this.elements.outputDivElement.scrollHeight;
        } else {
            this.logger.warn(`${this._logPrefix} Could not scroll #outputDiv. Element not found in this.elements or properties missing.`);
        }
    }

    /**
     * Cleans up resources.
     * VED subscriptions are handled by super.dispose().
     * DOM listeners (if any were added via _addDomListener) are also handled by super.dispose().
     */
    dispose() {
        this.logger.debug(`${this._logPrefix} Disposing.`);
        // VED subscriptions and DOM listeners managed by _addSubscription and _addDomListener
        // are cleaned up by super.dispose().
        super.dispose();
        this.effectiveSpeechContainer = null; // Clear custom reference
        // this.#entityManager = null; // Not strictly necessary if base class handles all, but good practice for direct members
        // this.#domElementFactory = null;
        // this.#entityDisplayDataProvider = null;
        this.logger.info(`${this._logPrefix} Disposed.`);
    }
}