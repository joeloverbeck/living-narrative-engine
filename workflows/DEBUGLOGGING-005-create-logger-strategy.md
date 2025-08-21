# DEBUGLOGGING-005: Create LoggerStrategy Class with Mode Selection

**Status**: Not Started  
**Priority**: P0 - Critical  
**Phase**: 1 - Infrastructure  
**Component**: Client-Side Logger  
**Estimated**: 5 hours  

## Description

Create the LoggerStrategy class that implements the Strategy pattern for logger selection based on runtime mode. This class will be the main entry point for all logging operations and will delegate to appropriate logger implementations.

## Technical Requirements

### 1. Class Structure
```javascript
class LoggerStrategy {
  #logger; // Current logger instance
  #mode;   // Current mode
  #config; // Configuration
  
  constructor({ mode, config, dependencies })
  
  // ILogger interface methods
  debug(message, metadata)
  info(message, metadata)
  warn(message, metadata)
  error(message, metadata)
  
  // ConsoleLogger compatibility methods
  groupCollapsed(label)
  groupEnd()
  table(data, columns)
  setLogLevel(logLevelInput) // Critical for runtime switching
  
  // Private methods
  #createLogger(mode, config, dependencies)
  #validateConfig(config)
  #switchMode(newMode)
}
```

### 2. Mode Selection Matrix
| Mode | Logger Type | Use Case |
|------|-------------|----------|
| production | RemoteLogger | Production deployments |
| development | HybridLogger | Local development |
| test | MockLogger | Unit/integration tests |
| console | ConsoleLogger | Legacy/fallback |
| none | NoOpLogger | Logging disabled |

### 3. Dependencies Structure
```javascript
{
  consoleLogger: ConsoleLogger instance,
  remoteLogger: RemoteLogger instance (lazy),
  hybridLogger: HybridLogger instance (lazy),
  mockLogger: MockLogger instance (for tests),
  eventBus: IEventBus (for error reporting)
}
```

## Implementation Steps

1. **Create LoggerStrategy Class**
   - [ ] Create `src/logging/loggerStrategy.js`
   - [ ] Import necessary logger types
   - [ ] Implement constructor with validation
   - [ ] Add mode detection logic

2. **Implement ILogger Interface**
   - [ ] Implement debug() method with delegation
   - [ ] Implement info() method with delegation
   - [ ] Implement warn() method with delegation
   - [ ] Implement error() method with delegation
   - [ ] Ensure metadata parameter is passed correctly

3. **Implement ConsoleLogger Compatibility**
   - [ ] Implement groupCollapsed() delegation
   - [ ] Implement groupEnd() delegation
   - [ ] Implement table() delegation
   - [ ] Implement setLogLevel() with mode switching

4. **Mode Management**
   - [ ] Detect mode from config/environment
   - [ ] Implement lazy logger instantiation
   - [ ] Add mode switching capability
   - [ ] Handle invalid mode gracefully

5. **Configuration Integration**
   - [ ] Load configuration from config file
   - [ ] Support environment variable override
   - [ ] Validate configuration structure
   - [ ] Apply sensible defaults

6. **Error Handling**
   - [ ] Handle logger creation failures
   - [ ] Implement fallback to console logger
   - [ ] Log mode switching events
   - [ ] Report critical errors via event bus

## Acceptance Criteria

- [ ] LoggerStrategy implements complete ILogger interface
- [ ] All ConsoleLogger methods are supported
- [ ] Mode selection works based on configuration
- [ ] Runtime mode switching via setLogLevel() works
- [ ] Lazy instantiation of logger implementations
- [ ] Fallback to console logger on failure
- [ ] Configuration validation prevents invalid states
- [ ] Backward compatible with existing logger usage

## Dependencies

- **Requires**: ConsoleLogger (existing)
- **Will Need**: DEBUGLOGGING-006 (RemoteLogger)
- **Will Need**: DEBUGLOGGING-008 (HybridLogger)
- **Will Need**: DEBUGLOGGING-012 (MockLogger updates)

## Testing Requirements

1. **Unit Tests**
   - [ ] Test mode selection logic
   - [ ] Test method delegation to correct logger
   - [ ] Test runtime mode switching
   - [ ] Test configuration validation
   - [ ] Test fallback mechanisms

2. **Integration Tests**
   - [ ] Test with each logger type
   - [ ] Test mode switching during operation
   - [ ] Test configuration loading
   - [ ] Test error handling scenarios

## Files to Create/Modify

- **Create**: `src/logging/loggerStrategy.js`
- **Create**: `tests/unit/logging/loggerStrategy.test.js`
- **Create**: `src/logging/noOpLogger.js` (simple no-op implementation)

## Configuration Example

```javascript
// config/debug-logging-config.json
{
  "enabled": true,
  "mode": "development", // or from process.env.DEBUG_LOG_MODE
  "remote": {
    "endpoint": "http://localhost:3001/api/debug-log",
    "batchSize": 100,
    "flushInterval": 1000
  },
  "categories": {
    "engine": { "enabled": true, "level": "debug" },
    "ui": { "enabled": true, "level": "info" }
  }
}
```

## Mode Detection Priority

1. `process.env.DEBUG_LOG_MODE` (highest priority)
2. Configuration file `mode` field
3. `process.env.NODE_ENV` mapping:
   - 'test' → 'test' mode
   - 'production' → 'production' mode
   - 'development' → 'development' mode
4. Default: 'console' mode

## setLogLevel() Integration

The `setLogLevel()` method must support both:
1. Traditional log level changes (debug, info, warn, error)
2. Mode switching via special values:
   - `'remote'` → Switch to RemoteLogger
   - `'console'` → Switch to ConsoleLogger
   - `'hybrid'` → Switch to HybridLogger
   - `'none'` → Disable logging

## Notes

- Must maintain 100% backward compatibility with ConsoleLogger
- LoggerStrategy will replace ConsoleLogger in DI container
- Consider performance impact of delegation pattern
- Ensure thread-safe mode switching
- All 2,054 existing debug calls must work unchanged

## Related Tickets

- **Next**: DEBUGLOGGING-006 (RemoteLogger implementation)
- **Parallel**: DEBUGLOGGING-016 (Configuration schema)
- **Blocks**: DEBUGLOGGING-010 (DI container update)