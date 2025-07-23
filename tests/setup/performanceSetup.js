/**
 * @file Performance test setup for ActionDefinitionBuilder
 * @description Configuration and utilities for performance testing
 */

// Global performance configuration
global.PERFORMANCE_CONFIG = {
  // Performance baseline thresholds
  thresholds: {
    simpleCreation: 0.1, // ms
    complexCreation: 0.5, // ms
    validation: 0.01, // ms
    memoryPerAction: 2048, // bytes
    builderOverhead: 100, // percent
  },
  
  // Test iteration counts
  iterations: {
    standard: 1000,
    bulk: 10000,
    memory: 1000,
    scaling: [100, 500, 1000],
  },
  
  // Memory monitoring
  enableMemoryTracking: typeof process !== 'undefined' && process.memoryUsage,
  
  // Garbage collection control
  enableGC: typeof global !== 'undefined' && global.gc,
};

// Performance measurement utilities
global.performanceUtils = {
  /**
   * Measures execution time of a function
   * @param {Function} fn - Function to measure
   * @param {number} iterations - Number of iterations
   * @returns {object} - Performance results
   */
  measureTime: (fn, iterations = 1) => {
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      fn(i);
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / iterations;
    
    return {
      totalTime,
      avgTime,
      iterations,
      startTime,
      endTime,
    };
  },
  
  /**
   * Measures memory usage of a function
   * @param {Function} fn - Function to measure
   * @param {number} iterations - Number of iterations
   * @returns {object} - Memory results
   */
  measureMemory: (fn, iterations = 1) => {
    if (!global.PERFORMANCE_CONFIG.enableMemoryTracking) {
      return {
        supported: false,
        message: 'Memory tracking not available in this environment',
      };
    }
    
    // Force garbage collection if available
    if (global.PERFORMANCE_CONFIG.enableGC) {
      global.gc();
    }
    
    const initialMemory = process.memoryUsage();
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const result = fn(i);
      results.push(result);
    }
    
    // Force garbage collection again
    if (global.PERFORMANCE_CONFIG.enableGC) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage();
    
    return {
      supported: true,
      initialMemory,
      finalMemory,
      heapUsedDelta: finalMemory.heapUsed - initialMemory.heapUsed,
      memoryPerIteration: (finalMemory.heapUsed - initialMemory.heapUsed) / iterations,
      results,
      iterations,
    };
  },
  
  /**
   * Formats performance results for console output
   * @param {object} results - Performance results
   * @param {string} testName - Name of the test
   */
  logResults: (results, testName) => {
    console.log(`\n📊 Performance Results: ${testName}`);
    console.log(`   Total Time: ${results.totalTime.toFixed(2)}ms`);
    console.log(`   Average Time: ${results.avgTime.toFixed(4)}ms per operation`);
    console.log(`   Iterations: ${results.iterations}`);
    
    if (results.heapUsedDelta !== undefined) {
      console.log(`   Memory Delta: ${(results.heapUsedDelta / 1024).toFixed(2)}KB`);
      console.log(`   Memory per Operation: ${results.memoryPerIteration.toFixed(0)} bytes`);
    }
  },
  
  /**
   * Validates performance against thresholds
   * @param {object} results - Performance results
   * @param {object} thresholds - Threshold configuration
   * @returns {boolean} - True if performance meets thresholds
   */
  validateThresholds: (results, thresholds) => {
    const failures = [];
    
    if (results.avgTime > thresholds.maxTime) {
      failures.push(`Average time ${results.avgTime.toFixed(4)}ms exceeds threshold ${thresholds.maxTime}ms`);
    }
    
    if (results.memoryPerIteration && results.memoryPerIteration > thresholds.maxMemory) {
      failures.push(`Memory usage ${results.memoryPerIteration}bytes exceeds threshold ${thresholds.maxMemory}bytes`);
    }
    
    if (failures.length > 0) {
      console.error('❌ Performance thresholds failed:');
      failures.forEach(failure => console.error(`   ${failure}`));
      return false;
    }
    
    console.log('✅ Performance thresholds passed');
    return true;
  },
};

// Jest setup for performance tests
beforeAll(() => {
  // Set up performance monitoring
  if (global.PERFORMANCE_CONFIG.enableMemoryTracking) {
    console.log('🔧 Performance monitoring enabled (Node.js environment)');
  } else {
    console.log('⚠️ Performance monitoring limited (browser environment)');
  }
  
  // Set performance.now polyfill if needed
  if (typeof performance === 'undefined') {
    global.performance = {
      now: () => Date.now()
    };
  }
});

// Clean up after performance tests
afterAll(() => {
  if (global.PERFORMANCE_CONFIG.enableGC) {
    global.gc();
  }
});