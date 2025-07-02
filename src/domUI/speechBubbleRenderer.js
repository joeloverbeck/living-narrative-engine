/**
 * @file This module listens to events related to entity speech, then displays the speech and a possible portrait.
 * @see src/domUI/speechBubbleRenderer.js
 */

import { BoundDomRendererBase } from './boundDomRendererBase.js';
import { DISPLAY_SPEECH_ID } from '../constants/eventIds.js';
import {
  PLAYER_COMPONENT_ID,
  PLAYER_TYPE_COMPONENT_ID,
} from '../constants/componentIds.js';
import { buildSpeechMeta } from './helpers/buildSpeechMeta.js';
import { DEFAULT_SPEAKER_NAME } from './uiDefaults.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 * @typedef {import('./domElementFactory.js').default} DomElementFactory
 * @typedef {import('../entities/entityDisplayDataProvider.js').EntityDisplayDataProvider} EntityDisplayDataProvider
 * @typedef {import('../entities/entity.js').default} Entity
 */

/**
 * @typedef {import('../constants/eventIds.js').DisplaySpeechPayload} DisplaySpeechPayload
 */

export class SpeechBubbleRenderer extends BoundDomRendererBase {
  #entityManager;
  #entityDisplayDataProvider;

  /**
   * The actual DOM element where speech bubbles will be appended.
   * Determined by the presence of #message-list or fallback to #outputDiv.
   *
   * @private
   * @type {HTMLElement|null}
   */
  effectiveSpeechContainer = null;

  /**
   * Creates an instance of SpeechBubbleRenderer.
   *
   * @param {object} dependencies - Required services.
   * @param {ILogger} dependencies.logger - Logger instance.
   * @param {IDocumentContext} dependencies.documentContext - DOM abstraction.
   * @param {IValidatedEventDispatcher} dependencies.validatedEventDispatcher - Event dispatcher.
   * @param {IEntityManager} dependencies.entityManager - Entity manager.
   * @param {DomElementFactory} dependencies.domElementFactory - Element factory.
   * @param {EntityDisplayDataProvider} dependencies.entityDisplayDataProvider - Provider for display data.
   */
  constructor({
    logger,
    documentContext,
    validatedEventDispatcher,
    entityManager,
    domElementFactory,
    entityDisplayDataProvider,
  }) {
    const elementsConfig = {
      outputDivElement: { selector: '#outputDiv', required: true }, // For scrolling
      speechContainer: { selector: '#message-list', required: false }, // Optional, falls back to outputDiv
    };
    super({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig,
      domElementFactory,
      scrollContainerKey: 'outputDivElement',
      contentContainerKey: 'speechContainer',
    });

    if (!entityManager)
      throw new Error(
        `${this._logPrefix} EntityManager dependency is required.`
      );
    if (!entityDisplayDataProvider)
      throw new Error(
        `${this._logPrefix} EntityDisplayDataProvider dependency is required.`
      );

    this.#entityManager = entityManager;
    this.#entityDisplayDataProvider = entityDisplayDataProvider;

    if (this.elements.speechContainer) {
      this.effectiveSpeechContainer = this.elements.speechContainer;
    } else if (this.elements.outputDivElement) {
      this.logger.warn(
        `${this._logPrefix} #message-list not found. Speech will be appended to #outputDiv.`
      );
      this.effectiveSpeechContainer = this.elements.outputDivElement;
    } else {
      this.logger.error(
        `${this._logPrefix} Critical: Effective speech container (#message-list or #outputDiv) could not be determined as #outputDiv was also not found or bound.`
      );
      this.effectiveSpeechContainer = null;
    }

    this._subscribe(DISPLAY_SPEECH_ID, this.#onDisplaySpeech.bind(this));
    this.logger.debug(
      `${this._logPrefix} Initialized and subscribed to ${DISPLAY_SPEECH_ID}.`
    );
  }

  /**
   * Handles the DISPLAY_SPEECH_ID event.
   *
   * @private
   * @param {{type: string, payload: DisplaySpeechPayload}} eventObject - The event object.
   */
  #onDisplaySpeech(eventObject) {
    if (!eventObject || !eventObject.payload) {
      this.logger.warn(
        `${this._logPrefix} Received invalid DISPLAY_SPEECH_ID event object.`,
        eventObject
      );
      return;
    }
    const { entityId, speechContent } = eventObject.payload;
    if (
      typeof entityId !== 'string' ||
      !entityId ||
      typeof speechContent !== 'string'
    ) {
      this.logger.warn(
        `${this._logPrefix} Invalid payload for DISPLAY_SPEECH_ID.`,
        eventObject.payload
      );
      return;
    }
    this.renderSpeech(eventObject.payload);
  }

