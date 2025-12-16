// src/domUI/locationRenderer.js
// --- FILE START ---
import { BoundDomRendererBase } from './boundDomRendererBase.js';
import { DomUtils } from '../utils/domUtils.js';
import createMessageElement from './helpers/createMessageElement.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/eventIds.js';
import { validateDependency } from '../utils/dependencyUtils.js';
import {} from // POSITION_COMPONENT_ID, // No longer directly used for current location logic
// NAME_COMPONENT_ID, // Handled by EntityDisplayDataProvider
// DESCRIPTION_COMPONENT_ID, // Handled by EntityDisplayDataProvider
// EXITS_COMPONENT_ID, // Handled by EntityDisplayDataProvider
// PORTRAIT_COMPONENT_ID might be implicitly used by EntityDisplayDataProvider
'../constants/componentIds.js';

import { buildLocationDisplayPayload } from './location/buildLocationDisplayPayload.js';
import { buildDarknessPayload } from './location/buildDarknessPayload.js';
import { getPresenceMessage } from './location/presenceMessageBuilder.js';
import { renderPortraitElements } from './location/renderPortraitElements.js';
import { renderLocationLists } from './location/renderLocationLists.js';
import { renderCharacterListItem } from './location/renderCharacterListItem.js';
import { LocationDataService } from './location/locationDataService.js';
import { LocationNotFoundError } from '../errors/locationNotFoundError.js';

/**
 * @typedef {import('../interfaces/ILogger').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('./domElementFactory.js').default} DomElementFactory
 * @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 * @typedef {import('../entities/entityDisplayDataProvider.js').EntityDisplayDataProvider} EntityDisplayDataProvider
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../locations/services/lightingStateService.js').LightingStateService} LightingStateService
 */

/**
 * @typedef {object} CoreTurnStartedPayload
 * @property {import('../interfaces/CommonTypes').NamespacedId} entityId - ID of the entity starting the turn.
 * @property {'player'|'ai'} entityType - Whether the actor is player-controlled or AI.
 /**
 * Represents a character to be displayed.
 * @typedef {import('../entities/entityDisplayDataProvider.js').CharacterDisplayInfo} CharacterDisplayData
 */

/**
 * @typedef {import('./location/buildLocationDisplayPayload.js').LocationDisplayPayload} LocationDisplayPayload
 */

import {
  DEFAULT_LOCATION_NAME,
  DEFAULT_LOCATION_DESCRIPTION,
} from './uiDefaults.js';

/**
 * Renders details of the current location, including its name, description, exits, and characters.
 * It extends BoundDomRendererBase to manage its DOM sub-elements and uses EntityDisplayDataProvider
 * for fetching display data.
 *
 * @augments {BoundDomRendererBase}
 */
export class LocationRenderer extends BoundDomRendererBase {
  baseContainerElement;
  entityManager;
  entityDisplayDataProvider;
  dataRegistry;
  locationDataService;
  safeEventDispatcher;
  /** @type {LightingStateService} */
  #lightingStateService;

  _EVENT_TYPE_SUBSCRIBED = 'core:turn_started';

