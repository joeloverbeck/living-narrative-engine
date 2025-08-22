# DEBUGLOGGING-010: Update DI Container Registration for LoggerStrategy

**Status**: Partially Complete  
**Priority**: P1 - High  
**Phase**: 2 - Integration  
**Component**: Dependency Injection  
**Estimated**: 1 hour

## Description

Complete the final integration of LoggerStrategy in the minimal container configuration. The main `containerConfig.js` already uses LoggerStrategy, but `minimalContainerConfig.js` still uses ConsoleLogger directly. This task focuses on the remaining integration work while maintaining 100% backward compatibility.

## Technical Requirements

### 1. Current State

**containerConfig.js (COMPLETED)**
```javascript
// Already using LoggerStrategy (lines 48-53)
const appLogger = new LoggerStrategy({
  dependencies: {
    consoleLogger: new ConsoleLogger(LogLevel.INFO),
  },
});
registrar.instance(tokens.ILogger, appLogger);
```

**minimalContainerConfig.js (NEEDS UPDATE)**
```javascript
// Still using ConsoleLogger directly (lines 47-48)
const initialLogLevel = LogLevel.INFO;
const appLogger = new ConsoleLogger(initialLogLevel);
registrar.instance(tokens.ILogger, appLogger);
```

### 2. Required Change for minimalContainerConfig.js

```javascript
// New implementation with LoggerStrategy (similar to containerConfig.js)
const appLogger = new LoggerStrategy({
  dependencies: {
    consoleLogger: new ConsoleLogger(LogLevel.INFO),
  },
});
registrar.instance(tokens.ILogger, appLogger);
```

### 3. Mode Detection (Built into LoggerStrategy)

LoggerStrategy already includes automatic mode detection logic in its `#detectMode()` method:
- Environment variable `DEBUG_LOG_MODE` (highest priority)
- `NODE_ENV` mapping (test → test, production → production, development → development)
- Configuration file mode
- Default to 'console' mode

No additional `determineLogMode()` function is needed.

## Implementation Steps

1. **✅ Update containerConfig.js** - COMPLETED
   - ✅ Import LoggerStrategy class
   - ✅ Replace ConsoleLogger instantiation with LoggerStrategy
   - ✅ Maintain async configuration loading pattern

2. **Update minimalContainerConfig.js**
   - [ ] Import LoggerStrategy class
   - [ ] Replace ConsoleLogger instantiation with LoggerStrategy
   - [ ] Ensure test mode detection works
   - [ ] Maintain minimal dependencies (no EventBus, no RemoteLogger)

3. **✅ Configuration Loading Integration** - ALREADY WORKING
   - ✅ Already integrated with loadAndApplyLoggerConfig utility
   - ✅ Configuration loading works correctly
   - ✅ Error handling is already implemented

4. **Backward Compatibility Validation**
   - [ ] Verify all ILogger methods available in minimal container
   - [ ] Test setLogLevel() functionality with LoggerStrategy
   - [ ] Ensure minimal container startup works unchanged
   - [ ] Validate with existing minimal container consumers

## Files Requiring Updates

### Primary Files

- ✅ `src/dependencyInjection/containerConfig.js` - COMPLETED
- 🔄 `src/dependencyInjection/minimalContainerConfig.js` - REMAINING WORK

### Dependencies Already Available

- ✅ `src/logging/loggerStrategy.js` - Available and working
- ✅ `src/logging/hybridLogger.js` - Available for future use
- ✅ `src/configuration/utils/loggerConfigUtils.js` - Already supports LoggerStrategy

### Test Files

- Tests for minimalContainerConfig.js that verify LoggerStrategy integration

## Acceptance Criteria

- ✅ LoggerStrategy registered as ILogger in containerConfig.js - COMPLETED
- [ ] LoggerStrategy registered as ILogger in minimalContainerConfig.js
- ✅ All existing code using ILogger continues to work - VERIFIED
- ✅ setLogLevel() method functions correctly - VERIFIED with LoggerStrategy
- ✅ Async configuration loading maintained - WORKING
- [ ] Test mode properly detected in minimal container
- ✅ No breaking changes to public API - VERIFIED
- ✅ All debug calls work unchanged - WORKING
- [ ] All tests pass with minimal container using LoggerStrategy

## Dependencies

- ✅ **Completed**: DEBUGLOGGING-005 (LoggerStrategy) - LoggerStrategy is implemented and working
- ✅ **Available**: HybridLogger implementation - Available for development mode
- 🔄 **Optional**: DEBUGLOGGING-016 (Configuration schema) - Can proceed without this
- 🔄 **Affects**: Minimal container consumers only (limited scope)

## Testing Requirements

1. **Unit Tests**
   - [ ] Test mode detection logic
   - [ ] Test DI registration
   - [ ] Test configuration loading
   - [ ] Test fallback behavior

2. **Integration Tests**
   - [ ] Test with real container
   - [ ] Test logger resolution
   - [ ] Test with different modes
   - [ ] Test configuration changes

3. **Regression Tests**
   - [ ] Run full test suite
   - [ ] Verify no test failures
   - [ ] Check logger method availability

## Migration Code Example

```javascript
// src/dependencyInjection/minimalContainerConfig.js

import { LoggerStrategy } from '../logging/loggerStrategy.js';

// BEFORE (current implementation)
const initialLogLevel = LogLevel.INFO;
const appLogger = new ConsoleLogger(initialLogLevel);
registrar.instance(tokens.ILogger, appLogger);

// AFTER (updated to use LoggerStrategy)
const appLogger = new LoggerStrategy({
  dependencies: {
    consoleLogger: new ConsoleLogger(LogLevel.INFO),
  },
});
registrar.instance(tokens.ILogger, appLogger);
```

**Note**: This change mirrors the pattern already successfully implemented in `containerConfig.js`.

## Configuration Loading (Already Working)

The `loadAndApplyLoggerConfig()` function in `loggerConfigUtils.js` already supports LoggerStrategy:

```javascript
// src/configuration/utils/loggerConfigUtils.js (existing implementation)
export async function loadAndApplyLoggerConfig(container, logger, tokens, context) {
  // Already handles LoggerStrategy correctly
  // Applies trace configuration
  // Works with both ConsoleLogger and LoggerStrategy
}
```

**No changes needed** - the configuration loading system already works with LoggerStrategy.

## Risk Mitigation

1. ✅ **Main Risk Already Mitigated** - LoggerStrategy proven working in containerConfig.js

2. ✅ **Fallback Strategy Built-in** - LoggerStrategy has built-in fallbacks:
   ```javascript
   // LoggerStrategy automatically falls back to ConsoleLogger on errors
   // Mode detection handles missing dependencies gracefully
   ```

3. ✅ **Compatibility Already Verified**
   - LoggerStrategy implements all ILogger methods
   - setLogLevel() method works correctly
   - Backward compatibility maintained

4. **Minimal Container Specific Risks** (Low)
   - Simple change mirroring proven pattern
   - Limited scope and impact
   - Easy rollback if needed

## Notes

- ✅ Main integration (containerConfig.js) already completed and working
- Limited scope: Only minimalContainerConfig.js needs updating
- Low risk: Pattern already proven in containerConfig.js
- ✅ LoggerStrategy handles backward compatibility automatically
- ✅ All existing ILogger consumers work unchanged

## Related Tickets

- ✅ **Completed**: DEBUGLOGGING-005 (LoggerStrategy implementation)
- 🔄 **Optional**: DEBUGLOGGING-016 (Configuration schema)
- 🔄 **Enables**: DEBUGLOGGING-011 (config integration)
- 🔄 **Limited Impact**: Only minimal container consumers
