# TRAREW-013: Performance Testing and Optimization

## Priority: 🟢 LOW  

**Phase**: 3 - Testing & Validation  
**Story Points**: 2  
**Estimated Time**: 2-3 hours

## Problem Statement

The TraitsRewriter feature requires performance testing to ensure acceptable response times, memory usage, and scalability under various load conditions. Performance tests must validate generation speed, UI responsiveness, memory efficiency, and system behavior under stress.

## Requirements

1. Test trait generation performance with various character complexities
2. Validate UI responsiveness during generation workflows
3. Test memory usage and garbage collection efficiency
4. Measure token estimation and LLM interaction performance
5. Test concurrent request handling and resource management
6. Establish performance benchmarks and regression testing
7. Identify and document performance optimization opportunities

## Acceptance Criteria

- [ ] **Generation Performance**: Trait generation completes within acceptable time limits
- [ ] **UI Responsiveness**: Interface remains responsive during all operations
- [ ] **Memory Efficiency**: No memory leaks or excessive memory consumption
- [ ] **Concurrency Handling**: System handles multiple concurrent requests gracefully
- [ ] **Token Estimation**: Fast and accurate token counting for cost estimation
- [ ] **Performance Benchmarks**: Established baselines for regression testing
- [ ] **Optimization Recommendations**: Documented performance improvement opportunities

## Implementation Details

### File Structure
Create performance test files:

```
/tests/performance/characterBuilder/
├── traitsRewriterGeneration.performance.test.js
├── traitsRewriterUI.performance.test.js
├── traitsRewriterMemory.performance.test.js
├── traitsRewriterConcurrency.performance.test.js
└── traitsRewriterOptimization.performance.test.js
```

### Performance Test Framework
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { performance, PerformanceObserver } from 'perf_hooks';
import { createPerformanceTestBed } from '../../common/performanceTestBed.js';

