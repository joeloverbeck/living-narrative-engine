// src/domUI/speechBubbleRenderer.js

import {RendererBase} from './rendererBase.js';
import {DISPLAY_SPEECH_ID} from '../constants/eventIds.js'; // Corrected path
import {NAME_COMPONENT_ID, PORTRAIT_COMPONENT_ID} from '../constants/componentIds.js'; // Corrected path

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('./IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 * @typedef {import('./domElementFactory.js').default} DomElementFactory
 * @typedef {import('../core/interfaces/IEventSubscription.js').IEventSubscription} IEventSubscription
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

export class SpeechBubbleRenderer extends RendererBase {
    /** @type {HTMLElement|null} */ #speechContainer = null;
    /** @type {HTMLElement|null} */ #outputDivElement = null;
    /** @type {IEntityManager} */ #entityManager;
    /** @type {DomElementFactory} */ #domElementFactory;
    /** @type {Array<IEventSubscription|undefined>} */ #subscriptions = [];

    constructor({
                    logger,
                    documentContext,
                    validatedEventDispatcher,
                    entityManager,
                    domElementFactory
                }) {
        super({logger, documentContext, validatedEventDispatcher});
        this.#entityManager = entityManager;
        this.#domElementFactory = domElementFactory;
        this._logPrefix = 'SpeechBubbleRenderer:';

        this.#outputDivElement = this.documentContext.query('#outputDiv');
        if (!this.#outputDivElement) {
            this.logger.error(`${this._logPrefix} Could not find #outputDiv element!`);
        } else {
            this.#speechContainer = this.documentContext.query('#message-list');
            if (!this.#speechContainer) {
                this.logger.warn(`${this._logPrefix} #message-list not found. Speech will be appended to #outputDiv.`);
                this.#speechContainer = this.#outputDivElement;
            }
        }
        if (!this.#speechContainer) { // Final check if #outputDiv also failed
            this.logger.error(`${this._logPrefix} Critical: Speech container (#message-list or #outputDiv) not found.`);
        }

        this.#subscriptions.push(
            this.validatedEventDispatcher.subscribe(
                DISPLAY_SPEECH_ID,
                this.#onDisplaySpeech.bind(this)
            )
        );
        this.logger.debug(`${this._logPrefix} Initialized and subscribed to ${DISPLAY_SPEECH_ID}.`);
    }

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

    renderSpeech(entityId, speechContent, allowHtml = false) {
        if (!this.#speechContainer || !this.#domElementFactory) {
            this.logger.error(`${this._logPrefix} Cannot render speech: container or factory missing.`);
            return;
        }

        const entity = this.#entityManager.getEntityInstance(entityId);
        let portraitPath = null;
        let speakerName = DEFAULT_SPEAKER_NAME; // DEFAULT_SPEAKER_NAME should be defined, e.g., const DEFAULT_SPEAKER_NAME = 'Unknown Speaker';

        if (entity) {
            const nameComponent = entity.getComponentData(NAME_COMPONENT_ID);
            speakerName = nameComponent?.text || entity.id;
            const portraitComponent = entity.getComponentData(PORTRAIT_COMPONENT_ID);
            if (portraitComponent && portraitComponent.imagePath && typeof portraitComponent.imagePath === 'string') {
                const modId = this.#getModIdFromDefinitionId(entity.definitionId);
                if (modId) {
                    portraitPath = `/data/mods/${modId}/${portraitComponent.imagePath}`;
                } else {
                    this.logger.warn(`${this._logPrefix} Could not extract modId for entity '${entity.id}'.`);
                }
            }
        } else {
            this.logger.warn(`${this._logPrefix} Entity ID '${entityId}' not found.`);
        }

        const speechEntryDiv = this.#domElementFactory.create('div', {cls: 'speech-entry'});
        const speechBubbleDiv = this.#domElementFactory.create('div', {cls: 'speech-bubble'});

        const speakerIntroSpan = this.#domElementFactory.span('speech-speaker-intro');
        if (speakerIntroSpan) {
            speakerIntroSpan.textContent = `${speakerName} says: `;
            speechBubbleDiv.appendChild(speakerIntroSpan);
        }

        const quotedSpeechSpan = this.#domElementFactory.span('speech-quoted-text');
        if (quotedSpeechSpan) {
            // Corrected logic for parsing speechContent:
            if (speechContent && typeof speechContent === 'string') {
                const parts = speechContent.split(/(\*.*?\*)/g).filter(part => part.length > 0);

                // Add opening quote
                quotedSpeechSpan.appendChild(this.documentContext.document.createTextNode('"'));

                parts.forEach(part => {
                    if (part.startsWith('*') && part.endsWith('*')) {
                        const actionSpan = this.#domElementFactory.span('speech-action-text');
                        if (actionSpan) {
                            actionSpan.textContent = part; // Part includes asterisks
                            quotedSpeechSpan.appendChild(actionSpan);
                        }
                    } else {
                        // Handle non-action text
                        if (allowHtml) {
                            // This part relies on the test's tempSpanMock for detailed parsing,
                            // or a more robust HTML parsing approach if not in a test.
                            // The domElementFactory.span() call (without args) is what the test mocks.
                            const tempSpan = this.#domElementFactory.span();
                            if (tempSpan) {
                                tempSpan.innerHTML = part; // Use innerHTML if part is trusted HTML and factory provides parsing
                                while (tempSpan.firstChild) {
                                    quotedSpeechSpan.appendChild(tempSpan.firstChild);
                                }
                            }
                        } else {
                            quotedSpeechSpan.appendChild(this.documentContext.document.createTextNode(part));
                        }
                    }
                });
                // Add closing quote
                quotedSpeechSpan.appendChild(this.documentContext.document.createTextNode('"'));

            } else {
                // Fallback for empty or non-string speechContent
                if (allowHtml) {
                    // Ensure quotes are added even for empty content if it's to be treated as HTML
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
                speechEntryDiv.classList.add('no-portrait');
            }
        } else {
            speechEntryDiv.classList.add('no-portrait');
        }

        speechEntryDiv.appendChild(speechBubbleDiv);
        this.#speechContainer.appendChild(speechEntryDiv);
        this.#scrollToBottom();
        this.logger.debug(`${this._logPrefix} Rendered speech for ${speakerName}.`);
    }

    #getModIdFromDefinitionId(definitionId) {
        if (!definitionId || typeof definitionId !== 'string') return null;
        const parts = definitionId.split(':');
        return (parts.length > 1 && parts[0]) ? parts[0] : null;
    }

    #scrollToBottom() {
        if (this.#outputDivElement && typeof this.#outputDivElement.scrollTop !== 'undefined') {
            this.#outputDivElement.scrollTop = this.#outputDivElement.scrollHeight;
        }
    }

    dispose() {
        this.logger.debug(`${this._logPrefix} Disposing subscriptions.`);
        this.#subscriptions.forEach(sub => sub?.unsubscribe());
        this.#subscriptions = [];
        this.#speechContainer = null;
        this.#outputDivElement = null;
        super.dispose();
    }
}