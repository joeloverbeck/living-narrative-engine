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
// Backward compatibility: Used for fallback instantiation when not injected
/* eslint-disable-next-line no-unused-vars */
import ActivityCacheManager from '../cache/activityCacheManager.js';
/* eslint-disable-next-line no-unused-vars */
import ActivityIndexManager from './activityIndexManager.js';
/* eslint-disable-next-line no-unused-vars */
import ActivityMetadataCollectionSystem from './activityMetadataCollectionSystem.js';
import ActivityConditionValidator from './validation/activityConditionValidator.js';
import ActivityFilteringSystem from './filtering/activityFilteringSystem.js';
/* eslint-disable-next-line no-unused-vars */
import ActivityNLGSystem from './activityNLGSystem.js';
import ActivityContextBuildingSystem from './context/activityContextBuildingSystem.js';

const DEFAULT_ACTIVITY_FORMATTING_CONFIG = Object.freeze({
  enabled: true,
  prefix: 'Activity: ',
  suffix: '.',
  separator: '. ',
  maxActivities: 10,
  enableContextAwareness: true,
  maxDescriptionLength: 500,
  deduplicateActivities: true,
  nameResolution: Object.freeze({
    usePronounsWhenAvailable: false,
    preferReflexivePronouns: true,
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
 * @property {(activities: Array<object>) => Array<object>} deduplicateActivitiesBySignature - Deduplicate activities by semantic signature.
 * @property {(description: string, maxLength: number) => string} truncateDescription - Truncate composed descriptions to configured length.
 * @property {(name: string) => string} sanitizeEntityName - Sanitize entity names for display.
 * @property {(object: object) => string} getReflexivePronoun - Resolve reflexive pronouns for self-targeting logic.
 * @property {(targetEntityId: string) => boolean} shouldUsePronounForTarget - Determine pronoun usage for targets.
 * @property {() => void} cleanupCaches - Trigger cache cleanup routine.
 * @property {(key: string, value: unknown) => void} setEntityNameCacheEntry - Prime the entity name cache.
 * @property {(key: string, value: unknown) => void} setGenderCacheEntry - Prime the gender cache.
 * @property {(key: string, value: ActivityIndexCacheValue) => void} setActivityIndexCacheEntry - Prime the activity index cache.
 * @property {(key: string, value: Array<string>) => void} setClosenessCacheEntry - Prime the closeness cache with partner arrays.
 * @property {() => { entityName: Map<string, TimedCacheEntry>; gender: Map<string, TimedCacheEntry>; activityIndex: Map<string, TimedCacheEntry>; closeness: Map<string, TimedCacheEntry>; }} getCacheSnapshot - Retrieve shallow cache snapshots.
 */

class ActivityDescriptionService {
  #logger;

  #entityManager;

  #anatomyFormattingService;

  // eslint-disable-next-line no-unused-private-class-members
  #jsonLogicEvaluationService; // Used during fallback instantiation

  #cacheManager = null;

  #indexManager = null;

  #metadataCollectionSystem = null;

  #filteringSystem = null;

  #nlgSystem = null;

  #groupingSystem = null;

  #contextBuildingSystem = null;

  #eventBus = null;

  #eventUnsubscribers = [];

  // eslint-disable-next-line no-unused-private-class-members
  #activityIndex = null; // Phase 3: ACTDESC-020 - Reserved for future index caching

  #cacheConfig = {
    maxSize: 1000,
    ttl: 60000,
    enableMetrics: false,
  };

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
   * @param dependencies.cacheManager
   * @param dependencies.indexManager
   * @param dependencies.metadataCollectionSystem
   * @param dependencies.groupingSystem
   * @param dependencies.nlgSystem
   * @param dependencies.filteringSystem
   * @param dependencies.contextBuildingSystem
   */
  constructor({
    logger,
    entityManager,
    anatomyFormattingService,
    jsonLogicEvaluationService,
    cacheManager,
    indexManager,
    metadataCollectionSystem,
    groupingSystem,
    nlgSystem,
    filteringSystem = null,
    contextBuildingSystem = null,
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

    validateDependency(cacheManager, 'IActivityCacheManager', this.#logger, {
      requiredMethods: ['registerCache', 'get', 'set'],
    });

    validateDependency(indexManager, 'IActivityIndexManager', this.#logger, {
      requiredMethods: ['buildIndex'],
    });

    validateDependency(
      metadataCollectionSystem,
      'IActivityMetadataCollectionSystem',
      this.#logger,
      { requiredMethods: ['collectActivityMetadata'] }
    );

    validateDependency(groupingSystem, 'IActivityGroupingSystem', this.#logger, {
      requiredMethods: ['groupActivities', 'sortByPriority'],
    });

    validateDependency(nlgSystem, 'IActivityNLGSystem', this.#logger, {
      requiredMethods: ['formatActivityDescription'],
    });

    // For backward compatibility: create filtering system if not provided
    if (!filteringSystem) {
      const conditionValidator = new ActivityConditionValidator({ logger: this.#logger });
      filteringSystem = new ActivityFilteringSystem({
        logger: this.#logger,
        conditionValidator,
        jsonLogicEvaluationService,
        entityManager,
      });
    } else {
      validateDependency(
        filteringSystem,
        'IActivityFilteringSystem',
        this.#logger,
        { requiredMethods: ['filterByConditions'] }
      );
    }

    // For backward compatibility: create context building system if not provided
    if (!contextBuildingSystem) {
      contextBuildingSystem = new ActivityContextBuildingSystem({
        entityManager,
        logger: this.#logger,
        nlgSystem,
      });
    } else {
      validateDependency(
        contextBuildingSystem,
        'IActivityContextBuildingSystem',
        this.#logger,
        { requiredMethods: ['buildActivityContext'] }
      );
    }

    this.#entityManager = entityManager;
    this.#anatomyFormattingService = anatomyFormattingService;
    this.#jsonLogicEvaluationService = jsonLogicEvaluationService;
    this.#cacheManager = cacheManager;
    this.#indexManager = indexManager;
    this.#metadataCollectionSystem = metadataCollectionSystem;
    this.#groupingSystem = groupingSystem;
    this.#nlgSystem = nlgSystem;
    this.#filteringSystem = filteringSystem;
    this.#contextBuildingSystem = contextBuildingSystem;
    this.#activityIndex = activityIndex;

    // Validate event bus if provided
    if (eventBus !== null && eventBus !== undefined) {
      validateDependency(eventBus, 'EventBus', this.#logger, {
        requiredMethods: ['dispatch', 'subscribe', 'unsubscribe'],
      });
      this.#eventBus = eventBus;
    }

    // Register caches with appropriate configurations
    this.#cacheManager.registerCache('entityName', {
      ttl: this.#cacheConfig.ttl,
      maxSize: this.#cacheConfig.maxSize,
    });
    this.#cacheManager.registerCache('gender', {
      ttl: this.#cacheConfig.ttl,
      maxSize: this.#cacheConfig.maxSize,
    });
    this.#cacheManager.registerCache('activityIndex', {
      ttl: this.#cacheConfig.ttl,
      maxSize: 100, // Smaller size for activity index
    });
    this.#cacheManager.registerCache('closeness', {
      ttl: this.#cacheConfig.ttl,
      maxSize: this.#cacheConfig.maxSize,
    });

    // Subscribe to invalidation events only if event bus is available
    if (this.#eventBus) {
      this.#subscribeToInvalidationEvents();
    }
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

    // Gender components may change between invocations; refresh actor pronouns while retaining cached targets.
    if (this.#cacheManager) {
      this.#cacheManager.invalidate('gender', entityId);
    }

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

      let componentTypeIdsLogValue = 'not available';
      let hasComponentTypeIds = false;
      let componentCount = 0;

      try {
        const componentTypeIds = entity.componentTypeIds;

        if (Array.isArray(componentTypeIds)) {
          componentTypeIdsLogValue = componentTypeIds;
          hasComponentTypeIds = true;
          componentCount = componentTypeIds.length;
        }
      } catch (componentAccessError) {
        this.#logger.warn(
          `Failed to inspect componentTypeIds for entity ${entityId}`,
          componentAccessError
        );
        componentTypeIdsLogValue = 'inspection_failed';
      }

      this.#logger.info('ActivityDescriptionService: received entity', {
        entityId,
        entityExists: true,
        componentTypeIds: componentTypeIdsLogValue,
        hasComponentTypeIds,
        componentCount,
      });

      const activities = this.#metadataCollectionSystem.collectActivityMetadata(entityId, entity);

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
        return '';
      }

      const formattingConfig = this.#getActivityIntegrationConfig();
      let processedActivities = conditionedActivities;

      if (formattingConfig.deduplicateActivities !== false) {
        processedActivities = this.#metadataCollectionSystem.deduplicateActivitiesBySignature(
          conditionedActivities
        );

        if (processedActivities.length < conditionedActivities.length) {
          this.#logger.debug(
            `Deduplicated ${
              conditionedActivities.length - processedActivities.length
            } duplicate activities for entity: ${entityId}`
          );
        }
      }

      if (processedActivities.length === 0) {
        this.#logger.debug(
          `No activities remaining after deduplication for entity: ${entityId}`
        );
        return '';
      }

      const prioritizedActivities = this.#groupingSystem.sortByPriority(
        processedActivities,
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
  // Note: Metadata collection methods extracted to ActivityMetadataCollectionSystem

  /**
   * Filter activities based on visibility-oriented condition metadata.
   *
   * @param {Array<object>} activities - Raw activity entries from collectors.
   * @param {object} entity - Entity instance requesting the description.
   * @returns {Array<object>} Activities that should remain visible.
   * @private
   */
  #filterByConditions(activities, entity) {
    return this.#filteringSystem.filterByConditions(activities, entity);
  }



  // Note: Deduplication methods extracted to ActivityMetadataCollectionSystem
  // Note: Priority sorting extracted to ActivityGroupingSystem (ACTDESSERREF-007)

  #formatActivityDescription(activities, entity, cacheKey = null) {
    // ACTDESC-008 (Phase 2 - Enhanced with Pronoun Resolution)
    // ACTDESC-014: Pronoun resolution implementation
    const config = this.#getActivityIntegrationConfig();

    if (config?.enabled === false) {
      this.#logger.debug(
        'Activity description formatting disabled via configuration'
      );
      return '';
    }

    if (!Array.isArray(activities) || activities.length === 0) {
      return '';
    }

    // Get actor name and gender for pronoun resolution
    const actorId = entity?.id ?? null;
    const actorName = this.#nlgSystem.resolveEntityName(actorId);
    const actorGender = this.#nlgSystem.detectEntityGender(actorId);
    const actorPronouns = this.#nlgSystem.getPronounSet(actorGender);
    const pronounsEnabled =
      config.nameResolution?.usePronounsWhenAvailable === true;
    const preferReflexivePronouns =
      config.nameResolution?.preferReflexivePronouns !== false;

    // Respect maxActivities limit
    const maxActivities = config.maxActivities ?? 10;
    const limitedActivities = activities.slice(0, maxActivities);

    const enableContextAwareness = config.enableContextAwareness !== false;

    const contextAwareActivities = enableContextAwareness
      ? limitedActivities.map((activity) => {
          try {
            const context = this.#contextBuildingSystem.buildActivityContext(actorId, activity);
            const contextualised = this.#contextBuildingSystem.applyContextualTone(activity, context);
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
      const result = this.#groupingSystem.groupActivities(contextAwareActivities, cacheKey);
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
        primaryPhraseResult = this.#nlgSystem.generateActivityPhrase(
          actorReference,
          group.primaryActivity,
          useActorPronounForPrimary,
          {
            actorName,
            actorId,
            actorPronouns,
            preferReflexivePronouns,
            forceReflexivePronoun: pronounsEnabled && preferReflexivePronouns,
          }
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
          phraseComponents = this.#nlgSystem.generateActivityPhrase(
            actorReference,
            related.activity,
            pronounsEnabled,
            {
              omitActor: true,
              actorName,
              actorId,
              actorPronouns,
              preferReflexivePronouns,
              forceReflexivePronoun: pronounsEnabled && preferReflexivePronouns,
            }
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
          fragment = this.#nlgSystem.buildRelatedActivityFragment(
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
    const composedDescription = `${prefix}${activityText}${suffix}`.trim();
    const maxDescriptionLength = Number.isFinite(config.maxDescriptionLength)
      ? config.maxDescriptionLength
      : DEFAULT_ACTIVITY_FORMATTING_CONFIG.maxDescriptionLength;

    return this.#nlgSystem.truncateDescription(composedDescription, maxDescriptionLength);
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
   * Note: Context building methods extracted to ActivityContextBuildingSystem (ACTDESSERREF-008)
   * - #buildActivityContext
   * - #determineActivityIntensity
   * - #applyContextualTone
   */

  /**
   * Note: Activity grouping methods extracted to ActivityGroupingSystem (ACTDESSERREF-007)
   * - #groupActivities
   * - #startActivityGroup
   * - #shouldGroupActivities
   * - #determineConjunction
   * - #activitiesOccurSimultaneously
   */

  /**
   * Escape special characters within a string for safe RegExp usage.
   *
   * @description Escape special characters within a string for safe RegExp usage.
   * @param {string} value - Raw string to escape.
   * @returns {string} Escaped string.
   * @private
   */

  /**
   * Provide controlled access to private helpers for white-box unit testing.
   *
   * @description Provide controlled access to private helpers for white-box unit testing.
   * @returns {ActivityDescriptionTestHooks} Selected helper functions bound to the current service instance.
   */
  getTestHooks() {
    // Adapter layer removed - tests now use extracted services directly via DI container.
    // Remaining hooks provide access to ActivityDescriptionService's native implementation.
    return {
      // Native ActivityDescriptionService hooks for testing internal implementation
      buildActivityIndex: (...args) => this.#buildActivityIndex(...args),
      getActivityIndex: (...args) => this.#getActivityIndex(...args),
      subscribeToInvalidationEvents: () =>
        this.#subscribeToInvalidationEvents(),
      setEventBus: (eventBus) => {
        this.#eventBus = eventBus;
      },
      formatActivityDescription: (...args) =>
        this.#formatActivityDescription(...args),
      filterByConditions: (...args) => this.#filterByConditions(...args),
      // Cache management hooks for performance and integration testing
      cleanupCaches: () => this.#cleanupCaches(),
      setEntityNameCacheEntry: (key, value) =>
        this.#setCacheValue('entityName', key, value),
      setGenderCacheEntry: (key, value) =>
        this.#setCacheValue('gender', key, value),
      setActivityIndexCacheEntry: (key, value) =>
        this.#setCacheValue('activityIndex', key, value),
      setClosenessCacheEntry: (key, value) =>
        this.#setCacheValue('closeness', key, value),
      setEntityNameCacheRawEntry: (key, entry) => {
        // Legacy test hook - now delegates to cache manager with proper structure
        if (!this.#cacheManager) {
          return;
        }
        // If entry has the old structure {value, expiresAt}, extract the value
        const valueToStore = entry && typeof entry === 'object' && 'value' in entry
          ? entry.value
          : entry;

        if (valueToStore !== undefined && valueToStore !== null) {
          this.#cacheManager.set('entityName', key, valueToStore);
        }
      },
      getCacheSnapshot: () => {
        if (!this.#cacheManager) {
          return {
            entityName: new Map(),
            gender: new Map(),
            activityIndex: new Map(),
            closeness: new Map(),
          };
        }

        // Access the internal cache structure using test-only method
        return {
          entityName: this.#cacheManager._getInternalCacheForTesting('entityName'),
          gender: this.#cacheManager._getInternalCacheForTesting('gender'),
          activityIndex: this.#cacheManager._getInternalCacheForTesting('activityIndex'),
          closeness: this.#cacheManager._getInternalCacheForTesting('closeness'),
        };
      },
    };
  }

  /**
   * Subscribe to events that require cache invalidation.
   *
   * @description Subscribe to entity lifecycle events and register cache invalidation handlers.
   * @returns {void}
   * @private
   */
  /**
   * Subscribe to invalidation events - delegated to cache manager.
   *
   * @description No-op method maintained for backward compatibility. Event subscriptions are handled by ActivityCacheManager.
   * @private
   */
  #subscribeToInvalidationEvents() {
    // Cache manager handles event subscriptions automatically
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
    return this.#indexManager.buildActivityIndex(activities);
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
   * Cleanup method for test hooks - cache manager handles cleanup automatically.
   *
   * @description No-op method maintained for test compatibility. Cache cleanup is handled by ActivityCacheManager.
   * @private
   */
  #cleanupCaches() {
    // Cache manager handles periodic cleanup automatically
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
    return this.#indexManager.getActivityIndex(activities, cacheKey);
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
    return this.#indexManager.buildActivityIndexCacheKey(namespace, entityId);
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
  /**
   * Resolve cache reference to cache name for CacheManager
   *
   * @private
   * @param {Map} cacheMapReference - Reference to old cache Map
   * @returns {string} Cache name
   */
  /**
   * Retrieve a value from the unified cache manager.
   *
   * @description Retrieve a value from the unified cache manager.
   * @param {string} cacheName - Name of the cache (entityName, gender, activityIndex, closeness).
   * @param {string} key - Cache key for retrieval.
   * @returns {unknown|null} Cached value or null if not found/expired.
   * @private
   */
  // eslint-disable-next-line no-unused-private-class-members
  #getCacheValue(cacheName, key) { // Reserved for future direct cache access
    if (!this.#cacheManager) {
      return null;
    }

    const value = this.#cacheManager.get(cacheName, key);
    return value !== undefined ? value : null;
  }

  /**
   * Store a value in the unified cache manager.
   *
   * @description Store a value in the unified cache manager.
   * @param {string} cacheName - Name of the cache (entityName, gender, activityIndex, closeness).
   * @param {string} key - Cache key for storage.
   * @param {unknown} value - Cached value payload.
   * @private
   */
  #setCacheValue(cacheName, key, value) {
    if (!this.#cacheManager) {
      return;
    }

    this.#cacheManager.set(cacheName, key, value);
  }

  /**
   * Invalidate all caches for a single entity.
   *
   * @param {string} entityId - Entity ID whose cache entries should be removed.
   * @returns {void}
   * @description Delegate cache invalidation to the unified cache manager.
   * @private
   */
  #invalidateAllCachesForEntity(entityId) {
    if (this.#cacheManager) {
      this.#cacheManager.invalidateAll(entityId);
    }
    this.#contextBuildingSystem.invalidateClosenessCache(entityId);
  }

  /**
   * Invalidate caches for multiple entities efficiently.
   *
   * @param {Array<string>} entityIds - Entity IDs to invalidate.
   * @returns {void}
   * @description Invalidate all cache categories for each entity in the provided collection.
   */
  invalidateEntities(entityIds) {
    if (!Array.isArray(entityIds)) {
      this.#logger.warn(
        'ActivityDescriptionService: invalidateEntities called with non-array'
      );
      return;
    }

    for (const entityId of entityIds) {
      if (typeof entityId === 'string' && entityId.trim() !== '') {
        this.#invalidateAllCachesForEntity(entityId);
      }
    }

    this.#logger.debug(
      `ActivityDescriptionService: Invalidated caches for ${entityIds.length} entities`
    );
  }

  /**
   * Invalidate specific cache type for entity.
   *
   * @param {string} entityId - Entity ID to invalidate.
   * @param {string} [cacheType] - Cache type to invalidate.
   * @returns {void}
   * @description Delegate cache invalidation to the unified cache manager.
   */
  invalidateCache(entityId, cacheType = 'all') {
    if (!this.#cacheManager) {
      return;
    }

    switch (cacheType) {
      case 'name':
        this.#cacheManager.invalidate('entityName', entityId);
        break;
      case 'gender':
        this.#cacheManager.invalidate('gender', entityId);
        break;
      case 'activity':
        this.#cacheManager.invalidate('activityIndex', entityId);
        break;
      case 'closeness':
        this.#cacheManager.invalidate('closeness', entityId);
        this.#contextBuildingSystem.invalidateClosenessCache(entityId);
        break;
      case 'all':
        this.#invalidateAllCachesForEntity(entityId);
        break;
      default:
        this.#logger.warn(
          `ActivityDescriptionService: Unknown cache type: ${cacheType}`
        );
    }
  }

  /**
   * Clear all caches completely.
   *
   * @returns {void}
   * @description Delegate cache clearing to the unified cache manager.
   */
  clearAllCaches() {
    if (this.#cacheManager) {
      this.#cacheManager.clearAll();
    }
    this.#logger.info('ActivityDescriptionService: Cleared all caches');
  }

  /**
   * Destroy service resources and clear cache state.
   *
   * @description Destroy service resources and clear cache state.
   * @returns {void}
   */
  destroy() {
    // Destroy cache manager (handles cleanup interval and event unsubscription)
    if (this.#cacheManager) {
      this.#cacheManager.destroy();
      this.#cacheManager = null;
    }

    // Clean up any remaining event subscriptions (deprecated, but kept for backward compatibility)
    while (this.#eventUnsubscribers.length > 0) {
      const unsubscribe = this.#eventUnsubscribers.pop();
      try {
        unsubscribe?.();
      } catch (error) {
        this.#logger.warn(
          'ActivityDescriptionService: Failed to unsubscribe event handler',
          error
        );
      }
    }

    this.clearAllCaches();

    this.#logger.info('ActivityDescriptionService: Service destroyed');
  }
}

export default ActivityDescriptionService;
