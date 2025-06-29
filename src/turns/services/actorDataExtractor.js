// src/turns/services/actorDataExtractor.js
// --- FILE START ---

import {
  NAME_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
  PERSONALITY_COMPONENT_ID,
  PROFILE_COMPONENT_ID,
  LIKES_COMPONENT_ID,
  DISLIKES_COMPONENT_ID,
  SECRETS_COMPONENT_ID,
  FEARS_COMPONENT_ID, // <<< Added import
  SPEECH_PATTERNS_COMPONENT_ID,
  ANATOMY_BODY_COMPONENT_ID,
} from '../../constants/componentIds.js';
import { ensureTerminalPunctuation } from '../../utils/textUtils.js';
// --- TICKET AIPF-REFACTOR-009 START: Import and Use Standardized Fallback Strings ---
import {
  DEFAULT_FALLBACK_CHARACTER_NAME,
  DEFAULT_FALLBACK_DESCRIPTION_RAW,
} from '../../constants/textDefaults.js';
import { IActorDataExtractor } from '../../interfaces/IActorDataExtractor';
// --- TICKET AIPF-REFACTOR-009 END ---

// ActorPromptDataDTO is defined in AIGameStateDTO.js as per the provided context
/** @typedef {import('../dtos/AIGameStateDTO.js').ActorPromptDataDTO} ActorPromptDataDTO */

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
  constructor({ anatomyDescriptionService, entityFinder }) {
    super();
    this.anatomyDescriptionService = anatomyDescriptionService;
    this.entityFinder = entityFinder;
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
      const actorEntity = this.entityFinder.getEntity(actorId);
      if (actorEntity && actorEntity.components[ANATOMY_BODY_COMPONENT_ID]) {
        // Try to get or generate anatomy description
        const anatomyDescription =
          this.anatomyDescriptionService.getOrGenerateBodyDescription(
            actorEntity
          );
        if (anatomyDescription) {
          baseDescription = anatomyDescription;
        }
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
      { key: 'secrets', componentId: SECRETS_COMPONENT_ID },
      { key: 'fears', componentId: FEARS_COMPONENT_ID },
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

    return /** @type {ActorPromptDataDTO} */ (promptData);
  }
}

export { ActorDataExtractor };

// --- FILE END ---
