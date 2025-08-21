# CORMOTSEL-010: Performance Optimization and Caching

## Priority: P3 (Low)
## Estimated Effort: 1 hour
## Status: TODO

## Problem Statement
With potentially many thematic directions across multiple concepts, performance optimization and caching strategies are needed to ensure the UI remains responsive, especially during initial load and when checking for clichés.

## Implementation Details

### Step 1: Implement Data Caching Strategy
```javascript
class CoreMotivationsGeneratorController extends BaseCharacterBuilderController {
  // Add cache properties
  #dataCache = {
    directionsWithConcepts: null,
    eligibleDirections: null,
    timestamp: null,
    ttl: 5 * 60 * 1000 // 5 minutes TTL
  };
  
  /**
   * Check if cache is valid
   * @returns {boolean}
   */
  #isCacheValid() {
    if (!this.#dataCache.timestamp) return false;
    if (!this.#dataCache.directionsWithConcepts) return false;
    
    const age = Date.now() - this.#dataCache.timestamp;
    return age < this.#dataCache.ttl;
  }
  
  /**
   * Clear cache
   */
  #clearCache() {
    this.#dataCache = {
      directionsWithConcepts: null,
      eligibleDirections: null,
      timestamp: null,
      ttl: this.#dataCache.ttl
    };
    
    this.logger.debug('Cache cleared');
  }
  
  /**
   * Update cache with new data
   */
  #updateCache(directionsWithConcepts, eligibleDirections) {
    this.#dataCache = {
      directionsWithConcepts,
      eligibleDirections,
      timestamp: Date.now(),
      ttl: this.#dataCache.ttl
    };
    
    this.logger.debug('Cache updated with', eligibleDirections.length, 'directions');
  }
}
```

### Step 2: Optimize Data Loading with Cache
```javascript
async #loadEligibleDirections() {
  try {
    // Check cache first
    if (this.#isCacheValid()) {
      this.logger.info('Using cached directions data');
      this.#eligibleDirections = this.#dataCache.eligibleDirections;
      this.#directionsWithConceptsMap = new Map(
        this.#dataCache.directionsWithConcepts.map(item => [item.direction.id, item])
      );
      this.#populateDirectionSelector(this.#eligibleDirections);
      return;
    }
    
    this.#setLoadingState(true);
    const startTime = performance.now();
    
    // Load fresh data
    const directionsWithConcepts = 
      await this.characterBuilderService.getAllThematicDirectionsWithConcepts();
    
    if (!directionsWithConcepts || directionsWithConcepts.length === 0) {
      this.#eligibleDirections = [];
      this.#showEmptyState();
      return;
    }
    
    // Batch check for clichés (optimization)
    const eligibleDirections = await this.#batchFilterDirectionsWithCliches(
      directionsWithConcepts
    );
    
    // Update cache
    this.#updateCache(directionsWithConcepts, eligibleDirections);
    
    // Continue with normal flow...
    this.#directionsWithConceptsMap = new Map(
      eligibleDirections.map((item) => [item.direction.id, item])
    );
    
    const directions = eligibleDirections.map((item) => item.direction);
    this.#eligibleDirections = await this.#organizeDirectionsByConcept(directions);
    this.#populateDirectionSelector(this.#eligibleDirections);
    
    const loadTime = performance.now() - startTime;
    this.logger.info(`Loaded directions in ${loadTime.toFixed(2)}ms`);
    
  } catch (error) {
    this.logger.error('Failed to load eligible directions', error);
    this.#handleError(error, 'Failed to load thematic directions');
  } finally {
    this.#setLoadingState(false);
  }
}
```

