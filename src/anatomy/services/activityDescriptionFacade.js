/**
 * @file ActivityDescriptionFacade - Simplified API for activity description system
 * Orchestrates 7 extracted services with clean separation of concerns
 * Implements ACTDESSERREF-009
 * @see activityDescriptionService.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * ActivityDescriptionFacade
 *
 * Provides a simplified API that orchestrates the activity description system's
 * 7 specialized services:
 * 1. ActivityCacheManager - Caching with TTL and event-based invalidation
 * 2. ActivityIndexManager - Activity index building and retrieval
 * 3. ActivityMetadataCollectionSystem - Metadata collection and deduplication
 * 4. ActivityNLGSystem - Natural language generation
 * 5. ActivityGroupingSystem - Sequential activity grouping
 * 6. ActivityContextBuildingSystem - Context building with tone adjustments
 * 7. ActivityFilteringSystem - Condition-based filtering
 *
 * Dependencies (all injected):
 * - IActivityCacheManager
 * - IActivityIndexManager
 * - IActivityMetadataCollectionSystem
 * - IActivityNLGSystem
 * - IActivityGroupingSystem
 * - IActivityContextBuildingSystem
 * - IActivityFilteringSystem
 * - AnatomyFormattingService (for configuration)
 * - IEntityManager (for entity access)
 * - ILogger
 */
class ActivityDescriptionFacade {
  #logger;
  // eslint-disable-next-line no-unused-private-class-members
  #entityManager; // Reserved for future direct entity operations
  #anatomyFormattingService;
  #cacheManager;
  // eslint-disable-next-line no-unused-private-class-members
  #indexManager; // Reserved for future index operations
  #metadataCollectionSystem;
  #nlgSystem;
  #groupingSystem;
  #contextBuildingSystem;
  #filteringSystem;
  #eventBus = null;
  #eventUnsubscribers = [];
  // eslint-disable-next-line no-unused-private-class-members
  #activityIndex = null; // Reserved for future index caching

