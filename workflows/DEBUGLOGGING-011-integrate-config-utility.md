# DEBUGLOGGING-011: Integrate with Existing loadAndApplyLoggerConfig Utility

**Status**: Not Started  
**Priority**: P1 - High  
**Phase**: 2 - Integration  
**Component**: Configuration  
**Estimated**: 2 hours

## Description

Update the existing `loadAndApplyLoggerConfig` utility to support the new debug logging configuration format while maintaining backward compatibility with the existing logger configuration system.

**Important Architecture Notes**:
- LoggerStrategy is already used in all container configurations
- LoggerStrategy accepts configuration via its constructor, NOT runtime methods
- LoggerStrategy only has `setLogLevel()` for runtime changes (which can trigger mode switches)
- LoggerStrategy does NOT have `setMode()`, `setCategoryConfig()`, or `setRemoteConfig()` methods
- The debug config file (`config/debug-logging-config.json`) already exists with the correct structure

## Technical Requirements

### 1. Current Implementation

```javascript
// src/configuration/utils/loggerConfigUtils.js
export async function loadAndApplyLoggerConfig(
  container,
  logger,
  tokens,
  configPrefix = 'ContainerConfig'
) {
  // Uses LoggerConfigLoader to load legacy config
  // Applies log level via logger.setLogLevel()
}
```

**Note**: LoggerStrategy is already used in container configurations and accepts a config parameter in its constructor.

### 2. Enhanced Implementation Strategy

Since LoggerStrategy already supports configuration via its constructor, the integration should:

1. **Load debug config before LoggerStrategy creation** in container configurations
2. **Pass config to LoggerStrategy constructor** for initial setup
3. **Use loadAndApplyLoggerConfig for runtime changes** via `setLogLevel()`

