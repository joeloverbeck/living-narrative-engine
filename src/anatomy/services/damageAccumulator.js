/**
 * @file DamageAccumulator - Session-based accumulation of damage entries during damage sequences.
 * @see specs/injury-reporting-and-user-interface.md
 */

import { BaseService } from '../../utils/serviceBase.js';

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
 * @typedef {object} QueuedEvent
 * @property {string} eventType - The event type to dispatch
 * @property {object} payload - The event payload
 */

/**
 * @typedef {object} DamageSession
 * @property {string} sessionId - Unique session identifier
 * @property {string} entityId - The primary target entity ID
 * @property {DamageEntry[]} entries - All damage entries accumulated
 * @property {QueuedEvent[]} pendingEvents - Events to dispatch after composition
 * @property {number} createdAt - Timestamp when session was created
 */

/**
 * @typedef {object} FinalizedResult
 * @property {DamageEntry[]} entries - All accumulated damage entries
 * @property {QueuedEvent[]} pendingEvents - Events to dispatch
 */

/**
 * Service that accumulates damage entries during a damage sequence.
 * Creates sessions that persist through recursive APPLY_DAMAGE calls,
 * collecting all damage data for final composition.
 *
 * @augments BaseService
 */
class DamageAccumulator extends BaseService {
  /** @type {import('../../interfaces/coreServices.js').ILogger} */
  #logger;

  /** @type {number} */
  #sessionCounter;

  /**
   * Creates a new DamageAccumulator instance.
   *
   * @param {object} dependencies - The service dependencies
   * @param {import('../../interfaces/coreServices.js').ILogger} dependencies.logger - Logger instance
   */
  constructor({ logger }) {
    super();
    this.#logger = this._init('DamageAccumulator', logger, {});
    this.#sessionCounter = 0;
  }

  /**
   * Creates a new damage accumulation session.
   *
   * @param {string} entityId - The primary target entity ID
   * @returns {DamageSession} A new damage session
   */
  createSession(entityId) {
    if (!entityId) {
      this.#logger.warn(
        'DamageAccumulator.createSession called without entityId'
      );
    }

    this.#sessionCounter += 1;
    const session = {
      sessionId: `damage_session_${this.#sessionCounter}_${Date.now()}`,
      entityId: entityId || 'unknown',
      entries: [],
      pendingEvents: [],
      createdAt: Date.now(),
    };

    this.#logger.debug(
      `DamageAccumulator: Created session ${session.sessionId} for entity ${entityId}`
    );
    return session;
  }

  /**
   * Records a damage entry to the session.
   *
   * @param {DamageSession} session - The active damage session
   * @param {DamageEntry} entry - The damage entry to record
   */
  recordDamage(session, entry) {
    if (!session) {
      this.#logger.error(
        'DamageAccumulator.recordDamage called without session'
      );
      return;
    }

    if (!entry) {
      this.#logger.warn('DamageAccumulator.recordDamage called without entry');
      return;
    }

    // Ensure effectsTriggered array exists
    const normalizedEntry = {
      ...entry,
      effectsTriggered: entry.effectsTriggered || [],
      severity: entry.severity ?? 'standard',
    };

    session.entries.push(normalizedEntry);

    this.#logger.debug(
      `DamageAccumulator: Recorded damage to ${entry.partType || 'unknown'} ` +
        `(propagated: ${!!entry.propagatedFrom}) in session ${session.sessionId}`
    );
  }

  /**
   * Records an effect that was triggered for a specific part.
   * Finds the matching damage entry and adds the effect.
   *
   * @param {DamageSession} session - The active damage session
   * @param {string} partId - The part entity ID the effect applies to
   * @param {string} effect - The effect type (e.g., 'dismembered', 'bleeding')
   */
  recordEffect(session, partId, effect) {
    if (!session) {
      this.#logger.error(
        'DamageAccumulator.recordEffect called without session'
      );
      return;
    }

    if (!partId || !effect) {
      this.#logger.warn(
        'DamageAccumulator.recordEffect called with missing partId or effect'
      );
      return;
    }

    // Find the entry for this part and add the effect
    const entry = session.entries.find((e) => e.partId === partId);
    if (entry) {
      if (!entry.effectsTriggered.includes(effect)) {
        entry.effectsTriggered.push(effect);
        this.#logger.debug(
          `DamageAccumulator: Added effect '${effect}' to ${entry.partType} in session ${session.sessionId}`
        );
      }
    } else {
      this.#logger.warn(
        `DamageAccumulator: Could not find entry for partId ${partId} to add effect '${effect}'`
      );
    }
  }

  /**
   * Queues an event to be dispatched after the damage sequence completes.
   * This preserves backwards compatibility with existing event listeners.
   *
   * @param {DamageSession} session - The active damage session
   * @param {string} eventType - The event type to dispatch
   * @param {object} payload - The event payload
   */
  queueEvent(session, eventType, payload) {
    if (!session) {
      this.#logger.error('DamageAccumulator.queueEvent called without session');
      return;
    }

    if (!eventType) {
      this.#logger.warn(
        'DamageAccumulator.queueEvent called without eventType'
      );
      return;
    }

    session.pendingEvents.push({
      eventType,
      payload: payload || {},
    });

    this.#logger.debug(
      `DamageAccumulator: Queued event '${eventType}' in session ${session.sessionId}`
    );
  }

  /**
   * Finalizes the session and returns accumulated data.
   * The session should be discarded after this call.
   *
   * @param {DamageSession} session - The damage session to finalize
   * @returns {FinalizedResult} The accumulated entries and pending events
   */
  finalize(session) {
    if (!session) {
      this.#logger.error('DamageAccumulator.finalize called without session');
      return {
        entries: [],
        pendingEvents: [],
      };
    }

    const duration = Date.now() - session.createdAt;
    this.#logger.debug(
      `DamageAccumulator: Finalizing session ${session.sessionId} with ${session.entries.length} entries ` +
        `and ${session.pendingEvents.length} pending events (duration: ${duration}ms)`
    );

    return {
      entries: [...session.entries],
      pendingEvents: [...session.pendingEvents],
    };
  }

  /**
   * Checks if a session has any recorded damage entries.
   *
   * @param {DamageSession} session - The damage session to check
   * @returns {boolean} True if the session has entries
   */
  hasEntries(session) {
    return session && session.entries && session.entries.length > 0;
  }

  /**
   * Gets the primary (non-propagated) damage entry from a session.
   *
   * @param {DamageSession} session - The damage session
   * @returns {DamageEntry|null} The primary entry or null if not found
   */
  getPrimaryEntry(session) {
    if (!session || !session.entries) {
      return null;
    }
    return session.entries.find((e) => !e.propagatedFrom) || null;
  }
}

export default DamageAccumulator;
