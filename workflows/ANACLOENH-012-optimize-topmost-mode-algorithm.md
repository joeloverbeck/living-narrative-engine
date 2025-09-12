# ANACLOENH-012: Optimize Topmost Mode Algorithm

## Overview
Optimize the clothing accessibility service's topmost mode algorithm, which currently shows 5-15x slower performance than 'all' mode due to O(n*m) complexity in deduplication logic. Target 50% performance improvement while maintaining correctness.

## Current State
- **Performance**: 'Topmost' mode 5-15x slower than 'all' mode
- **Complexity**: O(n*m) deduplication logic with worst-case scenarios
- **Metrics**: Large wardrobes (100+ items) take 10-30ms per query
- **Bottleneck**: Priority calculations and deduplication performed repeatedly

## Objectives
1. Reduce topmost mode complexity from O(n*m) to O(n log n)
2. Implement priority queue-based deduplication
3. Add query result memoization for repeated calculations
4. Optimize priority calculation caching
5. Achieve 50% performance improvement in topmost queries

## Technical Requirements

### Current Algorithm Analysis
```javascript
// Current implementation pattern (inefficient)
// Location: Analysis based on tests/performance/clothing/clothingAccessibilityService.performance.test.js

class CurrentTopmostAlgorithm {
  getTopmostItems(equipment) {
    const allItems = [];
    
    // O(n) - collect all items
    for (const [slot, items] of Object.entries(equipment)) {
      allItems.push(...items.map(item => ({ ...item, slot })));
    }
    
    // O(n*m) - deduplication with priority comparison
    const visibleItems = [];
    for (const item of allItems) {
      let shouldAdd = true;
      
      // Check against all existing items for conflicts - O(m)
      for (const existing of visibleItems) {
        if (this.itemsConflict(item, existing)) {
          if (this.getPriority(item) > this.getPriority(existing)) {
            // Remove existing, add new
            const index = visibleItems.indexOf(existing);
            visibleItems.splice(index, 1);
          } else {
            shouldAdd = false;
            break;
          }
        }
      }
      
      if (shouldAdd) {
        visibleItems.push(item);
      }
    }
    
    return visibleItems;
  }
}
```

