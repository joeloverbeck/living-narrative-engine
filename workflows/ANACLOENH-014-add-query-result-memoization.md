# ANACLOENH-014: Add Query Result Memoization

## Overview
Implement intelligent memoization for clothing and anatomy query results to eliminate redundant computations and achieve 40-60% performance improvement for repeated queries.

## Current State
- **Repeated Calculations**: Same queries recalculated multiple times
- **No Smart Caching**: Basic caching without dependency tracking
- **Performance Impact**: 40-60% of queries are repetitive
- **Cache Misses**: High cache miss rate due to poor key design

## Objectives
1. Implement intelligent query result memoization
2. Add dependency-aware cache invalidation
3. Create smart cache key generation
4. Optimize cache hit rates for common query patterns
5. Reduce computational overhead for complex queries

## Technical Requirements

### Query Memoization System
```javascript
// Location: src/common/memoization/QueryMemoizer.js
class QueryMemoizer {
  #cache;
  #dependencyTracker;
  #keyGenerator;
  #hitRateTracker;
  
  constructor({ cache, dependencyTracker }) {
    this.#cache = cache;
    this.#dependencyTracker = dependencyTracker;
    this.#keyGenerator = new SmartKeyGenerator();
    this.#hitRateTracker = new Map();
  }
  
  async memoize(queryName, parameters, computeFn, options = {}) {
    const {
      ttl = 300000,           // 5 minutes default
      dependencies = [],      // Dependencies for invalidation
      keyNormalization = true, // Normalize parameter order
      compressionThreshold = 1000 // Compress results if larger
    } = options;
    
    // Generate smart cache key
    const cacheKey = this.#keyGenerator.generate(
      queryName,
      parameters,
      { normalize: keyNormalization }
    );
    
    // Track hit rate
    this.#trackQuery(queryName, cacheKey);
    
    return await this.#cache.get(cacheKey, async () => {
      // Execute expensive computation
      const result = await computeFn();
      
      // Register dependencies for invalidation
      if (dependencies.length > 0) {
        this.#dependencyTracker.register(cacheKey, dependencies);
      }
      
      // Compress large results
      if (JSON.stringify(result).length > compressionThreshold) {
        return this.#compressResult(result);
      }
      
      return result;
    }, { ttl });
  }
  
  invalidateByDependency(dependency) {
    const affectedKeys = this.#dependencyTracker.getAffectedKeys(dependency);
    
    for (const key of affectedKeys) {
      this.#cache.invalidate(key);
    }
    
    this.#dependencyTracker.cleanup(dependency);
  }
  
  getHitRate(queryName) {
    const stats = this.#hitRateTracker.get(queryName);
    return stats ? stats.hits / stats.total : 0;
  }
}
```

### Smart Key Generator
```javascript
// Location: src/common/memoization/SmartKeyGenerator.js
class SmartKeyGenerator {
  generate(queryName, parameters, options = {}) {
    const { normalize = true, maxLength = 200 } = options;
    
    let normalizedParams = parameters;
    
    if (normalize) {
      normalizedParams = this.#normalizeParameters(parameters);
    }
    
    const paramString = this.#serializeParameters(normalizedParams);
    const baseKey = `${queryName}:${paramString}`;
    
    if (baseKey.length > maxLength) {
      return `${queryName}:${this.#hashParameters(normalizedParams)}`;
    }
    
    return baseKey;
  }
  
  #normalizeParameters(params) {
    if (typeof params !== 'object' || params === null) {
      return params;
    }
    
    if (Array.isArray(params)) {
      return params.map(p => this.#normalizeParameters(p));
    }
    
    // Sort object keys for consistent ordering
    const sorted = {};
    const keys = Object.keys(params).sort();
    
    for (const key of keys) {
      sorted[key] = this.#normalizeParameters(params[key]);
    }
    
    return sorted;
  }
  
  #serializeParameters(params) {
    try {
      return JSON.stringify(params);
    } catch {
      return String(params);
    }
  }
  
  #hashParameters(params) {
    // Simple hash function for cache keys
    const str = this.#serializeParameters(params);
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }
}
```

### Clothing Query Memoization
```javascript
// Location: src/clothing/memoization/ClothingQueryMemoizer.js
class ClothingQueryMemoizer extends QueryMemoizer {
  constructor({ cache, entityManager }) {
    super({ 
      cache, 
      dependencyTracker: new ClothingDependencyTracker(entityManager)
    });
  }
  
