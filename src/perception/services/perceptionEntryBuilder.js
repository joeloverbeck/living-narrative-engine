/**
 * @file PerceptionEntryBuilder
 * @description Builds perception entries for specific recipients by handling role-based
 * description selection and sense filtering. Extracted from AddPerceptionLogEntryHandler
 * to achieve single responsibility and enable isolated unit testing.
 * @see specs/add_perception_log_entry_handler_robustness.md
 * @see tickets/ADDPERLOGENTHANROB-004.md
 */

import { ensureValidLogger } from '../../utils/index.js';

/**
 * @typedef {object} EntryBuildParams
 * @property {string} recipientId - ID of the entity receiving the entry
 * @property {object} baseEntry - The original perception entry
 * @property {string} baseEntry.descriptionText - Base description text
 * @property {string|undefined} actorDescription - Actor-specific description
 * @property {string|undefined} targetDescription - Target-specific description
 * @property {string|undefined} originatingActorId - Actor who initiated the event
 * @property {string|undefined} targetId - Target of the action
 * @property {Map<string, {descriptionText: string|null, sense: string}>|null} filteredRecipientsMap - Sense filtering results
 */

/**
 * @typedef {object} BuiltEntry
 * @property {string} descriptionText - Final description text
 * @property {string} [perceivedVia] - Sense used to perceive (e.g., 'self', 'visual')
 */

/**
 * Service for building perception entries for specific recipients.
 * Handles role-based description selection (actor vs target vs observer)
 * and sense filtering integration.
 *
 * Entry Building Logic:
 * 1. Actor receives actor_description WITHOUT sense filtering (perceivedVia = 'self')
 * 2. Target receives target_description WITH sense filtering applied
 * 3. Observers receive base description_text WITH sense filtering applied
 * 4. Original entry fields are preserved (never mutated)
 */
class PerceptionEntryBuilder {
  // Logger reserved for future debugging/telemetry (DI pattern consistency)
  // eslint-disable-next-line no-unused-private-class-members
  #logger;

  /**
   * Create a PerceptionEntryBuilder instance.
   *
   * @param {object} deps - Dependencies
   * @param {object} deps.logger - Logger service
   */
  constructor({ logger }) {
    this.#logger = ensureValidLogger(logger, 'PerceptionEntryBuilder');
  }

  /**
   * Builds a perception entry for a specific recipient.
   * Handles role-based description selection and sense filtering.
   *
   * @param {EntryBuildParams} params - Build parameters
   * @returns {BuiltEntry} The built entry with appropriate description and perception info
   */
  buildForRecipient(params) {
    const {
      recipientId,
      baseEntry,
      actorDescription,
      targetDescription,
      originatingActorId,
      targetId,
      filteredRecipientsMap,
    } = params;

    // Determine which description this recipient should receive based on role
    let descriptionForRecipient = baseEntry.descriptionText;
    let skipSenseFiltering = false;
    let perceivedVia;

    // Actor receives actor_description WITHOUT filtering
    if (actorDescription && recipientId === originatingActorId) {
      descriptionForRecipient = actorDescription;
      skipSenseFiltering = true;
      perceivedVia = 'self';
    }
    // Target receives target_description WITH filtering (only if not also actor)
    else if (
      targetDescription &&
      recipientId === targetId &&
      recipientId !== originatingActorId
    ) {
      descriptionForRecipient = targetDescription;
      // Will be filtered below if filtering enabled
    }
    // Observers receive description_text (default - already set)

    // Apply sense filtering if needed (unless skipped for actor)
    let finalEntry;
    const hasCustomDescription =
      descriptionForRecipient !== baseEntry.descriptionText;

    if (!skipSenseFiltering && filteredRecipientsMap) {
      // filtered is guaranteed to exist here - entities without filter data
      // or with canPerceive=false are skipped before calling this method
      const filtered = filteredRecipientsMap.get(recipientId);
      // Custom descriptions (target_description) take priority over filtered observer text
      // This ensures target sees "Pitch removes my shoes" not "Pitch removes Cress's shoes"
      finalEntry = {
        ...baseEntry,
        descriptionText: hasCustomDescription
          ? descriptionForRecipient
          : (filtered.descriptionText ?? baseEntry.descriptionText),
        perceivedVia: filtered.sense,
      };
    } else if (
      perceivedVia ||
      descriptionForRecipient !== baseEntry.descriptionText
    ) {
      // Need to create new entry for actor or custom description
      finalEntry = {
        ...baseEntry,
        descriptionText: descriptionForRecipient,
        ...(perceivedVia && { perceivedVia }),
      };
    } else {
      // No changes needed, use original entry (preserve referential equality)
      finalEntry = baseEntry;
    }

    return finalEntry;
  }
}

export default PerceptionEntryBuilder;