### Optimized Algorithm Implementation
```javascript
// Location: src/clothing/algorithms/OptimizedTopmostResolver.js
class OptimizedTopmostResolver {
  #priorityCache;
  #conflictCache;
  
  constructor({ cache }) {
    this.#priorityCache = cache;
    this.#conflictCache = new Map();
  }
  
  getTopmostItems(equipment) {
    // Use priority queue for efficient topmost resolution
    const slotQueues = this.#buildSlotPriorityQueues(equipment);
    const visibilityGraph = this.#buildVisibilityGraph(slotQueues);
    
    return this.#resolveTopmost(visibilityGraph);
  }
  
  #buildSlotPriorityQueues(equipment) {
    const slotQueues = new Map();
    
    // O(n log n) - build priority queue per slot
    for (const [slot, items] of Object.entries(equipment)) {
      const queue = new PriorityQueue((a, b) => {
        return this.#getCachedPriority(b) - this.#getCachedPriority(a);
      });
      
      for (const item of items) {
        queue.enqueue({ ...item, slot });
      }
      
      slotQueues.set(slot, queue);
    }
    
    return slotQueues;
  }
  
  #buildVisibilityGraph(slotQueues) {
    const graph = new VisibilityGraph();
    
    // O(n) - add all items as nodes
    for (const [slot, queue] of slotQueues.entries()) {
      while (!queue.isEmpty()) {
        const item = queue.dequeue();
        graph.addNode(item);
      }
    }
    
    // O(n log n) - build conflict edges using spatial indexing
    this.#addConflictEdges(graph);
    
    return graph;
  }
  
  #addConflictEdges(graph) {
    const spatialIndex = this.#buildSpatialIndex(graph.nodes);
    
    for (const node of graph.nodes) {
      const potentialConflicts = spatialIndex.query(node.bounds);
      
      for (const other of potentialConflicts) {
        if (node !== other && this.#itemsConflict(node, other)) {
          graph.addEdge(node, other, {
            type: 'blocks',
            priority: this.#getCachedPriority(node)
          });
        }
      }
    }
  }
  
  #resolveTopmost(graph) {
    // Topological sort with priority resolution
    const resolved = [];
    const blocked = new Set();
    
    // Process nodes in priority order
    const prioritySorted = [...graph.nodes].sort((a, b) => 
      this.#getCachedPriority(b) - this.#getCachedPriority(a)
    );
    
    for (const node of prioritySorted) {
      if (!blocked.has(node)) {
        resolved.push(node);
        
        // Block all lower priority conflicting items
        const conflicts = graph.getConflicts(node);
        for (const conflict of conflicts) {
          if (this.#getCachedPriority(conflict) < this.#getCachedPriority(node)) {
            blocked.add(conflict);
          }
        }
      }
    }
    
    return resolved;
  }
  
  #getCachedPriority(item) {
    const cacheKey = `priority:${item.id}:${item.layer}`;
    
    return this.#priorityCache.get(cacheKey, () => {
      return this.#calculatePriority(item);
    });
  }
  
  #calculatePriority(item) {
    // Optimized priority calculation
    let priority = 0;
    
    // Layer priority (most significant)
    priority += (item.layer || 0) * 1000;
    
    // Equipment priority
    priority += (item.equipmentPriority || 0) * 100;
    
    // Coverage priority
    priority += this.#calculateCoveragePriority(item) * 10;
    
    // Material priority
    priority += this.#getMaterialPriority(item.material || 'default');
    
    return priority;
  }
  
  #itemsConflict(item1, item2) {
    const cacheKey = `conflict:${item1.id}:${item2.id}`;
    
    // Use symmetric cache key
    const symmetricKey = item1.id < item2.id ? cacheKey : 
      `conflict:${item2.id}:${item1.id}`;
    
    if (this.#conflictCache.has(symmetricKey)) {
      return this.#conflictCache.get(symmetricKey);
    }
    
    const conflicts = this.#calculateConflict(item1, item2);
    this.#conflictCache.set(symmetricKey, conflicts);
    
    return conflicts;
  }
  
  #buildSpatialIndex(items) {
    // Simple spatial index for conflict detection
    const index = new Map();
    
    for (const item of items) {
      const bounds = this.#getItemBounds(item);
      const key = `${Math.floor(bounds.x / 10)}:${Math.floor(bounds.y / 10)}`;
      
      if (!index.has(key)) {
        index.set(key, []);
      }
      index.get(key).push(item);
    }
    
    return {
      query: (bounds) => {
        const results = [];
        const startX = Math.floor(bounds.x / 10);
        const startY = Math.floor(bounds.y / 10);
        const endX = Math.floor((bounds.x + bounds.width) / 10);
        const endY = Math.floor((bounds.y + bounds.height) / 10);
        
        for (let x = startX; x <= endX; x++) {
          for (let y = startY; y <= endY; y++) {
            const key = `${x}:${y}`;
            if (index.has(key)) {
              results.push(...index.get(key));
            }
          }
        }
        
        return results;
      }
    };
  }
}
```

### Priority Queue Implementation
```javascript
// Location: src/common/collections/PriorityQueue.js
class PriorityQueue {
  #heap;
  #compareFn;
  
  constructor(compareFn) {
    this.#heap = [];
    this.#compareFn = compareFn || ((a, b) => a - b);
  }
  
  enqueue(item) {
    this.#heap.push(item);
    this.#bubbleUp(this.#heap.length - 1);
  }
  
  dequeue() {
    if (this.#heap.length === 0) return null;
    
    const result = this.#heap[0];
    const last = this.#heap.pop();
    
    if (this.#heap.length > 0) {
      this.#heap[0] = last;
      this.#bubbleDown(0);
    }
    
    return result;
  }
  
  isEmpty() {
    return this.#heap.length === 0;
  }
  
  #bubbleUp(index) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      
      if (this.#compareFn(this.#heap[index], this.#heap[parentIndex]) <= 0) {
        break;
      }
      
      this.#swap(index, parentIndex);
      index = parentIndex;
    }
  }
  
  #bubbleDown(index) {
    while (true) {
      let targetIndex = index;
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      
      if (leftChild < this.#heap.length && 
          this.#compareFn(this.#heap[leftChild], this.#heap[targetIndex]) > 0) {
        targetIndex = leftChild;
      }
      
      if (rightChild < this.#heap.length && 
          this.#compareFn(this.#heap[rightChild], this.#heap[targetIndex]) > 0) {
        targetIndex = rightChild;
      }
      
      if (targetIndex === index) break;
      
      this.#swap(index, targetIndex);
      index = targetIndex;
    }
  }
  
  #swap(i, j) {
    [this.#heap[i], this.#heap[j]] = [this.#heap[j], this.#heap[i]];
  }
}

export default PriorityQueue;
```

