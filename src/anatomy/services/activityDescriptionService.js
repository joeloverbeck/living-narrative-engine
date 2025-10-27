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

const DEFAULT_ACTIVITY_FORMATTING_CONFIG = Object.freeze({
  enabled: true,
  prefix: 'Activity: ',
  suffix: '.',
  separator: '. ',
  maxActivities: 10,
  enableContextAwareness: true,
  nameResolution: Object.freeze({
    usePronounsWhenAvailable: false,
  }),
});

/**
 * @typedef {object} ActivityGroup
 * @description Represents a grouped collection of related activities.
 * @property {object} primaryActivity - The leading activity for the group.
 * @property {Array<ActivityGroupRelatedActivity>} relatedActivities - Additional grouped activities with their conjunctions.
 */

/**
 * @typedef {object} ActivityGroupRelatedActivity
 * @description Describes a related activity and how it should be connected to the primary activity.
 * @property {object} activity - The related activity metadata.
 * @property {string} conjunction - Conjunction used to join with the primary activity.
 */

/**
 * @typedef {object} ActivityPhraseComponents
 * @description Represents the decomposed pieces of a generated activity phrase.
 * @property {string} fullPhrase - The full phrase including the actor reference.
 * @property {string} verbPhrase - The phrase without the actor/copula for conjunction usage.
 */

/**
 * @typedef {object} ActivityIndex
 * @description Structured activity index partitions.
 * @property {Map<string, Array<object>>} byTarget - Activities grouped by target entity ID.
 * @property {Array<object>} byPriority - Activities sorted by priority (descending).
 * @property {Map<string, Array<object>>} byGroupKey - Activities grouped by shared group key metadata.
 * @property {Array<object>} all - Original activities collection reference.
 */

/**
 * @typedef {object} TimedCacheEntry
 * @description Cache entry with value payload and expiration metadata.
 * @property {unknown} value - Stored cache value.
 * @property {number} expiresAt - Timestamp when entry becomes stale.
 */

/**
 * @typedef {object} ActivityIndexCacheValue
 * @description Stored payload for indexed activity cache entries.
 * @property {string} signature - Deterministic signature describing the activities collection.
 * @property {ActivityIndex} index - Cached activity index payload.
 */

/**
 * @typedef {object} ActivityDescriptionTestHooks
 * @description White-box helper functions exposed for unit testing.
 * @property {(currentAdverb: string, injected: string) => string} mergeAdverb - Merge adverbs without duplicating descriptors.
 * @property {(template: string, descriptor: string) => string} injectSoftener - Inject descriptors into activity templates.
 * @property {(phrase: string) => string} sanitizeVerbPhrase - Remove redundant copulas from phrases.
 * @property {(conjunction: string, components: ActivityPhraseComponents, context: object) => string} buildRelatedActivityFragment - Build related activity fragments.
 * @property {(activities: Array<object>) => ActivityIndex} buildActivityIndex - Build an activity index for the supplied activities.
 * @property {() => void} cleanupCaches - Trigger cache cleanup routine.
 * @property {(key: string, value: unknown) => void} setEntityNameCacheEntry - Prime the entity name cache.
 * @property {(key: string, value: unknown) => void} setGenderCacheEntry - Prime the gender cache.
 * @property {(key: string, value: ActivityIndexCacheValue) => void} setActivityIndexCacheEntry - Prime the activity index cache.
 * @property {() => { entityName: Map<string, TimedCacheEntry>; gender: Map<string, TimedCacheEntry>; activityIndex: Map<string, TimedCacheEntry>; }} getCacheSnapshot - Retrieve shallow cache snapshots.
 */

class ActivityDescriptionService {
  #logger;

  #entityManager;

  #anatomyFormattingService;

  #jsonLogicEvaluationService;

  #entityNameCache = new Map();

  #genderCache = new Map();

  #activityIndexCache = new Map();

  #closenessCache = new Map();

  #eventBus = null;

  #activityIndex = null; // Phase 3: ACTDESC-020

