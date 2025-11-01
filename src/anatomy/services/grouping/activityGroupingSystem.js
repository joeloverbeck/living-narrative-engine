/**
 * @file Activity Grouping System
 * @description Handles grouping of related activities using sequential pair-wise comparison.
 *              Extracted from ActivityDescriptionService (ACTDESSERREF-007).
 *
 * Algorithm: Sequential pair-wise comparison
 * - Iterate through prioritized activities
 * - Create a group with current activity as PRIMARY
 * - Compare PRIMARY against all remaining candidates
 * - Group activities with matching groupKey or targetId
 * - Select conjunction based on priority proximity (≤10 = "while", >10 = "and")
 * @see workflows/ACTDESSERREF-007-extract-activity-grouping.md
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * Manages activity grouping logic for the activity description system.
 * Uses sequential pair-wise comparison to group related activities.
 */
class ActivityGroupingSystem {
  #indexManager;
  #logger;
  #simultaneousPriorityThreshold;

  /**
   * @param {object} dependencies
   * @param {object} dependencies.indexManager - ActivityIndexManager for optimization
   * @param {object} dependencies.logger - Logger instance
   * @param {object} [dependencies.config] - Configuration options
   * @param {number} [dependencies.config.simultaneousPriorityThreshold] - Priority threshold for "while" conjunction
   */
  constructor({ indexManager, logger, config = {} }) {
    validateDependency(indexManager, 'IActivityIndexManager', logger, {
      requiredMethods: ['buildIndex'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#indexManager = indexManager;
    this.#logger = logger;
    this.#simultaneousPriorityThreshold =
      config.simultaneousPriorityThreshold ?? 10;
  }

  /**
   * Groups activities using sequential pair-wise comparison.
   *
   * Algorithm:
   * 1. Sort activities by priority (using activity index)
   * 2. Iterate through sorted list
   * 3. For each unprocessed activity, create a new group with it as PRIMARY
   * 4. Compare PRIMARY against all remaining unprocessed candidates
   * 5. Group candidates that match groupKey or targetId
   * 6. Determine conjunction based on priority proximity
   *
   * @param {Array} activities - Activities to group
   * @param {string|null} [cacheKey] - Cache key for index optimization
   * @returns {Array} Array of activity groups
   */
  groupActivities(activities, cacheKey = null) {
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
   * Sorts activities by priority using the activity index.
   *
   * @param {Array} activities - Activities to sort
   * @param {string|null} [cacheKey] - Cache key for index optimization
   * @returns {Array} Sorted activities by priority (highest first)
   */
  sortByPriority(activities, cacheKey = null) {
    const index = this.#getActivityIndex(activities, cacheKey);
    return index.byPriority;
  }

  /**
   * Creates a new activity group with the given activity as primary.
   *
   * @param {object} activity - Primary activity for the group
   * @returns {object} Activity group structure
   * @private
   */
  #startActivityGroup(activity) {
    return {
      primaryActivity: activity,
      relatedActivities: [],
    };
  }

  /**
   * Determines if two activities should be grouped together.
   * Activities are grouped if they share:
   * - Same explicit groupKey, OR
   * - Same targetEntityId/targetId
   *
   * @param {object} first - First activity (primary)
   * @param {object} second - Second activity (candidate)
   * @returns {boolean} True if activities should be grouped
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
   * Determines the conjunction to use when connecting two activities.
   * - "while": Activities occur simultaneously (priority difference ≤ threshold)
   * - "and": Activities occur sequentially (priority difference > threshold)
   *
   * @param {object} first - First activity
   * @param {object} second - Second activity
   * @returns {string} "while" or "and"
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
   * Determines if two activities occur simultaneously based on priority proximity.
   *
   * @param {number} firstPriority - Priority of first activity
   * @param {number} secondPriority - Priority of second activity
   * @returns {boolean} True if priorities are within threshold
   * @private
   */
  #activitiesOccurSimultaneously(firstPriority, secondPriority) {
    return (
      Math.abs((firstPriority ?? 0) - (secondPriority ?? 0)) <=
      this.#simultaneousPriorityThreshold
    );
  }

  /**
   * Gets the activity index for the given activities.
   * Delegates to ActivityIndexManager for building optimized indexes.
   *
   * @param {Array} activities - Activities to index
   * @param {string|null} [cacheKey] - Cache key for optimization
   * @returns {object} Activity index with byPriority, byTarget, byGroupKey
   * @private
   */
  #getActivityIndex(activities, cacheKey = null) {
    return this.#indexManager.buildIndex(activities, cacheKey);
  }

  /**
   * Provides access to internal methods for testing purposes.
   *
   * @returns {object} Test hooks
   */
  getTestHooks() {
    return {
      groupActivities: (...args) => this.groupActivities(...args),
      sortByPriority: (...args) => this.sortByPriority(...args),
      startActivityGroup: (activity) => this.#startActivityGroup(activity),
      shouldGroupActivities: (first, second) =>
        this.#shouldGroupActivities(first, second),
      determineConjunction: (first, second) =>
        this.#determineConjunction(first, second),
      activitiesOccurSimultaneously: (p1, p2) =>
        this.#activitiesOccurSimultaneously(p1, p2),
    };
  }
}

export default ActivityGroupingSystem;
