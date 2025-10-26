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

    // Collect dedicated metadata (ACTDESC-007)
    try {
      const entity = this.#entityManager.getEntityInstance(entityId);
      const dedicatedActivities = this.#collectDedicatedMetadata(entity);
      activities.push(...dedicatedActivities);
    } catch (error) {
      this.#logger.error(
        `Failed to collect dedicated metadata for entity ${entityId}`,
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

  /**
   * Collect dedicated metadata component.
   *
   * @param {object} entity - Entity instance
   * @returns {Array<object>} Dedicated metadata activities (single item or empty)
   * @private
   */

  #collectDedicatedMetadata(entity) {
    const activities = [];

    // Check if entity has dedicated metadata component type
    // Note: Entity can only have ONE instance of each component type
    if (!entity.hasComponent('activity:description_metadata')) {
      return activities;
    }

    // Get the single metadata component
    const metadata = entity.getComponentData('activity:description_metadata');

    if (!metadata) {
      return activities;
    }

    try {
      const activity = this.#parseDedicatedMetadata(metadata, entity);
      if (activity) {
        activities.push(activity);
      }
    } catch (error) {
      this.#logger.error(`Failed to parse dedicated metadata`, error);
    }

    return activities;
  }

  /**
   * Parse dedicated metadata component into activity object.
   *
   * @param {object} metadata - Metadata component data
   * @param {object} entity - Entity instance
   * @returns {object|null} Activity object or null if invalid
   * @private
   */

  #parseDedicatedMetadata(metadata, entity) {
    const { sourceComponent, descriptionType, targetRole, priority = 50 } = metadata;

    if (!sourceComponent) {
      this.#logger.warn('Dedicated metadata missing sourceComponent');
      return null;
    }

    // Get source component data
    const sourceData = entity.getComponentData(sourceComponent);
    if (!sourceData) {
      this.#logger.warn(`Source component not found: ${sourceComponent}`);
      return null;
    }

    // Resolve target entity ID
    const targetEntityId = sourceData[targetRole || 'entityId'];

    return {
      type: 'dedicated',
      sourceComponent,
      descriptionType,
      metadata,
      sourceData,
      targetEntityId,
      priority,
      verb: metadata.verb,
      template: metadata.template,
      adverb: metadata.adverb,
      conditions: metadata.conditions,
      grouping: metadata.grouping,
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
    // ACTDESC-008 (Phase 2 - Enhanced)
    const config =
      this.#anatomyFormattingService.getActivityIntegrationConfig?.() ?? {};

    if (activities.length === 0) {
      return '';
    }

    // Get actor name
    const actorId = entity?.id;
    const actorName = this.#resolveEntityName(actorId);

    // ENHANCEMENT: Generate descriptions for ALL activities (not just first)
    const descriptions = activities.map(activity =>
      this.#generateActivityPhrase(actorName, activity)
    ).filter(phrase => phrase && phrase.trim());

    if (descriptions.length === 0) {
      return '';
    }

    // Format with configuration
    const prefix = config.prefix ?? '';
    const suffix = config.suffix ?? '';
    const separator = config.separator ?? '. ';

    const activityText = descriptions.join(separator);
    return `${prefix}${activityText}${suffix}`.trim();
  }

  /**
   * Generate a single activity phrase.
   *
   * @param {string} actorName - Name of entity performing activity
   * @param {object} activity - Activity object
   * @returns {string} Activity phrase
   * @private
   */

  #generateActivityPhrase(actorName, activity) {
    const targetEntityId = activity.targetEntityId || activity.targetId;
    const targetName = targetEntityId
      ? this.#resolveEntityName(targetEntityId)
      : '';

    if (activity.type === 'inline') {
      // Use template replacement
      if (activity.template) {
        return activity.template
          .replace(/\{actor\}/g, actorName)
          .replace(/\{target\}/g, targetName);
      }
      // Fallback to description field for backward compatibility
      if (activity.description) {
        return targetName
          ? `${actorName} ${activity.description} ${targetName}`.trim()
          : `${actorName} ${activity.description}`.trim();
      }
    } else if (activity.type === 'dedicated') {
      // Dedicated metadata: construct from verb/adverb
      const verb = activity.verb || 'interacting with';
      const adverb = activity.adverb ? ` ${activity.adverb}` : '';

      if (targetName) {
        return `${actorName} is ${verb} ${targetName}${adverb}`;
      } else {
        return `${actorName} is ${verb}${adverb}`;
      }
    }

    // Fallback for legacy activities without type
    if (activity.description) {
      return targetName
        ? `${actorName} ${activity.description} ${targetName}`.trim()
        : `${actorName} ${activity.description}`.trim();
    }

    if (activity.verb) {
      return targetName
        ? `${actorName} ${activity.verb} ${targetName}`
        : `${actorName} ${activity.verb}`;
    }

    return '';
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
