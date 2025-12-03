/**
 * @file InjuryNarrativeFormatterService - Formats injury data into natural language descriptions.
 * @see specs/injury-reporting-and-user-interface.md section 5.2
 */

import { BaseService } from '../../utils/serviceBase.js';

// --- State-to-Adjective Mappings (First-Person) ---
const FIRST_PERSON_STATE_MAP = {
  healthy: 'feels fine',
  scratched: 'stings slightly',
  wounded: 'throbs painfully',
  injured: 'aches deeply',
  critical: 'screams with agony',
  destroyed: 'is completely numb',
};

// --- State-to-Adjective Mappings (Third-Person) ---
const THIRD_PERSON_STATE_MAP = {
  healthy: 'is uninjured',
  scratched: 'is scratched',
  wounded: 'is wounded',
  injured: 'is injured',
  critical: 'is critically injured',
  destroyed: 'has been destroyed',
};

// --- Effect-to-Description Mappings (First-Person) ---
const FIRST_PERSON_EFFECT_MAP = {
  bleeding: 'blood flows from',
  burning: 'searing heat radiates from',
  poisoned: 'a sickening feeling spreads from',
  fractured: 'sharp pain shoots through',
};

// --- Effect-to-Description Mappings (Third-Person) ---
const THIRD_PERSON_EFFECT_MAP = {
  bleeding: 'is bleeding',
  burning: 'is burning',
  poisoned: 'is poisoned',
  fractured: 'is fractured',
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
      const turnsText =
        summary.dyingTurnsRemaining === 1
          ? 'moment'
          : `${summary.dyingTurnsRemaining} moments`;
      return `I am dying. Without help, I have only ${turnsText} left...`;
    }

    // Check if healthy
    if (
      !summary.injuredParts ||
      summary.injuredParts.length === 0
    ) {
      return 'I feel fine.';
    }

    const narrativeParts = [];

    // Group injuries by severity (most severe first)
    const destroyedParts = summary.destroyedParts || [];
    const criticalParts = summary.injuredParts.filter(
      (p) => p.state === 'critical'
    );
    const injuredParts = summary.injuredParts.filter(
      (p) => p.state === 'injured'
    );
    const woundedParts = summary.injuredParts.filter(
      (p) => p.state === 'wounded'
    );
    const scratchedParts = summary.injuredParts.filter(
      (p) => p.state === 'scratched'
    );

    // Process each severity group
    if (destroyedParts.length > 0) {
      narrativeParts.push(
        this.#formatPartGroupFirstPerson(destroyedParts, 'destroyed')
      );
    }

    if (criticalParts.length > 0) {
      narrativeParts.push(
        this.#formatPartGroupFirstPerson(criticalParts, 'critical')
      );
    }

    if (injuredParts.length > 0) {
      narrativeParts.push(
        this.#formatPartGroupFirstPerson(injuredParts, 'injured')
      );
    }

    if (woundedParts.length > 0) {
      narrativeParts.push(
        this.#formatPartGroupFirstPerson(woundedParts, 'wounded')
      );
    }

    if (scratchedParts.length > 0) {
      narrativeParts.push(
        this.#formatPartGroupFirstPerson(scratchedParts, 'scratched')
      );
    }

    // Add effect descriptions
    const effectDescriptions = this.#formatEffectsFirstPerson(summary);
    if (effectDescriptions) {
      narrativeParts.push(effectDescriptions);
    }

    return narrativeParts.join(' ') || 'I feel fine.';
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
      entityPronoun,
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

    const stateDesc =
      FIRST_PERSON_STATE_MAP[state] || `feels ${state}`;
    const partNames = parts.map((p) =>
      this.#formatPartName(p.partType, p.orientation)
    );

    if (partNames.length === 1) {
      return `My ${partNames[0]} ${stateDesc}.`;
    }

    const lastPart = partNames.pop();
    return `My ${partNames.join(', ')} and ${lastPart} ${stateDesc}.`;
  }

  /**
   * Formats effect descriptions for first-person voice.
   *
   * @param {InjurySummaryDTO} summary - The injury summary
   * @returns {string} Effect descriptions or empty string
   * @private
   */
  #formatEffectsFirstPerson(summary) {
    const effectParts = [];

    // Bleeding effects
    const bleedingParts = summary.bleedingParts || [];
    for (const part of bleedingParts) {
      const partName = this.#formatPartName(part.partType, part.orientation);
      const severity = part.bleedingSeverity || 'moderate';
      const bleedingDesc =
        BLEEDING_SEVERITY_FIRST_PERSON[severity] ||
        FIRST_PERSON_EFFECT_MAP.bleeding;
      effectParts.push(`${this.#capitalizeFirst(bleedingDesc)} my ${partName}.`);
    }

    // Burning effects
    const burningParts = summary.burningParts || [];
    for (const part of burningParts) {
      const partName = this.#formatPartName(part.partType, part.orientation);
      effectParts.push(
        `${this.#capitalizeFirst(FIRST_PERSON_EFFECT_MAP.burning)} my ${partName}.`
      );
    }

    // Poisoned effects
    const poisonedParts = summary.poisonedParts || [];
    for (const part of poisonedParts) {
      const partName = this.#formatPartName(part.partType, part.orientation);
      effectParts.push(
        `${this.#capitalizeFirst(FIRST_PERSON_EFFECT_MAP.poisoned)} my ${partName}.`
      );
    }

    // Fractured effects
    const fracturedParts = summary.fracturedParts || [];
    for (const part of fracturedParts) {
      const partName = this.#formatPartName(part.partType, part.orientation);
      effectParts.push(
        `${this.#capitalizeFirst(FIRST_PERSON_EFFECT_MAP.fractured)} my ${partName}.`
      );
    }

    return effectParts.join(' ');
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
   * Gets the possessive pronoun for an entity.
   *
   * @param {string} pronoun - Subject pronoun (he/she/they)
   * @returns {string} Possessive pronoun (his/her/their)
   * @private
   */
  #getPossessivePronoun(pronoun) {
    const possessiveMap = {
      he: 'his',
      she: 'her',
      they: 'their',
      it: 'its',
    };
    return possessiveMap[pronoun?.toLowerCase()] || 'their';
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
