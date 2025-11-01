/**
 * @file Activity Index Management System
 * @description Optimizes activity lookups via pre-computed indexes with caching support.
 * Extracted from ActivityDescriptionService for better separation of concerns.
 * @see activityDescriptionService.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Manages activity indexing with caching support.
 *
 * Creates optimized data structures for fast activity lookups:
 * - byTarget: Index activities by target entity ID
 * - byPriority: Sort activities by descending priority
 * - byGroupKey: Index activities by grouping key
 * - all: Complete activity collection
 *
 * Integrates with ActivityCacheManager for performance optimization.
 */
class ActivityIndexManager {
  #cacheManager;

  /**
   * Create an ActivityIndexManager instance.
   *
   * @param {object} dependencies - Dependency injection container
   * @param {object} dependencies.cacheManager - Activity cache manager instance
   * @param {object} dependencies.logger - Logger instance
   */
  constructor({ cacheManager, logger }) {
    validateDependency(cacheManager, 'ActivityCacheManager', logger, {
      requiredMethods: ['get', 'set'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#cacheManager = cacheManager;
  }

  /**
   * Build activity index structure for optimized lookups.
   *
   * Creates multiple indexes:
   * - byTarget: Map of target IDs to activity arrays
   * - byPriority: Array sorted by priority (descending)
   * - byGroupKey: Map of group keys to activity arrays
   * - all: Complete unmodified activity array
   *
   * @param {Array<object>} activities - Activities to index
   * @returns {object} Index structure with multiple access patterns
   * @example
   * const index = indexManager.buildActivityIndex([
   *   { targetId: 'actor1', priority: 10, grouping: { groupKey: 'combat' } },
   *   { targetId: 'actor2', priority: 5 }
   * ]);
   * // index.byTarget.get('actor1') => [activity1]
   * // index.byPriority => [activity1, activity2] (sorted by priority)
   * // index.byGroupKey.get('combat') => [activity1]
   */
  buildActivityIndex(activities) {
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

      // Index by target
      if (!index.byTarget.has(targetId)) {
        index.byTarget.set(targetId, []);
      }
      index.byTarget.get(targetId).push(activity);

      // Index by grouping key
      const groupKey = activity?.grouping?.groupKey;
      if (groupKey) {
        if (!index.byGroupKey.has(groupKey)) {
          index.byGroupKey.set(groupKey, []);
        }
        index.byGroupKey.get(groupKey).push(activity);
      }
    }

    // Sort by priority (descending)
    const fallbackPriority = Number.NEGATIVE_INFINITY;
    const prioritizedActivities = activities.map((activity) => ({
      activity,
      priority:
        typeof activity?.priority === 'number'
          ? activity.priority
          : fallbackPriority,
    }));

    prioritizedActivities.sort((a, b) => b.priority - a.priority);
    index.byPriority = prioritizedActivities.map(({ activity }) => activity);

    return index;
  }

  /**
   * Generate deterministic signature for activity collections.
   *
   * Creates a signature string encoding key activity properties:
   * - type: Activity type
   * - sourceComponent: Source component ID
   * - descriptionType: Description type (fallback)
   * - targetId: Target entity ID
   * - priority: Priority value
   *
   * Used for cache validation to detect changes in activity collections.
   *
   * @param {Array<object>} activities - Activities to sign
   * @returns {string} Signature in format "type:source:target:priority|..." for all activities
   * @example
   * const signature = indexManager.buildActivitySignature([
   *   { type: 'combat', sourceComponent: 'core:attack', targetId: 'enemy', priority: 10 }
   * ]);
   * // Returns: "combat:core:attack:enemy:10"
   */
  buildActivitySignature(activities) {
    return activities
      .map((activity) => {
        const normalizedActivity = activity ?? {};
        let source = 'unknown';
        if (
          normalizedActivity.sourceComponent !== null &&
          normalizedActivity.sourceComponent !== undefined
        ) {
          source = normalizedActivity.sourceComponent;
        } else if (
          normalizedActivity.descriptionType !== null &&
          normalizedActivity.descriptionType !== undefined
        ) {
          source = normalizedActivity.descriptionType;
        }
        const target =
          normalizedActivity.targetEntityId ??
          normalizedActivity.targetId ??
          'solo';
        const priority = normalizedActivity.priority ?? 50;
        const type = normalizedActivity.type ?? 'generic';
        return `${type}:${source}:${target}:${priority}`;
      })
      .join('|');
  }

  /**
   * Build cache key for activity index storage.
   *
   * Creates a namespaced cache key combining:
   * - namespace: Cache category (e.g., 'entity_activities')
   * - entityId: Entity identifier for differentiation
   *
   * @param {string} namespace - Cache namespace
   * @param {string} entityId - Entity identifier
   * @returns {string} Cache key in format "namespace:entityId"
   * @example
   * const cacheKey = indexManager.buildActivityIndexCacheKey('entity_activities', 'actor123');
   * // Returns: "entity_activities:actor123"
   */
  buildActivityIndexCacheKey(namespace, entityId) {
    return `${namespace}:${entityId ?? 'unknown'}`;
  }

  /**
   * Get or build activity index with caching support.
   *
   * Caching logic:
   * 1. If no cacheKey provided, build index without caching
   * 2. Generate signature for current activities
   * 3. Check cache for entry with matching signature
   * 4. If found and signature matches, return cached index
   * 5. Otherwise, build new index and cache with signature
   *
   * Signature validation ensures cached indexes remain valid
   * when activity collections change.
   *
   * @param {Array<object>} activities - Activities to index
   * @param {string|null} cacheKey - Optional cache key for result storage
   * @returns {object} Index structure (cached or freshly built)
   * @example
   * // Without caching
   * const index1 = indexManager.getActivityIndex(activities);
   *
   * // With caching
   * const index2 = indexManager.getActivityIndex(activities, 'entity:actor123');
   * // Subsequent calls with same key and activities return cached index
   */
  getActivityIndex(activities, cacheKey = null) {
    if (!Array.isArray(activities) || activities.length === 0) {
      return {
        byTarget: new Map(),
        byPriority: [],
        byGroupKey: new Map(),
        all: Array.isArray(activities) ? activities : [],
      };
    }

    if (!cacheKey) {
      return this.buildActivityIndex(activities);
    }

    const signature = this.buildActivitySignature(activities);
    const cachedEntry = this.#cacheManager.get('activityIndex', cacheKey);

    if (cachedEntry && cachedEntry.signature === signature) {
      return cachedEntry.index;
    }

    const index = this.buildActivityIndex(activities);
    this.#cacheManager.set('activityIndex', cacheKey, {
      signature,
      index,
    });

    return index;
  }

  /**
   * Alias for getActivityIndex for backward compatibility.
   * ActivityGroupingSystem expects this method name.
   *
   * @param {Array<object>} activities - Activities to index
   * @param {string|null} cacheKey - Optional cache key for result storage
   * @returns {object} Index structure (cached or freshly built)
   */
  buildIndex(activities, cacheKey = null) {
    return this.getActivityIndex(activities, cacheKey);
  }
}

export default ActivityIndexManager;