### Step 3: Implement Batch Cliché Checking
```javascript
/**
 * Batch filter directions with clichés for better performance
 * @param {Array} directionsWithConcepts
 * @returns {Promise<Array>}
 */
async #batchFilterDirectionsWithCliches(directionsWithConcepts) {
  const BATCH_SIZE = 10; // Process in batches to avoid blocking
  const eligibleDirections = [];
  
  // Create batches
  const batches = [];
  for (let i = 0; i < directionsWithConcepts.length; i += BATCH_SIZE) {
    batches.push(directionsWithConcepts.slice(i, i + BATCH_SIZE));
  }
  
  // Process batches with progress updates
  let processedCount = 0;
  for (const batch of batches) {
    const batchPromises = batch.map(async (item) => {
      const hasClichés = await this.characterBuilderService.hasClichesForDirection(
        item.direction.id
      );
      return hasClichés ? item : null;
    });
    
    const batchResults = await Promise.all(batchPromises);
    
    // Filter out nulls and add to eligible
    batchResults.forEach(result => {
      if (result) {
        eligibleDirections.push(result);
      }
    });
    
    processedCount += batch.length;
    this.#updateLoadingProgress(processedCount, directionsWithConcepts.length);
    
    // Allow UI to update between batches
    await this.#yieldToUI();
  }
  
  return eligibleDirections;
}

/**
 * Yield control back to UI thread
 */
async #yieldToUI() {
  return new Promise(resolve => setTimeout(resolve, 0));
}
```

### Step 4: Implement Virtual Scrolling for Large Lists
```javascript
/**
 * Implement virtual scrolling for dropdown with many items
 */
#implementVirtualScrolling() {
  const selector = document.getElementById('direction-selector');
  const optionCount = selector.querySelectorAll('option').length;
  
  // Only apply virtual scrolling for large lists
  if (optionCount > 200) {
    // Note: Native select doesn't support virtual scrolling
    // Consider using a custom dropdown component for very large lists
    this.logger.warn(
      `Large number of options (${optionCount}). ` +
      'Consider implementing pagination or search filtering.'
    );
    
    // Add search filter as alternative
    this.#addSearchFilter();
  }
}

/**
 * Add search filter for large direction lists
 */
#addSearchFilter() {
  const container = document.getElementById('direction-selector').parentElement;
  
  // Create search input
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.id = 'direction-search';
  searchInput.placeholder = 'Search directions...';
  searchInput.className = 'form-control mb-2';
  
  container.insertBefore(searchInput, document.getElementById('direction-selector'));
  
  // Add search functionality
  searchInput.addEventListener('input', (e) => {
    this.#filterDirections(e.target.value);
  });
}

/**
 * Filter visible directions based on search term
 */
#filterDirections(searchTerm) {
  const selector = document.getElementById('direction-selector');
  const term = searchTerm.toLowerCase();
  
  // Show/hide options based on search
  const options = selector.querySelectorAll('option');
  options.forEach(option => {
    if (!option.value) return; // Skip default option
    
    const text = option.textContent.toLowerCase();
    const conceptTitle = option.dataset.conceptTitle?.toLowerCase() || '';
    
    const matches = text.includes(term) || conceptTitle.includes(term);
    option.style.display = matches ? '' : 'none';
  });
  
  // Show/hide optgroups if all children are hidden
  const optgroups = selector.querySelectorAll('optgroup');
  optgroups.forEach(group => {
    const visibleOptions = group.querySelectorAll('option:not([style*="none"])');
    group.style.display = visibleOptions.length > 0 ? '' : 'none';
  });
}
```

### Step 5: Implement Lazy Loading
```javascript
/**
 * Implement lazy loading for concept details
 */
async #lazyLoadConceptDetails(conceptId) {
  // Check if already cached
  const cacheKey = `concept-${conceptId}`;
  if (this.#conceptCache.has(cacheKey)) {
    return this.#conceptCache.get(cacheKey);
  }
  
  // Load concept details
  const concept = await this.characterBuilderService.getCharacterConcept(conceptId);
  
  // Cache for future use
  this.#conceptCache.set(cacheKey, concept);
  
  // Limit cache size
  if (this.#conceptCache.size > 50) {
    const firstKey = this.#conceptCache.keys().next().value;
    this.#conceptCache.delete(firstKey);
  }
  
  return concept;
}
```

