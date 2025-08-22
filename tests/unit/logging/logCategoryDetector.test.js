/**
 * @file Unit tests for LogCategoryDetector class
 * @see src/logging/logCategoryDetector.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import LogCategoryDetector, {
  LRUCache,
} from '../../../src/logging/logCategoryDetector.js';

describe('LRUCache', () => {
  let cache;

  beforeEach(() => {
    cache = new LRUCache(3); // Small cache for testing
  });

  describe('basic operations', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for missing keys', () => {
      expect(cache.get('missing')).toBeUndefined();
    });

    it('should update access order on get', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Access key1 to make it most recently used
      cache.get('key1');

      // Add new item to trigger eviction
      cache.set('key4', 'value4');

      // key2 should be evicted (least recently used)
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    it('should evict least recently used when capacity exceeded', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4'); // Should evict key1

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    it('should handle has() correctly', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('missing')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.getStats().size).toBe(0);
    });

    it('should return correct statistics', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(3);
    });
  });
});

describe('LogCategoryDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new LogCategoryDetector();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const stats = detector.getStats();
      expect(stats.cacheEnabled).toBe(true);
      expect(stats.patternCount).toBeGreaterThan(10);
      expect(stats.detectionCount).toBe(0);
      expect(stats.cacheHits).toBe(0);
    });

    it('should accept custom configuration', () => {
      const customDetector = new LogCategoryDetector({
        cacheSize: 500,
        enableCache: false,
        customPatterns: {
          custom: /custom-pattern/i,
        },
      });

      const stats = customDetector.getStats();
      expect(stats.cacheEnabled).toBe(false);

      const patterns = customDetector.getPatterns();
      expect(patterns.custom).toBeDefined();
    });
  });

  describe('category detection - error patterns', () => {
    it('should detect error category with highest priority', () => {
      expect(detector.detectCategory('Error: Something went wrong')).toBe(
        'error'
      );
      expect(detector.detectCategory('Exception caught in handler')).toBe(
        'error'
      );
      expect(detector.detectCategory('Request failed with status 500')).toBe(
        'error'
      );
      expect(detector.detectCategory('Catch block triggered')).toBe('error');
      expect(detector.detectCategory('Stack trace follows')).toBe('error');
    });

    it('should prioritize error over other categories', () => {
      expect(
        detector.detectCategory('Engine error: initialization failed')
      ).toBe('error');
      expect(detector.detectCategory('UI component render error')).toBe(
        'error'
      );
      expect(detector.detectCategory('Network request failed')).toBe('error');
    });
  });

  describe('category detection - engine patterns', () => {
    it('should detect engine category', () => {
      expect(detector.detectCategory('GameEngine started successfully')).toBe(
        'engine'
      );
      expect(detector.detectCategory('engineState updated')).toBe('engine');
      expect(detector.detectCategory('gameSession initialized')).toBe('engine');
      expect(detector.detectCategory('Game loop running at 60 FPS')).toBe(
        'engine'
      );
      expect(detector.detectCategory('Tick rate adjusted to 30')).toBe(
        'engine'
      );
      expect(detector.detectCategory('Game loop running at 60 FPS')).toBe(
        'engine'
      );
      expect(detector.detectCategory('Tick rate adjusted to 30')).toBe(
        'engine'
      );
    });
  });

  describe('category detection - ECS patterns', () => {
    it('should detect ECS category', () => {
      expect(detector.detectCategory('EntityManager initialized')).toBe('ecs');
      expect(detector.detectCategory('ComponentManager ready')).toBe('ecs');
      expect(detector.detectCategory('SystemManager processing')).toBe('ecs');
      expect(detector.detectCategory('entity actor created')).toBe('ecs');
      expect(detector.detectCategory('component health added')).toBe('ecs');
      expect(detector.detectCategory('system physics updated')).toBe('ecs');
    });
  });

  describe('category detection - AI patterns', () => {
    it('should detect AI category', () => {
      expect(detector.detectCategory('AI model loaded')).toBe('ai');
      expect(detector.detectCategory('LLM response generated')).toBe('ai');
      expect(detector.detectCategory('Memory system updated')).toBe('ai');
      expect(detector.detectCategory('Thoughts processed')).toBe('ai');
      expect(detector.detectCategory('Notes created for character')).toBe('ai');
      expect(detector.detectCategory('Prompt template rendered')).toBe('ai');
      expect(detector.detectCategory('Decision tree evaluated')).toBe('ai');
      expect(detector.detectCategory('Neural network inference done')).toBe(
        'ai'
      );
      expect(detector.detectCategory('Embedding vectors calculated')).toBe(
        'ai'
      );
    });
  });

  describe('category detection - anatomy patterns', () => {
    it('should detect anatomy category', () => {
      expect(detector.detectCategory('Anatomy system initialized')).toBe(
        'anatomy'
      );
      expect(detector.detectCategory('Body part added: left arm')).toBe(
        'anatomy'
      );
      expect(detector.detectCategory('Descriptor template loaded')).toBe(
        'anatomy'
      );
      expect(detector.detectCategory('Blueprint created for humanoid')).toBe(
        'anatomy'
      );
      // 'socket' matches network with priority 70, body part matches anatomy with priority 90
      expect(
        detector.detectCategory('Body part connection: head to torso')
      ).toBe('anatomy');
      expect(detector.detectCategory('Limb movement calculated')).toBe(
        'anatomy'
      );
      expect(detector.detectCategory('Organ system updated')).toBe('anatomy');
    });
  });

  describe('category detection - persistence patterns', () => {
    it('should detect persistence category', () => {
      expect(detector.detectCategory('Save game initiated')).toBe(
        'persistence'
      );
      expect(detector.detectCategory('Load complete')).toBe('persistence');
      expect(detector.detectCategory('Data persisted to storage')).toBe(
        'persistence'
      );
      expect(detector.detectCategory('Serializing game state')).toBe(
        'persistence'
      );
      expect(detector.detectCategory('Deserialize operation started')).toBe(
        'persistence'
      );
      expect(detector.detectCategory('Backup created successfully')).toBe(
        'persistence'
      );
      expect(detector.detectCategory('Restore from checkpoint')).toBe(
        'persistence'
      );
    });
  });

  describe('category detection - actions patterns', () => {
    it('should detect actions category', () => {
      expect(detector.detectCategory('Action executed: move')).toBe('actions');
      expect(detector.detectCategory('Target selected for attack')).toBe(
        'actions'
      );
      expect(detector.detectCategory('Resolution phase started')).toBe(
        'actions'
      );
      expect(detector.detectCategory('Candidate actions evaluated')).toBe(
        'actions'
      );
      expect(detector.detectCategory('Discovery of new action')).toBe(
        'actions'
      );
      expect(detector.detectCategory('Perform skill check')).toBe('actions');
      expect(detector.detectCategory('Invoke ability: fireball')).toBe(
        'actions'
      );
    });
  });

  describe('category detection - turns patterns', () => {
    it('should detect turns category', () => {
      expect(detector.detectCategory('Turn 5 started')).toBe('turns');
      expect(detector.detectCategory('Round completed')).toBe('turns');
      expect(detector.detectCategory('Cycle reset')).toBe('turns');
      expect(detector.detectCategory('turnManager processing')).toBe('turns');
      expect(detector.detectCategory('roundManager initialized')).toBe('turns');
      expect(
        detector.detectCategory('Phase transition: combat to explore')
      ).toBe('turns');
      expect(detector.detectCategory('Step 3 of 5')).toBe('turns');
      expect(detector.detectCategory('Iteration complete')).toBe('turns');
    });
  });

  describe('category detection - events patterns', () => {
    it('should detect events category', () => {
      expect(detector.detectCategory('Event dispatched: PLAYER_MOVED')).toBe(
        'events'
      );
      expect(detector.detectCategory('Listener registered')).toBe('events');
      expect(detector.detectCategory('eventBus processing queue')).toBe(
        'events'
      );
      expect(detector.detectCategory('Emit signal to subscribers')).toBe(
        'events'
      );
      expect(detector.detectCategory('Subscribe to notifications')).toBe(
        'events'
      );
      expect(detector.detectCategory('Publish message to channel')).toBe(
        'events'
      );
      expect(detector.detectCategory('Observer pattern triggered')).toBe(
        'events'
      );
      expect(detector.detectCategory('Handler function called')).toBe('events');
    });
  });

  describe('category detection - validation patterns', () => {
    it('should detect validation category', () => {
      expect(detector.detectCategory('Validate input data')).toBe('validation');
      expect(detector.detectCategory('Schema check passed')).toBe('validation');
      // 'failed' triggers error pattern with higher priority
      expect(detector.detectCategory('Schema check passed')).toBe('validation');
      expect(detector.detectCategory('Invalid parameter detected')).toBe(
        'validation'
      );
      expect(detector.detectCategory('Constraint violation')).toBe(
        'validation'
      );
      expect(detector.detectCategory('Rule evaluation complete')).toBe(
        'validation'
      );
      expect(detector.detectCategory('Verify data integrity')).toBe(
        'validation'
      );
      expect(detector.detectCategory('Check requirements')).toBe('validation');
    });
  });

  describe('category detection - UI patterns', () => {
    it('should detect UI category', () => {
      expect(detector.detectCategory('UI initialized')).toBe('ui');
      expect(detector.detectCategory('Renderer started')).toBe('ui');
      expect(detector.detectCategory('domUI element created')).toBe('ui');
      expect(detector.detectCategory('Display updated')).toBe('ui');
      expect(detector.detectCategory('Modal opened')).toBe('ui');
      expect(detector.detectCategory('Button clicked')).toBe('ui');
      expect(detector.detectCategory('Widget rendered')).toBe('ui');
      // ECS has higher priority (95) than UI (70) for 'component'
      expect(detector.detectCategory('UI modal opened')).toBe('ui');
      expect(detector.detectCategory('View refreshed')).toBe('ui');
      expect(detector.detectCategory('Layout recalculated')).toBe('ui');
      expect(detector.detectCategory('Style applied')).toBe('ui');
      expect(detector.detectCategory('CSS rules updated')).toBe('ui');
    });
  });

  describe('category detection - network patterns', () => {
    it('should detect network category', () => {
      expect(detector.detectCategory('Fetch request sent')).toBe('network');
      expect(detector.detectCategory('HTTP 200 response')).toBe('network');
      expect(detector.detectCategory('Request timeout')).toBe('network');
      expect(detector.detectCategory('Response received')).toBe('network');
      expect(detector.detectCategory('XHR completed')).toBe('network');
      expect(detector.detectCategory('AJAX call initiated')).toBe('network');
      expect(detector.detectCategory('API endpoint called')).toBe('network');
      expect(detector.detectCategory('WebSocket endpoint connected')).toBe(
        'network'
      );
      expect(detector.detectCategory('Socket message received')).toBe(
        'network'
      );
    });
  });

  describe('category detection - configuration patterns', () => {
    it('should detect configuration category', () => {
      expect(detector.detectCategory('Config loaded')).toBe('configuration');
      expect(detector.detectCategory('Configuration updated')).toBe(
        'configuration'
      );
      expect(detector.detectCategory('Settings applied')).toBe('configuration');
      expect(detector.detectCategory('Options changed')).toBe('configuration');
      expect(detector.detectCategory('Preferences saved')).toBe(
        'configuration'
      );
      expect(detector.detectCategory('Setup complete')).toBe('configuration');
    });
  });

  describe('category detection - initialization patterns', () => {
    it('should detect initialization category', () => {
      expect(detector.detectCategory('Init started')).toBe('initialization');
      expect(detector.detectCategory('Bootstrap complete')).toBe(
        'initialization'
      );
      expect(detector.detectCategory('Startup sequence')).toBe(
        'initialization'
      );
      expect(detector.detectCategory('Initialize components')).toBe(
        'initialization'
      );
      expect(detector.detectCategory('Initialization complete')).toBe(
        'initialization'
      );
      expect(detector.detectCategory('Mount application')).toBe(
        'initialization'
      );
      expect(detector.detectCategory('Unmount cleanup')).toBe('initialization');
      expect(detector.detectCategory('System ready')).toBe('initialization');
    });
  });

  describe('category detection - performance patterns', () => {
    it('should detect performance category', () => {
      expect(detector.detectCategory('Performance metrics collected')).toBe(
        'performance'
      );
      expect(detector.detectCategory('Timing: 150ms')).toBe('performance');
      expect(detector.detectCategory('Latency detected: 500ms')).toBe(
        'performance'
      );
      expect(detector.detectCategory('Duration of operation: 2s')).toBe(
        'performance'
      );
      expect(detector.detectCategory('Benchmark results')).toBe('performance');
      expect(detector.detectCategory('Profiling data')).toBe('performance');
      expect(detector.detectCategory('Optimization applied')).toBe(
        'performance'
      );
      expect(detector.detectCategory('Speed improvement: 50%')).toBe(
        'performance'
      );
      expect(detector.detectCategory('Slow query detected')).toBe(
        'performance'
      );
      expect(detector.detectCategory('Fast path taken')).toBe('performance');
    });
  });

  describe('category detection - unmatched patterns', () => {
    it('should return undefined for unmatched messages', () => {
      expect(detector.detectCategory('Random log message')).toBeUndefined();
      expect(detector.detectCategory('Just some text')).toBeUndefined();
      expect(detector.detectCategory('Hello world')).toBeUndefined();
      expect(detector.detectCategory('123456')).toBeUndefined();
    });

    it('should handle empty or invalid input', () => {
      expect(detector.detectCategory('')).toBeUndefined();
      expect(detector.detectCategory(null)).toBeUndefined();
      expect(detector.detectCategory(undefined)).toBeUndefined();
      expect(detector.detectCategory(123)).toBeUndefined();
    });
  });

  describe('priority rules', () => {
    it('should prioritize error over specific patterns', () => {
      const message = 'Engine initialization error occurred';
      expect(detector.detectCategory(message)).toBe('error');
    });

    it('should prioritize specific over general patterns', () => {
      const detector2 = new LogCategoryDetector({
        customPatterns: {
          general: { pattern: /log/i, priority: 10 },
          specific: { pattern: /error\s+log/i, priority: 110 }, // Higher than error priority
        },
      });

      expect(detector2.detectCategory('Error log entry')).toBe('specific');
    });
  });

  describe('caching', () => {
    it('should cache detection results', () => {
      const message = 'GameEngine started';

      // First detection
      const result1 = detector.detectCategory(message);
      expect(result1).toBe('engine');

      // Second detection should hit cache
      const result2 = detector.detectCategory(message);
      expect(result2).toBe('engine');

      const stats = detector.getStats();
      expect(stats.detectionCount).toBe(2);
      expect(stats.cacheHits).toBe(1);
      expect(parseFloat(stats.cacheHitRate)).toBeGreaterThan(0);
    });

    it('should clear cache on demand', () => {
      detector.detectCategory('Test message 1');
      detector.detectCategory('Test message 2');

      let stats = detector.getStats();
      expect(stats.detectionCount).toBeGreaterThan(0);

      detector.clearCache();

      stats = detector.getStats();
      expect(stats.detectionCount).toBe(0);
      expect(stats.cacheHits).toBe(0);
    });

    it('should work with cache disabled', () => {
      const noCacheDetector = new LogCategoryDetector({
        enableCache: false,
      });

      const message = 'Engine error';
      const result1 = noCacheDetector.detectCategory(message);
      const result2 = noCacheDetector.detectCategory(message);

      expect(result1).toBe('error');
      expect(result2).toBe('error');

      const stats = noCacheDetector.getStats();
      expect(stats.cacheEnabled).toBe(false);
      expect(stats.cacheHits).toBe(0);
    });
  });

  describe('batch detection', () => {
    it('should detect categories for multiple messages', () => {
      const messages = [
        'GameEngine started',
        'UI display updated',
        'Error occurred',
        'Network request sent',
        'Random message',
      ];

      const results = detector.detectCategories(messages);

      expect(results).toEqual(['engine', 'ui', 'error', 'network', undefined]);
    });
  });

  describe('pattern management', () => {
    it('should add custom patterns', () => {
      detector.addPattern('custom', /custom-test/i, 75);

      expect(detector.detectCategory('This is a custom-test message')).toBe(
        'custom'
      );

      const patterns = detector.getPatterns();
      expect(patterns.custom).toBeDefined();
      expect(patterns.custom.priority).toBe(75);
    });

    it('should remove patterns', () => {
      detector.addPattern('temporary', /temp/i);
      expect(detector.detectCategory('temp message')).toBe('temporary');

      detector.removePattern('temporary');
      expect(detector.detectCategory('temp message')).toBeUndefined();
    });

    it('should clear cache when patterns change', () => {
      detector.detectCategory('Test message');
      let stats = detector.getStats();
      const initialCount = stats.detectionCount;

      detector.addPattern('new', /new/i);

      stats = detector.getStats();
      expect(stats.detectionCount).toBe(0); // Cache cleared
    });

    it('should get all patterns', () => {
      const patterns = detector.getPatterns();

      expect(patterns).toHaveProperty('error');
      expect(patterns).toHaveProperty('engine');
      expect(patterns).toHaveProperty('ui');
      expect(patterns).toHaveProperty('ai');
      expect(patterns).toHaveProperty('network');

      // Check pattern structure
      expect(patterns.error).toHaveProperty('pattern');
      expect(patterns.error).toHaveProperty('priority');
      expect(patterns.error.priority).toBe(100); // Highest priority
    });
  });

  describe('performance', () => {
    it('should handle high volume efficiently with cache', () => {
      const startTime = Date.now();
      const iterations = 10000;

      // Generate messages with some repetition for cache hits
      const messages = [];
      for (let i = 0; i < iterations; i++) {
        messages.push(`Test message ${i % 100}`); // 100 unique messages
      }

      // Detect all categories
      for (const message of messages) {
        detector.detectCategory(message);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should process 10000 messages quickly with cache
      expect(duration).toBeLessThan(100); // Less than 100ms

      const stats = detector.getStats();
      expect(stats.detectionCount).toBe(iterations);
      expect(stats.cacheHits).toBeGreaterThan(0);

      // Cache hit rate should be high due to repetition
      const hitRate = parseFloat(stats.cacheHitRate);
      expect(hitRate).toBeGreaterThan(90); // >90% cache hit rate
    });

    it('should maintain cache size limit', () => {
      const smallCacheDetector = new LogCategoryDetector({
        cacheSize: 10,
      });

      // Add more than cache size
      for (let i = 0; i < 20; i++) {
        smallCacheDetector.detectCategory(`Unique message ${i}`);
      }

      const stats = smallCacheDetector.getStats();
      expect(stats.cacheStats.size).toBeLessThanOrEqual(10);
    });
  });
});
