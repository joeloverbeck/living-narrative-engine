# PROXBASCLOS-012: Create Performance Tests for Scalability Validation

**Phase**: Testing Layer  
**Priority**: Medium  
**Complexity**: Medium  
**Dependencies**: PROXBASCLOS-001, PROXBASCLOS-003, PROXBASCLOS-004  
**Estimated Time**: 6-7 hours

## Summary

Create comprehensive performance tests to validate the scalability and efficiency of the proximity-based closeness system under various load conditions. These tests ensure the system maintains acceptable performance as the number of actors, furniture, and concurrent operations increases.

## Technical Requirements

### Files to Create

#### 1. `tests/performance/positioning/proximityClosenessPerformance.test.js`
- Core proximity calculation performance benchmarks
- Operation handler execution time validation
- Memory usage and leak detection
- Scalability testing with increasing load

#### 2. `tests/performance/positioning/largeFurnitureScenarios.performance.test.js`  
- Maximum capacity furniture performance testing
- Multi-furniture concurrent operation testing
- Complex adjacency calculation benchmarks
- Resource utilization monitoring

#### 3. `tests/performance/positioning/memoryUsageValidation.performance.test.js`
- Memory leak detection during repeated operations
- Component creation/destruction efficiency
- Long-running session memory stability
- Garbage collection impact analysis

### Performance Test Architecture

#### Test Environment
- **Node.js Performance APIs**: Use `performance.now()` and `process.hrtime()`
- **Memory Profiling**: Monitor `process.memoryUsage()` over time
- **Stress Testing**: High-volume operation simulation
- **Resource Monitoring**: CPU and memory utilization tracking

#### Performance Targets
- **Operation Execution**: <50ms per proximity operation
- **Memory Growth**: <10MB increase per 1000 operations
- **Scalability**: Linear performance scaling with actor count
- **Concurrent Operations**: Handle 10+ simultaneous sit/stand actions

## ProximityClosenessPerformance Tests

### Test Structure and Setup

#### Performance Test Configuration
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { performance } from 'perf_hooks';
import { createPerformanceTestBed } from '../../common/performanceTestBed.js';
import EstablishSittingClosenessHandler from '../../../src/logic/operationHandlers/establishSittingClosenessHandler.js';
import RemoveSittingClosenessHandler from '../../../src/logic/operationHandlers/removeSittingClosenessHandler.js';
import { getAdjacentSpots, findAdjacentOccupants } from '../../../src/utils/proximityUtils.js';

