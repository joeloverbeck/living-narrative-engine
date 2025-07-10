/**
 * Performance benchmark for anatomy system optimizations
 * Tests the performance improvements from:
 * 1. Cache persistence (no rebuilding)
 * 2. Component index (O(1) lookup)
 * 3. Optimized child lookup in cache building
 */

import { performance } from 'perf_hooks';
import { BodyGraphService } from '../src/anatomy/bodyGraphService.js';
import { EntityManager } from '../src/entities/entityManager.js';
import { createDefaultDeps } from '../src/entities/utils/createDefaultDeps.js';
import { createDefaultServices } from '../src/entities/utils/createDefaultServices.js';

// Mock logger for benchmarking
const mockLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

// Create entity manager with real implementation
const deps = createDefaultDeps();
deps.logger = mockLogger;
const services = createDefaultServices(deps);
const entityManager = new EntityManager({ ...deps, ...services });

// Create anatomy system services
const mockEventDispatcher = {
  dispatch: async () => {},
};

const bodyGraphService = new BodyGraphService({
  entityManager,
  logger: mockLogger,
  eventDispatcher: mockEventDispatcher,
});

/**
 * Create a test anatomy with specified number of parts
 */
async function createTestAnatomy(numParts) {
  const parts = [];
  
  // Create root torso
  const torso = await entityManager.createEntity('anatomy-part', {
    components: {
      'anatomy:part': { subType: 'torso' },
    },
  });
  parts.push(torso);
  
  // Create body parts in a tree structure
  for (let i = 1; i < numParts; i++) {
    const parentIndex = Math.floor((i - 1) / 2);
    const parent = parts[parentIndex];
    
    const part = await entityManager.createEntity('anatomy-part', {
      components: {
        'anatomy:part': { subType: `part-${i}` },
        'anatomy:joint': {
          parentId: parent.id,
          socketId: `socket-${i}`,
        },
      },
    });
    parts.push(part);
  }
  
  return { root: torso, parts };
}

/**
 * Benchmark cache persistence
 */
async function benchmarkCachePersistence(numParts, iterations) {
  console.log(`\n=== Cache Persistence Benchmark (${numParts} parts, ${iterations} iterations) ===`);
  
  const { root } = await createTestAnatomy(numParts);
  
  // First build - this will create the cache
  const firstBuildStart = performance.now();
  bodyGraphService.buildAdjacencyCache(root.id);
  const firstBuildTime = performance.now() - firstBuildStart;
  
  console.log(`First cache build: ${firstBuildTime.toFixed(2)}ms`);
  
  // Subsequent builds - should be instant with cache persistence
  let totalRebuildTime = 0;
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    bodyGraphService.buildAdjacencyCache(root.id);
    totalRebuildTime += performance.now() - start;
  }
  
  const avgRebuildTime = totalRebuildTime / iterations;
  console.log(`Average rebuild time: ${avgRebuildTime.toFixed(2)}ms`);
  console.log(`Performance improvement: ${(firstBuildTime / avgRebuildTime).toFixed(0)}x faster`);
}

/**
 * Benchmark component index lookup
 */
async function benchmarkComponentIndex(numEntities, iterations) {
  console.log(`\n=== Component Index Benchmark (${numEntities} entities, ${iterations} iterations) ===`);
  
  // Create entities with various components
  const componentTypes = ['component:a', 'component:b', 'component:c', 'component:d'];
  
  for (let i = 0; i < numEntities; i++) {
    const components = {};
    
    // Randomly assign 1-3 components to each entity
    const numComponents = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < numComponents; j++) {
      const componentType = componentTypes[Math.floor(Math.random() * componentTypes.length)];
      components[componentType] = { value: i };
    }
    
    await entityManager.createEntity('test-entity', { components });
  }
  
  // Benchmark lookups
  let totalLookupTime = 0;
  for (let i = 0; i < iterations; i++) {
    const componentType = componentTypes[i % componentTypes.length];
    const start = performance.now();
    const entities = entityManager.getEntitiesWithComponent(componentType);
    totalLookupTime += performance.now() - start;
  }
  
  const avgLookupTime = totalLookupTime / iterations;
  console.log(`Average lookup time: ${avgLookupTime.toFixed(4)}ms`);
  console.log(`Lookups per second: ${Math.floor(1000 / avgLookupTime)}`);
}

/**
 * Benchmark anatomy operations
 */
async function benchmarkAnatomyOperations(numParts) {
  console.log(`\n=== Anatomy Operations Benchmark (${numParts} parts) ===`);
  
  const { root, parts } = await createTestAnatomy(numParts);
  
  // Build cache first
  bodyGraphService.buildAdjacencyCache(root.id);
  
  // Benchmark findPartsByType
  const partTypes = ['torso', 'part-1', 'part-10', 'part-50'];
  let totalFindTime = 0;
  const iterations = 100;
  
  for (let i = 0; i < iterations; i++) {
    const partType = partTypes[i % partTypes.length];
    const start = performance.now();
    const foundParts = bodyGraphService.findPartsByType(root.id, partType);
    totalFindTime += performance.now() - start;
  }
  
  const avgFindTime = totalFindTime / iterations;
  console.log(`Average findPartsByType: ${avgFindTime.toFixed(4)}ms`);
  
  // Benchmark getPath
  let totalPathTime = 0;
  const pathIterations = 50;
  
  for (let i = 0; i < pathIterations; i++) {
    const fromPart = parts[Math.floor(Math.random() * parts.length)];
    const toPart = parts[Math.floor(Math.random() * parts.length)];
    
    const start = performance.now();
    const path = bodyGraphService.getPath(fromPart.id, toPart.id);
    totalPathTime += performance.now() - start;
  }
  
  const avgPathTime = totalPathTime / pathIterations;
  console.log(`Average getPath: ${avgPathTime.toFixed(4)}ms`);
}

// Run benchmarks
async function runBenchmarks() {
  console.log('Starting anatomy system performance benchmarks...');
  
  // Test with different anatomy sizes
  await benchmarkCachePersistence(100, 1000);
  await benchmarkCachePersistence(500, 1000);
  
  // Test component index with different entity counts
  await benchmarkComponentIndex(1000, 1000);
  await benchmarkComponentIndex(10000, 1000);
  
  // Test anatomy operations
  await benchmarkAnatomyOperations(100);
  await benchmarkAnatomyOperations(500);
  
  console.log('\nBenchmarks completed!');
}

// Run the benchmarks
runBenchmarks().catch(console.error);