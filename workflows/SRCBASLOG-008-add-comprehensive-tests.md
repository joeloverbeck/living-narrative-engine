# SRCBASLOG-008: Add Comprehensive Tests

## Overview

Implement comprehensive test coverage for the source-based logging categorization system, including unit tests, integration tests, and performance benchmarks for all 40+ categories.

## Objectives

- Create unit tests for all new components
- Implement integration tests for end-to-end flow
- Add performance benchmarks for 40+ categories
- Test browser compatibility across all major browsers
- Ensure > 80% code coverage

## Dependencies

- SRCBASLOG-001 through SRCBASLOG-007: All implementation tickets

## Test Structure

### Test Organization

```
tests/
├── unit/
│   ├── logging/
│   │   ├── logMetadataEnricher.test.js
│   │   ├── logCategoryDetector.test.js
│   │   ├── stackTraceParser.test.js
│   │   ├── sourceExtractionCache.test.js
│   │   ├── hierarchicalWriteBuffer.test.js
│   │   └── fileHandlePool.test.js
│   └── migration/
│       ├── logRecategorizer.test.js
│       ├── migrationController.test.js
│       └── rollbackManager.test.js
├── integration/
│   ├── logging/
│   │   ├── sourceBasedCategorization.test.js
│   │   ├── levelBasedRouting.test.js
│   │   └── migrationFlow.test.js
│   └── server/
│       └── logStorageService.test.js
├── e2e/
│   ├── logging/
│   │   └── fullLoggingFlow.test.js
│   └── migration/
│       └── completeMigration.test.js
└── performance/
    ├── logging/
    │   ├── categorizationPerformance.test.js
    │   ├── fileIOPerformance.test.js
    │   └── cacheEfficiency.test.js
    └── migration/
        └── migrationPerformance.test.js
```

## Unit Tests

### 1. LogMetadataEnricher Tests

