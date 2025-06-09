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
  // Removed constructor comment about injecting punctuationUtil, as we're importing directly.

  /**
   * Extracts and transforms actor-specific data from the actorState object
   * into a structured ActorPromptDataDTO.
   * @override
   * @param {object} actorState - The gameState.actorState object, which is a
   * map of component IDs to component data.
   * @returns {ActorPromptDataDTO} The populated DTO.
   */
  extractPromptData(actorState) {
    /** @type {Partial<ActorPromptDataDTO>} */
    const promptData = {};

    // Name
    const nameComponent = actorState[NAME_COMPONENT_ID];
    promptData.name =
      nameComponent &&
      nameComponent.text &&
      String(nameComponent.text).trim() !== ''
        ? String(nameComponent.text).trim()
        : // --- TICKET AIPF-REFACTOR-009: Use imported constant ---
          DEFAULT_FALLBACK_CHARACTER_NAME;
    // --- TICKET AIPF-REFACTOR-009 END ---

    // Description
    const descComponent = actorState[DESCRIPTION_COMPONENT_ID];
    // First, determine the base description (either from component or default)
    const baseDescription =
      descComponent &&
      descComponent.text &&
      String(descComponent.text).trim() !== ''
        ? String(descComponent.text) // Do not trim here, ensureTerminalPunctuation will handle it
        : // --- TICKET AIPF-REFACTOR-009: Use imported constant (raw version) ---
          DEFAULT_FALLBACK_DESCRIPTION_RAW;
    // --- TICKET AIPF-REFACTOR-009 END ---

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
      const component = actorState[attr.componentId];
      if (
        component &&
        typeof component.text === 'string' &&
        component.text.trim() !== ''
      ) {
        // For these fields, we are only trimming, not adding terminal punctuation by default.
        promptData[attr.key] = component.text.trim();
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
