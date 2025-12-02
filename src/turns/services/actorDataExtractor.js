// src/turns/services/actorDataExtractor.js
// --- FILE START ---

import {
  NAME_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
  PERSONALITY_COMPONENT_ID,
  PROFILE_COMPONENT_ID,
  LIKES_COMPONENT_ID,
  DISLIKES_COMPONENT_ID,
  STRENGTHS_COMPONENT_ID,
  WEAKNESSES_COMPONENT_ID,
  SECRETS_COMPONENT_ID,
  FEARS_COMPONENT_ID, // <<< Added import
  SPEECH_PATTERNS_COMPONENT_ID,
  ANATOMY_BODY_COMPONENT_ID,
  APPARENT_AGE_COMPONENT_ID,
  MOTIVATIONS_COMPONENT_ID,
  INTERNAL_TENSIONS_COMPONENT_ID,
  DILEMMAS_COMPONENT_ID,
} from '../../constants/componentIds.js';
import { ensureTerminalPunctuation } from '../../utils/textUtils.js';
// --- TICKET AIPF-REFACTOR-009 START: Import and Use Standardized Fallback Strings ---
import {
  DEFAULT_FALLBACK_CHARACTER_NAME,
  DEFAULT_FALLBACK_DESCRIPTION_RAW,
} from '../../constants/textDefaults.js';
import { IActorDataExtractor } from '../../interfaces/IActorDataExtractor.js';
// --- TICKET AIPF-REFACTOR-009 END ---

// ActorPromptDataDTO is defined in AIGameStateDTO.js as per the provided context
/** @typedef {import('../dtos/AIGameStateDTO.js').ActorPromptDataDTO} ActorPromptDataDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').ActorHealthStateDTO} ActorHealthStateDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').ActorInjuryDTO} ActorInjuryDTO */

/**
 * Retrieve and trim the text from a component if available.
 *
 * @description Helper to get trimmed text for a specific component ID.
 * @param {object} actorState - Map of component IDs to data objects.
 * @param {string} componentId - The component ID whose text should be returned.
 * @returns {string|undefined} Trimmed text or undefined when absent or blank.
 */
function getTrimmedComponentText(actorState, componentId) {
  const component = actorState[componentId];
  if (component && typeof component.text === 'string') {
    const trimmed = component.text.trim();
    if (trimmed !== '') {
      return trimmed;
    }
  }
  return undefined;
}

// --- TICKET AIPF-REFACTOR-009: Removed local default constants ---
// const DEFAULT_NAME = "Unnamed Character";
// const DEFAULT_DESCRIPTION = "No description available.";
// --- TICKET AIPF-REFACTOR-009 END ---

/**
 * @class ActorDataExtractor
 * @description Service responsible for processing raw actorState and component data
 * to populate the ActorPromptDataDTO.
 */
class ActorDataExtractor extends IActorDataExtractor {
  /** @type {object | null} */
  #injuryAggregationService;

  /** @type {object | null} */
  #injuryNarrativeFormatterService;

  constructor({
    anatomyDescriptionService,
    entityFinder,
    injuryAggregationService,
    injuryNarrativeFormatterService,
  }) {
    super();
    this.anatomyDescriptionService = anatomyDescriptionService;
    this.entityFinder = entityFinder;
    this.#injuryAggregationService = injuryAggregationService ?? null;
    this.#injuryNarrativeFormatterService =
      injuryNarrativeFormatterService ?? null;
  }