  #cacheConfig = {
    maxSize: 1000,
    ttl: 60000,
    enableMetrics: false,
  };

  #cleanupInterval = null;

  #simultaneousPriorityThreshold = 10;

  /**
   * Creates an ActivityDescriptionService instance.
   *
   * @param {object} dependencies - Service dependencies
   * @param {object} dependencies.logger - Logger service
   * @param {object} dependencies.entityManager - Entity manager for component access
   * @param {object} dependencies.anatomyFormattingService - Configuration service
   * @param {object} dependencies.jsonLogicEvaluationService - JSON Logic evaluation service
   * @param {object} [dependencies.activityIndex] - Optional index for performance (Phase 3)
   * @param {object} [dependencies.eventBus] - Optional event bus for error telemetry
   */
  constructor({
    logger,
    entityManager,
    anatomyFormattingService,
    jsonLogicEvaluationService,
    activityIndex = null,
    eventBus = null,
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

    validateDependency(
      jsonLogicEvaluationService,
      'JsonLogicEvaluationService',
      this.#logger,
      { requiredMethods: ['evaluate'] }
    );

    this.#entityManager = entityManager;
    this.#anatomyFormattingService = anatomyFormattingService;
    this.#jsonLogicEvaluationService = jsonLogicEvaluationService;
    this.#activityIndex = activityIndex;
    if (eventBus !== null && eventBus !== undefined) {
      validateDependency(eventBus, 'EventBus', this.#logger, {
        requiredMethods: ['dispatch'],
      });
      this.#eventBus = eventBus;
    }

    this.#setupCacheCleanup();
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

    this.#closenessCache.clear();

    try {
      this.#logger.debug(
        `Generating activity description for entity: ${entityId}`
      );

      let entity;
      try {
        entity = this.#entityManager.getEntityInstance(entityId);
      } catch (lookupError) {
        this.#logger.warn(
          `Failed to retrieve entity instance for ${entityId}`,
          lookupError
        );
        this.#dispatchError('ENTITY_LOOKUP_FAILED', {
          entityId,
          reason: lookupError?.message ?? 'Entity lookup threw an error',
        });
        return '';
      }

      if (!entity) {
        this.#logger.warn(
          `No entity found for activity description: ${entityId}`
        );
        this.#dispatchError('ENTITY_NOT_FOUND', {
          entityId,
          reason: 'Entity manager returned no instance',
        });
        return '';
      }

      const activities = this.#collectActivityMetadata(entityId, entity);

      if (activities.length === 0) {
        this.#logger.debug(`No activities found for entity: ${entityId}`);
        return '';
      }

      const conditionedActivities = this.#filterByConditions(
        activities,
        entity
      );

      if (conditionedActivities.length === 0) {
        this.#logger.debug(
          `No visible activities available after filtering for entity: ${entityId}`
        );
        return this.#formatActivityDescription([], entity);
      }

      const prioritizedActivities = this.#sortByPriority(
        conditionedActivities,
        this.#buildActivityIndexCacheKey('priority', entity?.id ?? entityId)
      );
      const description = this.#formatActivityDescription(
        prioritizedActivities,
        entity,
        this.#buildActivityIndexCacheKey('group', entity?.id ?? entityId)
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
      this.#dispatchError('ACTIVITY_DESCRIPTION_ERROR', {
        entityId,
        reason: error?.message ?? 'Unknown error',
      });
      return ''; // Fail gracefully
    }
  }

  // Stub methods - to be implemented in subsequent tickets

  #collectActivityMetadata(entityId, entity = null) {
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
    let resolvedEntity = entity;
    if (!resolvedEntity) {
      try {
        resolvedEntity = this.#entityManager.getEntityInstance(entityId);
      } catch (error) {
        this.#logger.warn(
          `Failed to resolve entity for metadata collection: ${entityId}`,
          error
        );
      }
    }

    if (resolvedEntity) {
      try {
        const inlineActivities = this.#collectInlineMetadata(resolvedEntity);
        activities.push(...inlineActivities);
      } catch (error) {
        this.#logger.error(
          `Failed to collect inline metadata for entity ${entityId}`,
          error
        );
      }
    } else {
      this.#logger.warn(
        `No entity available for inline metadata collection: ${entityId}`
      );
    }

    // Collect dedicated metadata (ACTDESC-007)
    if (resolvedEntity) {
      try {
        const dedicatedActivities =
          this.#collectDedicatedMetadata(resolvedEntity);
        activities.push(...dedicatedActivities);
      } catch (error) {
        this.#logger.error(
          `Failed to collect dedicated metadata for entity ${entityId}`,
          error
        );
      }
    } else {
      this.#logger.warn(
        `No entity available for dedicated metadata collection: ${entityId}`
      );
    }

    return activities.filter(Boolean);
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
    if (!entity || typeof entity !== 'object') {
      this.#logger.warn(
        'Cannot collect inline metadata without a valid entity'
      );
      return activities;
    }

    const componentIds = Array.isArray(entity.componentTypeIds)
      ? entity.componentTypeIds
      : [];

    for (const componentId of componentIds) {
      // Skip dedicated metadata components (already processed)
      if (componentId === 'activity:description_metadata') {
        continue;
      }

      if (typeof entity.getComponentData !== 'function') {
        this.#logger.warn(
          `Entity ${entity?.id ?? 'unknown'} is missing getComponentData; skipping ${componentId}`
        );
        continue;
      }

      let componentData;
      try {
        componentData = entity.getComponentData(componentId);
      } catch (error) {
        this.#logger.error(
          `Failed to retrieve component data for ${componentId}`,
          error
        );
        continue;
      }

      if (!componentData || typeof componentData !== 'object') {
        this.#logger.warn(
          `Component ${componentId} returned invalid data; skipping inline metadata`
        );
        continue;
      }

      const activityMetadata = componentData?.activityMetadata;

      if (activityMetadata && typeof activityMetadata !== 'object') {
        this.#logger.warn(
          `Activity metadata for ${componentId} is malformed; skipping`
        );
        continue;
      }

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
    const {
      template,
      targetRole = 'entityId',
      priority = 50,
    } = activityMetadata;

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
      activityMetadata,
      conditions: activityMetadata?.conditions ?? null,
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

    if (!entity || typeof entity !== 'object') {
      this.#logger.warn(
        'Cannot collect dedicated metadata without a valid entity'
      );
      return activities;
    }

    if (typeof entity.hasComponent !== 'function') {
      this.#logger.warn(
        `Entity ${entity?.id ?? 'unknown'} is missing hasComponent; skipping dedicated metadata`
      );
      return activities;
    }

    let hasMetadataComponent = false;
    try {
      hasMetadataComponent = entity.hasComponent(
        'activity:description_metadata'
      );
    } catch (error) {
      this.#logger.warn(
        `Failed to verify dedicated metadata component for ${entity?.id ?? 'unknown'}`,
        error
      );
      return activities;
    }

    // Check if entity has dedicated metadata component type
    // Note: Entity can only have ONE instance of each component type
    if (!hasMetadataComponent) {
      return activities;
    }

    // Get the single metadata component
    if (typeof entity.getComponentData !== 'function') {
      this.#logger.warn(
        `Entity ${entity?.id ?? 'unknown'} is missing getComponentData; skipping dedicated metadata`
      );
      return activities;
    }

    let metadata;
    try {
      metadata = entity.getComponentData('activity:description_metadata');
    } catch (error) {
      this.#logger.warn(
        `Failed to read dedicated metadata for ${entity?.id ?? 'unknown'}`,
        error
      );
      return activities;
    }

    if (!metadata || typeof metadata !== 'object') {
      this.#logger.warn(
        `Dedicated metadata for ${entity?.id ?? 'unknown'} is invalid; skipping`
      );
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
    if (!metadata || typeof metadata !== 'object') {
      this.#logger.warn('Dedicated metadata payload is invalid; skipping');
      return null;
    }

    if (!entity || typeof entity.getComponentData !== 'function') {
      this.#logger.warn(
        `Cannot parse dedicated metadata without component access for ${entity?.id ?? 'unknown'}`
      );
      return null;
    }

    const {
      sourceComponent,
      descriptionType,
      targetRole,
      priority = 50,
    } = metadata;

    if (!sourceComponent) {
      this.#logger.warn('Dedicated metadata missing sourceComponent');
      return null;
    }

    // Get source component data
    let sourceData;
    try {
      sourceData = entity.getComponentData(sourceComponent);
    } catch (error) {
      this.#logger.warn(
        `Failed to retrieve source component ${sourceComponent} for dedicated metadata`,
        error
      );
      return null;
    }
    if (!sourceData) {
      this.#logger.warn(`Source component not found: ${sourceComponent}`);
      return null;
    }

    // Resolve target entity ID
    const roleKey = targetRole || 'entityId';
    let targetEntityId = null;

    try {
      targetEntityId = sourceData?.[roleKey] ?? null;
    } catch (error) {
      this.#logger.warn(
        `Failed to resolve target entity for dedicated metadata ${sourceComponent}`,
        error
      );
      targetEntityId = null;
    }

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

  /**
   * Filter activities based on visibility-oriented condition metadata.
   *
   * @param {Array<object>} activities - Raw activity entries from collectors.
   * @param {object} entity - Entity instance requesting the description.
   * @returns {Array<object>} Activities that should remain visible.
   * @private
   */
  #filterByConditions(activities, entity) {
    if (!Array.isArray(activities) || activities.length === 0) {
      return [];
    }

    return activities.filter((activity) => {
      try {
        return this.#evaluateActivityVisibility(activity, entity);
      } catch (error) {
        this.#logger.warn(
          'Failed to evaluate activity visibility for activity metadata',
          error
        );
        return false;
      }
    });
  }

  /**
   * Determine whether a single activity should remain visible.
   *
   * @param {object} activity - Activity record produced by the collectors.
   * @param {object} entity - Entity instance requesting the description.
   * @returns {boolean} True when the activity should remain visible.
   * @private
   */
  #evaluateActivityVisibility(activity, entity) {
    if (!activity || activity.visible === false) {
      return false;
    }

    if (typeof activity.condition === 'function') {
      try {
        return activity.condition(entity);
      } catch (error) {
        this.#logger.warn(
          'Condition evaluation failed for activity description entry',
          error
        );
        return false;
      }
    }

    const metadata = activity.metadata ?? activity.activityMetadata ?? {};
    const conditions = activity.conditions ?? metadata.conditions;

    if (!conditions || this.#isEmptyConditionsObject(conditions)) {
      return metadata.shouldDescribeInActivity !== false;
    }

    if (metadata.shouldDescribeInActivity === false) {
      return false;
    }

    if (
      conditions.showOnlyIfProperty &&
      !this.#matchesPropertyCondition(activity, conditions.showOnlyIfProperty)
    ) {
      return false;
    }

    if (
      Array.isArray(conditions.requiredComponents) &&
      conditions.requiredComponents.length > 0 &&
      !this.#hasRequiredComponents(entity, conditions.requiredComponents)
    ) {
      return false;
    }

    if (
      Array.isArray(conditions.forbiddenComponents) &&
      conditions.forbiddenComponents.length > 0 &&
      this.#hasForbiddenComponents(entity, conditions.forbiddenComponents)
    ) {
      return false;
    }

    if (conditions.customLogic) {
      const context = this.#buildLogicContext(activity, entity);

      try {
        const result = this.#jsonLogicEvaluationService.evaluate(
          conditions.customLogic,
          context
        );

        if (!result) {
          return false;
        }
      } catch (error) {
        this.#logger.warn('Failed to evaluate custom logic', error);
        return true; // Fail open on JSON logic errors
      }
    }

    return true;
  }

  /**
   * Construct the data payload used for JSON Logic evaluation.
   *
   * @param {object} activity - Activity record.
   * @param {object} entity - Entity instance requesting the description.
   * @returns {object} Data for JSON Logic rules.
   * @private
   */
  #buildLogicContext(activity, entity) {
    let targetEntity = null;

    if (activity?.targetEntityId) {
      try {
        targetEntity = this.#entityManager.getEntityInstance(
          activity.targetEntityId
        );
      } catch (error) {
        this.#logger.warn(
          `Failed to resolve target entity '${activity.targetEntityId}' for activity conditions`,
          error
        );
      }
    }

    return {
      entity: this.#extractEntityData(entity),
      activity: activity?.sourceData ?? {},
      target: targetEntity ? this.#extractEntityData(targetEntity) : null,
    };
  }

  /**
   * Extract relevant component information for JSON Logic.
   *
   * @param {object|null} entity - Entity instance.
   * @returns {object|null} Simplified entity representation.
   * @private
   */
  #extractEntityData(entity) {
    if (!entity) {
      return null;
    }

    const componentIds = entity.componentTypeIds ?? [];
    const components = {};

    if (Array.isArray(componentIds)) {
      for (const componentId of componentIds) {
        if (typeof entity.getComponentData === 'function') {
          components[componentId] = entity.getComponentData(componentId);
        }
      }
    }

    return {
      id: entity.id,
      components,
    };
  }

  /**
   * Determine if the provided conditions object has no actionable rules.
   *
   * @param {object} conditions - Condition configuration from metadata.
   * @returns {boolean} True when the object contains no keys.
   * @private
   */
  #isEmptyConditionsObject(conditions) {
    if (!conditions) {
      return true;
    }

    return Object.keys(conditions).length === 0;
  }

  /**
   * Verify a `showOnlyIfProperty` rule against the activity source data.
   *
   * @param {object} activity - Activity record.
   * @param {object} rule - Rule with `property` and `equals` keys.
   * @returns {boolean} True when the activity satisfies the rule.
   * @private
   */
  #matchesPropertyCondition(activity, rule) {
    if (!rule || !rule.property) {
      return true;
    }

    const sourceData = activity?.sourceData ?? {};
    return sourceData[rule.property] === rule.equals;
  }

  /**
   * Verify that the entity has all components listed in `requiredComponents`.
   *
   * @param {object} entity - Entity instance.
   * @param {Array<string>} required - Component identifiers.
   * @returns {boolean} True when every component exists.
   * @private
   */
  #hasRequiredComponents(entity, required) {
    if (!entity || typeof entity.hasComponent !== 'function') {
      return false;
    }

    try {
      return required.every((componentId) => {
        try {
          return entity.hasComponent(componentId);
        } catch (error) {
          this.#logger.warn(
            `Failed to verify required component ${componentId} for ${entity?.id ?? 'unknown'}`,
            error
          );
          return false;
        }
      });
    } catch (error) {
      this.#logger.warn(
        `Failed to evaluate required components for ${entity?.id ?? 'unknown'}`,
        error
      );
      return false;
    }
  }

  /**
   * Verify that the entity contains any forbidden components.
   *
   * @param {object} entity - Entity instance.
   * @param {Array<string>} forbidden - Component identifiers.
   * @returns {boolean} True when a forbidden component is present.
   * @private
   */
  #hasForbiddenComponents(entity, forbidden) {
    if (!entity || typeof entity.hasComponent !== 'function') {
      return false;
    }

    try {
      return forbidden.some((componentId) => {
        try {
          return entity.hasComponent(componentId);
        } catch (error) {
          this.#logger.warn(
            `Failed to verify forbidden component ${componentId} for ${entity?.id ?? 'unknown'}`,
            error
          );
          return false;
        }
      });
    } catch (error) {
      this.#logger.warn(
        `Failed to evaluate forbidden components for ${entity?.id ?? 'unknown'}`,
        error
      );
      return false;
    }
  }

  #sortByPriority(activities, cacheKey = null) {
    // ACTDESC-016 (Phase 2)
    const index = this.#getActivityIndex(activities, cacheKey);
    return index.byPriority;
  }

  #formatActivityDescription(activities, entity, cacheKey = null) {
    // ACTDESC-008 (Phase 2 - Enhanced with Pronoun Resolution)
    // ACTDESC-014: Pronoun resolution implementation
    const config = this.#getActivityIntegrationConfig();

    if (!Array.isArray(activities) || activities.length === 0) {
      return '';
    }

    // Get actor name and gender for pronoun resolution
    const actorId = entity?.id ?? null;
    const actorName = this.#resolveEntityName(actorId);
    const actorGender = this.#detectEntityGender(actorId);
    const actorPronouns = this.#getPronounSet(actorGender);
    const pronounsEnabled =
      config.nameResolution?.usePronounsWhenAvailable === true;

    // Respect maxActivities limit
    const maxActivities = config.maxActivities ?? 10;
    const limitedActivities = activities.slice(0, maxActivities);

    const enableContextAwareness = config.enableContextAwareness !== false;

    const contextAwareActivities = enableContextAwareness
      ? limitedActivities.map((activity) => {
          try {
            const contextualised = this.#applyContextualTone(
              activity,
              this.#buildActivityContext(actorId, activity)
            );
            return contextualised ?? activity;
          } catch (error) {
            this.#logger.warn(
              'Failed to apply contextual tone to activity',
              error
            );
            return activity;
          }
        })
      : limitedActivities;

    let groupedActivities = [];
    try {
      const result = this.#groupActivities(contextAwareActivities, cacheKey);
      if (Array.isArray(result)) {
        groupedActivities = result;
      } else if (result && typeof result.forEach === 'function') {
        // Support legacy iterable responses
        result.forEach((group) => groupedActivities.push(group));
      } else if (result) {
        this.#logger.warn(
          'Grouping activities returned unexpected data; ignoring result'
        );
      }
    } catch (error) {
      this.#logger.error('Failed to group activities for formatting', error);
      this.#dispatchError('GROUP_ACTIVITIES_FAILED', {
        entityId: actorId ?? 'unknown',
        reason: error?.message ?? 'Grouping error',
      });
      groupedActivities = [];
    }

    const descriptions = [];

    groupedActivities.forEach((group, index) => {
      if (!group) {
        return;
      }

      const isFirstGroup = index === 0;
      const useActorPronounForPrimary = !isFirstGroup && pronounsEnabled;
      const actorReference = useActorPronounForPrimary
        ? actorPronouns.subject
        : actorName;

      let primaryPhraseResult;
      try {
        primaryPhraseResult = this.#generateActivityPhrase(
          actorReference,
          group.primaryActivity,
          useActorPronounForPrimary
        );
      } catch (error) {
        this.#logger.error('Failed to generate primary activity phrase', error);
        this.#dispatchError('PRIMARY_ACTIVITY_FORMATTING_FAILED', {
          entityId: actorId ?? 'unknown',
          sourceComponent: group?.primaryActivity?.sourceComponent ?? null,
          reason: error?.message ?? 'Primary phrase error',
        });
        return;
      }

      const primaryPhrase =
        typeof primaryPhraseResult === 'string'
          ? primaryPhraseResult
          : (primaryPhraseResult?.fullPhrase ?? '');

      if (!primaryPhrase || !primaryPhrase.trim()) {
        return;
      }

      let groupDescription = primaryPhrase.trim();

      const relatedActivities = Array.isArray(group.relatedActivities)
        ? group.relatedActivities
        : [];

      for (const related of relatedActivities) {
        if (!related) {
          continue;
        }

        let phraseComponents;
        try {
          phraseComponents = this.#generateActivityPhrase(
            actorReference,
            related.activity,
            pronounsEnabled,
            { omitActor: true }
          );
        } catch (error) {
          this.#logger.error(
            'Failed to generate related activity phrase',
            error
          );
          this.#dispatchError('RELATED_ACTIVITY_FORMATTING_FAILED', {
            entityId: actorId ?? 'unknown',
            sourceComponent: related?.activity?.sourceComponent ?? null,
            reason: error?.message ?? 'Related phrase error',
          });
          continue;
        }

        let fragment;
        try {
          fragment = this.#buildRelatedActivityFragment(
            related.conjunction,
            phraseComponents,
            {
              actorName,
              actorReference,
              actorPronouns,
              pronounsEnabled,
            }
          );
        } catch (error) {
          this.#logger.error(
            'Failed to build related activity fragment',
            error
          );
          this.#dispatchError('RELATED_ACTIVITY_FRAGMENT_FAILED', {
            entityId: actorId ?? 'unknown',
            sourceComponent: related?.activity?.sourceComponent ?? null,
            reason: error?.message ?? 'Fragment error',
          });
          fragment = '';
        }

        if (fragment) {
          groupDescription = `${groupDescription} ${fragment}`.trim();
        }
      }

      if (groupDescription) {
        descriptions.push(groupDescription);
      }
    });

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

  #getActivityIntegrationConfig() {
    const defaultConfig = {
      ...DEFAULT_ACTIVITY_FORMATTING_CONFIG,
      nameResolution: {
        ...DEFAULT_ACTIVITY_FORMATTING_CONFIG.nameResolution,
      },
    };

    const configGetter =
      this.#anatomyFormattingService?.getActivityIntegrationConfig;

    if (typeof configGetter !== 'function') {
      return defaultConfig;
    }

    try {
      const config = configGetter.call(this.#anatomyFormattingService);

      if (!config || typeof config !== 'object') {
        this.#logger.warn(
          'Activity integration config missing or invalid; using defaults'
        );
        return defaultConfig;
      }

      const mergedConfig = {
        ...defaultConfig,
        ...config,
        nameResolution: {
          ...defaultConfig.nameResolution,
          ...(config.nameResolution && typeof config.nameResolution === 'object'
            ? config.nameResolution
            : {}),
        },
      };

      return mergedConfig;
    } catch (error) {
      this.#logger.warn('Failed to get activity integration config', error);
      return defaultConfig;
    }
  }

  /**
   * Build the contextual payload for an activity.
   *
   * @description Build lightweight context for an activity based on available component data.
   * @param {string} actorId - Actor entity ID.
   * @param {object} activity - Activity metadata collected by the service.
   * @returns {object} Normalised context payload.
   * @private
   */
  #buildActivityContext(actorId, activity) {
    const targetId = activity?.targetEntityId ?? activity?.targetId ?? null;

    const context = {
      targetId,
      intensity: this.#determineActivityIntensity(activity?.priority),
      relationshipTone: 'neutral',
      targetGender: null,
    };

    if (!targetId || !actorId) {
      return context;
    }

    let cachedPartners = this.#closenessCache.get(actorId);

    if (!cachedPartners) {
      try {
        const actorEntity = this.#entityManager.getEntityInstance(actorId);
        const closenessData = actorEntity?.getComponentData?.(
          'positioning:closeness'
        );
        cachedPartners = Array.isArray(closenessData?.partners)
          ? [...closenessData.partners]
          : [];
      } catch (error) {
        this.#logger.warn(
          `Failed to retrieve closeness data for ${actorId}`,
          error
        );
        cachedPartners = [];
      }

      this.#closenessCache.set(actorId, cachedPartners);
    }

    context.targetGender = this.#detectEntityGender(targetId);

    if (Array.isArray(cachedPartners) && cachedPartners.includes(targetId)) {
      context.relationshipTone = 'closeness_partner';
    }

    return context;
  }

  /**
   * Map activity priority onto an intensity bucket.
   *
   * @description Map activity priority onto an intensity bucket.
   * @param {number} priority - Activity priority score (defaults to 0).
   * @returns {string} Intensity level identifier.
   * @private
   */
  #determineActivityIntensity(priority = 0) {
    if (priority >= 90) {
      return 'intense';
    }

    if (priority >= 70) {
      return 'elevated';
    }

    return 'casual';
  }

  /**
   * Apply contextual tone adjustments to an activity payload before rendering.
   *
   * @description Apply contextual tone adjustments to an activity payload before rendering.
   * @param {object} activity - Original activity metadata.
   * @param {object} context - Context payload from #buildActivityContext.
   * @returns {object} Activity metadata with contextual overrides.
   * @private
   */
  #applyContextualTone(activity, context) {
    const adjusted = { ...activity };

    if (!context || !context.targetId) {
      return adjusted;
    }

    if (context.relationshipTone === 'closeness_partner') {
      adjusted.contextualTone = 'intimate';

      if (typeof adjusted.adverb === 'string') {
        adjusted.adverb = this.#mergeAdverb(adjusted.adverb, 'tenderly');
      } else if (adjusted.type === 'dedicated') {
        adjusted.adverb = 'tenderly';
      }

      if (typeof adjusted.template === 'string') {
        adjusted.template = this.#injectSoftener(adjusted.template, 'tenderly');
      }

      return adjusted;
    }

    if (context.intensity === 'intense') {
      adjusted.contextualTone = 'intense';

      if (typeof adjusted.adverb === 'string') {
        adjusted.adverb = this.#mergeAdverb(adjusted.adverb, 'fiercely');
      } else if (adjusted.type === 'dedicated') {
        adjusted.adverb = 'fiercely';
      }

      if (typeof adjusted.template === 'string') {
        adjusted.template = this.#injectSoftener(adjusted.template, 'fiercely');
      }
    }

    return adjusted;
  }

  /**
   * Merge contextual adverbs without duplicating descriptors.
   *
   * @description Merge contextual adverbs without duplicating descriptors.
   * @param {string} currentAdverb - Existing adverb string.
   * @param {string} injected - Contextual adverb to merge.
   * @returns {string} Merged adverb string.
   * @private
   */
  #mergeAdverb(currentAdverb, injected) {
    const normalizedInjected =
      typeof injected === 'string' ? injected.trim() : '';
    const normalizedCurrent =
      typeof currentAdverb === 'string' ? currentAdverb.trim() : '';

    if (!normalizedInjected) {
      return normalizedCurrent;
    }

    if (!normalizedCurrent) {
      return normalizedInjected;
    }

    const lowerCurrent = normalizedCurrent.toLowerCase();
    if (lowerCurrent.includes(normalizedInjected.toLowerCase())) {
      return normalizedCurrent;
    }

    return `${normalizedCurrent} ${normalizedInjected}`.trim();
  }

  /**
   * Inject contextual descriptors into templates referencing targets.
   *
   * @description Inject contextual descriptors into templates that reference {target}.
   * @param {string} template - Activity template string.
   * @param {string} descriptor - Descriptor to inject (e.g. 'tenderly').
   * @returns {string} Updated template string.
   * @private
   */
  #injectSoftener(template, descriptor) {
    if (!descriptor || typeof template !== 'string') {
      return template;
    }

    const trimmedDescriptor = descriptor.trim();
    if (!trimmedDescriptor) {
      return template;
    }

    if (!template.includes('{target}')) {
      return template;
    }

    const existingDescriptor = `${trimmedDescriptor} {target}`.toLowerCase();
    if (template.toLowerCase().includes(existingDescriptor)) {
      return template;
    }

    return template.replace('{target}', `${trimmedDescriptor} {target}`);
  }

  /**
   * Generate a single activity phrase for the actor and optional target.
   * ACTDESC-014: Enhanced with pronoun support for target entities
   *
   * @description Generate an activity phrase and optionally return decomposed components.
   * @param {string} actorRef - Actor name or pronoun
   * @param {object} activity - Activity object
   * @param {boolean} usePronounsForTarget - Whether to use pronouns for target (default: false)
   * @param {object} [options] - Additional generation options
   * @param {boolean} [options.omitActor=false] - When true, return decomposed phrases for grouping
   * @returns {string|ActivityPhraseComponents} Activity phrase or decomposed components when omitActor is true
   * @private
   */

  #generateActivityPhrase(
    actorRef,
    activity,
    usePronounsForTarget = false,
    options = {}
  ) {
    const targetEntityId = activity.targetEntityId || activity.targetId;

    // Resolve target reference (name or pronoun)
    let targetRef = '';
    if (targetEntityId) {
      if (usePronounsForTarget) {
        const targetGender = this.#detectEntityGender(targetEntityId);
        const targetPronouns = this.#getPronounSet(targetGender);
        targetRef = targetPronouns.object; // 'him', 'her', 'them'
      } else {
        targetRef = this.#resolveEntityName(targetEntityId);
      }
    }

    let rawPhrase = '';

    if (activity.type === 'inline') {
      // Use template replacement
      if (activity.template) {
        rawPhrase = activity.template
          .replace(/\{actor\}/g, actorRef)
          .replace(/\{target\}/g, targetRef);
      } else if (activity.description) {
        const normalizedDesc = activity.description.trim();
        if (normalizedDesc) {
          rawPhrase = targetRef
            ? `${actorRef} ${normalizedDesc} ${targetRef}`
            : `${actorRef} ${normalizedDesc}`;
        }
      }
    } else if (activity.type === 'dedicated') {
      // Dedicated metadata: construct from verb/adverb
      const verb = (activity.verb || 'interacting with').trim();
      const adverb = activity.adverb ? ` ${activity.adverb.trim()}` : '';

      if (targetRef) {
        rawPhrase = `${actorRef} is ${verb} ${targetRef}${adverb}`;
      } else {
        rawPhrase = `${actorRef} is ${verb}${adverb}`;
      }
    } else if (activity.description) {
      const normalizedDesc = activity.description.trim();
      if (normalizedDesc) {
        rawPhrase = targetRef
          ? `${actorRef} ${normalizedDesc} ${targetRef}`
          : `${actorRef} ${normalizedDesc}`;
      }
    } else if (activity.verb) {
      const normalizedVerb = activity.verb.trim();
      if (normalizedVerb) {
        rawPhrase = targetRef
          ? `${actorRef} ${normalizedVerb} ${targetRef}`
          : `${actorRef} ${normalizedVerb}`;
      }
    }

    const normalizedPhrase = rawPhrase.trim();
    const omitActor = options?.omitActor === true;

    if (!omitActor) {
      return normalizedPhrase;
    }

    if (!normalizedPhrase) {
      return { fullPhrase: '', verbPhrase: '' };
    }

    const actorToken = (actorRef ?? '').trim();
    let verbPhrase = normalizedPhrase;

    if (actorToken) {
      const actorPattern = new RegExp(
        `^${this.#escapeRegExp(actorToken)}\\s+`,
        'i'
      );
      verbPhrase = verbPhrase.replace(actorPattern, '').trim();
    }

    return {
      fullPhrase: normalizedPhrase,
      verbPhrase,
    };
  }

  /**
   * Sanitize verb phrases to prevent duplicate copulas when grouping activities.
   *
   * @description Sanitize verb phrases to prevent duplicate copulas when grouping activities.
   * @param {string} phrase - Raw verb phrase with potential leading copula.
   * @returns {string} Cleaned phrase suitable for conjunction usage.
   * @private
   */
  #sanitizeVerbPhrase(phrase) {
    if (!phrase) {
      return '';
    }

    const trimmed = phrase.trim();
    if (!trimmed) {
      return '';
    }

    return trimmed.replace(/^(?:is|are|was|were|am)\s+/i, '').trim();
  }

  /**
   * Build the fragment used to connect related activities to the primary activity.
   *
   * @description Build the fragment used to connect related activities to the primary activity.
   * @param {string} conjunction - Conjunction used to join the phrase ("and" or "while").
   * @param {ActivityPhraseComponents} phraseComponents - Generated phrase components for the related activity.
   * @param {object} context - Actor context for pronoun and naming logic.
   * @param {string} context.actorName - Resolved actor name.
   * @param {string} context.actorReference - Reference used for the primary activity (name or pronoun).
   * @param {object} context.actorPronouns - Pronoun set for the actor.
   * @param {boolean} context.pronounsEnabled - Whether pronouns are enabled in configuration.
   * @returns {string} Fragment to append to the primary phrase.
   * @private
   */
  #buildRelatedActivityFragment(
    conjunction,
    phraseComponents,
    { actorName, actorReference, actorPronouns, pronounsEnabled }
  ) {
    if (!phraseComponents) {
      return '';
    }

    const rawVerbPhrase = phraseComponents.verbPhrase?.trim() ?? '';
    const sanitizedVerbPhrase = this.#sanitizeVerbPhrase(rawVerbPhrase);
    const removedCopula =
      sanitizedVerbPhrase && rawVerbPhrase !== sanitizedVerbPhrase;
    const fallbackPhrase = phraseComponents.fullPhrase?.trim() ?? '';
    const safeConjunction = conjunction || 'and';

    if (!sanitizedVerbPhrase && !fallbackPhrase) {
      return '';
    }

    if (safeConjunction === 'while') {
      if (sanitizedVerbPhrase) {
        if (removedCopula) {
          return `while ${sanitizedVerbPhrase}`;
        }

        const subjectRef = pronounsEnabled
          ? actorPronouns.subject
          : actorReference || actorName;

        if (subjectRef) {
          return `while ${subjectRef} ${sanitizedVerbPhrase}`;
        }

        return `while ${sanitizedVerbPhrase}`;
      }

      if (fallbackPhrase) {
        return `while ${fallbackPhrase}`;
      }

      return '';
    }

    const phraseBody = sanitizedVerbPhrase || fallbackPhrase;

    return `${safeConjunction} ${phraseBody}`;
  }

  /**
   * Group activities intelligently for natural composition.
   *
   * @description Group activities intelligently for natural composition.
   * @param {Array<object>} activities - Activities sorted by priority.
   * @param {string|null} cacheKey - Cache key used to reuse indexed activity structures.
   * @returns {Array<ActivityGroup>} Grouped activities ready for rendering.
   * @private
   */
  #groupActivities(activities, cacheKey = null) {
    const groups = [];
    if (!Array.isArray(activities) || activities.length === 0) {
      return groups;
    }

    const index = this.#getActivityIndex(activities, cacheKey);
    const prioritized =
      index.byPriority.length > 0 ? index.byPriority : activities;
    const visited = new Set();

    const candidateCache = new Map();

    for (let i = 0; i < prioritized.length; i += 1) {
      const activity = prioritized[i];

      if (visited.has(activity)) {
        continue;
      }

      const group = this.#startActivityGroup(activity);
      visited.add(activity);

      const targetId = activity?.targetEntityId ?? activity?.targetId ?? 'solo';
      const groupKey = activity?.grouping?.groupKey ?? null;

      const candidateKey = `${groupKey ?? 'no-group'}::${targetId}`;
      if (!candidateCache.has(candidateKey)) {
        const candidates = new Set();

        if (groupKey && index.byGroupKey?.has(groupKey)) {
          index.byGroupKey.get(groupKey).forEach((candidate) => {
            if (candidate !== activity) {
              candidates.add(candidate);
            }
          });
        }

        if (index.byTarget.has(targetId)) {
          index.byTarget.get(targetId).forEach((candidate) => {
            if (candidate !== activity) {
              candidates.add(candidate);
            }
          });
        }

        candidateCache.set(candidateKey, candidates);
      }

      const candidates = candidateCache.get(candidateKey);

      for (let j = i + 1; j < prioritized.length; j += 1) {
        const candidate = prioritized[j];

        if (!candidates.has(candidate) || visited.has(candidate)) {
          continue;
        }

        if (!this.#shouldGroupActivities(group.primaryActivity, candidate)) {
          continue;
        }

        group.relatedActivities.push({
          activity: candidate,
          conjunction: this.#determineConjunction(
            group.primaryActivity,
            candidate
          ),
        });
        visited.add(candidate);
      }

      groups.push(group);
    }

    return groups;
  }

  /**
   * Initialise a new activity group container.
   *
   * @description Initialise a new activity group.
   * @param {object} activity - Activity that becomes the group's primary entry.
   * @returns {ActivityGroup} Fresh activity group container.
   * @private
   */
  #startActivityGroup(activity) {
    return {
      primaryActivity: activity,
      relatedActivities: [],
    };
  }

  /**
   * Determine if two activities should be grouped together.
   *
   * @description Determine if two activities should be grouped together.
   * @param {object} first - Primary activity in the current group.
   * @param {object} second - Candidate activity being evaluated.
   * @returns {boolean} True when activities belong in the same group.
   * @private
   */
  #shouldGroupActivities(first, second) {
    const firstGroupKey = first?.grouping?.groupKey;
    const secondGroupKey = second?.grouping?.groupKey;

    if (firstGroupKey && firstGroupKey === secondGroupKey) {
      return true;
    }

    const firstTarget = first?.targetEntityId ?? first?.targetId;
    const secondTarget = second?.targetEntityId ?? second?.targetId;

    if (firstTarget && firstTarget === secondTarget) {
      return true;
    }

    return false;
  }

  /**
   * Determine the conjunction connecting two activities.
   *
   * @description Determine the conjunction connecting two activities.
   * @param {object} first - Primary activity.
   * @param {object} second - Related activity.
   * @returns {string} Conjunction keyword.
   * @private
   */
  #determineConjunction(first, second) {
    const firstPriority = first?.priority ?? 0;
    const secondPriority = second?.priority ?? 0;

    return this.#activitiesOccurSimultaneously(firstPriority, secondPriority)
      ? 'while'
      : 'and';
  }

  /**
   * Determine whether activities should be considered simultaneous.
   *
   * @description Determine whether activities should be considered simultaneous.
   * @param {number} firstPriority - Priority of the first activity.
   * @param {number} secondPriority - Priority of the second activity.
   * @returns {boolean} True when priorities are within the simultaneous threshold.
   * @private
   */
  #activitiesOccurSimultaneously(firstPriority, secondPriority) {
    return (
      Math.abs((firstPriority ?? 0) - (secondPriority ?? 0)) <=
      this.#simultaneousPriorityThreshold
    );
  }

  /**
   * Escape special characters within a string for safe RegExp usage.
   *
   * @description Escape special characters within a string for safe RegExp usage.
   * @param {string} value - Raw string to escape.
   * @returns {string} Escaped string.
   * @private
   */
  #escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  #resolveEntityName(entityId) {
    // ACTDESC-009
    if (!entityId) {
      return 'Unknown entity';
    }

    const cachedName = this.#getCacheValue(this.#entityNameCache, entityId);
    if (cachedName) {
      return cachedName;
    }

    try {
      const entity = this.#entityManager.getEntityInstance(entityId);

      if (!entity) {
        this.#logger.warn(
          `Failed to resolve entity name for ${entityId}: entity not found`
        );
        return entityId;
      }

      // Entities use core:name component for their names
      const nameComponent = entity?.getComponentData?.('core:name');
      const resolvedName = nameComponent?.text ?? entity?.id ?? entityId;

      this.#setCacheValue(this.#entityNameCache, entityId, resolvedName);
      return resolvedName;
    } catch (error) {
      this.#logger.warn(`Failed to resolve entity name for ${entityId}`, error);
      return entityId;
    }
  }

  /**
   * Detect entity gender for pronoun resolution.
   * ACTDESC-014: Phase 2 Natural Language Enhancement
   *
   * @param {string} entityId - Entity ID
   * @returns {string} Gender: 'male', 'female', 'neutral', or 'unknown'
   * @private
   */
  #detectEntityGender(entityId) {
    if (!entityId) {
      return 'unknown';
    }

    const cachedGender = this.#getCacheValue(this.#genderCache, entityId);
    if (cachedGender) {
      return cachedGender;
    }

    let resolvedGender = 'neutral';

    try {
      const entity = this.#entityManager.getEntityInstance(entityId);
      if (!entity) {
        resolvedGender = 'unknown';
      } else {
        // Check for explicit gender component
        const genderComponent = entity.getComponentData?.('core:gender');
        if (genderComponent?.value) {
          resolvedGender = genderComponent.value; // 'male', 'female', 'neutral'
        } else {
          resolvedGender = 'neutral';
        }
      }
    } catch (error) {
      this.#logger.warn(
        `Failed to detect gender for entity ${entityId}`,
        error
      );
      resolvedGender = 'neutral';
    }

    this.#setCacheValue(this.#genderCache, entityId, resolvedGender);
    return resolvedGender;
  }

  /**
   * Get pronouns for entity based on gender.
   * ACTDESC-014: Phase 2 Natural Language Enhancement
   *
   * @param {string} gender - Gender value ('male', 'female', 'neutral', 'unknown')
   * @returns {object} Pronoun set with subject, object, possessive, possessivePronoun
   * @private
   */
  #getPronounSet(gender) {
    const pronounSets = {
      male: {
        subject: 'he',
        object: 'him',
        possessive: 'his',
        possessivePronoun: 'his',
      },
      female: {
        subject: 'she',
        object: 'her',
        possessive: 'her',
        possessivePronoun: 'hers',
      },
      neutral: {
        subject: 'they',
        object: 'them',
        possessive: 'their',
        possessivePronoun: 'theirs',
      },
      unknown: {
        subject: 'they',
        object: 'them',
        possessive: 'their',
        possessivePronoun: 'theirs',
      },
    };

    return pronounSets[gender] || pronounSets.neutral;
  }

  /**
   * Provide controlled access to private helpers for white-box unit testing.
   *
   * @description Provide controlled access to private helpers for white-box unit testing.
   * @returns {ActivityDescriptionTestHooks} Selected helper functions bound to the current service instance.
   */
  getTestHooks() {
    return {
      mergeAdverb: (...args) => this.#mergeAdverb(...args),
      injectSoftener: (...args) => this.#injectSoftener(...args),
      sanitizeVerbPhrase: (...args) => this.#sanitizeVerbPhrase(...args),
      buildRelatedActivityFragment: (...args) =>
        this.#buildRelatedActivityFragment(...args),
      buildActivityIndex: (...args) => this.#buildActivityIndex(...args),
      cleanupCaches: () => this.#cleanupCaches(),
      setEntityNameCacheEntry: (key, value) =>
        this.#setCacheValue(this.#entityNameCache, key, value),
      setGenderCacheEntry: (key, value) =>
        this.#setCacheValue(this.#genderCache, key, value),
      setActivityIndexCacheEntry: (key, value) =>
        this.#setCacheValue(this.#activityIndexCache, key, value),
      getCacheSnapshot: () => ({
        entityName: new Map(this.#entityNameCache),
        gender: new Map(this.#genderCache),
        activityIndex: new Map(this.#activityIndexCache),
      }),
      // Additional test hooks for ACTDESC-014 pronoun resolution tests
      evaluateActivityVisibility: (...args) =>
        this.#evaluateActivityVisibility(...args),
      buildLogicContext: (...args) => this.#buildLogicContext(...args),
      buildActivityContext: (...args) => this.#buildActivityContext(...args),
      applyContextualTone: (...args) => this.#applyContextualTone(...args),
      generateActivityPhrase: (...args) =>
        this.#generateActivityPhrase(...args),
      filterByConditions: (...args) => this.#filterByConditions(...args),
      determineActivityIntensity: (...args) =>
        this.#determineActivityIntensity(...args),
      isEmptyConditionsObject: (...args) =>
        this.#isEmptyConditionsObject(...args),
      matchesPropertyCondition: (...args) =>
        this.#matchesPropertyCondition(...args),
      hasRequiredComponents: (...args) => this.#hasRequiredComponents(...args),
      hasForbiddenComponents: (...args) =>
        this.#hasForbiddenComponents(...args),
      extractEntityData: (...args) => this.#extractEntityData(...args),
      determineConjunction: (...args) => this.#determineConjunction(...args),
      activitiesOccurSimultaneously: (...args) =>
        this.#activitiesOccurSimultaneously(...args),
      getPronounSet: (...args) => this.#getPronounSet(...args),
      resolveEntityName: (...args) => this.#resolveEntityName(...args),
    };
  }

  /**
   * Build a cached index of activities for quick lookups.
   *
   * @description Build activity index for fast lookups.
   * @param {Array<object>} activities - All activities collected for the entity.
   * @returns {ActivityIndex} Indexed activities partitioned by target, priority, and grouping.
   * @private
   */
  #buildActivityIndex(activities) {
    const index = {
      byTarget: new Map(),
      byPriority: [],
      byGroupKey: new Map(),
      all: Array.isArray(activities) ? activities : [],
    };

    if (!Array.isArray(activities) || activities.length === 0) {
      return index;
    }

    for (const activity of activities) {
      const targetId = activity?.targetEntityId ?? activity?.targetId ?? 'solo';
      if (!index.byTarget.has(targetId)) {
        index.byTarget.set(targetId, []);
      }
      index.byTarget.get(targetId).push(activity);

      const groupKey = activity?.grouping?.groupKey;
      if (groupKey) {
        if (!index.byGroupKey.has(groupKey)) {
          index.byGroupKey.set(groupKey, []);
        }
        index.byGroupKey.get(groupKey).push(activity);
      }
    }

    index.byPriority = [...activities].sort(
      (a, b) => (b?.priority ?? 0) - (a?.priority ?? 0)
    );

    return index;
  }

  #dispatchError(errorType, context = {}) {
    if (!this.#eventBus || typeof this.#eventBus.dispatch !== 'function') {
      return;
    }

    const payload = {
      errorType,
      ...context,
      timestamp: Date.now(),
    };

    try {
      this.#eventBus.dispatch({
        type: 'ACTIVITY_DESCRIPTION_ERROR',
        payload,
      });
    } catch (error) {
      this.#logger.error(
        'Failed to dispatch activity description error event',
        error
      );
    }
  }

  /**
   * Setup periodic cache cleanup interval.
   *
   * @description Setup periodic cache cleanup interval.
   * @private
   */
  #setupCacheCleanup() {
    if (typeof setInterval !== 'undefined') {
      this.#cleanupInterval = setInterval(() => {
        this.#cleanupCaches();
      }, 30000);

      if (typeof this.#cleanupInterval?.unref === 'function') {
        this.#cleanupInterval.unref();
      }
    }
  }

  /**
   * Cleanup cache entries and enforce size limits.
   *
   * @description Cleanup cache entries and enforce size limits.
   * @private
   */
  #cleanupCaches() {
    const now = Date.now();
    this.#pruneCache(this.#entityNameCache, this.#cacheConfig.maxSize, now);
    this.#pruneCache(this.#genderCache, this.#cacheConfig.maxSize, now);
    this.#pruneCache(this.#activityIndexCache, 100, now);
  }

  /**
   * Remove expired entries and enforce cache size limits.
   *
   * @description Remove expired entries and enforce cache size limits.
   * @param {Map<string, TimedCacheEntry>} cache - Cache map storing entries with TTL metadata.
   * @param {number} maxSize - Maximum size before aggressive cleanup.
   * @param {number} now - Current timestamp for TTL comparison.
   * @private
   */
  #pruneCache(cache, maxSize, now) {
    for (const [key, entry] of cache.entries()) {
      if (!entry || (entry.expiresAt && entry.expiresAt <= now)) {
        cache.delete(key);
      }
    }

    if (cache.size > maxSize) {
      cache.clear();
    }
  }

  /**
   * Retrieve an activity index from cache or rebuild when necessary.
   *
   * @description Retrieve an activity index from cache or rebuild when necessary.
   * @param {Array<object>} activities - Activities requiring indexing.
   * @param {string|null} cacheKey - Cache key used for reuse between operations.
   * @returns {ActivityIndex} Activity index payload.
   * @private
   */
  #getActivityIndex(activities, cacheKey = null) {
    if (!Array.isArray(activities) || activities.length === 0) {
      return {
        byTarget: new Map(),
        byPriority: [],
        byGroupKey: new Map(),
        all: Array.isArray(activities) ? activities : [],
      };
    }

    if (!cacheKey) {
      return this.#buildActivityIndex(activities);
    }

    const signature = this.#buildActivitySignature(activities);
    const cachedEntry = this.#getCacheValue(this.#activityIndexCache, cacheKey);

    if (cachedEntry && cachedEntry.signature === signature) {
      return cachedEntry.index;
    }

    const index = this.#buildActivityIndex(activities);
    this.#setCacheValue(this.#activityIndexCache, cacheKey, {
      signature,
      index,
    });

    return index;
  }

  /**
   * Build deterministic signature for activity collections.
   *
   * @description Build deterministic signature for activity collections.
   * @param {Array<object>} activities - Activities to summarise.
   * @returns {string} Signature string for cache validation.
   * @private
   */
  #buildActivitySignature(activities) {
    return activities
      .map((activity) => {
        const source =
          activity?.sourceComponent ?? activity?.descriptionType ?? 'unknown';
        const target = activity?.targetEntityId ?? activity?.targetId ?? 'solo';
        const priority = activity?.priority ?? 50;
        const type = activity?.type ?? 'generic';
        return `${type}:${source}:${target}:${priority}`;
      })
      .join('|');
  }

  /**
   * Build a cache key for indexing namespaces.
   *
   * @description Build a cache key for indexing namespaces.
   * @param {string} namespace - Namespace for the cache entry.
   * @param {string} entityId - Entity identifier used in cache differentiation.
   * @returns {string} Composite cache key.
   * @private
   */
  #buildActivityIndexCacheKey(namespace, entityId) {
    return `${namespace}:${entityId ?? 'unknown'}`;
  }

  /**
   * Retrieve cached value honouring TTL semantics.
   *
   * @description Retrieve cached value honouring TTL semantics.
   * @param {Map<string, TimedCacheEntry>} cache - Cache map storing entries with expiry metadata.
   * @param {string} key - Cache key for lookup.
   * @returns {unknown|null} Cached value when present and fresh.
   * @private
   */
  #getCacheValue(cache, key) {
    if (!cache.has(key)) {
      return null;
    }

    const entry = cache.get(key);
    if (!entry) {
      cache.delete(key);
      return null;
    }

    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      cache.delete(key);
      return null;
    }

    return entry.value ?? null;
  }

  /**
   * Store a value within a TTL-governed cache.
   *
   * @description Store a value within a TTL-governed cache.
   * @param {Map<string, TimedCacheEntry>} cache - Cache map storing entries with expiry metadata.
   * @param {string} key - Cache key for storage.
   * @param {unknown} value - Cached value payload.
   * @private
   */
  #setCacheValue(cache, key, value) {
    const expiresAt = Date.now() + this.#cacheConfig.ttl;
    cache.set(key, { value, expiresAt });
  }

  /**
   * Destroy service resources and clear cache state.
   *
   * @description Destroy service resources and clear cache state.
   */
  destroy() {
    if (this.#cleanupInterval) {
      clearInterval(this.#cleanupInterval);
      this.#cleanupInterval = null;
    }

    this.#entityNameCache.clear();
    this.#genderCache.clear();
    this.#activityIndexCache.clear();
    this.#closenessCache.clear();
  }
}

export default ActivityDescriptionService;