```javascript
// tests/unit/logging/logMetadataEnricher.test.js
import { describe, it, expect, beforeEach } from '@jest/globals';
import { LogMetadataEnricher } from '../../../src/logging/logMetadataEnricher.js';

describe('LogMetadataEnricher - Source Category Detection', () => {
  let enricher;
  
  beforeEach(() => {
    enricher = new LogMetadataEnricher();
  });
  
  describe('detectSourceCategory', () => {
    it('should extract category from actions directory', () => {
      const mockStack = `Error
        at ActionResolver.resolve (src/actions/actionResolver.js:145:10)
        at GameEngine.tick (src/engine/gameEngine.js:234:15)`;
      
      jest.spyOn(Error, 'prototype', 'get').mockReturnValue({ stack: mockStack });
      
      const category = enricher.detectSourceCategory();
      expect(category).toBe('actions');
    });
    
    it('should handle all 40+ source directories', () => {
      const testCases = [
        { path: 'src/actions/test.js', expected: 'actions' },
        { path: 'src/logic/test.js', expected: 'logic' },
        { path: 'src/entities/test.js', expected: 'entities' },
        { path: 'src/ai/test.js', expected: 'ai' },
        { path: 'src/domUI/test.js', expected: 'domUI' },
        { path: 'src/engine/test.js', expected: 'engine' },
        { path: 'src/events/test.js', expected: 'events' },
        { path: 'src/loaders/test.js', expected: 'loaders' },
        { path: 'src/scopeDsl/test.js', expected: 'scopeDsl' },
        { path: 'src/initializers/test.js', expected: 'initializers' },
        { path: 'src/dependencyInjection/test.js', expected: 'dependencyInjection' },
        { path: 'src/logging/test.js', expected: 'logging' },
        { path: 'src/config/test.js', expected: 'config' },
        { path: 'src/utils/test.js', expected: 'utils' },
        { path: 'src/services/test.js', expected: 'services' },
        { path: 'src/constants/test.js', expected: 'constants' },
        { path: 'src/storage/test.js', expected: 'storage' },
        { path: 'src/types/test.js', expected: 'types' },
        { path: 'src/alerting/test.js', expected: 'alerting' },
        { path: 'src/context/test.js', expected: 'context' },
        { path: 'src/turns/test.js', expected: 'turns' },
        { path: 'src/adapters/test.js', expected: 'adapters' },
        { path: 'src/query/test.js', expected: 'query' },
        { path: 'src/characterBuilder/test.js', expected: 'characterBuilder' },
        { path: 'src/prompting/test.js', expected: 'prompting' },
        { path: 'src/anatomy/test.js', expected: 'anatomy' },
        { path: 'src/scheduling/test.js', expected: 'scheduling' },
        { path: 'src/errors/test.js', expected: 'errors' },
        { path: 'src/interfaces/test.js', expected: 'interfaces' },
        { path: 'src/clothing/test.js', expected: 'clothing' },
        { path: 'src/input/test.js', expected: 'input' },
        { path: 'src/testing/test.js', expected: 'testing' },
        { path: 'src/configuration/test.js', expected: 'configuration' },
        { path: 'src/modding/test.js', expected: 'modding' },
        { path: 'src/persistence/test.js', expected: 'persistence' },
        { path: 'src/data/test.js', expected: 'data' },
        { path: 'src/shared/test.js', expected: 'shared' },
        { path: 'src/bootstrapper/test.js', expected: 'bootstrapper' },
        { path: 'src/commands/test.js', expected: 'commands' },
        { path: 'src/thematicDirection/test.js', expected: 'thematicDirection' },
        { path: 'src/models/test.js', expected: 'models' },
        { path: 'src/llms/test.js', expected: 'llms' },
        { path: 'src/validation/test.js', expected: 'validation' },
        { path: 'src/pathing/test.js', expected: 'pathing' },
        { path: 'src/formatting/test.js', expected: 'formatting' },
        { path: 'src/ports/test.js', expected: 'ports' },
        { path: 'src/shutdown/test.js', expected: 'shutdown' },
        { path: 'src/common/test.js', expected: 'common' },
        { path: 'tests/unit/test.js', expected: 'tests' },
        { path: 'llm-proxy-server/test.js', expected: 'llm-proxy' }
      ];
      
      testCases.forEach(({ path, expected }) => {
        const mockStack = `Error\n    at test (${path}:10:5)`;
        jest.spyOn(Error, 'prototype', 'get').mockReturnValue({ stack: mockStack });
        
        const category = enricher.detectSourceCategory();
        expect(category).toBe(expected);
      });
    });
    
    it('should return general for unknown paths', () => {
      const mockStack = `Error\n    at unknown (unknown/path.js:10:5)`;
      jest.spyOn(Error, 'prototype', 'get').mockReturnValue({ stack: mockStack });
      
      const category = enricher.detectSourceCategory();
      expect(category).toBe('general');
    });
    
    it('should handle missing stack traces', () => {
      jest.spyOn(Error, 'prototype', 'get').mockReturnValue({ stack: null });
      
      const category = enricher.detectSourceCategory();
      expect(category).toBe('general');
    });
  });
});
```

### 2. LogCategoryDetector Tests

```javascript
// tests/unit/logging/logCategoryDetector.test.js
describe('LogCategoryDetector - Priority-Based Detection', () => {
  let detector;
  
  beforeEach(() => {
    detector = new LogCategoryDetector({ useSourceBased: true });
  });
  
  describe('Level-based routing', () => {
    it('should categorize error-level logs as error', () => {
      const category = detector.detectCategory('Any message', { level: 'error' });
      expect(category).toBe('error');
    });
    
    it('should categorize warn-level logs as warning', () => {
      const category = detector.detectCategory('Any message', { level: 'warn' });
      expect(category).toBe('warning');
    });
    
    it('should NOT categorize based on error keywords', () => {
      const testMessages = [
        'Action failed with error',
        'Exception occurred',
        'Failed to process',
        'Catch block executed',
        'Stack trace follows'
      ];
      
      testMessages.forEach(message => {
        const category = detector.detectCategory(message, { level: 'debug' });
        expect(category).not.toBe('error');
      });
    });
  });
  
  describe('Source-based categorization', () => {
    it('should use sourceCategory when provided', () => {
      const category = detector.detectCategory('Message', { 
        level: 'debug',
        sourceCategory: 'actions'
      });
      expect(category).toBe('actions');
    });
    
    it('should prioritize level over sourceCategory', () => {
      const category = detector.detectCategory('Message', {
        level: 'error',
        sourceCategory: 'actions'
      });
      expect(category).toBe('error');
    });
  });
  
  describe('Pattern fallback', () => {
    it('should use domain patterns when source unavailable', () => {
      const category = detector.detectCategory('EntityManager processing', {
        level: 'debug'
      });
      expect(category).toBe('ecs');
    });
  });
});
```