  /**
   * Extracts and transforms actor-specific data from the actorState object
   * into a structured ActorPromptDataDTO.
   *
   * @override
   * @param {object} actorState - The gameState.actorState object, which is a
   * map of component IDs to component data.
   * @param {string} [actorId] - Optional actor entity ID for anatomy lookups
   * @returns {ActorPromptDataDTO} The populated DTO.
   */
  extractPromptData(actorState, actorId = null) {
    if (actorState === null || typeof actorState !== 'object') {
      throw new TypeError('actorState must be an object');
    }
    /** @type {Partial<ActorPromptDataDTO>} */
    const promptData = {};

    // Name
    const nameText = getTrimmedComponentText(actorState, NAME_COMPONENT_ID);
    promptData.name = nameText ?? DEFAULT_FALLBACK_CHARACTER_NAME;
    // --- TICKET AIPF-REFACTOR-009 END ---

    // Description
    let baseDescription = DEFAULT_FALLBACK_DESCRIPTION_RAW;

    // First, check if we have an anatomy-based description
    if (actorId && this.anatomyDescriptionService && this.entityFinder) {
      try {
        const actorEntity = this.entityFinder.getEntityInstance(actorId);

        if (
          actorEntity &&
          actorEntity.hasComponent(ANATOMY_BODY_COMPONENT_ID)
        ) {
          // Try to get description directly from entity component first (synchronous)
          // The anatomy service already generates and stores descriptions in the component
          const descComponent = actorEntity.getComponentData(
            DESCRIPTION_COMPONENT_ID
          );
          if (
            descComponent &&
            descComponent.text &&
            descComponent.text.trim()
          ) {
            baseDescription = descComponent.text;
          }
        }
      } catch (error) {
        // If there's an error accessing anatomy data, fall back to default
        // This ensures the system remains stable even if entity API calls fail
        // Silently handle errors to maintain stability
      }
    }

    // Fall back to core:description if no anatomy description
    if (baseDescription === DEFAULT_FALLBACK_DESCRIPTION_RAW) {
      const descText = getTrimmedComponentText(
        actorState,
        DESCRIPTION_COMPONENT_ID
      );
      if (descText) {
        baseDescription = descText;
      }
    }

    // Now, ensure the baseDescription has terminal punctuation.
    // ensureTerminalPunctuation handles trimming. If baseDescription was DEFAULT_FALLBACK_DESCRIPTION_RAW,
    // (e.g. "No description available"), ensureTerminalPunctuation will add a period if not present.
    promptData.description = ensureTerminalPunctuation(baseDescription);

    // Optional Text Attributes
    // These are typically short phrases or lists and might not always require terminal punctuation
    // in the same way a narrative description does. For now, they are extracted as-is (trimmed).
    // If punctuation is needed for these, ensureTerminalPunctuation could be applied similarly.
    const optionalTextAttributes = [
      { key: 'personality', componentId: PERSONALITY_COMPONENT_ID },
      { key: 'profile', componentId: PROFILE_COMPONENT_ID },
      { key: 'likes', componentId: LIKES_COMPONENT_ID },
      { key: 'dislikes', componentId: DISLIKES_COMPONENT_ID },
      { key: 'strengths', componentId: STRENGTHS_COMPONENT_ID },
      { key: 'weaknesses', componentId: WEAKNESSES_COMPONENT_ID },
      { key: 'secrets', componentId: SECRETS_COMPONENT_ID },
      { key: 'fears', componentId: FEARS_COMPONENT_ID },
      { key: 'motivations', componentId: MOTIVATIONS_COMPONENT_ID },
      { key: 'internalTensions', componentId: INTERNAL_TENSIONS_COMPONENT_ID },
      { key: 'coreDilemmas', componentId: DILEMMAS_COMPONENT_ID },
    ];

    for (const attr of optionalTextAttributes) {
      const trimmed = getTrimmedComponentText(actorState, attr.componentId);
      if (trimmed) {
        // For these fields, we are only trimming, not adding terminal punctuation by default.
        promptData[attr.key] = trimmed;
      }
    }

    // Speech Patterns
    const speechPatternsComponent = actorState[SPEECH_PATTERNS_COMPONENT_ID];
    if (
      speechPatternsComponent &&
      Array.isArray(speechPatternsComponent.patterns)
    ) {
      const validPatterns = speechPatternsComponent.patterns
        .map((p) => (typeof p === 'string' ? p.trim() : ''))
        .filter((p) => p !== '');

      if (validPatterns.length > 0) {
        promptData.speechPatterns = validPatterns;
      }
    }

    // Apparent Age
    const apparentAgeData = actorState[APPARENT_AGE_COMPONENT_ID];
    if (
      apparentAgeData &&
      typeof apparentAgeData.minAge === 'number' &&
      typeof apparentAgeData.maxAge === 'number'
    ) {
      promptData.apparentAge = apparentAgeData;
    }

    // Health State - returns null for healthy characters (optimization)
    promptData.healthState = this.#extractHealthData(actorId);

    return /** @type {ActorPromptDataDTO} */ (promptData);
  }

