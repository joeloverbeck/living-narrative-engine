# DEBUGLOGGING-007: Add Category Detection and Metadata Enrichment

**Status**: Not Started  
**Priority**: P0 - Critical  
**Phase**: 1 - Infrastructure  
**Component**: Client-Side Logger  
**Estimated**: 1.5 hours

## Description

**UPDATED**: Enhance existing category detection and metadata enrichment in RemoteLogger. The base functionality already exists but needs expansion with comprehensive patterns, caching, and performance optimizations. This will improve log organization and provide better debugging context.

## Current Implementation Status

✅ **Already Implemented in RemoteLogger**:

- Basic category detection (`#detectCategory()`) with engine, ui, ai, network patterns
- Source extraction (`#detectSource()`) with stack trace parsing
- Metadata enrichment (`#enrichLogEntry()`) with session, browser, and performance data

🔄 **Needs Enhancement**:

- Expand category patterns to include all domains
- Add caching and pattern priority rules
- Improve browser compatibility for source extraction
- Add configurable metadata collection

## Technical Requirements

### 1. Enhanced Category Detection Patterns

**Current Implementation** (simple keyword matching):

```javascript
// In RemoteLogger #detectCategory()
if (msg.includes('engine') || msg.includes('ecs') || msg.includes('entity'))
  return 'engine';
if (msg.includes('ui') || msg.includes('dom') || msg.includes('component'))
  return 'ui';
if (msg.includes('ai') || msg.includes('llm') || msg.includes('memory'))
  return 'ai';
if (msg.includes('fetch') || msg.includes('http') || msg.includes('request'))
  return 'network';
return undefined; // Note: returns undefined, not 'general'
```

**Enhanced Patterns** (to be added):

```javascript
const ENHANCED_CATEGORY_PATTERNS = {
  engine:
    /GameEngine|engineState|gameSession|gameEngine|ecs|entity(?!Manager)/i,
  ui: /UI|Renderer|domUI|display|modal|button|widget|component/i,
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
  network: /fetch|http|request|response|xhr/i, // Extend existing
  general: null, // default fallback (change from undefined)
};
```

### 2. Enhanced Source Detection

**Current Implementation** (already working):

```javascript
// In RemoteLogger #detectSource()
#detectSource() {
  const stack = new Error().stack;
  const lines = stack.split('\n');
  // Skip first 4 lines (Error, this method, addToBuffer, logger method)
  for (let i = 4; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line && !line.includes('remoteLogger.js')) {
      const match = line.match(/([^/\\]+\.js):(\d+):\d+/);
      if (match) return `${match[1]}:${match[2]}`;
    }
  }
  return undefined;
}
```

**Enhancements Needed**:

- Add browser-specific regex patterns for better compatibility
- Improve stack frame filtering for different logger depths
- Handle minified source maps if needed

### 3. Enhanced Metadata Structure

**Current Implementation** (already working):

```javascript
// In RemoteLogger #enrichLogEntry()
{
  level: "info|warn|error|debug",
  message: String(message),
  timestamp: new Date().toISOString(),
  category: this.#detectCategory(message), // or undefined
  source: this.#detectSource(), // or undefined
  sessionId: this.#sessionId, // UUID v4
  metadata: {
    originalArgs: metadata.length > 0 ? metadata : undefined,
    userAgent: navigator.userAgent,
    url: window.location.href,
    performance: {
      timing: performance.now(),
      memory: performance.memory?.usedJSHeapSize // if available
    }
  }
}
```

**Enhancements Needed**:

```javascript
{
  // Enhanced browser metadata (configurable)
  browser: {
    userAgent: "...",
    url: "current URL",
    viewport: { width: window.innerWidth, height: window.innerHeight },
    screen: { width: screen.width, height: screen.height }
  },

  // Enhanced performance metadata (configurable)
  performance: {
    memory: {
      used: performance.memory?.usedJSHeapSize,
      total: performance.memory?.totalJSHeapSize,
      limit: performance.memory?.jsHeapSizeLimit
    },
    timing: performance.now(),
    navigation: performance.getEntriesByType?.('navigation')?.[0]
  }
}
```

## Implementation Steps

1. **Enhance Category Detection in RemoteLogger**
   - [ ] Extend `#detectCategory()` method with comprehensive patterns
   - [ ] Add category scoring for ambiguous matches
   - [ ] Implement LRU cache for detection results
   - [ ] Add pattern priority rules (error > specific > general)