```javascript
// In container configurations
const debugConfig = await loadDebugLogConfig();
const logger = new LoggerStrategy({
  config: debugConfig,
  dependencies: { consoleLogger }
});

// For runtime changes
export async function loadAndApplyLoggerConfig(
  container,
  logger,
  tokens,
  configPrefix = 'ContainerConfig'
) {
  // Load debug config if available
  const debugConfig = await loadDebugLogConfig();
  if (debugConfig && debugConfig.mode) {
    // LoggerStrategy supports mode switching via setLogLevel
    logger.setLogLevel(debugConfig.mode);
    return;
  }
  
  // Fall back to legacy config loading
  // ... existing implementation
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
   - [ ] Create `src/configuration/debugLogConfigLoader.js` (follow LoggerConfigLoader pattern)
   - [ ] Implement config file reading from `config/debug-logging-config.json`
   - [ ] Add environment variable override support
   - [ ] Handle missing config gracefully with proper error reporting

2. **Update Container Configurations**
   - [ ] Load debug config in `minimalContainerConfig.js` before creating LoggerStrategy
   - [ ] Load debug config in `containerConfig.js` before creating LoggerStrategy  
   - [ ] Pass loaded config to LoggerStrategy constructor
   - [ ] Maintain existing loadAndApplyLoggerConfig call for runtime changes

3. **Update loadAndApplyLoggerConfig**
   - [ ] Add debug config loading as alternative to legacy config
   - [ ] Use `setLogLevel()` for mode switching (LoggerStrategy supports this)
   - [ ] Maintain backward compatibility with legacy logger-config.json
   - [ ] Add proper logging of config source (debug vs legacy)

3. **Config Application Logic**

   ```javascript
   function applyDebugLogConfig(logger, config) {
     // LoggerStrategy supports mode switching via setLogLevel
     // Special values like 'remote', 'console', 'hybrid', 'none' trigger mode switches
     if (config.mode && logger.setLogLevel) {
       logger.setLogLevel(config.mode);
     }

     // Apply log level for backward compatibility
     if (config.logLevel && logger.setLogLevel) {
       logger.setLogLevel(config.logLevel);
     }

     // Note: LoggerStrategy handles categories and remote config internally
     // These are passed via the constructor config, not runtime methods
   }
   ```

   **Important**: LoggerStrategy does NOT have `setMode()`, `setCategoryConfig()`, or `setRemoteConfig()` methods. All configuration except log level must be passed via the constructor.

4. **Environment Variable Support**
   - [ ] Check `DEBUG_LOG_CONFIG_PATH` for custom config path
   - [ ] Support `DEBUG_LOG_MODE` override (already supported by LoggerStrategy)
   - [ ] Document all environment variables in README
   - [ ] Ensure proper precedence: env vars > config file > defaults

5. **Config File Resolution**

   ```javascript
   // In DebugLogConfigLoader
   async function resolveConfigPath() {
     // Priority order for config file resolution
     const configPath = process.env.DEBUG_LOG_CONFIG_PATH || 
                       'config/debug-logging-config.json';
     
     // The file already exists at config/debug-logging-config.json
     // Just need to handle the case where it might be missing
     return configPath;
   }
   ```

   **Note**: The debug config file already exists at `config/debug-logging-config.json` with the correct structure.

## Acceptance Criteria

- [ ] Debug config is loaded from `config/debug-logging-config.json` correctly
- [ ] LoggerStrategy receives config via constructor in container configurations
- [ ] Runtime mode switching works via `setLogLevel()` with special values
- [ ] Legacy `logger-config.json` format continues to work
- [ ] Environment variable `DEBUG_LOG_MODE` overrides config mode
- [ ] Missing debug config falls back to legacy config gracefully
- [ ] All existing container configurations work with new approach
- [ ] Config validation provides clear error messages
- [ ] Documentation updated to explain both config formats

## Dependencies

- **Requires**: DEBUGLOGGING-010 (DI container update)
- **Requires**: DEBUGLOGGING-016 (Configuration schema)
- **Modifies**: Existing logger config utility

## Testing Requirements

1. **Unit Tests** (`tests/unit/configuration/debugLogConfigLoader.test.js`)
   - [ ] Test loading debug config from file
   - [ ] Test environment variable path override
   - [ ] Test missing config file handling
   - [ ] Test config validation and error reporting
   - [ ] Test config structure compatibility with LoggerStrategy

2. **Integration Tests** (`tests/integration/configuration/debugLogConfigLoader.integration.test.js`)
   - [ ] Test LoggerStrategy with debug config in constructor
   - [ ] Test runtime mode switching via setLogLevel()
   - [ ] Test fallback from debug to legacy config
   - [ ] Test container configurations with debug config
   - [ ] Test that categories and remote config are properly used by LoggerStrategy

## Files to Create/Modify

- **Create**: `src/configuration/debugLogConfigLoader.js` (follow LoggerConfigLoader pattern)
- **Modify**: `src/configuration/utils/loggerConfigUtils.js` (add debug config support)
- **Modify**: `src/dependencyInjection/minimalContainerConfig.js` (load debug config for LoggerStrategy)
- **Modify**: `src/dependencyInjection/containerConfig.js` (load debug config for LoggerStrategy)
- **Already Exists**: `config/debug-logging-config.json` (no creation needed)
- **Create**: `tests/unit/configuration/debugLogConfigLoader.test.js`
- **Create**: `tests/integration/configuration/debugLogConfigLoader.integration.test.js`

## Configuration Migration Strategy

1. **Check for new config file**
2. **If not found, check for legacy config**
3. **If legacy exists, use compatibility mode**
4. **Log deprecation warning for legacy format**
5. **Provide migration tool/script**

## Migration Path

Since `debug-logging-config.json` already exists with the proper structure, migration involves:

1. **DebugLogConfigLoader attempts to load debug config first**
2. **If not found or disabled, fall back to LoggerConfigLoader**
3. **LoggerStrategy already handles both config formats**

The existing debug config structure is already compatible with LoggerStrategy:
```json
{
  "mode": "development",  // LoggerStrategy detects this
  "logLevel": "INFO",      // Backward compatibility
  "remote": { ... },       // Used by RemoteLogger
  "categories": { ... }    // Category-specific settings
}
```

## Error Handling

```javascript
// In container configuration
try {
  const debugConfig = await loadDebugLogConfig();
  const logger = new LoggerStrategy({
    config: debugConfig || {},
    dependencies: { consoleLogger }
  });
} catch (error) {
  // LoggerStrategy constructor handles errors internally
  // Falls back to console logger if config is invalid
  logger.warn('Failed to load debug config:', error);
}

// In loadAndApplyLoggerConfig for runtime changes
try {
  const debugConfig = await loadDebugLogConfig();
  if (debugConfig?.mode) {
    logger.setLogLevel(debugConfig.mode); // Triggers mode switch
  }
} catch (error) {
  // Fall back to legacy config loading
  // Existing implementation handles this
}
```

## Runtime Configuration Updates

Since LoggerStrategy doesn't support updating categories or remote config after construction, runtime updates are limited to mode switching:

```javascript
// Runtime mode switching via loadAndApplyLoggerConfig
const debugConfig = await loadDebugLogConfig();
if (debugConfig?.mode) {
  // This triggers LoggerStrategy's mode switching logic
  logger.setLogLevel(debugConfig.mode);
}
```

For full config updates (categories, remote settings), the application would need to restart or recreate the LoggerStrategy instance.

## Key Implementation Constraints

- **LoggerStrategy Configuration**: Must be passed via constructor, not runtime methods
- **Runtime Changes**: Limited to mode switching via `setLogLevel()` with special values
- **Existing Config**: `debug-logging-config.json` already exists - don't recreate
- **Container Integration**: Must load config BEFORE creating LoggerStrategy
- **Backward Compatibility**: Must maintain support for legacy `logger-config.json`

## Notes

- Ensure smooth migration path from old to new format
- Document both configuration formats and their precedence
- Test mode switching with special setLogLevel values ('remote', 'console', 'hybrid', 'none')
- Validate that categories and remote config work via constructor
- Monitor for configuration loading errors in production

## Related Tickets

- **Depends On**: DEBUGLOGGING-010, DEBUGLOGGING-016
- **Related**: DEBUGLOGGING-003 (server config)
- **Blocks**: Full system integration testing