  constructor({
    logger,
    documentContext,
    safeEventDispatcher,
    domElementFactory,
    entityManager,
    entityDisplayDataProvider,
    dataRegistry,
    containerElement,
    lightingStateService,
  }) {
    const elementsConfig = {
      nameDisplay: { selector: '#location-name-display', required: true },
      // NEW: Add location portrait elements
      locationPortraitVisualsElement: {
        selector: '#location-portrait-visuals',
        required: true,
      },
      locationPortraitImageElement: {
        selector: '#location-portrait-image',
        required: true,
        expectedType: HTMLImageElement,
      },
      descriptionDisplay: {
        selector: '#location-description-display',
        required: true,
      },
      exitsDisplay: { selector: '#location-exits-display', required: true },
      charactersDisplay: {
        selector: '#location-characters-display',
        required: true,
      },
    };

    validateDependency(safeEventDispatcher, 'safeEventDispatcher', logger, {
      requiredMethods: ['dispatch', 'subscribe', 'unsubscribe'],
    });
    const resolvedDispatcher = safeEventDispatcher;

    super({
      logger,
      documentContext,
      validatedEventDispatcher: resolvedDispatcher,
      elementsConfig,
      domElementFactory,
    });

    this.safeEventDispatcher = resolvedDispatcher;

    if (
      !entityManager ||
      typeof entityManager.getEntitiesInLocation !== 'function'
    ) {
      const errMsg = `${this._logPrefix} 'entityManager' dependency is missing or invalid.`;
      this.safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: errMsg,
      });
      throw new Error(errMsg);
    }
    this.entityManager = entityManager;

    if (
      !entityDisplayDataProvider ||
      typeof entityDisplayDataProvider.getLocationDetails !== 'function' ||
      typeof entityDisplayDataProvider.getEntityLocationId !== 'function' ||
      // Assume a new method will be added to EntityDisplayDataProvider
      typeof entityDisplayDataProvider.getLocationPortraitData !== 'function' // IMPORTANT ASSUMPTION
    ) {
      const errMsg = `${this._logPrefix} 'entityDisplayDataProvider' dependency is missing or invalid (must include getLocationDetails, getEntityLocationId, and a new getLocationPortraitData).`;
      this.safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: errMsg,
      });
      throw new Error(errMsg);
    }
    this.entityDisplayDataProvider = entityDisplayDataProvider;

    if (dataRegistry) {
      this.dataRegistry = dataRegistry;
    } else {
      this.logger.warn(
        `${this._logPrefix} 'dataRegistry' dependency is missing.`
      );
    }

    validateDependency(lightingStateService, 'lightingStateService', logger, {
      requiredMethods: ['getLocationLightingState'],
    });
    this.#lightingStateService = lightingStateService;

    if (!containerElement || containerElement.nodeType !== 1) {
      const errMsg = `${this._logPrefix} 'containerElement' dependency is missing or not a valid DOM element.`;
      this.safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: errMsg,
      });
      throw new Error(errMsg);
    }
    this.baseContainerElement = containerElement;
    this.logger.debug(
      `${this._logPrefix} Attached to base container element:`,
      this.baseContainerElement
    );

    this.locationDataService = new LocationDataService({
      logger,
      entityManager: this.entityManager,
      entityDisplayDataProvider: this.entityDisplayDataProvider,
      dataRegistry: this.dataRegistry,
      safeEventDispatcher: this.safeEventDispatcher,
    });

    // Check for new portrait elements after super() and _bindElements() have run
    if (
      !this.elements.locationPortraitVisualsElement ||
      !this.elements.locationPortraitImageElement
    ) {
      this.safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: `${this._logPrefix} Location portrait DOM elements not bound. Portraits will not be displayed.`,
      });
      // Depending on strictness, you might throw an error or allow graceful degradation.
    }

    this._subscribe(
      this._EVENT_TYPE_SUBSCRIBED,
      this.#handleTurnStarted.bind(this)
    );
    this.logger.debug(
      `${this._logPrefix} Subscribed to VED event '${this._EVENT_TYPE_SUBSCRIBED}'.`
    );
  }

  #handleTurnStarted(event) {
    this.logger.debug(
      `${this._logPrefix} Received '${event.type}' event. Payload:`,
      event.payload
    );

    if (!event.payload || !event.payload.entityId) {
      this.logger.warn(
        `${this._logPrefix} '${event.type}' event is missing entityId. Cannot update location display.`
      );
      this.#clearDisplayWithError('No entity specified for turn.');
      return;
    }

    const currentActorEntityId = event.payload.entityId;

    let currentLocationInstanceId;
    try {
      currentLocationInstanceId =
        this.#resolveCurrentLocationId(currentActorEntityId);
      if (!currentLocationInstanceId) {
        return;
      }

      const displayPayload = this.#buildDisplayPayload(
        currentLocationInstanceId,
        currentActorEntityId
      );

      this.render(displayPayload);
    } catch (error) {
      if (error instanceof LocationNotFoundError) {
        this.safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
          message: `${this._logPrefix} Location details for ID '${currentLocationInstanceId}' not found.`,
        });
        this.#clearDisplayWithError(
          `Location data for '${currentLocationInstanceId}' missing.`
        );
        return;
      }
      this.safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: `${this._logPrefix} Error processing '${event.type}' for entity '${currentActorEntityId}': ${error.message}`,
        details: { stack: error.stack },
      });
      this.#clearDisplayWithError('Error retrieving location details.');
    }
  }

  /**
   * Resolve the location instance ID for the given actor and handle missing cases.
   *
   * @private
   * @param {import('../interfaces/CommonTypes').NamespacedId} actorId - Actor entity ID.
   * @returns {string|null} Resolved location ID or null if not found.
   */
  #resolveCurrentLocationId(actorId) {
    const locId = this.locationDataService.resolveLocationInstanceId(actorId);
    if (!locId) {
      this.#clearDisplayWithError(`Location for ${actorId} is unknown.`);
      return null;
    }
    return locId;
  }

  /**
   * Build the LocationDisplayPayload for rendering.
   *
   * @private
   * @param {string} locationId - Resolved location instance ID.
   * @param {import('../interfaces/CommonTypes').NamespacedId} actorId - Actor entity ID.
   * @returns {LocationDisplayPayload} Structured payload for rendering.
   */
  #buildDisplayPayload(locationId, actorId) {
    // Check lighting state first
    const { isLit } = this.#lightingStateService.getLocationLightingState(locationId);

    if (!isLit) {
      return this.#buildDarknessPayload(locationId, actorId);
    }

    const locationDetails =
      this.entityDisplayDataProvider.getLocationDetails(locationId);

    const portraitData =
      this.entityDisplayDataProvider.getLocationPortraitData(locationId);

    const charactersInLocation =
      this.locationDataService.gatherLocationCharacters(locationId, actorId);

    return buildLocationDisplayPayload(
      locationDetails,
      portraitData,
      charactersInLocation
    );
  }

  /**
   * Build a darkness-specific payload when the location is not lit.
   *
   * @private
   * @param {string} locationId - Location entity ID.
   * @param {import('../interfaces/CommonTypes').NamespacedId} actorId - Actor entity ID (excluded from presence count).
   * @returns {LocationDisplayPayload} Payload with darkness-specific values.
   */
  #buildDarknessPayload(locationId, actorId) {
    const locationDetails =
      this.entityDisplayDataProvider.getLocationDetails(locationId);

    const darknessDescData = this.entityManager.getComponentData(
      locationId,
      'locations:description_in_darkness'
    );

    const charactersInLocation =
      this.locationDataService.gatherLocationCharacters(locationId, actorId);

    return buildDarknessPayload({
      locationName: locationDetails.name,
      darknessDescription: darknessDescData?.text || null,
      otherActorCount: charactersInLocation.length,
    });
  }

  /**
   * Clear all display elements and show an error message.
   *
   * @private
   * @param {string} message - Error message to display.
   * @returns {void}
   */

  #clearDisplayWithError(message) {
    const elementsAndDefaults = {
      nameDisplay: `(${DEFAULT_LOCATION_NAME})`,
      // No default for portrait, it will be hidden by render logic
      descriptionDisplay: message,
      exitsDisplay: '(Exits Unavailable)',
      charactersDisplay: '(Characters Unavailable)',
    };

    for (const [key, defaultText] of Object.entries(elementsAndDefaults)) {
      const element = this.elements[key];
      if (element) {
        DomUtils.clearElement(element);
        const text = key === 'descriptionDisplay' ? message : defaultText;
        const pError = createMessageElement(
          this.domElementFactory,
          'error-message',
          text
        );
        element.appendChild(pError);
      } else {
        this.logger.warn(
          `${this._logPrefix} Could not find element this.elements.${key} to clear on error.`
        );
      }
    }
    // Explicitly hide portrait on error
    if (this.elements.locationPortraitVisualsElement) {
      this.elements.locationPortraitVisualsElement.style.display = 'none';
    }
    if (this.elements.locationPortraitImageElement) {
      this.elements.locationPortraitImageElement.src = '';
      this.elements.locationPortraitImageElement.alt = '';
      this.elements.locationPortraitImageElement.style.display = 'none';
    }
  }

  /* -----------------------------------------------------------------------
   *  PRIVATE - render any data list (exits, characters, etc.)
   * --------------------------------------------------------------------- */
  /**
   * Renders a header element for a list section.
   *
   * @param {string} title - The heading text.
   * @param {HTMLElement} targetElement - Element the heading is appended to.
   * @returns {void}
   */
  _renderListHeader(title, targetElement) {
    const heading =
      this.domElementFactory.h4?.(undefined, `${title}:`) ??
      this.documentContext.document.createTextNode(`${title}:`);
    targetElement.appendChild(heading);
  }

  /**
   * Renders a character list item including portrait and tooltip.
   *
   * @param {CharacterDisplayData|object} item - Character info to render.
   * @param {HTMLElement} listElement - UL element to append the item to.
   * @returns {void}
   */

  /**
   * Renders a basic list item.
   *
   * @param {string} itemText - Text for the list item.
   * @param {HTMLElement} listElement - UL element to append the item to.
   * @param {string} [itemClassName] - CSS class for the list item.
   * @returns {void}
   */
  _renderGenericListItem(itemText, listElement, itemClassName = 'list-item') {
    const li =
      this.domElementFactory.li?.(itemClassName) ??
      this.documentContext.document.createElement('li');
    if (!li.textContent) li.textContent = itemText;
    listElement.appendChild(li);
  }

  /**
   * Renders a data list.  Heading is optional: we *skip* it for
   * Exits and Characters because the accordion summary already
   * names the section.
   *
   * @param dataArray
   * @param targetElement
   * @param title
   * @param itemTextProperty
   * @param emptyText
   * @param itemClassName
   */
  _renderList(
    dataArray,
    targetElement,
    title,
    itemTextProperty,
    emptyText,
    itemClassName = 'list-item'
  ) {
    DomUtils.clearElement(targetElement);

    /** omit heading for "Exits"/"Characters" — summary tag is enough */
    const skipHeading = title === 'Exits' || title === 'Characters';
    if (!skipHeading) {
      this._renderListHeader(title, targetElement);
    }

    /* empty state */
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      targetElement.appendChild(
        createMessageElement(
          this.domElementFactory,
          'empty-list-message',
          emptyText
        )
      );
      return;
    }

    /* build list */
    const ul =
      this.domElementFactory.ul?.(undefined, 'location-detail-list') ??
      this.documentContext.document.createElement('ul');
    targetElement.appendChild(ul);

    dataArray.forEach((item) => {
      const text =
        item && typeof item === 'object' && item[itemTextProperty]
          ? String(item[itemTextProperty])
          : `(Invalid ${itemTextProperty})`;

      if (title === 'Characters' && item && typeof item === 'object') {
        renderCharacterListItem(
          item,
          ul,
          this.domElementFactory,
          this.documentContext,
          this._addDomListener.bind(this)
        );
      } else {
        this._renderGenericListItem(text, ul, itemClassName);
      }
    });
  }

  /* ---------------------------------------------------------------------
   *  HELPER – builds the hidden tooltip block for character descriptions
   * ------------------------------------------------------------------- */

  /**
   * Render the location name heading.
   *
   * @param {LocationDisplayPayload} locationDto - Details for the current location.
   * @returns {void}
   */
  renderName(locationDto) {
    DomUtils.clearElement(this.elements.nameDisplay);
    const h3Name = this.domElementFactory.h3(
      undefined,
      locationDto.name || DEFAULT_LOCATION_NAME
    );
    if (h3Name) {
      this.elements.nameDisplay.appendChild(h3Name);
    } else {
      this.elements.nameDisplay.textContent =
        locationDto.name || DEFAULT_LOCATION_NAME;
    }
  }

  /**
   * Render the location portrait section.
   *
   * @param {LocationDisplayPayload} locationDto - Details for the current location.
   * @returns {void}
   */
  renderPortrait(locationDto) {
    renderPortraitElements(
      this.elements.locationPortraitImageElement,
      this.elements.locationPortraitVisualsElement,
      locationDto,
      this.logger,
      this.domElementFactory,
      this.documentContext,
      this._addDomListener.bind(this)
    );
  }

  /**
   * Render the location description.
   * When the location is dark, also renders the presence message.
   *
   * @param {LocationDisplayPayload} locationDto - Details for the current location.
   * @returns {void}
   */
  renderDescription(locationDto) {
    DomUtils.clearElement(this.elements.descriptionDisplay);

    // Only show inline description if no portrait exists (or if in darkness)
    if (!locationDto.portraitPath || locationDto.isDark) {
      const pDesc = this.domElementFactory.p(
        undefined,
        locationDto.description || DEFAULT_LOCATION_DESCRIPTION
      );
      if (pDesc) {
        this.elements.descriptionDisplay.appendChild(pDesc);
      } else {
        this.elements.descriptionDisplay.textContent =
          locationDto.description || DEFAULT_LOCATION_DESCRIPTION;
      }
    }

    // Render presence message when in darkness
    if (locationDto.isDark && typeof locationDto.otherActorCount === 'number') {
      const presenceMsg = getPresenceMessage(locationDto.otherActorCount);
      const presenceElement = this.domElementFactory.p(
        'darkness-presence',
        presenceMsg
      );
      if (presenceElement) {
        this.elements.descriptionDisplay.appendChild(presenceElement);
      }
    }
  }

  /**
   * Render exits and characters lists.
   *
   * @param {LocationDisplayPayload} locationDto - Details for the current location.
   * @returns {void}
   */
  renderLists(locationDto) {
    renderLocationLists(this, locationDto);
  }

  render(locationDto) {
    if (!this.baseContainerElement || !this.domElementFactory) {
      this.safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: `${this._logPrefix} Cannot render, critical dependencies (baseContainerElement or domElementFactory) missing.`,
      });
      return;
    }
    // Check for all required elements, including new portrait ones
    const requiredElements = [
      'nameDisplay',
      'locationPortraitVisualsElement',
      'locationPortraitImageElement',
      'descriptionDisplay',
      'exitsDisplay',
      'charactersDisplay',
    ];
    for (const elKey of requiredElements) {
      if (!this.elements[elKey]) {
        this.safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
          message: `${this._logPrefix} Cannot render, required DOM element '${elKey}' is missing.`,
        });
        // Potentially call #clearDisplayWithError or a similar specific error display
        return;
      }
    }

    if (!locationDto) {
      this.logger.warn(
        `${this._logPrefix} Received null location DTO. Clearing display.`
      );
      this.#clearDisplayWithError('(No location data to display)');
      return;
    }

    this.logger.debug(
      `${this._logPrefix} Rendering location: "${locationDto.name}".`
    );

    this.renderName(locationDto);
    this.renderPortrait(locationDto);
    this.renderDescription(locationDto);
    this.renderLists(locationDto);

    this.logger.debug(
      `${this._logPrefix} Location "${locationDto.name}" display updated.`
    );
  }

  dispose() {
    this.logger.debug(`${this._logPrefix} Disposing LocationRenderer.`);
    super.dispose();
    this.logger.debug(`${this._logPrefix} LocationRenderer disposed.`);
  }
}

// --- FILE END ---