  #cacheConfig = {
    maxSize: 1000,
    ttl: 60000,
    enableMetrics: false,
  };

  constructor({
    logger,
    entityManager,
    anatomyFormattingService,
    cacheManager,
    indexManager,
    metadataCollectionSystem,
    nlgSystem,
    groupingSystem,
    contextBuildingSystem,
    filteringSystem,
    activityIndex = null,
    eventBus = null,
  }) {
    this.#logger = ensureValidLogger(logger, 'ActivityDescriptionFacade');

    // Validate all service dependencies
    validateDependency(entityManager, 'IEntityManager', this.#logger, {
      requiredMethods: ['getEntityInstance'],
    });

    validateDependency(
      anatomyFormattingService,
      'AnatomyFormattingService',
      this.#logger
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

    validateDependency(nlgSystem, 'IActivityNLGSystem', this.#logger, {
      requiredMethods: ['formatActivityDescription'],
    });

    validateDependency(
      groupingSystem,
      'IActivityGroupingSystem',
      this.#logger,
      {
        requiredMethods: ['groupActivities', 'sortByPriority'],
      }
    );

    validateDependency(
      contextBuildingSystem,
      'IActivityContextBuildingSystem',
      this.#logger,
      { requiredMethods: ['buildActivityContext'] }
    );

    validateDependency(
      filteringSystem,
      'IActivityFilteringSystem',
      this.#logger,
      { requiredMethods: ['filterByConditions'] }
    );

    // Assign dependencies
    this.#entityManager = entityManager;
    this.#anatomyFormattingService = anatomyFormattingService;
    this.#cacheManager = cacheManager;
    this.#indexManager = indexManager;
    this.#metadataCollectionSystem = metadataCollectionSystem;
    this.#nlgSystem = nlgSystem;
    this.#groupingSystem = groupingSystem;
    this.#contextBuildingSystem = contextBuildingSystem;
    this.#filteringSystem = filteringSystem;
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
      maxSize: 100,
    });
    this.#cacheManager.registerCache('closeness', {
      ttl: this.#cacheConfig.ttl,
      maxSize: this.#cacheConfig.maxSize,
    });

    // Subscribe to invalidation events if event bus is available
    if (this.#eventBus) {
      this.#subscribeToInvalidationEvents();
    }
  }

  /**
   * Generate activity description for an entity
   *
   * Orchestration workflow:
   * 1. Collect metadata (metadata collection system)
   * 2. Filter by conditions (filtering system)
   * 3. Group activities (grouping system)
   * 4. Build context with tone (context building system)
   * 5. Format description (NLG system)
   *
   * @param {object} entity - Entity instance
   * @param {object} [_options] - Generation options (reserved for future use)
   * @returns {string} Formatted activity description
   */
  async generateActivityDescription(entity, _options = {}) {
    try {
      // Step 1: Collect activity metadata
      const allMetadata =
        this.#metadataCollectionSystem.collectActivityMetadata(entity);

      if (!allMetadata || allMetadata.length === 0) {
        return '';
      }

      // Step 2: Filter activities by conditions
      const filteredMetadata = this.#filteringSystem.filterByConditions(
        allMetadata,
        entity
      );

      if (!filteredMetadata || filteredMetadata.length === 0) {
        return '';
      }

      // Step 3: Group activities with priority-based conjunction selection
      const groupedActivities =
        this.#groupingSystem.groupActivities(filteredMetadata);

      if (!groupedActivities || groupedActivities.length === 0) {
        return '';
      }

      // Step 4: Build context with tone adjustments
      const activitiesWithContext =
        this.#contextBuildingSystem.buildActivityContext(
          groupedActivities,
          entity
        );

      // Step 5: Format final description using NLG system
      const config = this.#getActivityIntegrationConfig();
      const formattedDescription = this.#nlgSystem.formatActivityDescription(
        activitiesWithContext,
        entity,
        config
      );

      return formattedDescription;
    } catch (error) {
      this.#logger.error('Failed to generate activity description', error);
      this.#dispatchError(
        'ACTIVITY_DESCRIPTION_GENERATION_FAILED',
        error,
        entity
      );
      return '';
    }
  }

  /**
   * Get activity integration configuration from anatomy formatting service
   *
   * @returns {object} Configuration object
   * @private
   */
  #getActivityIntegrationConfig() {
    try {
      return this.#anatomyFormattingService.getActivityIntegrationConfig();
    } catch (error) {
      this.#logger.warn(
        'Failed to retrieve activity integration config, using defaults',
        error
      );
      return {
        enabled: true,
        maxActivities: 5,
        includeRelatedActivities: true,
      };
    }
  }

  /**
   * Subscribe to cache invalidation events
   *
   * @private
   */
  #subscribeToInvalidationEvents() {
    // Delegate to cache manager which handles event subscriptions
    // Cache manager automatically subscribes to COMPONENTS_BATCH_ADDED,
    // COMPONENT_ADDED, COMPONENT_REMOVED, etc.
  }

  /**
   * Dispatch error event if event bus is available
   *
   * @param {string} errorType - Type of error
   * @param {Error} error - Error object
   * @param {object} context - Error context
   * @private
   */
  #dispatchError(errorType, error, context) {
    if (!this.#eventBus) {
      return;
    }

    try {
      this.#eventBus.dispatch({
        type: 'SYSTEM_ERROR_OCCURRED',
        payload: {
          errorType,
          message: error.message,
          stack: error.stack,
          context: {
            entityId: context?.id,
            service: 'ActivityDescriptionFacade',
          },
        },
      });
    } catch (dispatchError) {
      this.#logger.warn('Failed to dispatch error event', dispatchError);
    }
  }

  /**
   * Clear all caches
   */
  clearAllCaches() {
    try {
      this.#cacheManager.clearAll();
      this.#logger.info('All activity description caches cleared');
    } catch (error) {
      this.#logger.error('Failed to clear caches', error);
    }
  }

  /**
   * Invalidate cache for specific entity
   *
   * @param {string} entityId - Entity ID
   */
  invalidateCache(entityId) {
    if (!entityId) {
      this.#logger.warn('Cannot invalidate cache: entityId is required');
      return;
    }

    try {
      this.#cacheManager.invalidate('entityName', entityId);
      this.#cacheManager.invalidate('gender', entityId);
      this.#cacheManager.invalidate('activityIndex', entityId);
      this.#cacheManager.invalidate('closeness', entityId);
      this.#logger.debug(`Cache invalidated for entity: ${entityId}`);
    } catch (error) {
      this.#logger.error(`Failed to invalidate cache for ${entityId}`, error);
    }
  }

  /**
   * Invalidate caches for multiple entities
   *
   * @param {string[]} entityIds - Array of entity IDs
   */
  invalidateEntities(entityIds) {
    if (!Array.isArray(entityIds) || entityIds.length === 0) {
      return;
    }

    entityIds.forEach((entityId) => {
      this.invalidateCache(entityId);
    });
  }

  /**
   * Clean up resources
   */
  destroy() {
    try {
      // Unsubscribe from events
      this.#eventUnsubscribers.forEach((unsub) => {
        try {
          unsub();
        } catch (error) {
          this.#logger.warn('Failed to unsubscribe from event', error);
        }
      });
      this.#eventUnsubscribers = [];

      // Destroy cache manager
      if (
        this.#cacheManager &&
        typeof this.#cacheManager.destroy === 'function'
      ) {
        this.#cacheManager.destroy();
      }

      this.#logger.info('ActivityDescriptionFacade destroyed');
    } catch (error) {
      this.#logger.error('Error during facade destruction', error);
    }
  }

  /**
   * Get test hooks for testing (maintains backward compatibility)
   * Delegates to individual service test hooks
   *
   * @returns {object} Test hooks object
   */
  getTestHooks() {
    return {
      // Delegate to each service's test hooks
      ...(this.#nlgSystem.getTestHooks?.() || {}),
      ...(this.#groupingSystem.getTestHooks?.() || {}),
      ...(this.#contextBuildingSystem.getTestHooks?.() || {}),
      ...(this.#filteringSystem.getTestHooks?.() || {}),
      ...(this.#metadataCollectionSystem.getTestHooks?.() || {}),

      // Facade-specific hooks
      clearAllCaches: () => this.clearAllCaches(),
      invalidateCache: (entityId) => this.invalidateCache(entityId),
      invalidateEntities: (entityIds) => this.invalidateEntities(entityIds),
      getActivityIntegrationConfig: () => this.#getActivityIntegrationConfig(),
      registerEventUnsubscriber: (unsubscribeFn) => {
        if (typeof unsubscribeFn === 'function') {
          this.#eventUnsubscribers.push(unsubscribeFn);
        }
      },
    };
  }
}

export default ActivityDescriptionFacade;
