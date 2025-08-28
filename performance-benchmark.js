#!/usr/bin/env node
/**
 * Performance benchmark for priority calculation system
 */

import { 
  calculateCoveragePriorityOptimized, 
  clearPriorityCache, 
  getCacheStats 
} from './src/scopeDsl/prioritySystem/priorityCalculator.js';

console.log('=== Priority System Performance Benchmark ===\n');

// Test data
const testCoverages = ['outer', 'base', 'underwear', 'direct'];
const testLayers = ['outer', 'base', 'underwear', 'accessories'];
const iterations = 10000;

console.log(`Test parameters:`);
console.log(`- Coverage types: ${testCoverages.length}`);
console.log(`- Layer types: ${testLayers.length}`);
console.log(`- Total combinations: ${testCoverages.length * testLayers.length}`);
console.log(`- Iterations per test: ${iterations}`);
console.log('');

// Clear cache to start fresh
clearPriorityCache();

// Performance test without cache (first run)
console.log('🔥 Testing performance WITHOUT cache (cold start):');
const startCold = process.hrtime.bigint();

for (let i = 0; i < iterations; i++) {
  const coverage = testCoverages[i % testCoverages.length];
  const layer = testLayers[i % testLayers.length];
  calculateCoveragePriorityOptimized(coverage, layer);
}

const endCold = process.hrtime.bigint();
const coldDuration = Number(endCold - startCold) / 1000000; // Convert to milliseconds

console.log(`Cold start duration: ${coldDuration.toFixed(2)}ms`);
console.log(`Average per calculation: ${(coldDuration / iterations).toFixed(4)}ms`);

const cacheStats = getCacheStats();
console.log(`Cache size after cold run: ${cacheStats.size}`);
console.log('');

// Performance test with cache (second run, should hit cache)
console.log('⚡ Testing performance WITH cache (warm run):');
const startWarm = process.hrtime.bigint();

for (let i = 0; i < iterations; i++) {
  const coverage = testCoverages[i % testCoverages.length];
  const layer = testLayers[i % testLayers.length];
  calculateCoveragePriorityOptimized(coverage, layer);
}

const endWarm = process.hrtime.bigint();
const warmDuration = Number(endWarm - startWarm) / 1000000; // Convert to milliseconds

console.log(`Warm run duration: ${warmDuration.toFixed(2)}ms`);
console.log(`Average per calculation: ${(warmDuration / iterations).toFixed(4)}ms`);
console.log('');

// Performance analysis
const performanceImprovement = ((coldDuration - warmDuration) / coldDuration) * 100;
const speedup = coldDuration / warmDuration;

console.log('📊 PERFORMANCE ANALYSIS:');
console.log(`Performance improvement: ${performanceImprovement.toFixed(1)}%`);
console.log(`Speed multiplier: ${speedup.toFixed(1)}x faster`);

// Validation against target (>50% improvement)
const targetImprovement = 50;
console.log('');
if (performanceImprovement >= targetImprovement) {
  console.log(`✅ TARGET MET: ${performanceImprovement.toFixed(1)}% improvement exceeds ${targetImprovement}% target`);
} else {
  console.log(`❌ TARGET MISSED: ${performanceImprovement.toFixed(1)}% improvement below ${targetImprovement}% target`);
}

// Cache efficiency analysis
console.log('');
console.log('💾 CACHE ANALYSIS:');
console.log(`Expected unique combinations: ${testCoverages.length * testLayers.length}`);
console.log(`Actual cache entries: ${cacheStats.size}`);
console.log(`Cache efficiency: ${cacheStats.size === (testCoverages.length * testLayers.length) ? 'Perfect' : 'Suboptimal'}`);

// Memory usage estimation
const estimatedMemoryPerEntry = 50; // bytes (rough estimate)
const totalMemoryUsage = cacheStats.size * estimatedMemoryPerEntry;
console.log(`Estimated memory usage: ${totalMemoryUsage} bytes (~${(totalMemoryUsage/1024).toFixed(1)}KB)`);

console.log('');
console.log('🎯 BENCHMARK COMPLETE');

// Cleanup
clearPriorityCache();