describe('TraitsRewriter Performance Tests', () => {
  let testBed;
  let performanceMetrics;

  beforeEach(() => {
    testBed = createPerformanceTestBed();
    performanceMetrics = testBed.createMetricsCollector();
    
    // Setup performance monitoring
    const observer = new PerformanceObserver((list) => {
      performanceMetrics.addEntries(list.getEntries());
    });
    observer.observe({ entryTypes: ['measure', 'mark'] });
  });

  afterEach(() => {
    testBed.cleanup();
    performanceMetrics.report();
  });
});
```

## Performance Test Categories

### 1. Trait Generation Performance

#### Generation Speed Tests
```javascript
describe('Trait Generation Performance', () => {
  it('should generate traits for simple character within 2 seconds', async () => {
    const simpleCharacter = testBed.getSimpleCharacterData();
    const generator = testBed.getTraitsRewriterGenerator();

    performance.mark('generation-start');
    const result = await generator.generateRewrittenTraits(simpleCharacter);
    performance.mark('generation-end');
    
    performance.measure('trait-generation', 'generation-start', 'generation-end');
    const measure = performance.getEntriesByName('trait-generation')[0];
    
    expect(measure.duration).toBeLessThan(2000); // 2 seconds
    expect(result.rewrittenTraits).toBeDefined();
  });

  it('should generate traits for complex character within 5 seconds', async () => {
    const complexCharacter = testBed.getComplexCharacterData(); // All 10 trait types
    const generator = testBed.getTraitsRewriterGenerator();

    performance.mark('complex-generation-start');
    const result = await generator.generateRewrittenTraits(complexCharacter);
    performance.mark('complex-generation-end');
    
    performance.measure('complex-trait-generation', 'complex-generation-start', 'complex-generation-end');
    const measure = performance.getEntriesByName('complex-trait-generation')[0];
    
    expect(measure.duration).toBeLessThan(5000); // 5 seconds
    expect(Object.keys(result.rewrittenTraits)).toHaveLength(10);
  });

  it('should maintain consistent performance across multiple generations', async () => {
    const character = testBed.getStandardCharacterData();
    const generator = testBed.getTraitsRewriterGenerator();
    const durations = [];

    // Run 5 generations and measure each
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      await generator.generateRewrittenTraits(character);
      const end = performance.now();
      durations.push(end - start);
    }

    // Calculate statistics
    const average = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance = durations.reduce((sum, duration) => {
      return sum + Math.pow(duration - average, 2);
    }, 0) / durations.length;
    const stdDev = Math.sqrt(variance);

    // Performance should be consistent (low variance)
    expect(average).toBeLessThan(3000); // Average under 3 seconds
    expect(stdDev).toBeLessThan(500); // Standard deviation under 500ms
  });
});
```

### 2. UI Responsiveness Tests

#### UI Performance Measurements
```javascript
describe('UI Responsiveness', () => {
  it('should update UI state within 100ms', async () => {
    const controller = testBed.getTraitsRewriterController();
    const mockCharacterInput = testBed.createMockUIElement();

    performance.mark('ui-update-start');
    await controller._showState('loading', { message: 'Generating...' });
    performance.mark('ui-update-end');
    
    performance.measure('ui-state-change', 'ui-update-start', 'ui-update-end');
    const measure = performance.getEntriesByName('ui-state-change')[0];
    
    expect(measure.duration).toBeLessThan(100); // 100ms for UI updates
  });

  it('should handle input validation without blocking UI', async () => {
    const controller = testBed.getTraitsRewriterController();
    const largeInput = testBed.getLargeCharacterDefinition();

    performance.mark('validation-start');
    const isValid = await controller._validateCharacterDefinition(JSON.stringify(largeInput));
    performance.mark('validation-end');
    
    performance.measure('input-validation', 'validation-start', 'validation-end');
    const measure = performance.getEntriesByName('input-validation')[0];
    
    // Input validation should be fast
    expect(measure.duration).toBeLessThan(50);
    expect(isValid).toBeDefined();
  });

  it('should render results without UI freezing', async () => {
    const enhancer = testBed.getTraitsRewriterDisplayEnhancer();
    const largeTraitSet = testBed.getLargeTraitSet();

    performance.mark('render-start');
    const displayData = enhancer.enhanceForDisplay(largeTraitSet, 'Test Character');
    performance.mark('render-end');
    
    performance.measure('results-rendering', 'render-start', 'render-end');
    const measure = performance.getEntriesByName('results-rendering')[0];
    
    expect(measure.duration).toBeLessThan(200); // 200ms for rendering
    expect(displayData.sections).toBeDefined();
  });
});
```

### 3. Memory Efficiency Tests

#### Memory Usage Monitoring
```javascript
describe('Memory Efficiency', () => {
  it('should not leak memory during repeated generations', async () => {
    const generator = testBed.getTraitsRewriterGenerator();
    const character = testBed.getStandardCharacterData();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Perform 10 generations
    for (let i = 0; i < 10; i++) {
      await generator.generateRewrittenTraits(character);
      
      // Periodically force garbage collection
      if (i % 3 === 0 && global.gc) {
        global.gc();
      }
    }
    
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    // Memory increase should be minimal (less than 10MB)
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
  });

  it('should efficiently manage large character definitions', async () => {
    const processor = testBed.getTraitsRewriterResponseProcessor();
    const veryLargeResponse = testBed.getVeryLargeResponse();
    
    const beforeMemory = process.memoryUsage().heapUsed;
    
    await processor.processResponse(veryLargeResponse, testBed.getStandardCharacterData());
    
    const afterMemory = process.memoryUsage().heapUsed;
    const memoryUsed = afterMemory - beforeMemory;
    
    // Memory usage should be proportional to input size
    expect(memoryUsed).toBeLessThan(5 * 1024 * 1024); // Less than 5MB
  });
});
```

### 4. Concurrency Performance Tests

#### Concurrent Request Handling
```javascript
describe('Concurrency Performance', () => {
  it('should handle 5 concurrent generations efficiently', async () => {
    const generator = testBed.getTraitsRewriterGenerator();
    const character = testBed.getStandardCharacterData();
    
    performance.mark('concurrent-start');
    
    // Create 5 concurrent generation promises
    const promises = Array(5).fill(null).map(() => 
      generator.generateRewrittenTraits(character)
    );
    
    const results = await Promise.all(promises);
    
    performance.mark('concurrent-end');
    performance.measure('concurrent-generation', 'concurrent-start', 'concurrent-end');
    
    const measure = performance.getEntriesByName('concurrent-generation')[0];
    
    // Should complete within 8 seconds (not much slower than sequential)
    expect(measure.duration).toBeLessThan(8000);
    expect(results).toHaveLength(5);
    results.forEach(result => {
      expect(result.rewrittenTraits).toBeDefined();
    });
  });

  it('should maintain response quality under concurrent load', async () => {
    const generator = testBed.getTraitsRewriterGenerator();
    const differentCharacters = testBed.getDifferentCharacterSet();
    
    const promises = differentCharacters.map(character => 
      generator.generateRewrittenTraits(character)
    );
    
    const results = await Promise.all(promises);
    
    // Each result should be unique and properly generated
    for (let i = 0; i < results.length; i++) {
      expect(results[i].rewrittenTraits).toBeDefined();
      expect(results[i].characterName).toBe(differentCharacters[i]['core:name'].text);
      
      // Results should be different from each other
      for (let j = i + 1; j < results.length; j++) {
        expect(results[i].rewrittenTraits).not.toEqual(results[j].rewrittenTraits);
      }
    }
  });
});
```

### 5. Token Estimation Performance

#### Token Counting Efficiency
```javascript
describe('Token Estimation Performance', () => {
  it('should estimate tokens quickly for various input sizes', async () => {
    const tokenEstimator = testBed.getTokenEstimator();
    const testInputs = [
      testBed.getSmallPrompt(),
      testBed.getMediumPrompt(),
      testBed.getLargePrompt()
    ];
    
    for (const input of testInputs) {
      performance.mark('token-estimation-start');
      const tokenCount = await tokenEstimator.estimateTokens(input);
      performance.mark('token-estimation-end');
      
      performance.measure('token-estimation', 'token-estimation-start', 'token-estimation-end');
      const measure = performance.getEntriesByName('token-estimation')[0];
      
      // Token estimation should be very fast
      expect(measure.duration).toBeLessThan(10); // 10ms
      expect(tokenCount).toBeGreaterThan(0);
      
      performance.clearMarks();
      performance.clearMeasures();
    }
  });
});
```

## Performance Benchmarks

### Baseline Performance Targets
```javascript
// Performance targets for regression testing
export const PERFORMANCE_TARGETS = {
  GENERATION: {
    SIMPLE_CHARACTER: 2000,    // 2 seconds
    COMPLEX_CHARACTER: 5000,   // 5 seconds
    AVERAGE_VARIANCE: 500      // 500ms standard deviation
  },
  
  UI_RESPONSIVENESS: {
    STATE_CHANGE: 100,         // 100ms
    INPUT_VALIDATION: 50,      // 50ms
    RESULTS_RENDERING: 200     // 200ms
  },
  
  MEMORY: {
    GENERATION_LEAK: 10 * 1024 * 1024,  // 10MB max increase
    LARGE_RESPONSE: 5 * 1024 * 1024      // 5MB max usage
  },
  
  CONCURRENCY: {
    FIVE_CONCURRENT: 8000,     // 8 seconds for 5 concurrent
    QUALITY_MAINTAINED: true   // Results should remain unique
  },
  
  TOKEN_ESTIMATION: {
    MAX_TIME: 10              // 10ms maximum
  }
};
```

### Performance Monitoring Setup
```javascript
// Performance test utilities
export class PerformanceMonitor {
  constructor() {
    this.metrics = [];
    this.thresholds = PERFORMANCE_TARGETS;
  }
  
