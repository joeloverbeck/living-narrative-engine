/**
 * @file InjuryNarrativeFormatterService - Formats injury data into natural language descriptions.
 * @see specs/injury-reporting-and-user-interface.md section 5.2
 */

import { BaseService } from '../../utils/serviceBase.js';
import {
  getFirstPersonDescription,
  getFirstPersonDescriptionPlural,
  getStateOrder,
  getThirdPersonDescription,
} from '../../anatomy/registries/healthStateRegistry.js';

// --- Effect-to-Description Mappings (First-Person) ---
const FIRST_PERSON_EFFECT_MAP = {
  bleeding: 'blood flows from',
  burning: 'searing heat radiates from',
  poisoned: 'a sickening feeling spreads from',
  fractured: 'sharp pain shoots through',
  dismembered: 'is missing',
};

// --- Effect-to-Description Mappings (Third-Person) ---
const THIRD_PERSON_EFFECT_MAP = {
  bleeding: 'is bleeding',
  burning: 'is burning',
  poisoned: 'is poisoned',
  fractured: 'is fractured',
  dismembered: 'flies off in an arc',
};

// --- Bleeding Severity Descriptions (First-Person) ---
const BLEEDING_SEVERITY_FIRST_PERSON = {
  minor: 'blood seeps from',
  moderate: 'blood flows steadily from',
  severe: 'blood pours freely from',
};

// --- Bleeding Severity Descriptions (Third-Person) ---
// Reserved for future third-person bleeding severity formatting
const _BLEEDING_SEVERITY_THIRD_PERSON = {
  minor: 'bleeding lightly',
  moderate: 'bleeding',
  severe: 'bleeding heavily',
};

/**
 * @typedef {import('./injuryAggregationService.js').InjurySummaryDTO} InjurySummaryDTO
 * @typedef {import('./injuryAggregationService.js').InjuredPartInfo} InjuredPartInfo
 */

/**
 * @typedef {object} DamageEventData
 * @property {string} entityName - Target entity name
 * @property {string} entityPronoun - Pronoun (he/she/they)
 * @property {string} partType - Part that was hit
 * @property {string|null} orientation - left/right/null
 * @property {string} damageType - piercing/blunt/slashing/etc.
 * @property {number} damageAmount - Amount of damage
 * @property {string} previousState - State before damage
 * @property {string} newState - State after damage
 * @property {string[]} effectsTriggered - bleeding, burning, etc.
 * @property {object[]} [propagatedDamage] - Internal damage results
 */

/**
 * Service that formats injury data into natural language descriptions.
 * Supports first-person (sensory) and third-person (narrative) voices.
 *
 * @augments BaseService
 */
class InjuryNarrativeFormatterService extends BaseService {
  /** @type {import('../../interfaces/coreServices.js').ILogger} */
  #logger;

  /**
   * Creates a new InjuryNarrativeFormatterService instance.
   *
   * @param {object} dependencies - The service dependencies
   * @param {import('../../interfaces/coreServices.js').ILogger} dependencies.logger - Logger instance
   */
  constructor({ logger }) {
    super();
    this.#logger = this._init('InjuryNarrativeFormatterService', logger, {});
  }

