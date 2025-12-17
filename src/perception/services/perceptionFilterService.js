/**
 * @file PerceptionFilterService
 * @description Determines what description each recipient should receive based on their
 * sensory capabilities and environmental conditions (lighting). Filters events for
 * delivery based on sense availability and fallback descriptions.
 * @see specs/sense-aware-perceptible-events.spec.md
 * @see tickets/SENAWAPEREVE-005-perception-filter-service.md
 */

import { validateDependency, ensureValidLogger } from '../../utils/index.js';
import {
  getPrimarySense,
  getFallbackSenses,
  isOmniscient,
} from '../registries/perceptionTypeRegistry.js';

/**
 * @typedef {object} FilteredRecipient
 * @property {string} entityId - Recipient entity ID
 * @property {string|null} descriptionText - Text to show, or null if filtered
 * @property {string} sense - Sense used for perception ('visual', 'auditory', etc.)
 * @property {boolean} canPerceive - Whether recipient can perceive the event
 */

/**
 * @typedef {object} EventData
 * @property {string} perception_type - The perception type (e.g., 'movement.arrival')
 * @property {string} description_text - Primary description text
 * @property {{[key: string]: string}} [alternate_descriptions] - Fallback descriptions keyed by sense
 */

/**
 * Service for filtering perceptible events based on recipient sensory capabilities
 * and environmental lighting conditions.
 *
 * Filtering Logic:
 * 1. Omniscient types bypass all filtering (always perceive)
 * 2. Proprioceptive types only delivered to actor
 * 3. For each recipient, check primary sense availability
 * 4. If primary unavailable, try fallback senses in priority order
 * 5. Use 'limited' fallback as last resort
 * 6. Silent filter (no error) if no perception possible
 */
class PerceptionFilterService {
  #sensoryCapabilityService;
  #lightingStateService;
  #logger;

  /**
   * Create a PerceptionFilterService instance.
   *
   * @param {object} deps - Dependencies
   * @param {object} deps.sensoryCapabilityService - Service to query entity senses
   * @param {object} deps.lightingStateService - Service to query location lighting
   * @param {object} deps.logger - Logger service
   */
  constructor({ sensoryCapabilityService, lightingStateService, logger }) {
    this.#logger = ensureValidLogger(logger, 'PerceptionFilterService');

    validateDependency(
      sensoryCapabilityService,
      'ISensoryCapabilityService',
      this.#logger,
      {
        requiredMethods: ['getSensoryCapabilities'],
      }
    );

    validateDependency(
      lightingStateService,
      'ILightingStateService',
      this.#logger,
      {
        requiredMethods: ['getLightingState'],
      }
    );

    this.#sensoryCapabilityService = sensoryCapabilityService;
    this.#lightingStateService = lightingStateService;

    this.#logger.debug('PerceptionFilterService initialized');
  }

