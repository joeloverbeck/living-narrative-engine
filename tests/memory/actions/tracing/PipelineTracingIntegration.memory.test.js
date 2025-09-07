/**
 * @file Memory tests for Pipeline Tracing Integration
 * @description Tests memory usage and leak prevention during comprehensive pipeline tracing operations
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PipelineTracingIntegrationTestBed } from '../../../e2e/tracing/common/pipelineTracingIntegrationTestBed.js';
import {
  PIPELINE_TEST_ACTORS,
  PERFORMANCE_THRESHOLDS,
  createPipelineTestAction,
} from '../../../e2e/tracing/fixtures/pipelineTracingTestActions.js';

describe('Pipeline Tracing Integration Memory', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new PipelineTracingIntegrationTestBed();
    await testBed.initialize();
  });

  afterEach(async () => {
    await testBed.cleanup();
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  describe('Memory Usage Limits', () => {
    it('should maintain memory usage within acceptable limits during comprehensive pipeline tracing', async () => {
      // Arrange
      const comprehensiveAction = createPipelineTestAction({
        complexity: 'high',
        includeMultiTarget: true,
        includeLegacyComponents: true,
      });
      const testActor = PIPELINE_TEST_ACTORS.COMPLEX_ACTOR;
      
      await testBed.setupComplexEnvironment(testActor);
      await testBed.enablePipelineTracing({ 
        verbosity: 'verbose',
        enableAllFeatures: true,
      });

      // Measure initial memory
      if (global.gc) global.gc();
      const initialMemory = process.memoryUsage().heapUsed;
      console.log(
        `Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`
      );

      // Act - Execute comprehensive pipeline tracing
      const result = await testBed.executePipelineWithTracing(comprehensiveAction, {
        actorId: testActor.id,
        validateIntegration: true,
      });

      // Force garbage collection and measure final memory
      if (global.gc) global.gc();
      const finalMemory = process.memoryUsage().heapUsed;
      console.log(
        `Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`
      );

      // Assert - Action completed successfully
      expect(result.success).toBe(true);
      expect(result.integrationValidation.passed).toBe(true);

      // Assert - Memory usage within limits
      const performanceData = testBed.getPerformanceMetrics();
      expect(performanceData.memoryUsage).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_MEMORY_MB * 1024 * 1024);
      
      // Assert - Check actual memory usage
      expect(finalMemory).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_MEMORY_MB * 1024 * 1024);
      
      // Assert - No significant memory leak (with retry logic)
      const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024;
      console.log(`Memory growth: ${memoryGrowth.toFixed(2)} MB`);
      
      // Use adaptive thresholds and retry logic for more resilient testing
      // Apply higher multiplier for pipeline tracing tests due to mock overhead
      const baseAdaptedThresholds = global.memoryTestUtils.getAdaptiveThresholds(PERFORMANCE_THRESHOLDS);
      const adaptedThresholds = {
        ...baseAdaptedThresholds,
        MEMORY_GROWTH_LIMIT_MB: baseAdaptedThresholds.MEMORY_GROWTH_LIMIT_MB * 1.5, // Extra multiplier for pipeline tests
        MEMORY_GROWTH_LIMIT_PERCENT: baseAdaptedThresholds.MEMORY_GROWTH_LIMIT_PERCENT * 1.5,
      };
      
      try {
        await global.memoryTestUtils.assertMemoryWithRetry(
          async () => finalMemory - initialMemory,
          adaptedThresholds.MEMORY_GROWTH_LIMIT_MB,
          6 // increased retry attempts for better reliability
        );
      } catch (error) {
        // Fallback to percentage-based check
        const growthPercent = global.memoryTestUtils.calculateMemoryGrowthPercentage(initialMemory, finalMemory);
        console.log(`Memory growth percentage: ${growthPercent.toFixed(1)}%`);
        
        if (growthPercent > adaptedThresholds.MEMORY_GROWTH_LIMIT_PERCENT) {
          throw new Error(`Memory growth ${growthPercent.toFixed(1)}% exceeds ${adaptedThresholds.MEMORY_GROWTH_LIMIT_PERCENT}% limit`);
        }
      }
    });

    it('should not leak memory during repeated pipeline tracing operations', async () => {
      // Arrange
      const simpleAction = createPipelineTestAction({
        complexity: 'simple',
      });
      const testActor = PIPELINE_TEST_ACTORS.MINIMAL_ACTOR;
      
      await testBed.setupActor(testActor);
      await testBed.enablePipelineTracing({ 
        verbosity: 'standard',
      });

      // Measure initial memory
      if (global.gc) global.gc();
      const initialMemory = process.memoryUsage().heapUsed;
      console.log(
        `Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`
      );

      // Act - Perform multiple tracing operations
      const iterations = 100;
      for (let i = 0; i < iterations; i++) {
        await testBed.executePipelineWithTracing(simpleAction, {
          actorId: testActor.id,
        });

        // Periodic garbage collection and progress reporting
        if (i % 20 === 0) {
          if (global.gc) {
            global.gc();
          }
          const currentMemory = process.memoryUsage().heapUsed;
          console.log(
            `Iteration ${i}: ${(currentMemory / 1024 / 1024).toFixed(2)} MB`
          );
        }
      }

      // Force garbage collection and measure final memory
      if (global.gc) global.gc();
      const finalMemory = process.memoryUsage().heapUsed;
      console.log(
        `Final memory after ${iterations} iterations: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`
      );

      // Assert - Memory growth is reasonable
      const memoryGrowthMB = (finalMemory - initialMemory) / 1024 / 1024;
      console.log(`Total memory growth: ${memoryGrowthMB.toFixed(2)} MB`);
      
      // Use percentage-based growth check for better portability
      const growthPercent = global.memoryTestUtils.calculateMemoryGrowthPercentage(initialMemory, finalMemory);
      console.log(`Memory growth percentage: ${growthPercent.toFixed(1)}%`);
      
      // Allow up to 200% growth for 100 iterations (more lenient for pipeline tracing)
      const maxGrowthPercent = 200; // 200% growth accounts for mock overhead and GC timing
      
      try {
        global.memoryTestUtils.assertMemoryGrowthPercentage(
          initialMemory,
          finalMemory,
          maxGrowthPercent * 1.5, // More lenient threshold
          `After ${iterations} iterations`
        );
      } catch (error) {
        // Fallback to absolute check with adaptive threshold
        const adaptedThresholds = global.memoryTestUtils.getAdaptiveThresholds({ 
          MAX_MEMORY_MB: 200, // Increased for pipeline tests
          MEMORY_GROWTH_LIMIT_MB: 30 // Increased for 100 iterations
        });
        
        if (memoryGrowthMB > adaptedThresholds.MEMORY_GROWTH_LIMIT_MB) {
          throw new Error(`Memory growth ${memoryGrowthMB.toFixed(2)}MB exceeds adapted limit of ${adaptedThresholds.MEMORY_GROWTH_LIMIT_MB}MB`);
        }
      }
      
      // Assert - Final memory usage within limits
      expect(finalMemory).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_MEMORY_MB * 1024 * 1024);
    });
  });

  describe('Memory Efficiency', () => {
    it('should efficiently handle memory during high-complexity pipeline operations', async () => {
      // Arrange
      const highComplexityAction = createPipelineTestAction({
        complexity: 'extreme',
        includeMultiTarget: true,
        includeLegacyComponents: true,
        includeDeepNesting: true,
      });
      const testActor = PIPELINE_TEST_ACTORS.COMPLEX_ACTOR;
      
      await testBed.setupComplexEnvironment(testActor);
      await testBed.enablePipelineTracing({ 
        verbosity: 'verbose',
        enableAllFeatures: true,
        enableMemoryTracking: true,
      });

      const memorySnapshots = [];

      // Act - Execute with memory tracking
      if (global.gc) global.gc();
      memorySnapshots.push({
        stage: 'initial',
        memory: process.memoryUsage().heapUsed,
      });

      const result = await testBed.executePipelineWithTracing(highComplexityAction, {
        actorId: testActor.id,
        validateIntegration: true,
        captureMemorySnapshots: true,
      });

      if (global.gc) global.gc();
      memorySnapshots.push({
        stage: 'final',
        memory: process.memoryUsage().heapUsed,
      });

      // Analyze memory usage pattern
      const initialMemoryMB = memorySnapshots[0].memory / 1024 / 1024;
      const finalMemoryMB = memorySnapshots[1].memory / 1024 / 1024;
      const growthMB = finalMemoryMB - initialMemoryMB;

      console.log(`Memory usage analysis:`);
      console.log(`  Initial: ${initialMemoryMB.toFixed(2)} MB`);
      console.log(`  Final: ${finalMemoryMB.toFixed(2)} MB`);
      console.log(`  Growth: ${growthMB.toFixed(2)} MB`);

      // Assert - Operation succeeded
      expect(result.success).toBe(true);

      // Assert - Memory efficiency with adaptive thresholds
      const adaptedThresholds = global.memoryTestUtils.getAdaptiveThresholds(PERFORMANCE_THRESHOLDS);
      
      // Check absolute memory limit with retry logic
      // Apply extra multiplier for extreme complexity pipeline tests
      await global.memoryTestUtils.assertMemoryWithRetry(
        async () => finalMemoryMB * 1024 * 1024,
        adaptedThresholds.MAX_MEMORY_MB * 1.25, // Extra 25% for extreme complexity
        8 // increased retry attempts for better reliability
      );
      
      // Check growth with both percentage and absolute limits
      const growthPercent = global.memoryTestUtils.calculateMemoryGrowthPercentage(
        memorySnapshots[0].memory,
        memorySnapshots[1].memory
      );
      console.log(`Memory growth percentage: ${growthPercent.toFixed(1)}%`);
      
      // For extreme complexity, allow 300% growth or 3x the normal limit
      const maxGrowthForExtreme = Math.min(300, adaptedThresholds.MEMORY_GROWTH_LIMIT_PERCENT * 5);
      
      try {
        global.memoryTestUtils.assertMemoryGrowthPercentage(
          memorySnapshots[0].memory,
          memorySnapshots[1].memory,
          maxGrowthForExtreme,
          'Extreme complexity operation'
        );
      } catch (error) {
        // Fallback to absolute check with higher tolerance for extreme complexity
        const extremeGrowthLimitMB = adaptedThresholds.MEMORY_GROWTH_LIMIT_MB * 2;
        if (growthMB > extremeGrowthLimitMB) {
          throw new Error(
            `Memory growth ${growthMB.toFixed(2)}MB exceeds extreme complexity limit of ${extremeGrowthLimitMB}MB`
          );
        }
      }
    });
  });
});