  async memoizeAccessibilityQuery(entityId, mode, options) {
    return await this.memoize(
      'clothing.accessibility',
      { entityId, mode, options },
      () => this.#computeAccessibility(entityId, mode, options),
      {
        dependencies: [`entity:${entityId}`, `equipment:${entityId}`],
        ttl: 60000 // 1 minute for clothing queries
      }
    );
  }
  
  async memoizeEquipmentQuery(entityId, options) {
    return await this.memoize(
      'clothing.equipment',
      { entityId, options },
      () => this.#computeEquipment(entityId, options),
      {
        dependencies: [`entity:${entityId}`, `equipment:${entityId}`],
        ttl: 120000 // 2 minutes for equipment state
      }
    );
  }
  
  async memoizeCompatibilityQuery(entityId, itemId, slot) {
    return await this.memoize(
      'clothing.compatibility',
      { entityId, itemId, slot },
      () => this.#computeCompatibility(entityId, itemId, slot),
      {
        dependencies: [`entity:${entityId}`, `item:${itemId}`],
        ttl: 300000 // 5 minutes for compatibility checks
      }
    );
  }
}
```

### Anatomy Query Memoization
```javascript
// Location: src/anatomy/memoization/AnatomyQueryMemoizer.js
class AnatomyQueryMemoizer extends QueryMemoizer {
  async memoizeGraphQuery(entityId) {
    return await this.memoize(
      'anatomy.graph',
      { entityId },
      () => this.#computeGraph(entityId),
      {
        dependencies: [`entity:${entityId}`, `anatomy:${entityId}`],
        ttl: 600000 // 10 minutes for stable graphs
      }
    );
  }
  
  async memoizeDescriptionQuery(entityId, options) {
    return await this.memoize(
      'anatomy.description',
      { entityId, options },
      () => this.#computeDescription(entityId, options),
      {
        dependencies: [`entity:${entityId}`, `anatomy:${entityId}`],
        ttl: 300000, // 5 minutes for descriptions
        compressionThreshold: 500 // Compress long descriptions
      }
    );
  }
  
  async memoizeValidationQuery(entityId, constraints) {
    return await this.memoize(
      'anatomy.validation',
      { entityId, constraints },
      () => this.#computeValidation(entityId, constraints),
      {
        dependencies: [`entity:${entityId}`, `anatomy:${entityId}`],
        ttl: 180000 // 3 minutes for validation results
      }
    );
  }
}
```

## Implementation Steps

1. **Core Memoization Framework** (Day 1-2)
   - Implement QueryMemoizer base class
   - Create SmartKeyGenerator
   - Add dependency tracking system

2. **Clothing Query Integration** (Day 3)
   - Create ClothingQueryMemoizer
   - Integrate with accessibility service
   - Add equipment query memoization

3. **Anatomy Query Integration** (Day 4)
   - Create AnatomyQueryMemoizer
   - Integrate with graph operations
   - Add description memoization

4. **Facade Integration** (Day 5)
   - Update facades to use memoization
   - Add memoization configuration
   - Implement cache warming strategies

5. **Testing and Optimization** (Day 6)
   - Performance testing
   - Cache hit rate optimization
   - Memory usage validation

## File Changes

### New Files
- `src/common/memoization/QueryMemoizer.js`
- `src/common/memoization/SmartKeyGenerator.js`
- `src/common/memoization/DependencyTracker.js`
- `src/clothing/memoization/ClothingQueryMemoizer.js`
- `src/anatomy/memoization/AnatomyQueryMemoizer.js`

### Modified Files
- `src/clothing/facades/ClothingSystemFacade.js` - Add memoization
- `src/anatomy/facades/AnatomySystemFacade.js` - Add memoization
- `src/clothing/services/clothingAccessibilityService.js` - Memoization integration

### Test Files
- `tests/unit/common/memoization/QueryMemoizer.test.js`
- `tests/unit/common/memoization/SmartKeyGenerator.test.js`
- `tests/performance/memoization/queryMemoization.performance.test.js`

## Dependencies
- **Prerequisites**: ANACLOENH-001 (Unified Cache), ANACLOENH-007/008 (Facades)
- **Internal**: UnifiedCache, EntityManager

## Acceptance Criteria
1. ✅ 40-60% performance improvement for repeated queries
2. ✅ Cache hit rate >70% for common query patterns
3. ✅ Smart cache key generation handles parameter normalization
4. ✅ Dependency-based invalidation works correctly
5. ✅ Memory usage for memoization <10% overhead
6. ✅ All existing functionality preserved
7. ✅ Cache compression for large results

## Estimated Effort: 6 days
## Success Metrics: 50% performance improvement, 75% cache hit rate, <10% memory overhead