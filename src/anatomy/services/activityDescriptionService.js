/**
 * @file Service for generating activity descriptions based on component metadata.
 * Follows the Equipment service pattern from BODCLODES.
 * Integrates into BodyDescriptionComposer as an optional extension point.
 * @see src/clothing/services/equipmentDescriptionService.js
 * @see reports/BODCLODES-body-description-composition-architecture.md
 * @see brainstorming/ACTDESC-activity-description-composition-design.md
 */

import {
  validateDependency,
  ensureValidLogger,
  assertNonBlankString,
} from '../../utils/index.js';

class ActivityDescriptionService {
  #logger;
   
  #entityManager;
   
  #anatomyFormattingService;
   
  #entityNameCache = new Map();
   
  #activityIndex = null; // Phase 3: ACTDESC-020

  /**
   * Creates an ActivityDescriptionService instance.
   *
   * @param {object} dependencies - Service dependencies
   * @param {object} dependencies.logger - Logger service
   * @param {object} dependencies.entityManager - Entity manager for component access
   * @param {object} dependencies.anatomyFormattingService - Configuration service
   * @param {object} [dependencies.activityIndex] - Optional index for performance (Phase 3)
   */
  constructor({
    logger,
    entityManager,
    anatomyFormattingService,
    activityIndex = null,
  }) {
    this.#logger = ensureValidLogger(logger, 'ActivityDescriptionService');

    validateDependency(entityManager, 'IEntityManager', this.#logger, {
      requiredMethods: ['getEntityInstance'],
    });
    validateDependency(
      anatomyFormattingService,
      'AnatomyFormattingService',
      this.#logger
    );