  /**
   * Formats injury summary in first-person sensory voice.
   * Used for status panel display.
   *
   * @param {InjurySummaryDTO} summary - The injury summary to format
   * @returns {string} First-person narrative description
   */
  formatFirstPerson(summary) {
    if (!summary) {
      this.#logger.warn('formatFirstPerson called with null/undefined summary');
      return 'I feel fine.';
    }

    // Check if entity is dead
    if (summary.isDead) {
      return 'Everything fades to black...';
    }

    // Check if entity is dying
    if (summary.isDying) {
      return this.#formatDyingMessage(summary.dyingTurnsRemaining);
    }

    // Check if healthy
    if (
      !summary.injuredParts ||
      summary.injuredParts.length === 0
    ) {
      return 'I feel fine.';
    }

    // Build exclusion set for dismembered parts ONCE at start
    // A dismembered part should only show "is missing", not health state or other effects
    const dismemberedPartIds = this.#buildDismemberedPartIdSet(summary);

    // 1. FIRST: Dismemberment (highest priority - body part loss)
    const narrativeParts = this.#formatDismembermentFirstPerson(summary);

    // 2. Group injuries by severity (most severe first)
    const states = getStateOrder(false); // Descending severity

    for (const state of states) {
      if (state === 'healthy') continue;

      let parts = [];
      if (state === 'destroyed') {
        // Use destroyedParts array as authoritative source (no duplicate merging)
        // Filter out dismembered parts - they should only show "is missing"
        parts = (summary.destroyedParts || []).filter(
          (p) => !dismemberedPartIds.has(p.partEntityId)
        );
      } else {
        // Filter out dismembered parts from other health states too
        parts = (summary.injuredParts || []).filter(
          (p) => p.state === state && !dismemberedPartIds.has(p.partEntityId)
        );
      }

      if (parts.length > 0) {
        narrativeParts.push(this.#formatPartGroupFirstPerson(parts, state));
      }
    }

    // 3. Add other effect descriptions (bleeding, burning, etc. - dismemberment already handled above)
    const effectDescriptions = this.#formatEffectsFirstPerson(summary, dismemberedPartIds);
    if (effectDescriptions) {
      narrativeParts.push(effectDescriptions);
    }

    return narrativeParts.join(' ') || 'I feel fine.';
  }

  /**
   * Formats injury summary in third-person voice for visible injuries only.
   * Mirrors first-person ordering while filtering out vital organs and pain language.
   *
   * @param {InjurySummaryDTO} summary - The injury summary to format
   * @returns {string} Third-person visible-injury description
   */
  formatThirdPersonVisible(summary) {
    if (!summary) {
      this.#logger.warn('formatThirdPersonVisible called with null/undefined summary');
      return 'Perfect health.';
    }

    const hasVisibleData =
      (summary.injuredParts && summary.injuredParts.length > 0) ||
      (summary.destroyedParts && summary.destroyedParts.length > 0) ||
      (summary.dismemberedParts && summary.dismemberedParts.length > 0) ||
      (summary.bleedingParts && summary.bleedingParts.length > 0) ||
      (summary.burningParts && summary.burningParts.length > 0) ||
      (summary.poisonedParts && summary.poisonedParts.length > 0) ||
      (summary.fracturedParts && summary.fracturedParts.length > 0);

    if (!hasVisibleData) {
      return 'Perfect health.';
    }

    const dismemberedPartIds = this.#buildDismemberedPartIdSet(summary);
    const visibleNarrative = [];

    const visibleDismembered = (summary.dismemberedParts || []).filter(
      (p) => !p.isVitalOrgan
    );
    if (visibleDismembered.length > 0) {
      visibleNarrative.push(
        this.#formatDismembermentThirdPerson(visibleDismembered)
      );
    }

    const states = getStateOrder(false);
    for (const state of states) {
      if (state === 'healthy') continue;

      const partsForState = state === 'destroyed'
        ? summary.destroyedParts || []
        : (summary.injuredParts || []).filter((p) => p.state === state);

      const visibleParts = partsForState.filter(
        (p) => !p.isVitalOrgan && !dismemberedPartIds.has(p.partEntityId)
      );

      if (visibleParts.length > 0) {
        visibleNarrative.push(
          this.#formatPartGroupThirdPerson(visibleParts, state)
        );
      }
    }

    const effectDescriptions = this.#formatEffectsThirdPerson(
      summary,
      dismemberedPartIds
    );
    if (effectDescriptions) {
      visibleNarrative.push(effectDescriptions);
    }

    return visibleNarrative.join(' ') || 'Perfect health.';
  }

  /**
   * Formats a damage event in third-person narrative voice.
   * Used for chat panel messages.
   *
   * @param {DamageEventData} damageEventData - Data from damage events
   * @returns {string} Third-person narrative description
   */
  formatDamageEvent(damageEventData) {
    if (!damageEventData) {
      this.#logger.warn(
        'formatDamageEvent called with null/undefined damageEventData'
      );
      return '';
    }