### 3. Stack Trace Parser Tests

```javascript
// tests/unit/logging/stackTraceParser.test.js
describe('StackTraceParser - Browser Compatibility', () => {
  let parser;
  
  beforeEach(() => {
    parser = new StackTraceParser();
  });
  
  describe('Chrome/V8 format', () => {
    it('should parse Chrome stack traces', () => {
      const stack = `Error
        at ActionResolver.resolve (file:///src/actions/actionResolver.js:145:10)
        at GameEngine.tick (file:///src/engine/gameEngine.js:234:15)`;
      
      const result = parser.parseStackTrace({ stack });
      
      expect(result.sourcePath).toBe('src/actions/actionResolver.js');
      expect(result.frames[0]).toMatchObject({
        functionName: 'ActionResolver.resolve',
        file: 'actionResolver.js',
        fullPath: 'src/actions/actionResolver.js',
        line: 145,
        column: 10
      });
    });
  });
  
  describe('Firefox format', () => {
    it('should parse Firefox stack traces', () => {
      const stack = `ActionResolver.resolve@file:///src/actions/actionResolver.js:145:10
GameEngine.tick@file:///src/engine/gameEngine.js:234:15`;
      
      const result = parser.parseStackTrace({ stack });
      
      expect(result.sourcePath).toBe('src/actions/actionResolver.js');
      expect(result.frames[0].functionName).toBe('ActionResolver.resolve');
    });
  });
  
  describe('Safari format', () => {
    it('should parse Safari stack traces', () => {
      const stack = `resolve@file:///src/actions/actionResolver.js:145:10
tick@file:///src/engine/gameEngine.js:234:15
global code@file:///src/main.js:10:1`;
      
      const result = parser.parseStackTrace({ stack });
      
      expect(result.sourcePath).toBe('src/actions/actionResolver.js');
    });
  });
  
  describe('Webpack formats', () => {
    it('should parse webpack dev server format', () => {
      const stack = `Error
        at ActionResolver.resolve (webpack-internal:///./src/actions/actionResolver.js:145:10)`;
      
      const result = parser.parseStackTrace({ stack });
      
      expect(result.sourcePath).toBe('src/actions/actionResolver.js');
      expect(result.frames[0].webpack).toBe(true);
    });
    
    it('should parse webpack production format', () => {
      const stack = `Error
        at t.resolve (https://example.com/bundle.min.js:1:12345)
        at e.tick (https://example.com/bundle.min.js:1:23456)`;
      
      const result = parser.parseStackTrace({ stack });
      
      // Should attempt source map resolution
      expect(result.sourcePath).toMatch(/bundle\.min\.js/);
    });
  });
});
```

## Integration Tests

### 1. End-to-End Categorization Flow

```javascript
// tests/integration/logging/sourceBasedCategorization.test.js
describe('Source-Based Categorization - E2E', () => {
  let logSystem;
  let mockServer;
  
  beforeEach(async () => {
    mockServer = await createMockLogServer();
    logSystem = new LoggingSystem({
      categorization: { strategy: 'source-based' }
    });
  });
  
  afterEach(async () => {
    await mockServer.close();
  });
  
  it('should categorize logs from all 40+ sources correctly', async () => {
    // Generate logs from different sources
    const testLogs = generateTestLogsFromAllSources();
    
    for (const { source, message, expectedCategory } of testLogs) {
      // Simulate logging from specific source
      await simulateLogFromSource(source, message);
    }
    
    // Wait for flush
    await logSystem.flush();
    
    // Verify server received correctly categorized logs
    const receivedLogs = mockServer.getReceivedLogs();
    
    testLogs.forEach(({ expectedCategory, message }) => {
      const log = receivedLogs.find(l => l.message === message);
      expect(log).toBeDefined();
      expect(log.category).toBe(expectedCategory);
    });
  });
  
  it('should handle high volume from multiple sources', async () => {
    const logCount = 10000;
    const categories = getAllCategories();
    
    // Generate logs
    const promises = [];
    for (let i = 0; i < logCount; i++) {
      const category = categories[i % categories.length];
      promises.push(logSystem.log('debug', `Test ${i}`, { sourceCategory: category }));
    }
    
    await Promise.all(promises);
    await logSystem.flush();
    
    // Verify distribution
    const distribution = mockServer.getCategoryDistribution();
    
    categories.forEach(category => {
      expect(distribution[category]).toBeGreaterThan(0);
    });
  });
});
```

### 2. Migration Flow Test

```javascript
// tests/integration/logging/migrationFlow.test.js
describe('Migration Flow - Integration', () => {
  it('should migrate from pattern-based to source-based', async () => {
    // Start with pattern-based
    const controller = new MigrationController({
      migration: { mode: 'shadow' }
    });
    
    // Log with old system
    await controller.log('debug', 'EntityManager failed to process', {});
    
    // Transition to dual mode
    await controller.transitionToNextPhase();
    expect(controller.getMode()).toBe('dual');
    
    // Log with both systems
    await controller.log('debug', 'Test message', {});
    
    // Verify both systems received logs
    const oldLogs = await getOldSystemLogs();
    const newLogs = await getNewSystemLogs();
    
    expect(oldLogs.length).toBeGreaterThan(0);
    expect(newLogs.length).toBeGreaterThan(0);
    
    // Complete migration
    await controller.transitionToNextPhase(); // to primary
    await controller.transitionToNextPhase(); // to complete
    
    expect(controller.getMode()).toBe('complete');
  });
});
```

## Performance Tests

### 1. Categorization Performance

```javascript
// tests/performance/logging/categorizationPerformance.test.js
describe('Categorization Performance', () => {
  it('should maintain < 2ms overhead per log', async () => {
    const enricher = new LogMetadataEnricher();
    const iterations = 10000;
    
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      enricher.detectSourceCategory();
    }
    
    const duration = performance.now() - start;
    const avgTime = duration / iterations;
    
    expect(avgTime).toBeLessThan(2);
  });
  
  it('should achieve > 80% cache hit rate', async () => {
    const cache = new SourceExtractionCache({ maxSize: 500 });
    
    // Simulate realistic usage pattern
    const patterns = generateRealisticStackPatterns(100);
    
    // First pass - populate cache
    patterns.forEach(pattern => {
      cache.set(pattern.stack, pattern.category);
    });
    
    // Second pass - should hit cache
    patterns.forEach(pattern => {
      cache.get(pattern.stack);
    });
    
    const stats = cache.getStats();
    const hitRate = parseFloat(stats.hitRate);
    
    expect(hitRate).toBeGreaterThan(80);
  });
});
```

### 2. File I/O Performance

```javascript
// tests/performance/logging/fileIOPerformance.test.js
describe('File I/O Performance - 40+ Files', () => {
  it('should handle 40+ concurrent file writes', async () => {
    const coordinator = new BatchWriteCoordinator({
      maxConcurrentWrites: 5
    });
    
    const categories = getAllCategories(); // 40+ categories
    const logsPerCategory = 100;
    
    const start = performance.now();
    
    const promises = [];
    for (const category of categories) {
      for (let i = 0; i < logsPerCategory; i++) {
        promises.push(coordinator.write(
          `logs/${category}.jsonl`,
          [{ level: 'debug', message: `Test ${i}` }]
        ));
      }
    }
    
    await Promise.all(promises);
    await coordinator.flush();
    
    const duration = performance.now() - start;
    const totalLogs = categories.length * logsPerCategory;
    const throughput = totalLogs / (duration / 1000);
    
    expect(throughput).toBeGreaterThan(10000); // 10k logs/sec
  });
  
  it('should not exceed file handle limits', async () => {
    const pool = new FileHandlePool({ maxHandles: 50 });
    const files = Array.from({ length: 100 }, (_, i) => `test-${i}.log`);
    
    // Request more handles than limit
    const handles = await Promise.all(
      files.map(file => pool.getHandle(file))
    );
    
    // Should have evicted old handles
    expect(pool.getOpenHandleCount()).toBeLessThanOrEqual(50);
    
    // Should still be functional
    const testHandle = await pool.getHandle('test-new.log');
    expect(testHandle).toBeDefined();
  });
});
```

## Browser Compatibility Tests

```javascript
// tests/e2e/logging/browserCompatibility.test.js
describe('Browser Compatibility', () => {
  const browsers = ['chrome', 'firefox', 'safari', 'edge'];
  
  browsers.forEach(browser => {
    it(`should work in ${browser}`, async () => {
      const page = await launchBrowser(browser);
      
      await page.goto('http://localhost:3000/test');
      
      // Inject test script
      await page.evaluate(() => {
        // Generate error from specific source
        function testFromActions() {
          throw new Error('Test error from actions');
        }
        
        try {
          testFromActions();
        } catch (error) {
          window.testResult = window.logger.extractSourceCategory(error);
        }
      });
      
      const result = await page.evaluate(() => window.testResult);
      expect(result).toBe('actions');
      
      await page.close();
    });
  });
});
```

## Test Coverage Requirements

### Coverage Targets

- **Overall**: > 80% coverage
- **Critical paths**: > 95% coverage
- **New code**: 100% coverage

### Coverage Report Structure

```
-----------------------------|---------|----------|---------|---------|
File                         | % Stmts | % Branch | % Funcs | % Lines |
-----------------------------|---------|----------|---------|---------|
All files                    |   85.32 |    82.15 |   88.94 |   85.32 |
 src/logging                 |   92.45 |    89.32 |   94.12 |   92.45 |
  logMetadataEnricher.js     |   95.23 |    92.11 |   96.00 |   95.23 |
  logCategoryDetector.js     |   93.87 |    90.45 |   95.65 |   93.87 |
  stackTraceParser.js        |   91.32 |    88.76 |   92.31 |   91.32 |
  sourceExtractionCache.js   |   88.45 |    85.23 |   90.00 |   88.45 |
 llm-proxy-server            |   83.21 |    79.54 |   85.71 |   83.21 |
  logStorageService.js       |   86.54 |    82.35 |   88.46 |   86.54 |
 tools/logging-migration     |   81.23 |    78.91 |   83.33 |   81.23 |
  logRecategorizer.js        |   82.45 |    79.23 |   85.00 |   82.45 |
  migrationController.js     |   80.12 |    77.89 |   82.35 |   80.12 |
-----------------------------|---------|----------|---------|---------|
```

## Success Criteria

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Performance benchmarks met
- [ ] Browser compatibility verified
- [ ] > 80% code coverage achieved
- [ ] Critical paths have > 95% coverage
- [ ] All 40+ categories tested
- [ ] Migration flow tested end-to-end

## Risk Assessment

### Risks

1. **Test Flakiness**
   - Mitigation: Proper test isolation
   - Use deterministic mocks
   - Avoid timing-dependent tests

2. **Performance Test Variability**
   - Mitigation: Run multiple iterations
   - Use statistical analysis
   - Test in controlled environment

3. **Browser Test Complexity**
   - Mitigation: Use automation tools
   - Test critical paths only
   - Focus on stack trace extraction

## Estimated Effort

- Unit tests: 6-8 hours
- Integration tests: 4-5 hours
- Performance tests: 3-4 hours
- Browser tests: 2-3 hours
- Total: 15-20 hours

## Follow-up Tasks

- SRCBASLOG-009: Set up continuous monitoring
- SRCBASLOG-010: Create test documentation