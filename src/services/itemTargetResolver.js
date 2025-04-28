// src/services/itemTargetResolver.js
// ─────────────────────────────────────────────────────────────────────────────
import {TARGET_MESSAGES, getDisplayName} from '../utils/messages.js';
import {
  CONNECTIONS_COMPONENT_TYPE_ID,
  PASSAGE_DETAILS_COMPONENT_TYPE_ID,
  POSITION_COMPONENT_ID
} from '../types/components.js';

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../core/services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../core/entityManager.js').default} EntityManager */

/** @typedef {import('./conditionEvaluationService.js').default} ConditionEvaluationService */

/**
 * Resolve and validate an item‑use target.
 * If the explicit target is a connection that owns a blocker, the blocker door
 * becomes the effective target.
 */
export class ItemTargetResolverService {
  #em;
  #validatedEventDispatcher; // Changed from #bus
  #ce;
  #logger; // Added

  /**
     * @param {object} dependencies
     * @param {EntityManager} dependencies.entityManager
     * @param {ValidatedEventDispatcher} dependencies.validatedEventDispatcher - Changed from eventBus
     * @param {ConditionEvaluationService} dependencies.conditionEvaluationService
     * @param {ILogger} dependencies.logger - Added
     */
  constructor({entityManager, validatedEventDispatcher, conditionEvaluationService, logger}) {
    if (!entityManager) throw new Error("ItemTargetResolverService: Missing dependency 'entityManager'.");
    if (!validatedEventDispatcher) throw new Error("ItemTargetResolverService: Missing dependency 'validatedEventDispatcher'.");
    if (!conditionEvaluationService) throw new Error("ItemTargetResolverService: Missing dependency 'conditionEvaluationService'.");
    if (!logger) throw new Error("ItemTargetResolverService: Missing dependency 'logger'.");

    this.#em = entityManager;
    this.#validatedEventDispatcher = validatedEventDispatcher; // Store validated dispatcher
    this.#ce = conditionEvaluationService;
    this.#logger = logger; // Store logger

    this.#logger.debug('ItemTargetResolverService instance created.');
  }

  /**
     * @param {object} p
     * @returns {Promise<{success:boolean,target:Entity|null,targetType:'entity'|'connection'|'none',messages:any[]}>}
     */
  async resolveItemTarget(p) {
    const {
      userEntity, usableComponentData,
      explicitTargetEntityId, explicitTargetConnectionEntityId, itemName
    } = p;

    const messages = [];
    // Internal logging for the resolution process itself
    const log = (t, type = 'internal') => {
      messages.push({text: t, type});
      this.#logger.debug(`ItemTargetResolverService.resolveItemTarget: ${t}`); // Also log internally
    };

    if (!usableComponentData.target_required)
      return {success: true, target: null, targetType: 'none', messages};

    // ─────────────────────────── resolve CONNECTION ─────────────────────────
    if (explicitTargetConnectionEntityId) {
      const conn = this.#em.getEntityInstance(explicitTargetConnectionEntityId);
      if (conn) {
        const userRoomId = userEntity.getComponentData(POSITION_COMPONENT_ID)?.locationId;
        const exits = this.#em
          .getEntityInstance(userRoomId)
          ?.getComponentData(CONNECTIONS_COMPONENT_TYPE_ID)
          ?.getAllConnections() ?? [];

        const isExitHere = exits.some(e => (e.id ?? e.connectionEntityId) === conn.id);
        if (!isExitHere) log('Connection is not an exit from this room.', 'warning');
        else {
          const passage = conn.getComponentData(PASSAGE_DETAILS_COMPONENT_TYPE_ID);
          const blockerId = passage?.blockerEntityId ?? null;

          if (blockerId) {
            const blocker = this.#em.getEntityInstance(blockerId);
            if (blocker) {
              log(`Connection blocked by ${getDisplayName(blocker)} – using blocker.`);
              return {success: true, target: blocker, targetType: 'entity', messages};
            }
          }
          return {success: true, target: conn, targetType: 'connection', messages};
        }
      }
    }

    // ─────────────────────────── resolve ENTITY ─────────────────────────────
    if (explicitTargetEntityId) {
      const ent = this.#em.getEntityInstance(explicitTargetEntityId);
      if (ent) return {success: true, target: ent, targetType: 'entity', messages};
    }

    // ─────────────────────────── failure ────────────────────────────────────
    const failureText = usableComponentData.failure_message_target_required
            ?? TARGET_MESSAGES.USE_REQUIRES_TARGET(itemName);
    const failureType = 'warning';

    this.#logger.warn(`ItemTargetResolverService: No valid target found for item '${itemName}'. Dispatching failure message.`);

    // --- Refactored Dispatch Logic ---
    // Line: 54 (approx)
    await this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', {
      text: failureText,
      type: failureType
    });
    // --- End Refactored Dispatch Logic ---

    return {success: false, target: null, targetType: 'none', messages};
  }
}