### Visibility Graph Helper
```javascript
// Location: src/clothing/algorithms/VisibilityGraph.js
class VisibilityGraph {
  constructor() {
    this.nodes = [];
    this.adjacencyList = new Map();
  }
  
  addNode(item) {
    this.nodes.push(item);
    this.adjacencyList.set(item, []);
  }
  
  addEdge(from, to, metadata = {}) {
    this.adjacencyList.get(from).push({ node: to, ...metadata });
  }
  
  getConflicts(node) {
    return (this.adjacencyList.get(node) || [])
      .filter(edge => edge.type === 'blocks')
      .map(edge => edge.node);
  }
  
  getNeighbors(node) {
    return (this.adjacencyList.get(node) || []).map(edge => edge.node);
  }
}

export default VisibilityGraph;
```

## Implementation Steps

1. **Create Priority Queue Implementation** (Day 1)
   - Implement efficient heap-based priority queue
   - Add comprehensive unit tests
   - Benchmark against array-based sorting

2. **Build Optimized Topmost Resolver** (Day 2-3)
   - Implement slot-based priority queues
   - Add visibility graph construction
   - Create spatial indexing for conflicts

3. **Add Caching Layers** (Day 4)
   - Implement priority calculation caching
   - Add conflict resolution caching
   - Create cache invalidation strategies

4. **Integration with Facade** (Day 5)
   - Update ClothingSystemFacade to use optimized resolver
   - Add configuration options for algorithm selection
   - Maintain backward compatibility

5. **Performance Testing and Tuning** (Day 6)
   - Run comprehensive benchmarks
   - Compare against baseline performance
   - Fine-tune cache sizes and thresholds

## File Changes

### New Files
- `src/common/collections/PriorityQueue.js`
- `src/clothing/algorithms/OptimizedTopmostResolver.js`
- `src/clothing/algorithms/VisibilityGraph.js`
- `src/clothing/algorithms/SpatialIndex.js`

### Modified Files
- `src/clothing/facades/ClothingSystemFacade.js` - Use optimized resolver
- `src/clothing/services/clothingAccessibilityService.js` - Add algorithm selection

### Test Files
- `tests/unit/common/collections/PriorityQueue.test.js`
- `tests/unit/clothing/algorithms/OptimizedTopmostResolver.test.js`
- `tests/performance/clothing/topmostOptimization.performance.test.js`
- `tests/integration/clothing/optimizedTopmost.integration.test.js`

## Dependencies
- **Prerequisites**: 
  - ANACLOENH-001 (Unified Cache)
  - ANACLOENH-007 (Clothing Facade)
- **External**: None
- **Internal**: ClothingAccessibilityService, UnifiedCache

## Acceptance Criteria
1. ✅ Topmost mode performance improved by >50%
2. ✅ Algorithm complexity reduced to O(n log n)
3. ✅ All existing tests continue to pass
4. ✅ Cache hit rate >80% for repeated queries
5. ✅ Spatial indexing reduces conflict checks by >60%
6. ✅ Priority queue operations <0.1ms per operation
7. ✅ Memory usage increase <20% for optimization
8. ✅ Results identical to original algorithm

## Testing Requirements

### Unit Tests
- Test priority queue correctness
- Verify topmost resolution accuracy
- Test cache behavior
- Validate conflict detection

### Performance Tests
- Benchmark topmost vs all mode
- Test with various wardrobe sizes
- Measure cache effectiveness
- Compare memory usage

### Integration Tests
- Test with real clothing data
- Verify facade integration
- Test error scenarios

## Risk Assessment

### Risks
1. **Algorithm complexity**: New algorithm might have edge cases
2. **Memory usage**: Caching and indexing increase memory
3. **Cache invalidation**: Incorrect invalidation could cause stale results

### Mitigation
1. Comprehensive test suite with edge cases
2. Configurable cache limits and monitoring
3. Event-driven cache invalidation

## Estimated Effort
- **Algorithm design**: 1 day
- **Implementation**: 3 days
- **Caching layer**: 1 day
- **Integration**: 1 day
- **Testing**: 1 day
- **Total**: 7 days

## Success Metrics
- 50% improvement in topmost mode performance
- 60% reduction in conflict detection overhead
- 80% cache hit rate for priority calculations
- Zero functional regressions

## Performance Comparison Target
```
Operation                | Before    | Target    | Improvement
-------------------------|-----------|-----------|------------
Small wardrobe (10 items) | 5ms      | 2.5ms     | 50%
Medium wardrobe (50 items)| 15ms     | 7.5ms     | 50%
Large wardrobe (100 items)| 30ms     | 15ms      | 50%
Cache hit scenario        | 5ms      | 0.1ms     | 98%

Memory Usage:
Base algorithm           | 10MB      | 10MB      | 0%
With optimization        | 10MB      | 12MB      | +20%
```

## Notes
- Consider implementing A* pathfinding for complex visibility resolution
- Add metrics collection for algorithm performance monitoring
- Consider WebAssembly implementation for performance-critical sections
- Plan for GPU acceleration of conflict detection in future iterations