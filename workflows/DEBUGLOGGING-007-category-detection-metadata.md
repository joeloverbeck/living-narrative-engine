# DEBUGLOGGING-007: Add Category Detection and Metadata Enrichment

**Status**: Not Started  
**Priority**: P0 - Critical  
**Phase**: 1 - Infrastructure  
**Component**: Client-Side Logger  
**Estimated**: 3 hours  

## Description

Implement automatic category detection based on log message patterns and enrich log entries with contextual metadata. This will help organize logs and provide better debugging context.

## Technical Requirements

### 1. Category Detection Patterns
```javascript
const CATEGORY_PATTERNS = {
  engine: /GameEngine|engineState|gameSession|gameEngine/i,
  ui: /UI|Renderer|domUI|display|modal|button|widget/i,
  ecs: /Entity|Component|System|entityManager|entity\s+\w+/i,
  ai: /AI|LLM|notes|thoughts|memory|prompt|decision/i,
  persistence: /Save|Load|persist|storage|serialize|deserialize/i,
  anatomy: /anatomy|body|part|descriptor|blueprint|socket/i,
  actions: /action|target|resolution|candidate|discovery/i,
  turns: /turn|round|cycle|turnManager|roundManager/i,
  events: /event|dispatch|listener|eventBus|emit/i,
  validation: /validate|schema|ajv|validation|invalid/i,
  configuration: /config|configuration|settings|options/i,
  initialization: /init|bootstrap|startup|initialize/i,
  error: /error|exception|failed|failure|catch/i,
  performance: /performance|timing|latency|duration|benchmark/i,
  general: null // default fallback
};
```

### 2. Source Detection
Extract file and line number from stack trace:
```javascript
// Expected format: "filename.js:123"
function extractSource() {
  const stack = new Error().stack;
  // Parse stack to find calling location
  // Skip internal logger frames
}
```

### 3. Metadata Structure
```javascript
{
  // System metadata (always added)
  timestamp: "2024-12-20T10:15:30.123Z",
  sessionId: "uuid-v4",
  category: "detected-category",
  source: "file.js:line",
  
  // Browser metadata (configurable)
  browser: {
    userAgent: "...",
    url: "current URL",
    viewport: { width, height },
    screen: { width, height }
  },
  
  // Performance metadata (configurable)
  performance: {
    memory: {
      used: "JS heap size",
      total: "Total heap size"
    },
    timing: "ms since page load"
  },
  
  // User metadata (passed in)
  ...userProvidedMetadata
}
```

## Implementation Steps

1. **Create Category Detector**
   - [ ] Create `src/logging/categoryDetector.js`
   - [ ] Implement pattern matching logic
   - [ ] Add category scoring for ambiguous matches
   - [ ] Cache detection results for performance

2. **Category Detection Algorithm**
   ```javascript
   class CategoryDetector {
     detectCategory(message) {
       // Check cache first
       if (this.#cache.has(message)) {
         return this.#cache.get(message);
       }
       
       // Try each pattern
       for (const [category, pattern] of Object.entries(CATEGORY_PATTERNS)) {
         if (pattern && pattern.test(message)) {
           this.#cache.set(message, category);
           return category;
         }
       }
       
       return 'general';
     }
   }
   ```

3. **Create Source Extractor**
   - [ ] Create `src/logging/sourceExtractor.js`
   - [ ] Parse Error stack traces
   - [ ] Filter out logger internal frames
   - [ ] Handle different browser formats

4. **Source Extraction Logic**
   ```javascript
   class SourceExtractor {
     extractSource(depth = 3) {
       const stack = new Error().stack;
       const lines = stack.split('\n');
       
       // Skip Error message and logger frames
       const callerLine = lines[depth];
       
       // Extract file:line from different formats
       // Chrome: "at function (file:line:col)"
       // Firefox: "function@file:line:col"
       // Safari: "function@file:line:col"
       
       return this.#parseStackLine(callerLine);
     }
   }
   ```

5. **Create Metadata Enricher**
   - [ ] Create `src/logging/metadataEnricher.js`
   - [ ] Collect browser information
   - [ ] Collect performance metrics
   - [ ] Merge with user metadata

6. **Performance Optimization**
   - [ ] Implement LRU cache for category detection
   - [ ] Lazy load heavy metadata
   - [ ] Batch metadata collection
   - [ ] Use WeakMap for object associations

## Acceptance Criteria

- [ ] Categories are correctly detected from log messages
- [ ] Source file and line are extracted from stack
- [ ] Metadata includes all required fields
- [ ] Category detection is cached for performance
- [ ] Ambiguous messages default to 'general'
- [ ] Source extraction works in Chrome, Firefox, Safari
- [ ] Metadata enrichment doesn't impact performance
- [ ] User metadata is preserved and merged

## Dependencies

- **Used By**: DEBUGLOGGING-006 (RemoteLogger)
- **Used By**: DEBUGLOGGING-008 (HybridLogger)

## Testing Requirements

1. **Unit Tests**
   - [ ] Test category detection for each pattern
   - [ ] Test ambiguous message handling
   - [ ] Test source extraction in different browsers
   - [ ] Test metadata merging
   - [ ] Test cache functionality

2. **Performance Tests**
   - [ ] Test category detection speed
   - [ ] Test cache hit rate
   - [ ] Test metadata collection overhead
   - [ ] Test with 13,000+ unique messages

## Files to Create/Modify

- **Create**: `src/logging/categoryDetector.js`
- **Create**: `src/logging/sourceExtractor.js`
- **Create**: `src/logging/metadataEnricher.js`
- **Create**: `tests/unit/logging/categoryDetector.test.js`
- **Create**: `tests/unit/logging/sourceExtractor.test.js`
- **Create**: `tests/unit/logging/metadataEnricher.test.js`

## Category Priority Rules

When multiple patterns match:
1. Error category takes precedence (for error messages)
2. More specific patterns override general ones
3. First match wins for equal specificity
4. Cache the result for consistency

## Performance Considerations

- Category detection cache size: max 1000 entries (LRU)
- Source extraction: only on debug/error levels
- Metadata collection: lazy for expensive operations
- Use requestIdleCallback for non-critical metadata

## Browser Compatibility

Source extraction patterns:
```javascript
// Chrome/Edge
/at\s+(?:.*?\s+)?\(?(.+?):(\d+):(\d+)\)?/

// Firefox
/@(.+?):(\d+):(\d+)/

// Safari
/(?:.*?@)?(.+?):(\d+)(?::(\d+))?/
```

## Notes

- Consider adding custom category registration API
- May need to handle minified source maps
- Test with different build tools (esbuild output)
- Consider adding category statistics/analytics
- Cache invalidation strategy needed

## Related Tickets

- **Used By**: DEBUGLOGGING-006 (RemoteLogger)
- **Used By**: DEBUGLOGGING-008 (HybridLogger)
- **Related**: DEBUGLOGGING-002 (server-side categories)