describe('Proximity Closeness Performance Tests', () => {
  let testBed;
  let establishHandler;
  let removeHandler;
  let performanceMetrics;

  beforeEach(() => {
    testBed = createPerformanceTestBed();
    
    establishHandler = new EstablishSittingClosenessHandler({
      logger: testBed.createMockLogger(),
      entityManager: testBed.createMockEntityManager(),
      eventBus: testBed.createMockEventBus(),
      closenessCircleService: testBed.createMockClosenessCircleService(),
      operationContext: testBed.createMockOperationContext(),
    });

    removeHandler = new RemoveSittingClosenessHandler({
      logger: testBed.createMockLogger(),
      entityManager: testBed.createMockEntityManager(), 
      eventBus: testBed.createMockEventBus(),
      closenessCircleService: testBed.createMockClosenessCircleService(),
      operationContext: testBed.createMockOperationContext(),
    });

    performanceMetrics = {
      startTime: 0,
      endTime: 0,
      memoryBefore: 0,
      memoryAfter: 0,
      operations: 0
    };
  });

  afterEach(() => {
    testBed.cleanup();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });
});
```

### Core Utility Function Benchmarks

#### Adjacency Calculation Performance
```javascript
describe('Core Utility Performance', () => {
  it('should calculate adjacency in constant time O(1)', () => {
    const iterations = 100000;
    
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      const spotIndex = Math.floor(Math.random() * 10);
      const totalSpots = 10;
      getAdjacentSpots(spotIndex, totalSpots);
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    const operationsPerMs = iterations / duration;
    
    // Should handle >1000 adjacency calculations per millisecond
    expect(operationsPerMs).toBeGreaterThan(1000);
    expect(duration).toBeLessThan(100); // <100ms for 100k operations
  });

  it('should find adjacent occupants efficiently with varying furniture sizes', () => {
    const testSizes = [2, 5, 10]; // Different furniture sizes
    const iterations = 10000;
    
    testSizes.forEach(size => {
      const furnitureComponent = {
        spots: new Array(size).fill(null)
      };
      
      // Fill with some actors
      for (let i = 0; i < size; i += 2) {
        furnitureComponent.spots[i] = `game:actor_${i}`;
      }
      
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        const spotIndex = Math.floor(Math.random() * size);
        findAdjacentOccupants(furnitureComponent, spotIndex);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Performance should be independent of furniture size
      expect(duration).toBeLessThan(50); // <50ms for 10k operations regardless of size
    });
  });
});
```

### Operation Handler Performance Tests

#### Establish Closeness Performance
```javascript
describe('Operation Handler Performance', () => {
  it('should execute establish closeness operation quickly', async () => {
    const operations = 1000;
    const results = [];
    
    // Setup mock responses for consistent behavior
    testBed.mockEntityManager.getComponent.mockImplementation((entityId, componentType) => {
      if (componentType === 'positioning:allows_sitting') {
        return { spots: ['game:alice', null, 'game:charlie'] };
      }
      return null;
    });
    
    testBed.mockClosenessCircleService.merge.mockReturnValue({
      'game:alice': ['game:bob'],
      'game:bob': ['game:alice']
    });

    const startTime = performance.now();

    for (let i = 0; i < operations; i++) {
      const operationStart = performance.now();
      
      await establishHandler.execute({
        furniture_id: 'furniture:couch',
        actor_id: 'game:bob',
        spot_index: 1
      });
      
      const operationEnd = performance.now();
      results.push(operationEnd - operationStart);
    }

    const endTime = performance.now();
    const totalDuration = endTime - startTime;
    const averageOperation = results.reduce((sum, time) => sum + time, 0) / operations;
    const maxOperation = Math.max(...results);
    const minOperation = Math.min(...results);

    // Performance assertions
    expect(averageOperation).toBeLessThan(50); // <50ms average
    expect(maxOperation).toBeLessThan(100); // <100ms worst case
    expect(totalDuration).toBeLessThan(10000); // <10s for 1000 operations
    
    // Log performance metrics
    console.log(`Establish Closeness Performance:
      Operations: ${operations}
      Total Duration: ${totalDuration.toFixed(2)}ms
      Average Operation: ${averageOperation.toFixed(2)}ms
      Min Operation: ${minOperation.toFixed(2)}ms
      Max Operation: ${maxOperation.toFixed(2)}ms
      Operations/sec: ${(operations / totalDuration * 1000).toFixed(0)}`);
  });

  it('should execute remove closeness operation quickly', async () => {
    const operations = 1000;
    const results = [];

    testBed.mockEntityManager.getComponent.mockImplementation((entityId, componentType) => {
      if (componentType === 'positioning:allows_sitting') {
        return { spots: ['game:alice', null, 'game:charlie'] };
      }
      if (componentType === 'positioning:closeness') {
        return { partners: ['game:alice', 'game:charlie'] };
      }
      return null;
    });

    testBed.mockClosenessCircleService.repair.mockReturnValue({
      'game:alice': [],
      'game:charlie': []
    });

    const startTime = performance.now();

    for (let i = 0; i < operations; i++) {
      const operationStart = performance.now();
      
      await removeHandler.execute({
        furniture_id: 'furniture:couch',
        actor_id: 'game:bob',
        spot_index: 1
      });
      
      const operationEnd = performance.now();
      results.push(operationEnd - operationStart);
    }

    const endTime = performance.now();
    const totalDuration = endTime - startTime;
    const averageOperation = results.reduce((sum, time) => sum + time, 0) / operations;

    expect(averageOperation).toBeLessThan(50); // <50ms average
    expect(totalDuration).toBeLessThan(10000); // <10s for 1000 operations

    console.log(`Remove Closeness Performance:
      Operations: ${operations}
      Average Operation: ${averageOperation.toFixed(2)}ms
      Operations/sec: ${(operations / totalDuration * 1000).toFixed(0)}`);
  });
});
```

### Scalability Testing

#### Actor Count Scaling
```javascript
describe('Scalability Tests', () => {
  it('should scale linearly with actor count', async () => {
    const actorCounts = [10, 50, 100, 500];
    const scalabilityResults = [];

    for (const actorCount of actorCounts) {
      // Setup furniture with all spots occupied
      const spots = new Array(Math.min(actorCount, 10)).fill(null);
      for (let i = 0; i < spots.length; i++) {
        spots[i] = `game:actor_${i}`;
      }

      testBed.mockEntityManager.getComponent.mockImplementation((entityId, componentType) => {
        if (componentType === 'positioning:allows_sitting') {
          return { spots };
        }
        if (componentType === 'positioning:closeness') {
          // Return partners based on adjacency  
          const actorIndex = parseInt(entityId.split('_')[1]);
          const partners = [];
          if (actorIndex > 0) partners.push(`game:actor_${actorIndex - 1}`);
          if (actorIndex < spots.length - 1) partners.push(`game:actor_${actorIndex + 1}`);
          return partners.length > 0 ? { partners } : null;
        }
        return null;
      });

      // Create partner data for closeness service
      const partnerData = {};
      for (let i = 0; i < spots.length; i++) {
        const partners = [];
        if (i > 0) partners.push(`game:actor_${i - 1}`);
        if (i < spots.length - 1) partners.push(`game:actor_${i + 1}`);
        partnerData[`game:actor_${i}`] = partners;
      }

      testBed.mockClosenessCircleService.repair.mockReturnValue(partnerData);

      const startTime = performance.now();

      // Simulate multiple actors standing up
      const operations = Math.min(actorCount / 10, 50); // Scale operations with actor count
      for (let i = 0; i < operations; i++) {
        await removeHandler.execute({
          furniture_id: 'furniture:large_space',
          actor_id: `game:actor_${i}`,
          spot_index: i % spots.length
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const operationsPerSecond = operations / duration * 1000;

      scalabilityResults.push({
        actorCount,
        operations,
        duration,
        operationsPerSecond
      });
    }

    // Verify linear scaling (operations per second should remain relatively consistent)
    const baselineOpsPerSec = scalabilityResults[0].operationsPerSecond;
    
    scalabilityResults.forEach((result, index) => {
      if (index > 0) {
        const degradation = (baselineOpsPerSec - result.operationsPerSecond) / baselineOpsPerSec;
        
        // Performance should not degrade more than 50% even with 50x more actors
        expect(degradation).toBeLessThan(0.5);
        
        console.log(`Actor Count: ${result.actorCount}, Ops/sec: ${result.operationsPerSecond.toFixed(0)}, Degradation: ${(degradation * 100).toFixed(1)}%`);
      }
    });
  });
});
```

## LargeFurnitureScenarios Performance Tests

### Maximum Capacity Testing

#### Full Furniture Performance
```javascript
describe('Large Furniture Scenarios Performance', () => {
  it('should handle maximum capacity furniture efficiently', async () => {
    const maxSpots = 10;
    const iterations = 100;
    
    // Create fully occupied furniture
    const spots = new Array(maxSpots).fill(null);
    for (let i = 0; i < maxSpots; i++) {
      spots[i] = `game:actor_${i}`;
    }

    testBed.mockEntityManager.getComponent.mockImplementation((entityId, componentType) => {
      if (componentType === 'positioning:allows_sitting') {
        return { spots };
      }
      if (componentType === 'positioning:closeness') {
        const actorIndex = parseInt(entityId.split('_')[1]);
        const partners = [];
        if (actorIndex > 0) partners.push(`game:actor_${actorIndex - 1}`);
        if (actorIndex < maxSpots - 1) partners.push(`game:actor_${actorIndex + 1}`);
        return partners.length > 0 ? { partners } : null;
      }
      return null;
    });

    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      // Test removing from middle position (affects 2 adjacent actors)
      await removeHandler.execute({
        furniture_id: 'furniture:max_capacity',
        actor_id: 'game:actor_5', // Middle position
        spot_index: 5
      });
      
      const endTime = performance.now();
      results.push(endTime - startTime);
    }

    const averageTime = results.reduce((sum, time) => sum + time, 0) / iterations;
    const maxTime = Math.max(...results);
    
    // Performance should be independent of furniture size
    expect(averageTime).toBeLessThan(50); // <50ms average
    expect(maxTime).toBeLessThan(100); // <100ms worst case
    
    console.log(`Max Capacity Performance:
      Spots: ${maxSpots}
      Average Time: ${averageTime.toFixed(2)}ms
      Max Time: ${maxTime.toFixed(2)}ms`);
  });

  it('should handle concurrent operations on multiple furniture pieces', async () => {
    const furnitureCount = 10;
    const concurrentOperations = 20;
    
    // Setup multiple furniture pieces
    const furnitureData = {};
    for (let f = 0; f < furnitureCount; f++) {
      const spots = new Array(5).fill(null);
      for (let s = 0; s < 5; s++) {
        spots[s] = `game:actor_${f}_${s}`;
      }
      furnitureData[`furniture:piece_${f}`] = spots;
    }

    testBed.mockEntityManager.getComponent.mockImplementation((entityId, componentType) => {
      if (componentType === 'positioning:allows_sitting') {
        // Extract furniture ID from context or use default
        return { spots: furnitureData['furniture:piece_0'] || [] };
      }
      return null;
    });

    const startTime = performance.now();
    
    // Execute concurrent operations
    const operations = [];
    for (let i = 0; i < concurrentOperations; i++) {
      const furnitureIndex = i % furnitureCount;
      const actorIndex = i % 5;
      
      operations.push(establishHandler.execute({
        furniture_id: `furniture:piece_${furnitureIndex}`,
        actor_id: `game:new_actor_${i}`,
        spot_index: actorIndex
      }));
    }
    
    await Promise.all(operations);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    const operationsPerSecond = concurrentOperations / duration * 1000;
    
    expect(operationsPerSecond).toBeGreaterThan(100); // >100 ops/sec concurrent
    expect(duration).toBeLessThan(1000); // <1s for 20 concurrent operations
    
    console.log(`Concurrent Operations Performance:
      Furniture Pieces: ${furnitureCount}
      Concurrent Operations: ${concurrentOperations}
      Duration: ${duration.toFixed(2)}ms
      Ops/sec: ${operationsPerSecond.toFixed(0)}`);
  });
});
```

## MemoryUsageValidation Performance Tests

### Memory Leak Detection

#### Repeated Operations Memory Testing
```javascript
describe('Memory Usage Validation', () => {
  it('should not create memory leaks during repeated operations', async () => {
    const iterations = 1000;
    const memoryMeasurements = [];
    
    // Force initial garbage collection
    if (global.gc) {
      global.gc();
    }
    
    const initialMemory = process.memoryUsage();
    memoryMeasurements.push(initialMemory.heapUsed);
    
    // Setup consistent mock responses
    testBed.mockEntityManager.getComponent.mockReturnValue({
      spots: ['game:alice', null, 'game:charlie']
    });
    
    testBed.mockClosenessCircleService.merge.mockReturnValue({
      'game:alice': ['game:bob'],
      'game:bob': ['game:alice']
    });

    // Perform repeated operations
    for (let i = 0; i < iterations; i++) {
      await establishHandler.execute({
        furniture_id: 'furniture:test',
        actor_id: 'game:bob',
        spot_index: 1
      });
      
      await removeHandler.execute({
        furniture_id: 'furniture:test',
        actor_id: 'game:bob',
        spot_index: 1
      });
      
      // Measure memory every 100 operations
      if (i % 100 === 99) {
        if (global.gc) global.gc();
        const currentMemory = process.memoryUsage();
        memoryMeasurements.push(currentMemory.heapUsed);
      }
    }
    
    // Final measurement
    if (global.gc) global.gc();
    const finalMemory = process.memoryUsage();
    memoryMeasurements.push(finalMemory.heapUsed);
    
    // Analyze memory growth
    const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryGrowthMB = memoryGrowth / (1024 * 1024);
    
    // Memory growth should be minimal (<10MB for 1000 operations)
    expect(memoryGrowthMB).toBeLessThan(10);
    
    // Check for consistent growth pattern (not exponential)
    const growthRates = [];
    for (let i = 1; i < memoryMeasurements.length; i++) {
      const growth = memoryMeasurements[i] - memoryMeasurements[i - 1];
      growthRates.push(growth);
    }
    
    const maxGrowthRate = Math.max(...growthRates);
    const avgGrowthRate = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
    
    // Growth rate should be consistent, not accelerating
    expect(maxGrowthRate).toBeLessThan(avgGrowthRate * 3);
    
    console.log(`Memory Usage Analysis:
      Iterations: ${iterations}
      Initial Memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
      Final Memory: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
      Growth: ${memoryGrowthMB.toFixed(2)}MB
      Avg Growth Rate: ${(avgGrowthRate / 1024).toFixed(2)}KB per 100 ops
      Max Growth Rate: ${(maxGrowthRate / 1024).toFixed(2)}KB per 100 ops`);
  });

  it('should handle large closeness circles efficiently', async () => {
    const circleSize = 100; // Large closeness circle
    const operations = 100;
    
    // Create large partner list
    const partners = [];
    for (let i = 0; i < circleSize; i++) {
      partners.push(`game:actor_${i}`);
    }
    
    testBed.mockEntityManager.getComponent.mockImplementation((entityId, componentType) => {
      if (componentType === 'positioning:closeness') {
        return { partners: [...partners] }; // Create new array to avoid shared references
      }
      return null;
    });
    
    // Mock closeness circle service to handle large circles
    testBed.mockClosenessCircleService.repair.mockImplementation((partnerData) => {
      // Simulate the repair logic but efficiently
      const result = {};
      for (const [actorId, actorPartners] of Object.entries(partnerData)) {
        result[actorId] = actorPartners.slice(0, 50); // Limit to 50 partners for performance
      }
      return result;
    });
    
    const startTime = performance.now();
    const initialMemory = process.memoryUsage();
    
    for (let i = 0; i < operations; i++) {
      await removeHandler.execute({
        furniture_id: 'furniture:massive',
        actor_id: `game:actor_${i % circleSize}`,
        spot_index: 0
      });
    }
    
    const endTime = performance.now();
    const finalMemory = process.memoryUsage();
    
    const duration = endTime - startTime;
    const memoryGrowth = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
    const averageOperationTime = duration / operations;
    
    // Performance should still be acceptable with large circles
    expect(averageOperationTime).toBeLessThan(100); // <100ms per operation
    expect(memoryGrowth).toBeLessThan(50); // <50MB growth
    
    console.log(`Large Circle Performance:
      Circle Size: ${circleSize} actors
      Operations: ${operations}
      Avg Operation Time: ${averageOperationTime.toFixed(2)}ms
      Memory Growth: ${memoryGrowth.toFixed(2)}MB`);
  });
});
```

## Performance Test Utilities

### Performance Test Bed
```javascript
// tests/common/performanceTestBed.js
export function createPerformanceTestBed() {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };

  const mockEntityManager = {
    getComponent: jest.fn(),
    upsertComponent: jest.fn(),
    removeComponent: jest.fn(),
    hasComponent: jest.fn()
  };

  const mockEventBus = {
    dispatch: jest.fn()
  };

  const mockClosenessCircleService = {
    merge: jest.fn(),
    repair: jest.fn(),
    dedupe: jest.fn(partners => partners)
  };

  const mockOperationContext = {
    setVariable: jest.fn(),
    getVariable: jest.fn()
  };

  return {
    mockLogger,
    mockEntityManager, 
    mockEventBus,
    mockClosenessCircleService,
    mockOperationContext,
    
    createMockLogger: () => mockLogger,
    createMockEntityManager: () => mockEntityManager,
    createMockEventBus: () => mockEventBus,
    createMockClosenessCircleService: () => mockClosenessCircleService,
    createMockOperationContext: () => mockOperationContext,
    
    cleanup() {
      jest.clearAllMocks();
    }
  };
}
```

## Implementation Checklist

### Phase 1: Performance Test Infrastructure
- [ ] Create performance test bed utilities
- [ ] Set up memory monitoring and metrics collection
- [ ] Configure performance measurement tools
- [ ] Implement test data generation helpers

### Phase 2: Core Performance Tests
- [ ] Implement utility function benchmark tests
- [ ] Implement operation handler performance tests
- [ ] Implement scalability testing with varying load
- [ ] Implement concurrent operation performance tests

### Phase 3: Memory and Resource Tests
- [ ] Implement memory leak detection tests
- [ ] Implement large furniture scenario tests
- [ ] Implement long-running operation tests
- [ ] Implement resource utilization monitoring

### Phase 4: Analysis and Reporting
- [ ] Implement performance metrics collection and reporting
- [ ] Create performance regression detection
- [ ] Set up continuous performance monitoring
- [ ] Document performance benchmarks and targets

## Definition of Done
- [ ] All performance test files created with comprehensive coverage
- [ ] Performance benchmarks established and documented
- [ ] Memory leak detection tests validate no excessive growth
- [ ] Scalability tests demonstrate linear performance scaling
- [ ] Concurrent operation tests validate multi-user scenarios
- [ ] Performance regression detection implemented
- [ ] All tests pass performance targets consistently
- [ ] Performance monitoring utilities created and reusable
- [ ] CI/CD integration for performance regression prevention
- [ ] Documentation covers performance characteristics and limitations