    const {
      entityName,
      entityPronoun: _entityPronoun, // Reserved for future third-person narrative
      partType,
      orientation,
      damageType,
      damageAmount: _damageAmount, // Reserved for future severity-based narrative
      previousState: _previousState,
      newState: _newState,
      effectsTriggered,
      propagatedDamage,
    } = damageEventData;

    // Defensive null checks with fallbacks for incomplete event data
    const resolvedEntityName = entityName || 'An entity';
    const resolvedPartType = partType || 'body part';
    const resolvedDamageType = damageType || 'damage';

    // Log warning for incomplete data (helps with debugging propagation events)
    if (!entityName || !partType || !damageType) {
      this.#logger.warn('formatDamageEvent received incomplete data', {
        hasEntityName: !!entityName,
        hasPartType: !!partType,
        hasDamageType: !!damageType,
      });
    }

    const parts = [];
    const partName = this.#formatPartName(resolvedPartType, orientation);

    // Primary damage description: "{entityName}'s {partName} suffers {damageType} damage"
    let primaryDamage = `${resolvedEntityName}'s ${partName} suffers ${resolvedDamageType} damage`;

    // Effects triggered (bleeding, etc.) - append to same sentence
    if (effectsTriggered && effectsTriggered.length > 0) {
      const effectDescs = effectsTriggered
        .map((effect) => {
          const effectDesc = THIRD_PERSON_EFFECT_MAP[effect];
          return effectDesc ? effectDesc : null;
        })
        .filter(Boolean);

      if (effectDescs.length > 0) {
        primaryDamage += ` and ${effectDescs.join(' and ')}`;
      }
    }

    primaryDamage += '.';
    parts.push(primaryDamage);

    // Propagated damage - narrative chain
    if (propagatedDamage && propagatedDamage.length > 0) {
      propagatedDamage.forEach((prop, index) => {
        const propPartName = this.#formatPartName(prop.childPartType, prop.orientation);
        const connector = index === 0 ? 'The damage propagates to' : 'The damage also propagates to';
        
        let propDamage = `${connector} ${resolvedEntityName}'s ${propPartName}, that suffers ${resolvedDamageType} damage`;

        // Add effects for propagated damage
        if (prop.effectsTriggered && prop.effectsTriggered.length > 0) {
          const propEffectDescs = prop.effectsTriggered
            .map((effect) => {
              const effectDesc = THIRD_PERSON_EFFECT_MAP[effect];
              return effectDesc ? effectDesc : null;
            })
            .filter(Boolean);

          if (propEffectDescs.length > 0) {
            propDamage += ` and ${propEffectDescs.join(' and ')}`;
          }
        }

        propDamage += '.';
        parts.push(propDamage);
      });
    }

    return parts.join(' ');
  }

  /**
   * Formats a group of parts with the same state for first-person voice.
   *
   * @param {InjuredPartInfo[]} parts - Parts with the same state
   * @param {string} state - The health state
   * @returns {string} Formatted description
   * @private
   */
  #formatPartGroupFirstPerson(parts, state) {
    if (parts.length === 0) {
      return '';
    }

    const partNames = parts.map((p) =>
      this.#formatPartName(p.partType, p.orientation)
    );

    if (partNames.length === 1) {
      const stateDesc = getFirstPersonDescription(state) || `feels ${state}`;
      return `My ${partNames[0]} ${stateDesc}.`;
    }

    // Use plural form for multiple parts
    const stateDescPlural =
      getFirstPersonDescriptionPlural(state) || `feel ${state}`;
    const lastPart = partNames.pop();
    return `My ${partNames.join(', ')} and ${lastPart} ${stateDescPlural}.`;
  }

  /**
   * Formats effect descriptions for first-person voice.
   *
   * @param {InjurySummaryDTO} summary - The injury summary
   * @param {Set<string>} [dismemberedPartIds] - Set of part IDs that are dismembered (to exclude from other effects)
   * @returns {string} Effect descriptions or empty string
   * @private
   */
  #formatEffectsFirstPerson(summary, dismemberedPartIds = new Set()) {
    const effectParts = [];

    // Note: Dismemberment is now processed FIRST in formatFirstPerson() before health states
    // This method only handles other effects (bleeding, burning, poisoned, fractured)

    // Bleeding effects - grouped by severity, exclude dismembered parts
    const bleedingParts = (summary.bleedingParts || []).filter(
      (p) => !dismemberedPartIds.has(p.partEntityId)
    );
    const bleedingNarrative = this.#formatBleedingEffectsFirstPerson(bleedingParts);
    if (bleedingNarrative) {
      effectParts.push(bleedingNarrative);
    }

    // Burning effects - exclude dismembered parts (can't burn a missing part)
    const burningParts = (summary.burningParts || []).filter(
      (p) => !dismemberedPartIds.has(p.partEntityId)
    );
    for (const part of burningParts) {
      const partName = this.#formatPartName(part.partType, part.orientation);
      effectParts.push(
        `${this.#capitalizeFirst(FIRST_PERSON_EFFECT_MAP.burning)} my ${partName}.`
      );
    }

    // Poisoned effects - exclude dismembered parts (can't be poisoned in missing part)
    const poisonedParts = (summary.poisonedParts || []).filter(
      (p) => !dismemberedPartIds.has(p.partEntityId)
    );
    for (const part of poisonedParts) {
      const partName = this.#formatPartName(part.partType, part.orientation);
      effectParts.push(
        `${this.#capitalizeFirst(FIRST_PERSON_EFFECT_MAP.poisoned)} my ${partName}.`
      );
    }

    // Fractured effects - exclude dismembered parts (can't have fracture in missing part)
    const fracturedParts = (summary.fracturedParts || []).filter(
      (p) => !dismemberedPartIds.has(p.partEntityId)
    );
    for (const part of fracturedParts) {
      const partName = this.#formatPartName(part.partType, part.orientation);
      effectParts.push(
        `${this.#capitalizeFirst(FIRST_PERSON_EFFECT_MAP.fractured)} my ${partName}.`
      );
    }

    return effectParts.join(' ');
  }

  /**
   * Formats bleeding effects grouped by severity level.
   * Parts with the same severity are combined into a single sentence with Oxford comma.
   *
   * @param {Array<object>} bleedingParts - Array of bleeding part objects
   * @returns {string} Formatted bleeding narrative or empty string
   * @private
   */
  #formatBleedingEffectsFirstPerson(bleedingParts) {
    if (!bleedingParts || bleedingParts.length === 0) return '';

    // Group by severity
    const bySeverity = {};
    for (const part of bleedingParts) {
      const severity = part.bleedingSeverity || 'moderate';
      if (!bySeverity[severity]) bySeverity[severity] = [];
      bySeverity[severity].push(part);
    }

    const sentences = [];
    const severityOrder = ['severe', 'moderate', 'minor'];

    for (const severity of severityOrder) {
      const parts = bySeverity[severity];
      if (!parts || parts.length === 0) continue;

      const bleedingDesc =
        BLEEDING_SEVERITY_FIRST_PERSON[severity] ||
        FIRST_PERSON_EFFECT_MAP.bleeding;
      const partNames = parts.map((p) =>
        this.#formatPartName(p.partType, p.orientation)
      );
      const combined = this.#formatListWithLeadingPossessive(partNames, 'my');
      sentences.push(`${this.#capitalizeFirst(bleedingDesc)} ${combined}.`);
    }

    return sentences.join(' ');
  }

  /**
   * Formats a group of parts with the same state for third-person voice.
   *
   * @param {InjuredPartInfo[]} parts
   * @param {string} state
   * @returns {string}
   * @private
   */
  #formatPartGroupThirdPerson(parts, state) {
    if (parts.length === 0) {
      return '';
    }

    const partNames = parts.map((p) =>
      this.#formatPartName(p.partType, p.orientation)
    );

    const stateDesc = getThirdPersonDescription(state) || `is ${state}`;
    const stateDescPlural = this.#pluralizeThirdPersonDescription(stateDesc);

    const formattedList = this.#formatList(partNames);
    const description = partNames.length === 1 ? stateDesc : stateDescPlural;

    return `${this.#capitalizeFirst(formattedList)} ${description}.`;
  }

  /**
   * Formats effect descriptions for third-person voice.
   *
   * @param {InjurySummaryDTO} summary
   * @param {Set<string>} dismemberedPartIds
   * @returns {string}
   * @private
   */
  #formatEffectsThirdPerson(summary, dismemberedPartIds = new Set()) {
    const effectParts = [];

    const bleedingParts = (summary.bleedingParts || []).filter(
      (p) => !dismemberedPartIds.has(p.partEntityId) && !p.isVitalOrgan
    );
    const bleedingNarrative = this.#formatBleedingEffectsThirdPerson(
      bleedingParts
    );
    if (bleedingNarrative) {
      effectParts.push(bleedingNarrative);
    }

    const burningParts = (summary.burningParts || []).filter(
      (p) => !dismemberedPartIds.has(p.partEntityId) && !p.isVitalOrgan
    );
    for (const part of burningParts) {
      const partName = this.#formatPartName(part.partType, part.orientation);
      effectParts.push(
        `${this.#capitalizeFirst(partName)} ${THIRD_PERSON_EFFECT_MAP.burning}.`
      );
    }

    const poisonedParts = (summary.poisonedParts || []).filter(
      (p) => !dismemberedPartIds.has(p.partEntityId) && !p.isVitalOrgan
    );
    for (const part of poisonedParts) {
      const partName = this.#formatPartName(part.partType, part.orientation);
      effectParts.push(
        `${this.#capitalizeFirst(partName)} ${THIRD_PERSON_EFFECT_MAP.poisoned}.`
      );
    }

    const fracturedParts = (summary.fracturedParts || []).filter(
      (p) => !dismemberedPartIds.has(p.partEntityId) && !p.isVitalOrgan
    );
    for (const part of fracturedParts) {
      const partName = this.#formatPartName(part.partType, part.orientation);
      effectParts.push(
        `${this.#capitalizeFirst(partName)} ${THIRD_PERSON_EFFECT_MAP.fractured}.`
      );
    }

    return effectParts.join(' ');
  }

  /**
   * Formats bleeding effects grouped by severity for third-person voice.
   *
   * @param {Array<object>} bleedingParts
   * @returns {string}
   * @private
   */
  #formatBleedingEffectsThirdPerson(bleedingParts) {
    if (!bleedingParts || bleedingParts.length === 0) return '';

    const bySeverity = {};
    for (const part of bleedingParts) {
      const severity = part.bleedingSeverity || 'moderate';
      if (!bySeverity[severity]) bySeverity[severity] = [];
      bySeverity[severity].push(part);
    }

    const sentences = [];
    const severityOrder = ['severe', 'moderate', 'minor'];
    const bleedingSeverityThirdPerson = {
      minor: 'Blood seeps from',
      moderate: 'Blood flows steadily from',
      severe: 'Blood pours freely from',
    };

    for (const severity of severityOrder) {
      const parts = bySeverity[severity];
      if (!parts || parts.length === 0) continue;

      const bleedingDesc =
        bleedingSeverityThirdPerson[severity] || 'Blood flows from';
      const partNames = parts.map((p) =>
        this.#formatPartName(p.partType, p.orientation)
      );
      const combined = this.#formatList(partNames);
      sentences.push(`${bleedingDesc} ${combined}.`);
    }

    return sentences.join(' ');
  }

  /**
   * Formats dismemberment descriptions for third-person narrative.
   *
   * @param {InjurySummaryDTO['dismemberedParts']} dismemberedParts
   * @returns {string}
   * @private
   */
  #formatDismembermentThirdPerson(dismemberedParts) {
    if (!dismemberedParts || dismemberedParts.length === 0) {
      return '';
    }

    const partNames = dismemberedParts.map((part) =>
      this.#formatPartName(part.partType, part.orientation)
    );

    const formattedList = this.#formatList(partNames);
    const verb = dismemberedParts.length === 1 ? 'is' : 'are';

    return `${this.#capitalizeFirst(formattedList)} ${verb} missing.`;
  }

  /**
   * Formats a list with a possessive prefix on the first item only.
   *
   * @param {string[]} items - List of items to format
   * @param {string} possessive - The possessive prefix (e.g., "My", "my")
   * @returns {string} Formatted list (e.g., "My left arm, right leg, and torso")
   * @private
   */
  #formatListWithLeadingPossessive(items, possessive) {
    if (items.length === 0) return '';
    if (items.length === 1) return `${possessive} ${items[0]}`;
    if (items.length === 2) return `${possessive} ${items[0]} and ${items[1]}`;

    const allButLast = items.slice(0, -1);
    const lastItem = items[items.length - 1];
    return `${possessive} ${allButLast.join(', ')}, and ${lastItem}`;
  }

  /**
   * Formats a plain list with Oxford comma rules.
   *
   * @param {string[]} items
   * @returns {string}
   * @private
   */
  #formatList(items) {
    if (items.length === 0) return '';
    if (items.length === 1) return `${items[0]}`;
    if (items.length === 2) return `${items[0]} and ${items[1]}`;

    const allButLast = items.slice(0, -1);
    const lastItem = items[items.length - 1];
    return `${allButLast.join(', ')}, and ${lastItem}`;
  }

  /**
   * Creates a Set of part entity IDs for dismembered parts.
   * Used to filter dismembered parts from other descriptions.
   *
   * @param {InjurySummaryDTO} summary - The injury summary
   * @returns {Set<string>} Set of dismembered part entity IDs
   * @private
   */
  #buildDismemberedPartIdSet(summary) {
    return new Set(
      (summary.dismemberedParts || []).map((p) => p.partEntityId)
    );
  }

  /**
   * Formats the dying state message with turn count.
   *
   * @param {number} turnsRemaining - Turns until death
   * @returns {string} Dying message
   * @private
   */
  #formatDyingMessage(turnsRemaining) {
    const turnsText = turnsRemaining === 1 ? 'moment' : `${turnsRemaining} moments`;
    return `I am dying. Without help, I have only ${turnsText} left...`;
  }

  /**
   * Formats dismemberment descriptions for first-person narrative.
   *
   * @param {InjurySummaryDTO} summary - The injury summary
   * @returns {string[]} Array of dismemberment sentences
   * @private
   */
  #formatDismembermentFirstPerson(summary) {
    const dismemberedParts = summary.dismemberedParts || [];
    if (dismemberedParts.length === 0) {
      return [];
    }

    const partNames = dismemberedParts.map((part) =>
      this.#formatPartName(part.partType, part.orientation)
    );

    const formattedList = this.#formatListWithLeadingPossessive(partNames, 'My');
    const verb = dismemberedParts.length === 1 ? 'is' : 'are';

    return [`${formattedList} ${verb} missing.`];
  }

  /**
   * Converts a singular third-person description to plural (basic heuristic).
   *
   * @param {string} description
   * @returns {string}
   * @private
   */
  #pluralizeThirdPersonDescription(description) {
    if (!description) return '';

    if (description.startsWith('is ')) {
      return description.replace('is ', 'are ');
    }

    if (description.startsWith('has ')) {
      return description.replace('has ', 'have ');
    }

    if (description.startsWith('has been ')) {
      return description.replace('has been ', 'have been ');
    }

    return description;
  }

  /**
   * Formats part name with orientation.
   *
   * @param {string} partType - Type of part
   * @param {string|null} orientation - left/right/null
   * @returns {string} Formatted name (e.g., "left arm", "torso", "heart")
   * @private
   */
  #formatPartName(partType, orientation) {
    const normalizedType = (partType?.toLowerCase() || 'body part').replace(/_/g, ' ');

    if (orientation) {
      return `${orientation} ${normalizedType}`;
    }

    return normalizedType;
  }

  /**
   * Capitalizes the first letter of a string.
   *
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   * @private
   */
  #capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

export default InjuryNarrativeFormatterService;