  startMeasurement(name) {
    performance.mark(`${name}-start`);
  }
  
  endMeasurement(name) {
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    
    const measure = performance.getEntriesByName(name)[0];
    this.metrics.push({
      name,
      duration: measure.duration,
      timestamp: Date.now()
    });
    
    return measure.duration;
  }
  
  validateThreshold(metricName, actualValue, thresholdPath) {
    const threshold = this.getNestedValue(this.thresholds, thresholdPath);
    const passed = actualValue <= threshold;
    
    this.metrics.push({
      name: `${metricName}-threshold`,
      expected: threshold,
      actual: actualValue,
      passed
    });
    
    return passed;
  }
  
  generateReport() {
    return {
      totalTests: this.metrics.length,
      passed: this.metrics.filter(m => m.passed !== false).length,
      failed: this.metrics.filter(m => m.passed === false).length,
      averageDuration: this.metrics
        .filter(m => m.duration)
        .reduce((sum, m) => sum + m.duration, 0) / this.metrics.length,
      metrics: this.metrics
    };
  }
}
```

## Dependencies

**Blocking**:
- TRAREW-005 through TRAREW-009 (All service implementations)
- TRAREW-011 (Integration testing for realistic scenarios)

**External Dependencies**:
- Node.js performance hooks ✅
- Memory profiling utilities
- Jest performance testing configuration

## Test Environment Configuration

### Performance Test Setup
```javascript
// jest.config.performance.js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/performance/**/*.performance.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/common/performanceSetup.js'],
  testTimeout: 30000, // 30 seconds for performance tests
  maxWorkers: 1, // Run performance tests sequentially
  collectCoverage: false, // Disable coverage for performance tests
  
  // Performance test specific settings
  globals: {
    'performance-test': true
  }
};
```

### Memory Test Configuration
```javascript
// For memory leak detection
const nodeOptions = '--expose-gc --max-old-space-size=4096';
process.env.NODE_OPTIONS = nodeOptions;
```

## Validation Steps

### Step 1: Performance Test Execution
```bash
# Run all performance tests
npm run test:performance

