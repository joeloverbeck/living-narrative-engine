# DEBUGLOGGING-008: Create HybridLogger for Development Mode

**Status**: Not Started  
**Priority**: P1 - High  
**Phase**: 2 - Integration  
**Component**: Client-Side Logger  
**Estimated**: 4 hours

## Description

Create a HybridLogger that sends logs to both the console and remote server simultaneously. This is ideal for development mode where developers want immediate console feedback while also capturing logs server-side for analysis.

## Important Implementation Notes

The ILogger interface in the codebase uses variadic arguments (`...args`) for all logging methods, not a single `metadata` parameter. Both ConsoleLogger and RemoteLogger follow this pattern. The HybridLogger must maintain compatibility with this existing interface signature.

## Technical Requirements

### 1. Class Structure

```javascript
class HybridLogger {
  #consoleLogger;         // ConsoleLogger instance
  #remoteLogger;          // RemoteLogger instance
  #categoryDetector;      // LogCategoryDetector instance
  #config;                // Configuration
  #filters;               // Category/level filters

  constructor({ consoleLogger, remoteLogger, categoryDetector, config })

  // ILogger interface (matches actual signature)
  debug(message, ...args)
  info(message, ...args)
  warn(message, ...args)
  error(message, ...args)

  // ConsoleLogger compatibility
  groupCollapsed(label)
  groupEnd()
  table(data, columns)
  setLogLevel(logLevelInput)

  // Hybrid-specific methods
  setConsoleFilter(categories, levels)
  setRemoteFilter(categories, levels)
  #shouldLogToConsole(level, category)
  #shouldLogToRemote(level, category)
}
```

### 2. Filtering Strategy

```javascript
{
  console: {
    categories: ['engine', 'ui', 'errors'], // null = all
    levels: ['warn', 'error'], // null = all
    enabled: true
  },
  remote: {
    categories: null, // all categories
    levels: null, // all levels
    enabled: true
  }
}
```

### 3. Dual Logging Behavior

- Both loggers called independently (no dependency)
- Failures in one don't affect the other
- Filters applied before calling each logger
- Metadata passed to both loggers

## Implementation Steps

1. **Create HybridLogger Class**
   - [ ] Create `src/logging/hybridLogger.js`
   - [ ] Implement constructor with dependency injection
   - [ ] Initialize both logger instances and category detector
   - [ ] Set up default filters

2. **Implement Dual Logging**

   ```javascript
   debug(message, ...args) {
     const category = this.#categoryDetector.detectCategory(message);

     if (this.#shouldLogToConsole('debug', category)) {
       this.#consoleLogger.debug(message, ...args);
     }

     if (this.#shouldLogToRemote('debug', category)) {
       this.#remoteLogger.debug(message, ...args);
     }
   }
   ```

3. **Implement Filtering Logic**
   - [ ] Create category filter matching
   - [ ] Create level filter matching
   - [ ] Support wildcard patterns
   - [ ] Cache filter results

4. **Console-Specific Features**
   - [ ] Pass through groupCollapsed/groupEnd to console only
   - [ ] Pass through table() to console only
   - [ ] Format console output for readability
   - [ ] Add category prefix to console messages

5. **Remote-Specific Features**
   - [ ] Ensure all logs sent to remote (by default)
   - [ ] Add development environment metadata
   - [ ] Include filter state in metadata
   - [ ] Track console vs remote disparities

6. **Configuration Management**
   - [ ] Load filter configuration
   - [ ] Support runtime filter updates
   - [ ] Validate filter configuration
   - [ ] Provide filter presets

## Filter Configuration Examples

```javascript
// Development preset - reduce console noise
{
  console: {
    categories: ['errors', 'warnings', 'ai'],
    levels: ['warn', 'error'],
    enabled: true
  },
  remote: {
    categories: null, // all
    levels: null, // all
    enabled: true
  }
}

// Debugging preset - see everything
{
  console: {
    categories: null, // all
    levels: null, // all
    enabled: true
  },
  remote: {
    categories: null, // all
    levels: null, // all
    enabled: true
  }
}

// Performance testing - remote only
{
  console: {
    enabled: false
  },
  remote: {
    categories: ['performance', 'timing'],
    levels: null,
    enabled: true
  }
}
```

## Acceptance Criteria

- [ ] Logs appear in both console and remote
- [ ] Console filtering reduces noise effectively
- [ ] Remote receives all logs by default
- [ ] Filter configuration is applied correctly
- [ ] Console-only methods work properly
- [ ] Failures don't cascade between loggers
- [ ] Runtime filter updates work
- [ ] Category detection works for filtering

## Dependencies

- **Requires**: ConsoleLogger (existing)
- **Requires**: RemoteLogger (existing in src/logging/remoteLogger.js)
- **Requires**: LogCategoryDetector (existing in src/logging/logCategoryDetector.js)
- **Requires**: LogMetadataEnricher (existing in src/logging/logMetadataEnricher.js)
- **Used By**: DEBUGLOGGING-005 (LoggerStrategy)

## Testing Requirements

1. **Unit Tests**
   - [ ] Test dual logging execution
   - [ ] Test filter application
   - [ ] Test failure isolation
   - [ ] Test console-only methods
   - [ ] Test configuration updates

2. **Integration Tests**
   - [ ] Test with real console and remote
   - [ ] Test filter effectiveness
   - [ ] Test high-volume logging
   - [ ] Test error handling

## Files to Create/Modify

- **Create**: `src/logging/hybridLogger.js`
- **Create**: `tests/unit/logging/hybridLogger.test.js`
- **Create**: `tests/integration/logging/hybridLogger.integration.test.js`
- **Optional**: `data/config/logging-presets.json` (if configuration presets are needed)

## Console Output Enhancement

Add category and level prefixes for clarity:

```javascript
// Instead of: "GameEngine: Constructor called"
// Display as: "[ENGINE:DEBUG] GameEngine: Constructor called"

#formatConsoleMessage(level, category, message) {
  const categoryStr = category ? category.toUpperCase() : 'GENERAL';
  const prefix = `[${categoryStr}:${level.toUpperCase()}]`;
  return `${prefix} ${message}`;
}
```

## Performance Considerations

- Filter matching should be cached
- Category detection called only once per log
- Avoid duplicate work between loggers
- Consider throttling console output in high-volume scenarios

## Error Handling

- Console logger failures: Log error once, continue with remote
- Remote logger failures: Continue with console only
- Both failures: Use fallback error reporting
- Invalid filters: Use defaults with warning

## Filter Wildcard Support

```javascript
// Support patterns like:
categories: ['engine*', '*ui', '*error*'];
// Matches: engine, engineState, UI, domUI, error, errors, errorHandler
```

## Notes

- Console filtering crucial for 13,000+ log scenario
- Consider adding log sampling for console
- May need rate limiting for console output
- Test with Chrome DevTools performance
- Consider colored output for categories

## Related Tickets

- **Depends On**: Existing RemoteLogger, ConsoleLogger, LogCategoryDetector
- **Used By**: DEBUGLOGGING-005 (LoggerStrategy)
- **Related**: DEBUGLOGGING-016 (configuration)