    this.#entityManager = entityManager;
    this.#anatomyFormattingService = anatomyFormattingService;
    this.#activityIndex = activityIndex;
  }

  /**
   * Generate activity description for an entity.
   *
   * @param {string} entityId - Entity ID to generate activity description for
   * @returns {Promise<string>} Formatted activity description (empty string if no activities)
   * @example
   * const description = await service.generateActivityDescription('character_1');
   * // Returns: "Activity: Jon Ureña is kneeling before Alicia Western."
   */
  async generateActivityDescription(entityId) {
    assertNonBlankString(
      entityId,
      'entityId',
      'ActivityDescriptionService.generateActivityDescription',
      this.#logger
    );

    try {
      this.#logger.debug(`Generating activity description for entity: ${entityId}`);

      const entity = this.#entityManager.getEntityInstance(entityId);

      const activities = this.#collectActivityMetadata(entityId);

      if (activities.length === 0) {
        this.#logger.debug(`No activities found for entity: ${entityId}`);
        return '';
      }

      const conditionedActivities = this.#filterByConditions(activities, entity);

      if (conditionedActivities.length === 0) {
        this.#logger.debug(
          `No visible activities available after filtering for entity: ${entityId}`
        );
        return '';
      }

      const prioritizedActivities = this.#sortByPriority(conditionedActivities);
      const description = this.#formatActivityDescription(
        prioritizedActivities,
        entity
      );

      if (!description) {
        this.#logger.debug(
          `No formatted activity description produced for entity: ${entityId}`
        );
        return '';
      }

      return description;

    } catch (error) {
      this.#logger.error(
        `Failed to generate activity description for entity ${entityId}`,
        error
      );
      return ''; // Fail gracefully
    }
  }

  // Stub methods - to be implemented in subsequent tickets
   
  #collectActivityMetadata(entityId) {
    // ACTDESC-006, ACTDESC-007
    const activities = [];

    // Collect from activity index (Phase 3)
    if (
      this.#activityIndex &&
      typeof this.#activityIndex.findActivitiesForEntity === 'function'
    ) {
      try {
        const indexedActivities =
          this.#activityIndex.findActivitiesForEntity(entityId);

        if (!Array.isArray(indexedActivities)) {
          this.#logger.warn(
            `Activity index returned invalid data for entity ${entityId}`
          );
        } else {
          activities.push(...indexedActivities.filter(Boolean));
        }
      } catch (error) {
        this.#logger.error(
          `Failed to collect activity metadata for entity ${entityId}`,
          error
        );
      }
    }

    // Collect inline metadata (ACTDESC-006)
    try {
      const entity = this.#entityManager.getEntityInstance(entityId);
      const inlineActivities = this.#collectInlineMetadata(entity);
      activities.push(...inlineActivities);
    } catch (error) {
      this.#logger.error(
        `Failed to collect inline metadata for entity ${entityId}`,
        error
      );
    }

    return activities;
  }

  /**
   * Collect inline metadata from components.
   *
   * @param {object} entity - Entity instance
   * @returns {Array<object>} Inline metadata activities
   * @private
   */
   
  #collectInlineMetadata(entity) {
    const activities = [];
    const componentIds = entity.componentTypeIds ?? [];

    for (const componentId of componentIds) {
      // Skip dedicated metadata components (already processed)
      if (componentId === 'activity:description_metadata') {
        continue;
      }

      const componentData = entity.getComponentData(componentId);
      const activityMetadata = componentData?.activityMetadata;

      if (activityMetadata?.shouldDescribeInActivity) {
        try {
          const activity = this.#parseInlineMetadata(
            componentId,
            componentData,
            activityMetadata
          );
          if (activity) {
            activities.push(activity);
          }
        } catch (error) {
          this.#logger.error(
            `Failed to parse inline metadata for ${componentId}`,
            error
          );
        }
      }
    }

    return activities;
  }

  /**
   * Parse inline metadata into activity object.
   *
   * @param {string} componentId - Component ID
   * @param {object} componentData - Full component data
   * @param {object} activityMetadata - Activity metadata from component
   * @returns {object|null} Activity object or null if invalid
   * @private
   */
   
  #parseInlineMetadata(componentId, componentData, activityMetadata) {
    const { template, targetRole = 'entityId', priority = 50 } = activityMetadata;

    if (!template) {
      this.#logger.warn(`Inline metadata missing template for ${componentId}`);
      return null;
    }

    // Resolve target entity ID
    const targetEntityId = componentData[targetRole];

    // For Phase 1 compatibility with existing formatter, provide a basic description
    // Phase 2 (ACTDESC-008) will handle proper template interpolation
    const basicDescription = template
      .replace(/\{actor\}/g, '')
      .replace(/\{target\}/g, '')
      .trim();

    return {
      type: 'inline',
      sourceComponent: componentId,
      sourceData: componentData,
      targetEntityId,
      targetId: targetEntityId, // Alias for compatibility with formatter
      priority,
      template,
      description: basicDescription, // Temporary for Phase 1 formatter
    };
  }

   
  #filterByConditions(activities, _entity) {
    // ACTDESC-018 (Phase 3)
    return activities.filter((activity) => {
      if (!activity || activity.visible === false) {
        return false;
      }

      if (typeof activity.condition === 'function') {
        try {
          return activity.condition(_entity);
        } catch (error) {
          this.#logger.warn(
            'Condition evaluation failed for activity description entry',
            error
          );
          return false;
        }
      }

      return true;
    });
  }

   
  #sortByPriority(activities) {
    // ACTDESC-016 (Phase 2)
    return [...activities].sort(
      (a, b) => (b?.priority ?? 0) - (a?.priority ?? 0)
    );
  }

   
  #formatActivityDescription(activities, entity) {
    // ACTDESC-008 (Phase 1)
    const config =
      this.#anatomyFormattingService.getActivityIntegrationConfig?.() ?? {};

    const primary = activities[0];
    const descriptionText =
      typeof primary?.description === 'string'
        ? primary.description.trim()
        : '';

    if (!descriptionText && !primary?.verb && !primary?.targetId) {
      return '';
    }

    const actorId = primary?.actorId ?? entity?.id;
    const actorName = this.#resolveEntityName(actorId);

    let formatted = descriptionText
      ? `${actorName} ${descriptionText}`
      : `${actorName} ${primary?.verb ?? ''}`.trim();

    if (primary?.targetId) {
      const targetName = this.#resolveEntityName(primary.targetId);
      formatted = descriptionText
        ? `${actorName} ${descriptionText} ${targetName}`.trim()
        : `${actorName} ${primary?.verb ?? 'interacts with'} ${targetName}`;
    }

    const prefix = config.prefix ?? '';
    const suffix = config.suffix ?? '';

    return `${prefix}${formatted}${suffix}`.trim();
  }

   
  #resolveEntityName(entityId) {
    // ACTDESC-009
    if (!entityId) {
      return 'Unknown entity';
    }

    if (this.#entityNameCache.has(entityId)) {
      return this.#entityNameCache.get(entityId);
    }

    try {
      const entity = this.#entityManager.getEntityInstance(entityId);
      const resolvedName =
        entity?.displayName ?? entity?.name ?? entity?.id ?? entityId;

      this.#entityNameCache.set(entityId, resolvedName);
      return resolvedName;
    } catch (error) {
      this.#logger.warn(
        `Failed to resolve entity name for ${entityId}`,
        error
      );
      return entityId;
    }
  }
}

export default ActivityDescriptionService;
