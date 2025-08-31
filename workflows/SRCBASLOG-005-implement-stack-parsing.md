# SRCBASLOG-005: Implement Advanced Stack Trace Parsing

## Overview

Implement robust stack trace parsing that handles multiple browser formats, webpack bundling, source maps, and production builds. This ensures reliable source extraction across all deployment scenarios.

## Objectives

- Support all major browser stack trace formats
- Handle webpack and bundled code correctly
- Integrate source map support for production builds
- Optimize parsing performance with caching
- Provide fallback mechanisms for edge cases

## Dependencies

- SRCBASLOG-001: Basic source extraction must be implemented
- SRCBASLOG-004: Configuration schema for stack trace options

## Implementation Details

### Location

- Main implementation: `src/logging/stackTraceParser.js` (new file)
- Integration: `src/logging/logMetadataEnricher.js`
- Source maps: `src/logging/sourceMapResolver.js` (new file)

### Stack Trace Formats to Support

#### 1. Chrome/V8 Format
```
Error
    at functionName (file:///path/to/file.js:10:15)
    at Object.<anonymous> (file:///path/to/file.js:20:5)
    at webpack_require (webpack:///webpack/bootstrap:19:1)
```

#### 2. Firefox Format
```
functionName@file:///path/to/file.js:10:15
@file:///path/to/file.js:20:5
webpack_require@webpack:///webpack/bootstrap:19:1
```

#### 3. Safari/WebKit Format
```
functionName@file:///path/to/file.js:10:15
global code@file:///path/to/file.js:20:5
evaluateWithScopeExtension@[native code]
```

#### 4. Webpack Dev Server Format
```
at ActionResolver.resolve (webpack-internal:///./src/actions/actionResolver.js:145:10)
at GameEngine.tick (webpack-internal:///./src/engine/gameEngine.js:234:15)
```

#### 5. Production Bundled Format
```
at t.resolve (https://example.com/bundle.min.js:1:12345)
at e.tick (https://example.com/bundle.min.js:1:23456)
```

### Implementation Components

#### 1. StackTraceParser Class

```javascript
class StackTraceParser {
  constructor(config = {}) {
    this.#patterns = this.#initializePatterns();
    this.#cache = new LRUCache(config.cacheSize || 200);
    this.#sourceMapResolver = config.sourceMapResolver;
  }
  
  parseStackTrace(error, skipFrames = 4) {
    const cacheKey = this.#getCacheKey(error.stack);
    if (this.#cache.has(cacheKey)) {
      return this.#cache.get(cacheKey);
    }
    
    const frames = this.#extractFrames(error.stack);
    const relevantFrames = this.#filterFrames(frames, skipFrames);
    const parsedFrames = this.#parseFrames(relevantFrames);
    
    const result = {
      frames: parsedFrames,
      sourceLocation: parsedFrames[0]?.file || null,
      sourcePath: parsedFrames[0]?.fullPath || null
    };
    
    this.#cache.set(cacheKey, result);
    return result;
  }
  
  #initializePatterns() {
    return [
      {
        name: 'chrome',
        pattern: /^\s*at\s+(?:(.+?)\s+)?\((.+?):(\d+):(\d+)\)$/,
        extractor: this.#extractChromeFrame
      },
      {
        name: 'firefox',
        pattern: /^(.+?)@(.+?):(\d+):(\d+)$/,
        extractor: this.#extractFirefoxFrame
      },
      {
        name: 'safari',
        pattern: /^(?:(.+?)@)?(.+?):(\d+):(\d+)$/,
        extractor: this.#extractSafariFrame
      },
      {
        name: 'webpack-dev',
        pattern: /at\s+(?:(.+?)\s+)?\(webpack-internal:\/\/\/(.+?):(\d+):(\d+)\)/,
        extractor: this.#extractWebpackDevFrame
      },
      {
        name: 'webpack-prod',
        pattern: /at\s+([a-z])\.[a-z]+\s+\((.+?):(\d+):(\d+)\)/i,
        extractor: this.#extractWebpackProdFrame
      }
    ];
  }
  
  #extractFrames(stackString) {
    if (!stackString) return [];
    return stackString.split('\n').filter(line => line.trim());
  }
  
  #filterFrames(frames, skipFrames) {
    const filtered = [];
    let skipped = 0;
    
    for (const frame of frames) {
      if (this.#isInternalFrame(frame)) continue;
      if (skipped++ < skipFrames) continue;
      filtered.push(frame);
      if (filtered.length >= 10) break; // Limit depth
    }
    
    return filtered;
  }
  
  #isInternalFrame(frame) {
    const internalPatterns = [
      /node_modules/,
      /webpack\/bootstrap/,
      /<anonymous>/,
      /\[native code\]/,
      /^Error$/
    ];
    
    return internalPatterns.some(pattern => pattern.test(frame));
  }
}
```

#### 2. Source Map Resolver