2. **Enhanced Category Detection Algorithm**

   ```javascript
   // Enhancement to existing #detectCategory() in RemoteLogger
   #detectCategory(message) {
     // Check cache first
     if (this.#categoryCache?.has(message)) {
       return this.#categoryCache.get(message);
     }

     const msg = message.toLowerCase();
     let detectedCategory = undefined;

     // Priority 1: Error patterns (highest priority)
     if (/error|exception|failed|failure|catch/i.test(message)) {
       detectedCategory = 'error';
     }
     // Priority 2: Specific domain patterns
     else if (/GameEngine|engineState|gameSession|ecs|entity(?!Manager)/i.test(message)) {
       detectedCategory = 'engine';
     }
     // ... continue with existing + new patterns

     // Cache result (LRU with max 1000 entries)
     if (this.#categoryCache) {
       this.#categoryCache.set(message, detectedCategory);
     }

     return detectedCategory; // Keep returning undefined for unmatched
   }
   ```

3. **Enhance Source Extraction in RemoteLogger**
   - [ ] Add browser-specific regex patterns to `#detectSource()`
   - [ ] Improve stack frame filtering for different call depths
   - [ ] Add error handling for different browser formats
   - [ ] Test with minified code scenarios

4. **Enhanced Source Extraction Logic**

   ```javascript
   // Enhancement to existing #detectSource() in RemoteLogger
   #detectSource() {
     try {
       const stack = new Error().stack;
       if (!stack) return undefined;

       const lines = stack.split('\n');

       // Dynamic depth detection (skip internal logger frames)
       for (let i = 4; i < lines.length; i++) {
         const line = lines[i].trim();
         if (line && !this.#isInternalLoggerFrame(line)) {
           return this.#parseStackLine(line);
         }
       }
     } catch (error) {
       // Ignore source detection errors
     }
     return undefined;
   }

   #parseStackLine(line) {
     // Chrome/Edge: "at function (file:line:col)"
     let match = line.match(/at\s+(?:.*?\s+)?\(?(.+?):(\d+):(\d+)\)?/);
     if (match) return `${match[1].split('/').pop()}:${match[2]}`;

     // Firefox: "function@file:line:col"
     match = line.match(/@(.+?):(\d+):(\d+)/);
     if (match) return `${match[1].split('/').pop()}:${match[2]}`;

     // Safari: "function@file:line:col" or "file:line:col"
     match = line.match(/(?:.*?@)?(.+?):(\d+)(?::(\d+))?/);
     if (match) return `${match[1].split('/').pop()}:${match[2]}`;

     return undefined;
   }
   ```

5. **Enhance Metadata Enrichment in RemoteLogger**
   - [ ] Extend `#enrichLogEntry()` with configurable metadata collection
   - [ ] Add viewport and screen dimensions to browser metadata
   - [ ] Enhance performance metrics collection
   - [ ] Implement lazy loading for expensive metadata operations

6. **Performance Optimization Enhancements**
   - [ ] Add LRU cache to existing category detection
   - [ ] Implement configurable metadata collection (enable/disable expensive operations)
   - [ ] Add requestIdleCallback for non-critical metadata
   - [ ] Optimize stack trace parsing performance

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

1. **Enhanced Unit Tests**
   - [ ] Test enhanced category detection patterns (extend existing tests)
   - [ ] Test pattern priority rules (error > specific > general)
   - [ ] Test LRU cache functionality and hit rates
   - [ ] Test improved source extraction across browsers
   - [ ] Test configurable metadata collection
   - [ ] Test backward compatibility with existing log format

2. **Performance Tests**
   - [ ] Benchmark enhanced category detection vs. current implementation
   - [ ] Test cache effectiveness with 13,000+ unique messages
   - [ ] Test metadata collection overhead with different configurations
   - [ ] Test stack trace parsing performance across browsers

## Files to Create/Modify

- **Modify**: `src/logging/remoteLogger.js` (enhance existing methods)
- **Enhance**: `tests/unit/logging/remoteLogger.test.js` (add tests for new patterns)
- **Enhance**: `tests/integration/logging/remoteLogger.integration.test.js` (performance tests)
- **Optional**: Create separate utility classes if RemoteLogger becomes too large (>500 lines)

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

- **Backward Compatibility**: Maintain existing log format and API
- **Migration Path**: Enhanced patterns should not break existing category detection
- **Performance**: Current implementation already handles production load
- **Testing**: Focus on enhancements rather than building from scratch
- **Configuration**: Add configuration options for metadata collection levels
- **Future**: Consider extracting to separate classes if RemoteLogger exceeds 500 lines

## Compatibility Considerations

- Existing logs will continue to work with enhanced patterns
- Undefined category return (current) vs. 'general' (proposed) - keep current behavior
- Enhanced patterns should be additive, not replacement
- Cache implementation should be optional and not affect existing functionality

## Related Tickets

- **Used By**: DEBUGLOGGING-006 (RemoteLogger)
- **Used By**: DEBUGLOGGING-008 (HybridLogger)
- **Related**: DEBUGLOGGING-002 (server-side categories)
