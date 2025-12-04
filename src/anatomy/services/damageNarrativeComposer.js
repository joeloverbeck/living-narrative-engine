/**
 * @file DamageNarrativeComposer - Composes unified damage narratives from accumulated damage entries.
 * @see specs/injury-reporting-and-user-interface.md
 */

import { BaseService } from '../../utils/serviceBase.js';

// --- Effect-to-Description Mappings (Third-Person) ---
// Reuses the same mappings as InjuryNarrativeFormatterService for consistency
const THIRD_PERSON_EFFECT_MAP = Object.freeze({
  bleeding: 'is bleeding',
  burning: 'is burning',
  poisoned: 'is poisoned',
  fractured: 'is fractured',
  dismembered: 'flies off in an arc',
});

/**
 * @typedef {object} DamageEntry
 * @property {string} entityId - Target entity ID
 * @property {string} entityName - Entity display name
 * @property {string} entityPronoun - Entity pronoun (he/she/they)
 * @property {string} entityPossessive - Entity possessive pronoun (his/her/their)
 * @property {string} partId - Target part entity ID
 * @property {string} partType - Part type (e.g., 'leg', 'head')
 * @property {string|null} orientation - Part orientation (e.g., 'left', 'right')
 * @property {number} amount - Damage amount
 * @property {string} damageType - Damage type (e.g., 'slashing')
 * @property {string|null} propagatedFrom - Parent part ID if propagated damage
 * @property {string[]} effectsTriggered - Effects like 'dismembered', 'bleeding'
 */

/**
 * Service that composes unified damage narratives from accumulated damage entries.
 * Takes the output of DamageAccumulator and produces human-readable text.
 *
 * @augments BaseService
 */
class DamageNarrativeComposer extends BaseService {
  /** @type {import('../../interfaces/coreServices.js').ILogger} */
  #logger;

  /**
   * Creates a new DamageNarrativeComposer instance.
   *
   * @param {object} dependencies - The service dependencies
   * @param {import('../../interfaces/coreServices.js').ILogger} dependencies.logger - Logger instance
   */
  constructor({ logger }) {
    super();
    this.#logger = this._init('DamageNarrativeComposer', logger, {});
  }

  /**
   * Composes a unified narrative from damage entries.
   *
   * @param {DamageEntry[]} entries - All damage entries from the sequence
   * @returns {string} Composed narrative text
   */
  compose(entries) {
    if (!entries || entries.length === 0) {
      this.#logger.warn('DamageNarrativeComposer.compose called with empty entries');
      return '';
    }

    // Separate primary and propagated entries
    const primaryEntry = entries.find((e) => !e.propagatedFrom);
    const propagatedEntries = entries.filter((e) => e.propagatedFrom);

    if (!primaryEntry) {
      this.#logger.warn('DamageNarrativeComposer: No primary damage entry found');
      return '';
    }

    const segments = [];

    // Primary damage segment
    segments.push(this.#composePrimarySegment(primaryEntry));

    // Propagation segment (combined sentence format per user requirement)
    if (propagatedEntries.length > 0) {
      segments.push(this.#composePropagationSegment(primaryEntry, propagatedEntries));
    }

    return segments.join(' ');
  }

  /**
   * Composes the primary damage segment.
   *
   * @param {DamageEntry} entry - The primary damage entry
   * @returns {string} Formatted primary damage sentence
   * @private
   */
  #composePrimarySegment(entry) {
    const partName = this.#formatPartName(entry.partType, entry.orientation);
    let segment = `${entry.entityName}'s ${partName} suffers ${entry.damageType} damage`;

    const effectDescriptions = this.#getEffectDescriptions(entry.effectsTriggered);
    if (effectDescriptions.length > 0) {
      segment += ` and ${effectDescriptions.join(' and ')}`;
    }

    return segment + '.';
  }

  /**
   * Composes the propagation segment with combined sentence format.
   * Example: "As a result, her brain and left eye suffer piercing damage."
   *
   * @param {DamageEntry} primary - The primary damage entry (for possessive pronoun)
   * @param {DamageEntry[]} propagated - Array of propagated damage entries
   * @returns {string} Formatted propagation sentence(s)
   * @private
   */
  #composePropagationSegment(primary, propagated) {
    if (propagated.length === 0) {
      return '';
    }

    // Group propagated entries by damage type for natural grouping
    const byDamageType = new Map();
    for (const entry of propagated) {
      const key = entry.damageType;
      if (!byDamageType.has(key)) {
        byDamageType.set(key, []);
      }
      byDamageType.get(key).push(entry);
    }

    const sentences = [];

    for (const [damageType, entries] of byDamageType) {
      const sentence = this.#composePropagationGroup(primary, entries, damageType);
      if (sentence) {
        sentences.push(sentence);
      }
    }

    return sentences.join(' ');
  }

  /**
   * Composes a propagation group sentence (same damage type).
   *
   * @param {DamageEntry} primary - The primary damage entry (for possessive pronoun)
   * @param {DamageEntry[]} entries - Propagated entries with same damage type
   * @param {string} damageType - The damage type
   * @returns {string} Formatted sentence
   * @private
   */
  #composePropagationGroup(primary, entries, damageType) {
    if (entries.length === 0) {
      return '';
    }

    // Collect part names
    const partNames = entries.map((e) =>
      this.#formatPartName(e.partType, e.orientation)
    );

    // Collect all effects from all entries in this group
    const allEffects = new Set();
    for (const entry of entries) {
      for (const effect of entry.effectsTriggered || []) {
        allEffects.add(effect);
      }
    }

    // Build the sentence
    const verb = entries.length === 1 ? 'suffers' : 'suffer';
    const partList = this.#formatPartList(partNames);

    let sentence = `As a result, ${primary.entityPossessive} ${partList} ${verb} ${damageType} damage`;

    // Add effects if any
    const effectDescriptions = this.#getEffectDescriptions([...allEffects]);
    if (effectDescriptions.length > 0) {
      // For multiple parts with effects, use a more general phrasing
      if (entries.length > 1) {
        sentence += ` and ${effectDescriptions.join(' and ')}`;
      } else {
        sentence += ` and ${effectDescriptions.join(' and ')}`;
      }
    }

    return sentence + '.';
  }

  /**
   * Formats a list of part names with "and" conjunction.
   *
   * @param {string[]} partNames - Array of part names
   * @returns {string} Formatted list (e.g., "brain and left eye")
   * @private
   */
  #formatPartList(partNames) {
    if (partNames.length === 0) {
      return '';
    }
    if (partNames.length === 1) {
      return partNames[0];
    }
    if (partNames.length === 2) {
      return `${partNames[0]} and ${partNames[1]}`;
    }

    // Oxford comma for 3+
    const allButLast = partNames.slice(0, -1);
    const lastPart = partNames[partNames.length - 1];
    return `${allButLast.join(', ')}, and ${lastPart}`;
  }

  /**
   * Formats part name with orientation.
   *
   * @param {string} partType - Type of part
   * @param {string|null} orientation - left/right/null
   * @returns {string} Formatted name (e.g., "left arm", "torso", "brain")
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
   * Gets effect descriptions for an array of effect types.
   *
   * @param {string[]} effects - Array of effect types
   * @returns {string[]} Array of effect descriptions
   * @private
   */
  #getEffectDescriptions(effects) {
    if (!effects || effects.length === 0) {
      return [];
    }

    return effects
      .map((effect) => THIRD_PERSON_EFFECT_MAP[effect])
      .filter(Boolean);
  }
}

export default DamageNarrativeComposer;