```javascript
class SourceMapResolver {
  constructor(config = {}) {
    this.#sourceMaps = new Map();
    this.#cache = new LRUCache(config.cacheSize || 100);
    this.#enabled = config.enabled !== false;
  }
  
  async resolve(bundledPath, line, column) {
    if (!this.#enabled) return null;
    
    const cacheKey = `${bundledPath}:${line}:${column}`;
    if (this.#cache.has(cacheKey)) {
      return this.#cache.get(cacheKey);
    }
    
    try {
      const sourceMap = await this.#loadSourceMap(bundledPath);
      if (!sourceMap) return null;
      
      const original = this.#findOriginalPosition(sourceMap, line, column);
      this.#cache.set(cacheKey, original);
      return original;
    } catch (error) {
      console.warn('Source map resolution failed:', error);
      return null;
    }
  }
  
  async #loadSourceMap(bundledPath) {
    // Check inline source map
    const inline = await this.#extractInlineSourceMap(bundledPath);
    if (inline) return inline;
    
    // Check external source map
    const external = await this.#loadExternalSourceMap(bundledPath);
    if (external) return external;
    
    return null;
  }
  
  #extractInlineSourceMap(content) {
    const match = content.match(/\/\/# sourceMappingURL=data:application\/json;base64,(.+)$/);
    if (!match) return null;
    
    try {
      const decoded = atob(match[1]);
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }
}
```

#### 3. Enhanced Frame Extraction

```javascript
#extractChromeFrame(match) {
  const [, functionName, file, line, column] = match;
  
  return {
    functionName: functionName || '<anonymous>',
    file: this.#normalizeFilePath(file),
    fullPath: this.#extractFullPath(file),
    line: parseInt(line, 10),
    column: parseInt(column, 10),
    raw: match[0]
  };
}

#extractWebpackDevFrame(match) {
  const [, functionName, file, line, column] = match;
  
  // webpack-internal:///./src/actions/actionResolver.js -> src/actions/actionResolver.js
  const normalizedPath = file.replace(/^\.\//, '');
  
  return {
    functionName: functionName || '<anonymous>',
    file: normalizedPath.split('/').pop(),
    fullPath: normalizedPath,
    line: parseInt(line, 10),
    column: parseInt(column, 10),
    webpack: true,
    raw: match[0]
  };
}

#normalizeFilePath(path) {
  // Remove common prefixes
  path = path.replace(/^(file:\/\/\/|https?:\/\/[^\/]+\/)/, '');
  path = path.replace(/^webpack-internal:\/\/\//, '');
  path = path.replace(/^\.\//, '');
  
  // Extract just filename for display
  return path.split('/').pop().split('?')[0];
}

#extractFullPath(path) {
  // Extract the meaningful path for categorization
  path = path.replace(/^(file:\/\/\/|https?:\/\/[^\/]+\/)/, '');
  path = path.replace(/^webpack-internal:\/\/\/\.\//, '');
  path = path.replace(/\?.*$/, ''); // Remove query params
  
  return path;
}
```

### Performance Optimizations

1. **Caching Strategy**
   - Cache parsed stack traces by hash
   - Cache source map resolutions
   - TTL-based expiration

2. **Early Exit Conditions**
   - Stop after finding first valid frame
   - Limit parsing depth
   - Skip known internal frames

3. **Lazy Source Map Loading**
   - Only load when production builds detected
   - Cache loaded source maps
   - Async loading with timeout

## Testing Requirements

### Unit Tests

1. **Browser Format Parsing**
   ```javascript
   describe('StackTraceParser', () => {
     it('should parse Chrome stack traces', () => {
       const stack = `Error
         at ActionResolver.resolve (file:///src/actions/actionResolver.js:145:10)
         at GameEngine.tick (file:///src/engine/gameEngine.js:234:15)`;
       
       const result = parser.parseStackTrace({ stack });
       expect(result.sourcePath).toBe('src/actions/actionResolver.js');
     });
     
     it('should parse Firefox stack traces', () => {
       const stack = `ActionResolver.resolve@file:///src/actions/actionResolver.js:145:10
         GameEngine.tick@file:///src/engine/gameEngine.js:234:15`;
       
       const result = parser.parseStackTrace({ stack });
       expect(result.sourcePath).toBe('src/actions/actionResolver.js');
     });
   });
   ```

2. **Webpack Format Parsing**
   - Test webpack dev server format
   - Test production bundled format
   - Test source map resolution

3. **Edge Cases**
   - Test with missing stack traces
   - Test with corrupted formats
   - Test with deeply nested calls

### Integration Tests

1. **Real Browser Testing**
   - Test in Chrome, Firefox, Safari
   - Test with actual errors
   - Verify cross-browser consistency

2. **Build System Integration**
   - Test with webpack builds
   - Test with source maps
   - Test with minified code

## Success Criteria

- [ ] All major browser formats supported
- [ ] Webpack formats parsed correctly
- [ ] Source map resolution working
- [ ] Cache hit rate > 80%
- [ ] Parsing overhead < 2ms average
- [ ] Fallback mechanisms functional
- [ ] 95% extraction success rate

## Risk Assessment

### Risks

1. **Browser API Changes**
   - Mitigation: Multiple pattern fallbacks
   - Regular testing across browsers
   - Version detection

2. **Source Map Availability**
   - Mitigation: Graceful degradation
   - Fallback to bundled paths
   - Clear logging of failures

3. **Performance Impact**
   - Mitigation: Aggressive caching
   - Async source map loading
   - Early exit optimizations

## Estimated Effort

- Implementation: 6-8 hours
- Testing: 3-4 hours
- Documentation: 1-2 hours
- Total: 10-14 hours

## Follow-up Tasks

- SRCBASLOG-001: Integrate with LogMetadataEnricher
- SRCBASLOG-008: Add comprehensive browser tests