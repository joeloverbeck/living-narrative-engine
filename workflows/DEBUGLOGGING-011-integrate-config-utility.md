# DEBUGLOGGING-011: Integrate with Existing loadAndApplyLoggerConfig Utility

**Status**: Not Started  
**Priority**: P1 - High  
**Phase**: 2 - Integration  
**Component**: Configuration  
**Estimated**: 2 hours

## Description

Update the existing `loadAndApplyLoggerConfig` utility to support the new debug logging configuration format while maintaining backward compatibility with the existing logger configuration system.

## Technical Requirements

### 1. Current Implementation

```javascript
// src/configuration/utils/loggerConfigUtils.js
export async function loadAndApplyLoggerConfig(logger) {
  const config = await loadLoggerConfig();
  if (config && config.logLevel) {
    logger.setLogLevel(config.logLevel);
  }
}
```

### 2. Enhanced Implementation

```javascript
export async function loadAndApplyLoggerConfig(logger) {
  // Try new config format first
  const debugConfig = await loadDebugLogConfig();
  if (debugConfig) {
    applyDebugLogConfig(logger, debugConfig);
    return;
  }

  // Fall back to old format
  const legacyConfig = await loadLoggerConfig();
  if (legacyConfig) {
    applyLegacyConfig(logger, legacyConfig);
  }
}
```

### 3. Configuration Formats

#### New Format (debug-logging-config.json)

```json
{
  "enabled": true,
  "mode": "development",
  "remote": {
    "endpoint": "http://localhost:3001/api/debug-log"
  },
  "categories": {
    "engine": { "enabled": true, "level": "debug" }
  }
}
```

#### Legacy Format (logger-config.json)

```json
{
  "logLevel": "ERROR"
}
```

## Implementation Steps

1. **Create Debug Config Loader**
   - [ ] Create `src/configuration/utils/debugLogConfigLoader.js`
   - [ ] Implement config file reading
   - [ ] Add environment variable override
   - [ ] Handle missing config gracefully

2. **Update loadAndApplyLoggerConfig**
   - [ ] Add debug config loading logic
   - [ ] Implement config format detection
   - [ ] Apply appropriate configuration
   - [ ] Maintain backward compatibility

3. **Config Application Logic**

   ```javascript
   function applyDebugLogConfig(logger, config) {
     // Apply mode if LoggerStrategy
     if (logger.setMode && config.mode) {
       logger.setMode(config.mode);
     }

     // Apply log level (backward compatibility)
     if (config.logLevel) {
       logger.setLogLevel(config.logLevel);
     }

     // Apply category-specific settings
     if (logger.setCategoryConfig && config.categories) {
       logger.setCategoryConfig(config.categories);
     }

     // Apply remote configuration
     if (logger.setRemoteConfig && config.remote) {
       logger.setRemoteConfig(config.remote);
     }
   }
   ```

4. **Environment Variable Support**
   - [ ] Check `DEBUG_LOG_CONFIG_PATH` for custom path
   - [ ] Override specific values with env vars
   - [ ] Document all environment variables

5. **Config File Resolution**
   ```javascript
   async function findConfigFile() {
     const paths = [
       process.env.DEBUG_LOG_CONFIG_PATH,
       './config/debug-logging-config.json',
       './config/logger-config.json', // Legacy
       './debug-logging-config.json',
       './logger-config.json', // Legacy
     ];

     for (const path of paths.filter(Boolean)) {
       if (await fileExists(path)) {
         return path;
       }
     }
     return null;
   }
   ```

## Acceptance Criteria

- [ ] New debug config format is loaded correctly
- [ ] Legacy config format still works
- [ ] Environment variables override config values
- [ ] Missing config doesn't cause errors
- [ ] Hot reload of config works
- [ ] All existing usage continues to work
- [ ] Config validation provides clear errors
- [ ] Documentation updated with new format

## Dependencies

- **Requires**: DEBUGLOGGING-010 (DI container update)
- **Requires**: DEBUGLOGGING-016 (Configuration schema)
- **Modifies**: Existing logger config utility

## Testing Requirements

1. **Unit Tests**
   - [ ] Test new config loading
   - [ ] Test legacy config loading
   - [ ] Test environment variable override
   - [ ] Test missing config handling
   - [ ] Test config validation

2. **Integration Tests**
   - [ ] Test with LoggerStrategy
   - [ ] Test with ConsoleLogger
   - [ ] Test config hot reload
   - [ ] Test config migration

## Files to Create/Modify

- **Create**: `src/configuration/utils/debugLogConfigLoader.js`
- **Modify**: `src/configuration/utils/loggerConfigUtils.js`
- **Create**: `config/debug-logging-config.json`
- **Create**: `tests/unit/configuration/debugLogConfigLoader.test.js`

## Configuration Migration Strategy

1. **Check for new config file**
2. **If not found, check for legacy config**
3. **If legacy exists, use compatibility mode**
4. **Log deprecation warning for legacy format**
5. **Provide migration tool/script**

## Migration Helper

```javascript
// src/configuration/utils/configMigrator.js
export function migrateLoggerConfig(legacyConfig) {
  return {
    enabled: true,
    mode: mapLogLevelToMode(legacyConfig.logLevel),
    categories: {
      general: {
        enabled: true,
        level: legacyConfig.logLevel.toLowerCase(),
      },
    },
  };
}

function mapLogLevelToMode(logLevel) {
  switch (logLevel) {
    case 'NONE':
      return 'none';
    case 'ERROR':
    case 'WARN':
      return 'production';
    case 'INFO':
      return 'development';
    case 'DEBUG':
      return 'development';
    default:
      return 'console';
  }
}
```

## Error Handling

```javascript
try {
  const config = await loadDebugLogConfig();
  applyConfig(logger, config);
} catch (error) {
  console.warn('Failed to load debug log config:', error);
  // Use defaults
  logger.setLogLevel(LogLevel.ERROR);
}
```

## Hot Reload Implementation

```javascript
// Watch for config changes
if (process.env.NODE_ENV === 'development') {
  fs.watch(configPath, async () => {
    console.log('Debug log config changed, reloading...');
    const newConfig = await loadDebugLogConfig();
    applyDebugLogConfig(logger, newConfig);
  });
}
```

## Notes

- Ensure smooth migration path from old to new format
- Document configuration options thoroughly
- Consider providing config validation CLI tool
- Test with various config combinations
- Monitor for configuration errors in production

## Related Tickets

- **Depends On**: DEBUGLOGGING-010, DEBUGLOGGING-016
- **Related**: DEBUGLOGGING-003 (server config)
- **Blocks**: Full system integration testing
