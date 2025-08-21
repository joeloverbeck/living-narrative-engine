# DEBUGLOGGING-010: Update DI Container Registration for LoggerStrategy

**Status**: Not Started  
**Priority**: P0 - Critical  
**Phase**: 2 - Integration  
**Component**: Dependency Injection  
**Estimated**: 3 hours

## Description

Update the dependency injection container to use LoggerStrategy instead of ConsoleLogger directly. This must maintain 100% backward compatibility with all existing code that uses `tokens.ILogger`.

## Technical Requirements

### 1. Current Registration (containerConfig.js:46)

```javascript
// Current implementation
const logger = new ConsoleLogger();
logger.setLogLevel(LogLevel.ERROR);
container.register(tokens.ILogger, logger);
```

### 2. New Registration Pattern

```javascript
// New implementation with LoggerStrategy
const loggerStrategy = new LoggerStrategy({
  mode: determineLogMode(),
  config: await loadDebugLogConfig(),
  dependencies: {
    consoleLogger: new ConsoleLogger(),
    eventBus: container.resolve(tokens.IEventBus),
  },
});
container.register(tokens.ILogger, loggerStrategy);
```

### 3. Mode Detection Logic

```javascript
function determineLogMode() {
  // Priority order:
  if (process.env.DEBUG_LOG_MODE) {
    return process.env.DEBUG_LOG_MODE;
  }
  if (process.env.NODE_ENV === 'test') {
    return 'test';
  }
  if (process.env.NODE_ENV === 'production') {
    return 'production';
  }
  return 'development';
}
```

## Implementation Steps

1. **Update containerConfig.js**
   - [ ] Import LoggerStrategy class
   - [ ] Import configuration loader
   - [ ] Replace ConsoleLogger instantiation
   - [ ] Maintain async configuration loading pattern

2. **Update minimalContainerConfig.js**
   - [ ] Apply same changes as containerConfig
   - [ ] Ensure test mode detection works
   - [ ] Maintain minimal dependencies

3. **Configuration Loading Integration**
   - [ ] Integrate with loadAndApplyLoggerConfig utility
   - [ ] Ensure configuration hot-reload works
   - [ ] Handle configuration errors gracefully

4. **Backward Compatibility Checks**
   - [ ] Verify all ILogger methods available
   - [ ] Test setLogLevel() functionality
   - [ ] Ensure async config loading works
   - [ ] Validate with existing consumers

5. **Lazy Initialization Pattern**
   ```javascript
   // Support lazy initialization of heavy loggers
   container.register(tokens.ILogger, () => {
     if (!loggerStrategyInstance) {
       loggerStrategyInstance = createLoggerStrategy();
     }
     return loggerStrategyInstance;
   });
   ```

## Files Requiring Updates

### Primary Files

- `src/dependencyInjection/containerConfig.js`
- `src/dependencyInjection/minimalContainerConfig.js`

### Configuration Utils

- `src/configuration/utils/loggerConfigUtils.js` - Update to support new config format

### Test Files

- Any test files that mock or stub the logger registration

## Acceptance Criteria

- [ ] LoggerStrategy registered as ILogger in both configs
- [ ] All existing code using ILogger continues to work
- [ ] setLogLevel() method functions correctly
- [ ] Async configuration loading maintained
- [ ] Test mode properly detected and applied
- [ ] No breaking changes to public API
- [ ] All 2,054 debug calls work unchanged
- [ ] All tests pass without modification

## Dependencies

- **Requires**: DEBUGLOGGING-005 (LoggerStrategy)
- **Requires**: DEBUGLOGGING-016 (Configuration schema)
- **Affects**: All 400+ files using ILogger

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
// src/dependencyInjection/containerConfig.js

import { LoggerStrategy } from '../logging/loggerStrategy.js';
import { loadDebugLogConfig } from '../configuration/utils/debugLogConfigLoader.js';

// ... other imports ...

export async function createContainer() {
  const container = new DIContainer();

  // ... other registrations ...

  // Logger registration with backward compatibility
  const debugLogConfig = await loadDebugLogConfig();
  const loggerStrategy = new LoggerStrategy({
    mode: determineLogMode(),
    config: debugLogConfig,
    dependencies: {
      consoleLogger: new ConsoleLogger(),
      eventBus: container.resolve(tokens.IEventBus),
      // RemoteLogger and HybridLogger created lazily
    },
  });

  // Maintain existing log level setting
  loggerStrategy.setLogLevel(LogLevel.ERROR);

  container.register(tokens.ILogger, loggerStrategy);

  // ... rest of container setup ...
}
```

## Configuration Loading Update

```javascript
// src/configuration/utils/loggerConfigUtils.js

export async function loadAndApplyLoggerConfig(logger) {
  try {
    const config = await loadDebugLogConfig();

    // Support both old and new config formats
    if (config.mode) {
      // New format with mode
      logger.setLogLevel(config.mode);
    } else if (config.logLevel) {
      // Old format with logLevel
      logger.setLogLevel(config.logLevel);
    }

    // Apply category-specific settings if available
    if (config.categories && logger.setCategoryLevels) {
      logger.setCategoryLevels(config.categories);
    }
  } catch (error) {
    console.warn('Failed to load logger config:', error);
  }
}
```

## Risk Mitigation

1. **Gradual Rollout**
   - Use feature flag to enable/disable
   - Default to ConsoleLogger if issues detected
   - Monitor error rates after deployment

2. **Fallback Strategy**

   ```javascript
   try {
     return new LoggerStrategy(config);
   } catch (error) {
     console.error('LoggerStrategy failed, using ConsoleLogger', error);
     return new ConsoleLogger();
   }
   ```

3. **Compatibility Layer**
   - Ensure LoggerStrategy implements all ConsoleLogger methods
   - Add method proxying if needed
   - Maintain same error handling behavior

## Notes

- Critical integration point affecting entire application
- Must be thoroughly tested before deployment
- Consider phased rollout with feature flags
- Monitor for performance regressions
- Document migration path for any custom logger usage

## Related Tickets

- **Depends On**: DEBUGLOGGING-005, DEBUGLOGGING-016
- **Blocks**: DEBUGLOGGING-011 (config integration)
- **Affects**: All application components using logger
