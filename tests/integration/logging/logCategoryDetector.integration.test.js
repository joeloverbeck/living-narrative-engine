/**
 * @file Integration tests for LogCategoryDetector to verify end-to-end behaviour with
 *       real logging collaborators like ConsoleLogger and LogFilter.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import LogCategoryDetector from '../../../src/logging/logCategoryDetector.js';
import LogFilter from '../../../src/logging/logFilter.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';

describe('LogCategoryDetector integration', () => {
  let consoleSpies;

  beforeEach(() => {
    consoleSpies = {
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
      groupCollapsed: jest
        .spyOn(console, 'groupCollapsed')
        .mockImplementation(() => {}),
      groupEnd: jest.spyOn(console, 'groupEnd').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    Object.values(consoleSpies).forEach((spy) => spy.mockRestore());
  });

  it('categorizes log streams and cooperates with LogFilter for domain segmentation', () => {
    const detector = new LogCategoryDetector();
    const logger = new ConsoleLogger('DEBUG');
    const onFilterChange = jest.fn();
    const filter = new LogFilter({ logger, callbacks: { onFilterChange } });

    const rawMessages = [
      { message: 'GameEngine initialization complete', metadata: {} },
      { message: 'AI model loaded and inference ready', metadata: {} },
      { message: 'Network request successfully completed', metadata: {} },
      { message: 'Validation schema applied to actor payload', metadata: {} },
      {
        message: 'Engine performance metrics indicate improvement',
        metadata: {},
      },
    ];

    const enrichedLogs = rawMessages.map(({ message, metadata }, index) => ({
      id: `log-${index}`,
      level: 'info',
      timestamp: new Date(Date.now() - index * 1000).toISOString(),
      message,
      category: detector.detectCategory(message, metadata),
    }));

    filter.setLogs(enrichedLogs);
    expect(onFilterChange).toHaveBeenCalled();
    expect(filter.getCategories()).toEqual(
      expect.arrayContaining(['all', 'engine', 'ai', 'network', 'validation'])
    );

    filter.setFilter({ category: 'ai' });
    const aiLogs = filter.getFilteredLogs();
    expect(aiLogs).toHaveLength(1);
    expect(aiLogs[0].message).toContain('AI model loaded');

    const batchCategories = detector.detectCategories(
      [
        'Event dispatch pipeline finished without issues',
        'Configuration module reloaded successfully',
      ],
      [{}, { categoryHint: 'configuration' }]
    );
    expect(batchCategories).toEqual(['events', 'configuration']);

    const stats = detector.getStats();
    expect(stats.detectionCount).toBe(enrichedLogs.length + 2);
    expect(stats.cacheEnabled).toBe(true);
    expect(stats.patternCount).toBeGreaterThan(10);
  });

  it('reuses hashed cache keys while honouring metadata fallbacks and source overrides', () => {
    const detector = new LogCategoryDetector();

    // Initial detection builds the cache entry
    const firstCategory = detector.detectCategory(
      'Engine startup sequence engaged'
    );
    expect(firstCategory).toBe('engine');

    // Repeat detection should be served from cache (hit rate > 0)
    const secondCategory = detector.detectCategory(
      'Engine startup sequence engaged'
    );
    expect(secondCategory).toBe('engine');

    const statsAfterRepeat = detector.getStats();
    expect(statsAfterRepeat.detectionCount).toBe(2);
    expect(statsAfterRepeat.cacheHits).toBe(1);
    expect(statsAfterRepeat.cacheHitRate).toBe('50.00%');

    // Metadata hint takes precedence when valid
    const hintedCategory = detector.detectCategory('arbitrary text', {
      categoryHint: 'ai',
    });
    expect(hintedCategory).toBe('ai');

    // Invalid hints fall back to pattern detection
    const invalidHintCategory = detector.detectCategory(
      'Anatomy blueprint created for new entity',
      { categoryHint: 'not-a-real-hint' }
    );
    expect(invalidHintCategory).toBe('anatomy');

    const nonStringHintCategory = detector.detectCategory(
      'Fallback behaviour for numeric hint',
      { categoryHint: 123 }
    );
    expect(nonStringHintCategory).toBeUndefined();

    const levelHintCategory = detector.detectCategory('explicit error hint', {
      categoryHint: 'error',
    });
    expect(levelHintCategory).toBe('error');

    // Level metadata wins over patterns
    const warningCategory = detector.detectCategory(
      'Potential issue detected',
      {
        level: 'warn',
      }
    );
    expect(warningCategory).toBe('warning');

    const errorLevelCategory = detector.detectCategory(
      'Critical failure event',
      {
        level: 'error',
      }
    );
    expect(errorLevelCategory).toBe('error');

    // Metadata contributes to hash-based cache keys as well
    const metadataDriven = detector.detectCategory(
      'Action pipeline executing additional phase',
      { sourceCategory: 'actions', context: 'pipeline-v2' }
    );
    expect(metadataDriven).toBe('actions');
    const cachedMetadata = detector.detectCategory(
      'Action pipeline executing additional phase',
      { sourceCategory: 'actions', context: 'pipeline-v2' }
    );
    expect(cachedMetadata).toBe('actions');

    // Source based categorisation when explicitly enabled
    const sourceAwareDetector = new LogCategoryDetector({
      useSourceBased: true,
    });
    const sourceCategory = sourceAwareDetector.detectCategory(
      'fallback message',
      {
        sourceCategory: 'persistence',
      }
    );
    expect(sourceCategory).toBe('persistence');

    // Non-string inputs short circuit gracefully
    expect(detector.detectCategory(null)).toBeUndefined();

    // Detector without cache skips caching paths entirely
    const noCacheDetector = new LogCategoryDetector({ enableCache: false });
    expect(noCacheDetector.detectCategory('AI pipeline ready')).toBe('ai');
    expect(noCacheDetector.detectCategory('AI pipeline ready')).toBe('ai');
    const noCacheStats = noCacheDetector.getStats();
    expect(noCacheStats.cacheEnabled).toBe(false);
    expect(noCacheStats.cacheHits).toBe(0);
    expect(noCacheStats.cacheStats).toBeNull();
    noCacheDetector.clearCache();
  });

  it('supports dynamic pattern lifecycle and exposes helper views', () => {
    const detector = new LogCategoryDetector();

    detector.addPattern('galaxy', /galactic/i, 99);
    const customCategory = detector.detectCategory(
      'Galactic navigation engaged'
    );
    expect(customCategory).toBe('galaxy');

    detector.addPattern('cluster', /cluster/i);
    expect(
      detector.detectCategory('Cluster analysis underway with telemetry')
    ).toBe('cluster');

    const patterns = detector.getPatterns();
    expect(patterns.galaxy).toEqual(expect.objectContaining({ priority: 99 }));
    expect(patterns.galaxy.pattern).toContain('galactic');

    const validHints = detector.getValidCategoryHints();
    expect(validHints).toEqual(
      expect.arrayContaining(['galaxy', 'engine', 'error', 'warning'])
    );

    const multiDetection = detector.detectCategories(
      ['Galactic navigation engaged', 'GameEngine boot complete'],
      [{}, {}]
    );
    expect(multiDetection).toEqual(['galaxy', 'engine']);

    const sparseMetadataDetection = detector.detectCategories(
      ['Performance sweep complete', 'Network request fallback triggered'],
      [{}]
    );
    expect(sparseMetadataDetection).toEqual(['performance', 'network']);

    detector.removePattern('galaxy');
    expect(
      detector.detectCategory('Galactic navigation engaged')
    ).toBeUndefined();
    expect(
      detector.detectCategory('Galactic navigation engaged', {
        categoryHint: 'galaxy',
      })
    ).toBeUndefined();

    const regexPatternDetector = new LogCategoryDetector({
      customPatterns: {
        nebula: /nebula/i,
      },
    });
    expect(regexPatternDetector.detectCategory('Nebula drift observed')).toBe(
      'nebula'
    );

    const objectPatternDetector = new LogCategoryDetector({
      customPatterns: {
        stellar: { pattern: /stellar/i, priority: 80 },
      },
    });
    expect(
      objectPatternDetector.detectCategory('Stellar navigation engaged')
    ).toBe('stellar');
    objectPatternDetector.removePattern('network');
    const hintsWithFallback = objectPatternDetector.getValidCategoryHints();
    expect(hintsWithFallback).toEqual(
      expect.arrayContaining(['network', 'stellar'])
    );

    detector.clearCache();
    const clearedStats = detector.getStats();
    expect(clearedStats.detectionCount).toBe(0);
    expect(clearedStats.cacheHits).toBe(0);
  });
});
