/**
 * @file Character Builder Event Constants
 * @description Shared event type definitions with no dependencies
 *
 * This file contains all event constants for the character builder system,
 * extracted to break circular dependencies between the service, cache manager,
 * and cache helpers.
 *
 * NOTE: These constants are extracted from characterBuilderService.js (lines 50-100).
 * This list represents the ACTUAL events in the codebase as of 2025-10-04.
 * @see src/characterBuilder/services/characterBuilderService.js
 * @see src/characterBuilder/cache/CoreMotivationsCacheManager.js
 */

/**
 * Character builder event types
 *
 * @enum {string}
 * All event constants for the character builder system organized by category.
 * Extracted from characterBuilderService.js to eliminate circular dependencies.
 */
export const CHARACTER_BUILDER_EVENTS = {
  // Cache events (4 events)
  CACHE_INITIALIZED: 'core:cache_initialized',
  CACHE_HIT: 'core:cache_hit',
  CACHE_MISS: 'core:cache_miss',
  CACHE_EVICTED: 'core:cache_evicted',

  // Concept events (4 events)
  CONCEPT_CREATED: 'core:character_concept_created',
  CONCEPT_UPDATED: 'core:character_concept_updated',
  CONCEPT_SAVED: 'core:character_concept_saved',
  CONCEPT_DELETED: 'core:character_concept_deleted',

  // Direction events (3 events)
  DIRECTIONS_GENERATED: 'core:thematic_directions_generated',
  DIRECTION_UPDATED: 'core:direction_updated',
  DIRECTION_DELETED: 'core:direction_deleted',

  // Error events (1 event)
  ERROR_OCCURRED: 'core:character_builder_error_occurred',

  // Cliché events (10 events)
  CLICHES_RETRIEVED: 'core:cliches_retrieved',
  CLICHES_RETRIEVAL_FAILED: 'core:cliches_retrieval_failed',
  CLICHES_STORED: 'core:cliches_stored',
  CLICHES_STORAGE_FAILED: 'core:cliches_storage_failed',
  CLICHES_GENERATION_STARTED: 'core:cliches_generation_started',
  CLICHES_GENERATION_COMPLETED: 'core:cliches_generation_completed',
  CLICHES_GENERATION_FAILED: 'core:cliches_generation_failed',
  CLICHES_DELETED: 'core:cliches_deleted',
  CLICHE_ITEM_DELETED: 'core:cliche_item_deleted',
  CLICHE_TROPE_DELETED: 'core:cliche_trope_deleted',

  // Core motivations events (4 events)
  CORE_MOTIVATIONS_GENERATION_STARTED:
    'core:core_motivations_generation_started',
  CORE_MOTIVATIONS_GENERATION_COMPLETED:
    'core:core_motivations_generation_completed',
  CORE_MOTIVATIONS_GENERATION_FAILED: 'core:core_motivations_generation_failed',
  CORE_MOTIVATIONS_RETRIEVED: 'core:core_motivations_retrieved',

  // Speech patterns events (5 events)
  SPEECH_PATTERNS_GENERATION_STARTED: 'core:speech_patterns_generation_started',
  SPEECH_PATTERNS_GENERATION_COMPLETED:
    'core:speech_patterns_generation_completed',
  SPEECH_PATTERNS_GENERATION_FAILED: 'core:speech_patterns_generation_failed',
  SPEECH_PATTERNS_CACHE_HIT: 'core:speech_patterns_cache_hit',
  SPEECH_PATTERNS_GENERATION_RETRY: 'core:speech_patterns_generation_retry',

  // Traits rewriter events (4 events)
  TRAITS_REWRITER_GENERATION_STARTED: 'core:traits_rewriter_generation_started',
  TRAITS_REWRITER_GENERATION_COMPLETED:
    'core:traits_rewriter_generation_completed',
  TRAITS_REWRITER_GENERATION_FAILED: 'core:traits_rewriter_generation_failed',
  TRAITS_REWRITER_CACHE_HIT: 'core:traits_rewriter_cache_hit',

  // Circuit breaker events (1 event)
  CIRCUIT_BREAKER_OPENED: 'core:circuit_breaker_opened',

  // Performance events (1 event)
  CHARACTER_BUILDER_PERFORMANCE_WARNING:
    'core:character_builder_performance_warning',
};

/**
 * Type definition for character builder events
 *
 * @typedef {string} CharacterBuilderEvent
 */

export {};