# Run specific performance test suite
npm run test:performance -- traitsRewriterGeneration.performance.test.js

# Run with memory profiling
npm run test:performance:memory
```

### Step 2: Benchmark Validation
```bash
# Run benchmark comparison
npm run test:performance:benchmark

# Generate performance report
npm run test:performance:report
```

### Step 3: Regression Testing
```bash
# Compare against baseline performance
npm run test:performance:regression
```

## Success Metrics

- **Generation Speed**: All generation tests meet time targets
- **UI Responsiveness**: Interface updates within acceptable limits
- **Memory Efficiency**: No memory leaks detected, efficient memory usage
- **Concurrency Support**: Handles multiple requests without degradation
- **Consistent Performance**: Low variance across repeated operations
- **Benchmark Establishment**: Clear performance baselines for future regression testing

## Optimization Recommendations

Based on performance test results, document:

1. **Hot Paths**: Identify most time-consuming operations
2. **Memory Bottlenecks**: Areas with high memory allocation
3. **Concurrency Limits**: Maximum recommended concurrent operations
4. **Optimization Opportunities**: Specific improvements for better performance
5. **Resource Usage**: CPU, memory, and network utilization patterns

## Next Steps

After completion:
- **TRAREW-014**: User acceptance testing scenarios
- **TRAREW-015**: Documentation and deployment preparation

## Implementation Checklist

- [ ] Set up performance testing framework and utilities
- [ ] Implement trait generation performance tests
- [ ] Implement UI responsiveness performance tests
- [ ] Implement memory efficiency and leak detection tests
- [ ] Implement concurrency performance tests
- [ ] Implement token estimation performance tests
- [ ] Create performance monitoring and reporting utilities
- [ ] Establish performance benchmark baselines
- [ ] Configure performance test environment
- [ ] Document performance targets and thresholds
- [ ] Create performance regression testing workflow
- [ ] Generate optimization recommendations based on results