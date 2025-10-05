/**
 * @file Cache key generators and helpers for Core Motivations
 * @description Utility functions for cache key generation, invalidation, and warming
 */

/**
 * Cache key generators for Core Motivations
 */
export const CacheKeys = {
  // Concept keys
  concept: (id) => `concept_${id}`,
  allConcepts: () => 'all_concepts',

  // Direction keys
  direction: (id) => `direction_${id}`,
  directionsForConcept: (conceptId) => `directions_concept_${conceptId}`,

  // Cliché keys
  clichesForDirection: (directionId) => `cliches_${directionId}`,

  // Motivation keys
  motivationsForDirection: (directionId) => `motivations_${directionId}`,
  motivationsForConcept: (conceptId) => `motivations_concept_${conceptId}`,
  motivationStats: (conceptId) => `motivation_stats_${conceptId}`,

  // Generation keys
  generationInProgress: (directionId) => `generating_${directionId}`,
  lastGeneration: (directionId) => `last_gen_${directionId}`,
};

/**
 * Cache invalidation helpers
 */
export const CacheInvalidation = {
  /**
   * Invalidate all caches for a concept
   *
   * @param {object} cache - Cache manager instance
   * @param {string} conceptId - Concept ID
   */
  invalidateConcept(cache, conceptId) {
    cache.delete(CacheKeys.concept(conceptId));
    cache.delete(CacheKeys.allConcepts());
    cache.invalidatePattern(new RegExp(`concept_${conceptId}`));
  },

  /**
   * Invalidate all caches for a direction
   *
   * @param {object} cache - Cache manager instance
   * @param {string} directionId - Direction ID
   */
  invalidateDirection(cache, directionId) {
    cache.delete(CacheKeys.direction(directionId));
    cache.delete(CacheKeys.clichesForDirection(directionId));
    cache.delete(CacheKeys.motivationsForDirection(directionId));
    cache.invalidatePattern(new RegExp(`${directionId}`));
  },

  /**
   * Invalidate motivation caches
   *
   * @param {object} cache - Cache manager instance
   * @param {string} directionId - Direction ID
   * @param {string} [conceptId] - Optional concept ID
   */
  invalidateMotivations(cache, directionId, conceptId) {
    cache.delete(CacheKeys.motivationsForDirection(directionId));
    if (conceptId) {
      cache.delete(CacheKeys.motivationsForConcept(conceptId));
      cache.delete(CacheKeys.motivationStats(conceptId));
    }
  },
};

/**
 * Cache warming utilities
 */
export const CacheWarming = {
  /**
   * Pre-warm cache with frequently accessed data
   *
   * @param {object} cache - Cache manager instance
   * @param {object} service - Character builder service instance
   * @param {object} logger - Logger instance
   */
  async warmCache(cache, service, logger) {
    try {
      // Load all concepts
      const concepts = await service.getAllCharacterConcepts();
      if (concepts) {
        cache.set(CacheKeys.allConcepts(), concepts, 'concepts');
        logger.debug('Cache warmed with all concepts');
      }

      // Load recent concept and its data
      if (concepts && concepts.length > 0) {
        const recentConcept = concepts[concepts.length - 1];

        // Load directions for recent concept
        const directions = await service.getThematicDirectionsByConceptId(
          recentConcept.id
        );

        if (directions) {
          cache.set(
            CacheKeys.directionsForConcept(recentConcept.id),
            directions,
            'directions'
          );
          logger.debug(
            `Cache warmed with directions for concept ${recentConcept.id}`
          );
        }
      }
    } catch (error) {
      // Cache warming is best-effort, don't throw but log properly
      logger.warn('Cache warming failed:', error);
    }
  },
};