  /**
   * Builds DOM elements for a speech entry and returns related info.
   *
   * @private
   * @param {DisplaySpeechPayload} payload - The speech data.
   * @returns {{speechEntryDiv: HTMLElement, speechBubbleDiv: HTMLElement, speakerName: string, portraitPath: string, isPlayer: boolean}|null}
   * Returns element references and speaker details or null if creation fails.
   */
  #createSpeechElements(payload) {
    const { entityId } = payload;

    const speakerName = this.#entityDisplayDataProvider.getEntityName(
      entityId,
      DEFAULT_SPEAKER_NAME
    );
    const portraitPath =
      this.#entityDisplayDataProvider.getEntityPortraitPath(entityId);

    const speechEntryDiv = this.domElementFactory.create('div', {
      cls: 'speech-entry',
    });
    const speechBubbleDiv = this.domElementFactory.create('div', {
      cls: 'speech-bubble',
    });

    if (!speechEntryDiv || !speechBubbleDiv) {
      this.logger.error(
        `${this._logPrefix} Failed to create speech entry or bubble div.`
      );
      return null;
    }

    let isPlayer = false;
    const speakerEntity = this.#entityManager.getEntityInstance(entityId);
    if (speakerEntity) {
      if (speakerEntity.hasComponent(PLAYER_TYPE_COMPONENT_ID)) {
        const playerTypeData = speakerEntity.getComponentData(
          PLAYER_TYPE_COMPONENT_ID
        );
        isPlayer = playerTypeData?.type === 'human';
      } else if (speakerEntity.hasComponent(PLAYER_COMPONENT_ID)) {
        isPlayer = true;
      }
    } else {
      this.logger.debug(
        `${this._logPrefix} Speaker entity with ID '${entityId}' not found for player check.`
      );
    }

    if (isPlayer) {
      speechEntryDiv.classList.add('player-speech');
    }

    const speakerIntroSpan = this.domElementFactory.span(
      'speech-speaker-intro'
    );
    if (speakerIntroSpan) {
      speakerIntroSpan.textContent = `${speakerName} says: `;
      speechBubbleDiv.appendChild(speakerIntroSpan);
    }

    return {
      speechEntryDiv,
      speechBubbleDiv,
      speakerName,
      portraitPath,
      isPlayer,
    };
  }

  /**
   * Appends the quoted speech text to the provided container.
   *
   * @private
   * @param {HTMLElement} container - The speech bubble element.
   * @param {string} text - Speech content.
   * @param {boolean} allowHtml - Whether HTML is allowed in speech text.
   * @returns {void}
   */
  #appendQuotedSpeech(container, text, allowHtml) {
    const quotedSpeechSpan = this.domElementFactory.span('speech-quoted-text');
    if (!quotedSpeechSpan) return;

    if (text && typeof text === 'string') {
      const parts = text.split(/(\*.*?\*)/g).filter((part) => part.length > 0);
      quotedSpeechSpan.appendChild(
        this.documentContext.document.createTextNode('"')
      );
      parts.forEach((part) => {
        if (part.startsWith('*') && part.endsWith('*')) {
          const actionSpan = this.domElementFactory.span('speech-action-text');
          if (actionSpan) {
            actionSpan.textContent = part;
            quotedSpeechSpan.appendChild(actionSpan);
          }
        } else if (allowHtml) {
          const tempSpan = this.domElementFactory.span();
          if (tempSpan) {
            tempSpan.innerHTML = part;
            while (tempSpan.firstChild) {
              quotedSpeechSpan.appendChild(tempSpan.firstChild);
            }
          }
        } else {
          quotedSpeechSpan.appendChild(
            this.documentContext.document.createTextNode(part)
          );
        }
      });
      quotedSpeechSpan.appendChild(
        this.documentContext.document.createTextNode('"')
      );
    } else if (allowHtml) {
      quotedSpeechSpan.innerHTML = `"${text || ''}"`;
    } else {
      quotedSpeechSpan.textContent = `"${text || ''}"`;
    }

    container.appendChild(quotedSpeechSpan);
  }

  /**
   * Adds a portrait image if available and handles scroll events.
   *
   * @private
   * @param {HTMLElement} container - The speech entry element.
   * @param {string|null} portraitPath - Path to the portrait image.
   * @param {string} speakerName - Name of the speaker for alt text.
   * @returns {boolean} True if a portrait image was appended.
   */
  #addPortrait(container, portraitPath, speakerName) {
    let hasPortrait = false;
    if (portraitPath) {
      const portraitImg = this.domElementFactory.img(
        portraitPath,
        `Portrait of ${speakerName}`,
        'speech-portrait'
      );
      if (portraitImg) {
        hasPortrait = true;
        this._addDomListener(portraitImg, 'load', () => this.scrollToBottom(), {
          once: true,
        });
        this._addDomListener(
          portraitImg,
          'error',
          () => {
            this.logger.warn(
              `${this._logPrefix} Portrait image failed to load for ${speakerName}. Scrolling anyway.`
            );
            this.scrollToBottom();
          },
          { once: true }
        );
        container.appendChild(portraitImg);
        container.classList.add('has-portrait');
      } else {
        this.logger.warn(
          `${this._logPrefix} Failed to create portraitImg element.`
        );
        container.classList.add('no-portrait');
      }
    } else {
      container.classList.add('no-portrait');
    }

    return hasPortrait;
  }

  /**
   * Renders the speech bubble for a given entity and content.
   *
   * @param {DisplaySpeechPayload} payload - The speech data.
   */
  renderSpeech(payload) {
    if (
      !this.effectiveSpeechContainer ||
      !this.domElementFactory ||
      !this.#entityManager
    ) {
      this.logger.error(
        `${this._logPrefix} Cannot render speech: effectiveSpeechContainer, domElementFactory, or entityManager missing.`
      );
      return;
    }

    const {
      entityId,
      speechContent,
      allowHtml = false,
      thoughts,
      notes,
    } = payload;

    const elementInfo = this.#createSpeechElements(payload);
    if (!elementInfo) return;

    const {
      speechEntryDiv,
      speechBubbleDiv,
      speakerName,
      portraitPath,
      isPlayer,
    } = elementInfo;

    this.#appendQuotedSpeech(speechBubbleDiv, speechContent, allowHtml);

    const speechMetaFragment = buildSpeechMeta(
      this.documentContext.document,
      this.domElementFactory,
      {
        thoughts,
        notes,
      }
    );
    if (speechMetaFragment) {
      speechBubbleDiv.classList.add('has-meta');
      speechBubbleDiv.appendChild(speechMetaFragment);
    }

    const hasPortrait = this.#addPortrait(
      speechEntryDiv,
      portraitPath,
      speakerName
    );

    speechEntryDiv.appendChild(speechBubbleDiv);
    this.effectiveSpeechContainer.appendChild(speechEntryDiv);

    if (!hasPortrait) {
      this.scrollToBottom();
    }

    this.logger.debug(
      `${this._logPrefix} Rendered speech for ${speakerName}${isPlayer ? ' (Player)' : ''}.`
    );
  }

  /**
   * Cleans up resources.
   */
  dispose() {
    this.logger.debug(`${this._logPrefix} Disposing.`);
    super.dispose();
    this.effectiveSpeechContainer = null;
    this.logger.debug(`${this._logPrefix} Disposed.`);
  }
}
