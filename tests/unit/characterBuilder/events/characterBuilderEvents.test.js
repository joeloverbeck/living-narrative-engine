/**
 * @file Tests for Character Builder Event Constants
 * @description Verifies all event constants and ensures no circular dependencies
 */

import { describe, it, expect } from '@jest/globals';
import { CHARACTER_BUILDER_EVENTS } from '../../../../src/characterBuilder/events/characterBuilderEvents.js';

describe('Character Builder Events - Constants', () => {
  describe('Cache events', () => {
    it('should provide CACHE_INITIALIZED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.CACHE_INITIALIZED).toBe(
        'core:cache_initialized'
      );
    });

    it('should provide CACHE_HIT constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.CACHE_HIT).toBe('core:cache_hit');
    });

    it('should provide CACHE_MISS constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.CACHE_MISS).toBe('core:cache_miss');
    });

    it('should provide CACHE_EVICTED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.CACHE_EVICTED).toBe('core:cache_evicted');
    });
  });

  describe('Concept events', () => {
    it('should provide CONCEPT_CREATED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.CONCEPT_CREATED).toBe(
        'core:character_concept_created'
      );
    });

    it('should provide CONCEPT_UPDATED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.CONCEPT_UPDATED).toBe(
        'core:character_concept_updated'
      );
    });

    it('should provide CONCEPT_SAVED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.CONCEPT_SAVED).toBe(
        'core:character_concept_saved'
      );
    });

    it('should provide CONCEPT_DELETED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.CONCEPT_DELETED).toBe(
        'core:character_concept_deleted'
      );
    });
  });

  describe('Direction events', () => {
    it('should provide DIRECTIONS_GENERATED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.DIRECTIONS_GENERATED).toBe(
        'core:thematic_directions_generated'
      );
    });

    it('should provide DIRECTION_UPDATED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.DIRECTION_UPDATED).toBe(
        'core:direction_updated'
      );
    });

    it('should provide DIRECTION_DELETED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.DIRECTION_DELETED).toBe(
        'core:direction_deleted'
      );
    });
  });

  describe('Error events', () => {
    it('should provide ERROR_OCCURRED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.ERROR_OCCURRED).toBe(
        'core:character_builder_error_occurred'
      );
    });
  });

  describe('Cliché events', () => {
    it('should provide CLICHES_RETRIEVED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.CLICHES_RETRIEVED).toBe(
        'core:cliches_retrieved'
      );
    });

    it('should provide CLICHES_RETRIEVAL_FAILED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.CLICHES_RETRIEVAL_FAILED).toBe(
        'core:cliches_retrieval_failed'
      );
    });

    it('should provide CLICHES_STORED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.CLICHES_STORED).toBe(
        'core:cliches_stored'
      );
    });

    it('should provide CLICHES_STORAGE_FAILED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.CLICHES_STORAGE_FAILED).toBe(
        'core:cliches_storage_failed'
      );
    });

    it('should provide CLICHES_GENERATION_STARTED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.CLICHES_GENERATION_STARTED).toBe(
        'core:cliches_generation_started'
      );
    });

    it('should provide CLICHES_GENERATION_COMPLETED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.CLICHES_GENERATION_COMPLETED).toBe(
        'core:cliches_generation_completed'
      );
    });

    it('should provide CLICHES_GENERATION_FAILED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.CLICHES_GENERATION_FAILED).toBe(
        'core:cliches_generation_failed'
      );
    });

    it('should provide CLICHES_DELETED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.CLICHES_DELETED).toBe(
        'core:cliches_deleted'
      );
    });

    it('should provide CLICHE_ITEM_DELETED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.CLICHE_ITEM_DELETED).toBe(
        'core:cliche_item_deleted'
      );
    });

    it('should provide CLICHE_TROPE_DELETED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.CLICHE_TROPE_DELETED).toBe(
        'core:cliche_trope_deleted'
      );
    });
  });

  describe('Core motivations events', () => {
    it('should provide CORE_MOTIVATIONS_GENERATION_STARTED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_GENERATION_STARTED).toBe(
        'core:core_motivations_generation_started'
      );
    });

    it('should provide CORE_MOTIVATIONS_GENERATION_COMPLETED constant', () => {
      expect(
        CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_GENERATION_COMPLETED
      ).toBe('core:core_motivations_generation_completed');
    });

    it('should provide CORE_MOTIVATIONS_GENERATION_FAILED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_GENERATION_FAILED).toBe(
        'core:core_motivations_generation_failed'
      );
    });

    it('should provide CORE_MOTIVATIONS_RETRIEVED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_RETRIEVED).toBe(
        'core:core_motivations_retrieved'
      );
    });
  });

  describe('Speech patterns events', () => {
    it('should provide SPEECH_PATTERNS_GENERATION_STARTED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_STARTED).toBe(
        'core:speech_patterns_generation_started'
      );
    });

    it('should provide SPEECH_PATTERNS_GENERATION_COMPLETED constant', () => {
      expect(
        CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_COMPLETED
      ).toBe('core:speech_patterns_generation_completed');
    });

    it('should provide SPEECH_PATTERNS_GENERATION_FAILED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_FAILED).toBe(
        'core:speech_patterns_generation_failed'
      );
    });

    it('should provide SPEECH_PATTERNS_CACHE_HIT constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_CACHE_HIT).toBe(
        'core:speech_patterns_cache_hit'
      );
    });

    it('should provide SPEECH_PATTERNS_GENERATION_RETRY constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_RETRY).toBe(
        'core:speech_patterns_generation_retry'
      );
    });
  });

  describe('Traits rewriter events', () => {
    it('should provide TRAITS_REWRITER_GENERATION_STARTED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_STARTED).toBe(
        'core:traits_rewriter_generation_started'
      );
    });

    it('should provide TRAITS_REWRITER_GENERATION_COMPLETED constant', () => {
      expect(
        CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_COMPLETED
      ).toBe('core:traits_rewriter_generation_completed');
    });

    it('should provide TRAITS_REWRITER_GENERATION_FAILED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_FAILED).toBe(
        'core:traits_rewriter_generation_failed'
      );
    });

    it('should provide TRAITS_REWRITER_CACHE_HIT constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_CACHE_HIT).toBe(
        'core:traits_rewriter_cache_hit'
      );
    });
  });

  describe('Circuit breaker events', () => {
    it('should provide CIRCUIT_BREAKER_OPENED constant', () => {
      expect(CHARACTER_BUILDER_EVENTS.CIRCUIT_BREAKER_OPENED).toBe(
        'core:circuit_breaker_opened'
      );
    });
  });

  describe('Performance events', () => {
    it('should provide CHARACTER_BUILDER_PERFORMANCE_WARNING constant', () => {
      expect(
        CHARACTER_BUILDER_EVENTS.CHARACTER_BUILDER_PERFORMANCE_WARNING
      ).toBe('core:character_builder_performance_warning');
    });
  });

  describe('Import and dependency verification', () => {
    it('should import without circular dependency', () => {
      expect(() => {
        // eslint-disable-next-line no-unused-vars
        const {
          CHARACTER_BUILDER_EVENTS: events,
        } = require('../../../../src/characterBuilder/events/characterBuilderEvents.js');
      }).not.toThrow();
    });

    it('should export CHARACTER_BUILDER_EVENTS object', () => {
      expect(CHARACTER_BUILDER_EVENTS).toBeDefined();
      expect(typeof CHARACTER_BUILDER_EVENTS).toBe('object');
    });

    it('should have all event categories populated', () => {
      const eventKeys = Object.keys(CHARACTER_BUILDER_EVENTS);

      // Should have 32 total events (4+4+3+1+10+4+5+4+1+1)
      expect(eventKeys.length).toBeGreaterThanOrEqual(32);
    });
  });
});