  /**
   * Extracts health state data for LLM context.
   * Returns null for healthy characters to optimize token usage.
   *
   * @param {string|null} actorId - Actor entity ID
   * @returns {ActorHealthStateDTO|null} Health state or null if healthy/no anatomy
   */
  #extractHealthData(actorId) {
    if (!actorId || !this.#injuryAggregationService) return null;

    try {
      const summary = this.#injuryAggregationService.aggregateInjuries(actorId);
      if (!summary) return null;

      // Optimization: return null for healthy characters
      if (
        summary.injuredParts.length === 0 &&
        !summary.isDying &&
        !summary.isDead &&
        summary.overallHealthPercentage >= 100
      ) {
        return null;
      }

      // Get first-person narrative if formatter available
      let firstPersonNarrative = null;
      if (
        this.#injuryNarrativeFormatterService &&
        summary.injuredParts.length > 0
      ) {
        firstPersonNarrative =
          this.#injuryNarrativeFormatterService.formatFirstPerson(summary);
      }

      return {
        overallHealthPercentage: summary.overallHealthPercentage,
        overallStatus: this.#determineOverallStatus(summary),
        injuries: summary.injuredParts.map((part) => ({
          partName: this.#formatPartName(part.partType, part.orientation),
          partType: part.partType,
          state: part.state,
          healthPercent: part.healthPercentage,
          effects: this.#collectPartEffects(part),
        })),
        activeEffects: this.#collectActiveEffects(summary),
        isDying: summary.isDying,
        turnsUntilDeath: summary.dyingTurnsRemaining,
        firstPersonNarrative,
      };
    } catch (error) {
      // Silently handle errors to maintain stability
      return null;
    }
  }

  /**
   * Determines overall health status string from summary.
   *
   * @param {object} summary - Injury summary
   * @returns {string} Status string
   */
  #determineOverallStatus(summary) {
    if (summary.isDead) return 'dead';
    if (summary.isDying) return 'dying';
    const pct = summary.overallHealthPercentage;
    if (pct >= 100) return 'healthy';
    if (pct >= 80) return 'scratched';
    if (pct >= 60) return 'wounded';
    if (pct >= 40) return 'injured';
    return 'critical';
  }

  /**
   * Formats a part name with optional orientation.
   *
   * @param {string} partType - Type of body part
   * @param {string|null} orientation - left/right/null
   * @returns {string} Formatted part name
   */
  #formatPartName(partType, orientation) {
    return orientation ? `${orientation} ${partType}` : partType;
  }

  /**
   * Collects active effects for a single part.
   *
   * @param {object} part - Part info from summary
   * @returns {string[]} Array of effect strings
   */
  #collectPartEffects(part) {
    const effects = [];
    if (part.isBleeding) effects.push(`bleeding_${part.bleedingSeverity}`);
    if (part.isBurning) effects.push('burning');
    if (part.isPoisoned) effects.push('poisoned');
    if (part.isFractured) effects.push('fractured');
    return effects;
  }

  /**
   * Collects summary of active effects across all parts.
   *
   * @param {object} summary - Injury summary
   * @returns {string[]} Array of active effect types
   */
  #collectActiveEffects(summary) {
    const effects = [];
    if (summary.bleedingParts.length > 0) effects.push('bleeding');
    if (summary.burningParts.length > 0) effects.push('burning');
    if (summary.poisonedParts.length > 0) effects.push('poisoned');
    if (summary.fracturedParts.length > 0) effects.push('fractured');
    return effects;
  }
}

export { ActorDataExtractor };

// --- FILE END ---