### Step 6: Add Performance Monitoring
```javascript
/**
 * Monitor and log performance metrics
 */
class PerformanceMonitor {
  static #metrics = new Map();
  
  static startMeasure(name) {
    this.#metrics.set(name, performance.now());
  }
  
  static endMeasure(name) {
    const startTime = this.#metrics.get(name);
    if (!startTime) return null;
    
    const duration = performance.now() - startTime;
    this.#metrics.delete(name);
    
    // Log if slow
    if (duration > 100) {
      console.warn(`Slow operation: ${name} took ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  }
}

// Usage in methods
async #loadEligibleDirections() {
  PerformanceMonitor.startMeasure('loadDirections');
  
  try {
    // ... loading logic
  } finally {
    const duration = PerformanceMonitor.endMeasure('loadDirections');
    this.logger.info(`Directions loaded in ${duration}ms`);
  }
}
```

### Step 7: Implement Debouncing for Frequent Operations
```javascript
/**
 * Debounce utility for search and other frequent operations
 */
#debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Apply debouncing to search
#setupSearchFilter() {
  const searchInput = document.getElementById('direction-search');
  
  const debouncedFilter = this.#debounce(
    (term) => this.#filterDirections(term),
    300 // 300ms delay
  );
  
  searchInput.addEventListener('input', (e) => {
    debouncedFilter(e.target.value);
  });
}
```

## Acceptance Criteria
- [ ] Cache is implemented and working
- [ ] Cache expires after 5 minutes
- [ ] Batch processing for cliché checks
- [ ] Loading progress indicator works
- [ ] Search filter added for large lists (200+ items)
- [ ] Performance metrics are logged
- [ ] Debouncing applied to search
- [ ] Page loads in <2 seconds with 100+ directions
- [ ] No UI freezing during load

## Dependencies
- **CORMOTSEL-001** through **CORMOTSEL-009**: Core implementation must be complete

## Performance Targets
- **Initial Load**: <2 seconds for 100 directions
- **Cache Hit**: <100ms for cached data
- **Search Filter**: <50ms response time
- **Direction Selection**: <100ms response time
- **Memory Usage**: <10MB for 500 directions

## Testing Performance
```javascript
describe('Performance Optimization', () => {
  it('should use cache on second load', async () => {
    // First load
    await controller.loadEligibleDirections();
    const firstCallCount = mockService.getAllThematicDirectionsWithConcepts.mock.calls.length;
    
    // Second load (should use cache)
    await controller.loadEligibleDirections();
    const secondCallCount = mockService.getAllThematicDirectionsWithConcepts.mock.calls.length;
    
    expect(secondCallCount).toBe(firstCallCount); // No additional calls
  });
  
  it('should complete batch processing without blocking', async () => {
    // Create many directions
    const directions = Array(100).fill(null).map((_, i) => ({
      direction: { id: `dir-${i}` },
      concept: { id: `concept-${i % 10}` }
    }));
    
    mockService.getAllThematicDirectionsWithConcepts.mockResolvedValue(directions);
    
    const start = performance.now();
    await controller.loadEligibleDirections();
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(2000);
  });
});
```

## Browser Profiling
Use Chrome DevTools Performance tab to:
1. Record page load
2. Check for long tasks (>50ms)
3. Verify no memory leaks
4. Monitor network requests

## Related Files
- **Controller**: `src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js`
- **Service**: `src/characterBuilder/services/characterBuilderService.js`
- **Performance Utils**: Consider creating `src/utils/performanceUtils.js`

## Notes
- Cache invalidation is important - clear cache when data changes
- Consider using IndexedDB for larger datasets
- Monitor real-world performance with analytics
- Consider progressive enhancement for very large datasets