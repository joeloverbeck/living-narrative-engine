/**
 * KnowledgeManager - Updates actor knowledge based on visibility
 *
 * Integration: Called from turn system state transitions (AwaitingActorDecisionState)
 * Dependencies: ComponentMutationService, IEntityManager, ILogger, IEventBus
 *
 * Knowledge System:
 * - Visibility: Current perception (location + visible flag)
 * - Knowledge: Accumulated information (persists across turns)
 * - Relationship: Visibility → Knowledge (one-way, additive)
 *
 * @file src/goap/services/knowledgeManager.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ACTOR_KNOWLEDGE_UPDATED_ID } from '../../constants/systemEventIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../constants/systemEventIds.js';

class KnowledgeManager {
  #componentMutationService;
  #entityManager;
  #logger;
  #eventBus;

  /**
   * Creates a new KnowledgeManager instance.
   *
   * @param {object} deps - Dependencies
   * @param {object} deps.componentMutationService - Component mutation service
   * @param {object} deps.entityManager - Entity manager
   * @param {object} deps.logger - Logger instance
   * @param {object} deps.eventBus - Event bus instance
   */
  constructor({ componentMutationService, entityManager, logger, eventBus }) {
    validateDependency(
      componentMutationService,
      'ComponentMutationService',
      logger,
      {
        requiredMethods: ['addComponent'],
      }
    );
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntityInstance'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(eventBus, 'IEventBus', logger, {
      requiredMethods: ['dispatch'],
    });

    this.#componentMutationService = componentMutationService;
    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#eventBus = eventBus;
  }

  /**
   * Update actor's knowledge based on currently visible entities.
   *
   * Visibility Rules:
   * - Same location as actor
   * - core:visible component missing or isVisible = true
   *
   * Knowledge Rules:
   * - Additive only (never removes entities)
   * - Self-knowledge always present
   * - Persists across turns
   *
   * @param {string} actorId - Actor entity ID
   * @param {object} context - Turn context (currently unused, reserved for future)
   */
  async updateKnowledge(actorId, context) {
    try {
      // 1. Find visible entities (same location + visible flag)
      const visibleEntities = this.#findVisibleEntities(actorId, context);

      // 2. Get current knowledge component (or create default)
      const actor = this.#entityManager.getEntityInstance(actorId);
      if (!actor) {
        this.#logger.warn(`Actor not found: ${actorId}`);
        return;
      }

      const currentKnowledge = actor.components['core:known_to'] || {
        entities: [actorId], // Actor always knows self
      };

      // 3. Add newly visible entities (maintain knowledge persistence)
      let knowledgeUpdated = false;
      const newEntities = [];

      for (const entityId of visibleEntities) {
        if (!currentKnowledge.entities.includes(entityId)) {
          currentKnowledge.entities.push(entityId);
          newEntities.push(entityId);
          knowledgeUpdated = true;
        }
      }

      // 4. Update component using ComponentMutationService
      if (knowledgeUpdated) {
        await this.#componentMutationService.addComponent(
          actorId,
          'core:known_to',
          currentKnowledge
        );

        this.#logger.debug('Knowledge updated', {
          actorId,
          newEntities,
          totalKnown: currentKnowledge.entities.length,
        });

        // Dispatch event for knowledge update
        this.#eventBus.dispatch(ACTOR_KNOWLEDGE_UPDATED_ID, {
          actorId,
          newEntitiesCount: newEntities.length,
          totalKnownCount: currentKnowledge.entities.length,
        });
      }
    } catch (err) {
      this.#logger.error('Failed to update knowledge', {
        actorId,
        error: err.message,
      });
      this.#eventBus.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        error: err.message,
        context: 'KnowledgeManager.updateKnowledge',
        actorId,
      });
    }
  }

  /**
   * Find entities visible to actor.
   *
   * Visibility Criteria:
   * - Entity is in same location as actor
   * - Entity has core:visible component missing OR isVisible = true
   *
   * @private
   * @param {string} actorId - Actor entity ID
   * @param {object} _context - Turn context (currently unused, reserved for future)
   * @returns {string[]} Array of visible entity IDs
   */
  #findVisibleEntities(actorId, _context) {
    const actor = this.#entityManager.getEntityInstance(actorId);
    if (!actor) {
      return [];
    }

    const actorLocation = actor.components['core:position']?.locationId;

    if (!actorLocation) {
      return []; // Actor has no location
    }

    const visibleIds = [];

    // Iterate all entities in same location
    for (const entity of this.#entityManager.entities) {
      if (entity.id === actorId) continue; // Skip self

      const entityLocation = entity.components['core:position']?.locationId;

      if (entityLocation === actorLocation) {
        // Check visibility override (defaults to true if component missing)
        const visibilityOverride = entity.components['core:visible'];
        const isVisible = visibilityOverride?.isVisible ?? true;

        if (isVisible) {
          visibleIds.push(entity.id);
        }
      }
    }

    return visibleIds;
  }
}

export default KnowledgeManager;