  /**
   * Filter event for multiple recipients.
   *
   * @param {EventData} eventData - Event details including perception_type, description_text, alternate_descriptions
   * @param {string[]} recipientIds - Entity IDs to filter for
   * @param {string} locationId - Location for lighting check
   * @param {string} actorId - Actor who performed action (for proprioceptive)
   * @returns {FilteredRecipient[]} Filtered recipients with perception results
   */
  filterEventForRecipients(eventData, recipientIds, locationId, actorId) {
    if (!eventData || !eventData.perception_type) {
      this.#logger.warn(
        'filterEventForRecipients: Invalid eventData - missing perception_type'
      );
      return [];
    }

    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
      this.#logger.debug(
        'filterEventForRecipients: No recipients provided, returning empty array'
      );
      return [];
    }

    const perceptionType = eventData.perception_type;
    const primarySense = getPrimarySense(perceptionType);

    // Get lighting state for visual checks
    const lightingState = this.#lightingStateService.getLightingState(locationId);

    this.#logger.debug(
      `filterEventForRecipients: type=${perceptionType}, primarySense=${primarySense}, ` +
        `lighting=${lightingState}, recipients=${recipientIds.length}`
    );

    const results = [];

    for (const recipientId of recipientIds) {
      const result = this.#filterForRecipient(
        eventData,
        recipientId,
        actorId,
        perceptionType,
        primarySense,
        lightingState
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Filter event for a single recipient.
   *
   * @param {EventData} eventData - Event data
   * @param {string} recipientId - Recipient entity ID
   * @param {string} actorId - Actor entity ID
   * @param {string} perceptionType - The perception type
   * @param {string|null} primarySense - Primary sense required
   * @param {string} lightingState - Location lighting state
   * @returns {FilteredRecipient} Filtering result for this recipient
   * @private
   */
  #filterForRecipient(
    eventData,
    recipientId,
    actorId,
    perceptionType,
    primarySense,
    lightingState
  ) {
    // Case 1: Omniscient types always perceive
    if (isOmniscient(perceptionType)) {
      this.#logger.debug(
        `#filterForRecipient: ${recipientId} receives omniscient event`
      );
      return {
        entityId: recipientId,
        descriptionText: eventData.description_text,
        sense: 'omniscient',
        canPerceive: true,
      };
    }

    // Case 2: Proprioceptive types only delivered to actor
    if (primarySense === 'proprioceptive') {
      if (recipientId === actorId) {
        this.#logger.debug(
          `#filterForRecipient: ${recipientId} (actor) receives proprioceptive event`
        );
        return {
          entityId: recipientId,
          descriptionText: eventData.description_text,
          sense: 'proprioceptive',
          canPerceive: true,
        };
      } else {
        this.#logger.debug(
          `#filterForRecipient: ${recipientId} filtered (proprioceptive, not actor)`
        );
        return {
          entityId: recipientId,
          descriptionText: null,
          sense: 'proprioceptive',
          canPerceive: false,
        };
      }
    }

    // Get recipient's sensory capabilities
    const capabilities =
      this.#sensoryCapabilityService.getSensoryCapabilities(recipientId);

    // Case 3: Check primary sense
    if (this.#canUseSense(primarySense, capabilities, lightingState)) {
      this.#logger.debug(
        `#filterForRecipient: ${recipientId} perceives via primary sense (${primarySense})`
      );
      return {
        entityId: recipientId,
        descriptionText: eventData.description_text,
        sense: primarySense,
        canPerceive: true,
      };
    }

    // Case 4: Try fallback senses
    const fallbacks = getFallbackSenses(perceptionType);
    const alternateDescriptions = eventData.alternate_descriptions || {};

    for (const fallbackSense of fallbacks) {
      if (
        this.#canUseSense(fallbackSense, capabilities, lightingState) &&
        alternateDescriptions[fallbackSense]
      ) {
        this.#logger.debug(
          `#filterForRecipient: ${recipientId} perceives via fallback sense (${fallbackSense})`
        );
        return {
          entityId: recipientId,
          descriptionText: alternateDescriptions[fallbackSense],
          sense: fallbackSense,
          canPerceive: true,
        };
      }
    }

    // Case 5: Try 'limited' fallback
    if (alternateDescriptions.limited) {
      this.#logger.debug(
        `#filterForRecipient: ${recipientId} perceives via limited fallback`
      );
      return {
        entityId: recipientId,
        descriptionText: alternateDescriptions.limited,
        sense: 'limited',
        canPerceive: true,
      };
    }

    // Case 6: No perception possible - silent filter
    this.#logger.debug(
      `#filterForRecipient: ${recipientId} cannot perceive event (no available sense/fallback)`
    );
    return {
      entityId: recipientId,
      descriptionText: null,
      sense: primarySense || 'unknown',
      canPerceive: false,
    };
  }

  /**
   * Check if a recipient can use a specific sense.
   *
   * @param {string} sense - Sense to check ('visual', 'auditory', etc.)
   * @param {object} capabilities - Recipient's sensory capabilities
   * @param {string} lightingState - Location lighting state
   * @returns {boolean} True if sense can be used
   * @private
   */
  #canUseSense(sense, capabilities, lightingState) {
    switch (sense) {
      case 'visual':
        // Visual requires non-dark lighting AND ability to see
        return lightingState !== 'dark' && capabilities.canSee;

      case 'auditory':
        return capabilities.canHear;

      case 'olfactory':
        return capabilities.canSmell;

      case 'tactile':
        // Tactile always available per spec
        return capabilities.canFeel;

      case 'proprioceptive':
        // Proprioceptive is handled separately (actor-only)
        return true;

      default:
        this.#logger.debug(`#canUseSense: Unknown sense type: ${sense}`);
        return false;
    }
  }
}

export default PerceptionFilterService;
