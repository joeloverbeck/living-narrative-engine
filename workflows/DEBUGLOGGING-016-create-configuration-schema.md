# DEBUGLOGGING-016: Create Configuration Schema and Defaults

**Status**: Not Started  
**Priority**: P0 - Critical  
**Phase**: 3 - Configuration  
**Component**: Configuration System  
**Estimated**: 3 hours

## Description

Create a comprehensive configuration schema for the debug logging system with validation, defaults, and support for both client and server configurations. This ensures consistent configuration across the system.

## Technical Requirements

### 1. Configuration Schema (JSON Schema)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "enabled": { "type": "boolean" },
    "mode": {
      "enum": ["console", "remote", "hybrid", "test", "none"]
    },
    "remote": {
      "type": "object",
      "properties": {
        "endpoint": { "type": "string", "format": "uri" },
        "batchSize": { "type": "integer", "minimum": 1, "maximum": 1000 },
        "flushInterval": {
          "type": "integer",
          "minimum": 100,
          "maximum": 10000
        },
        "retryAttempts": { "type": "integer", "minimum": 0, "maximum": 5 },
        "circuitBreakerThreshold": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        }
      }
    },
    "categories": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "enabled": { "type": "boolean" },
          "level": { "enum": ["debug", "info", "warn", "error", "none"] }
        }
      }
    }
  },
  "required": ["enabled", "mode"]
}
```

### 2. Default Configuration

```javascript
export const DEFAULT_CONFIG = {
  enabled: true,
  mode: 'development',
  remote: {
    endpoint: 'http://localhost:3001/api/debug-log',
    batchSize: 100,
    flushInterval: 1000,
    retryAttempts: 3,
    retryBaseDelay: 1000,
    retryMaxDelay: 30000,
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 60000,
    requestTimeout: 5000,
    compression: false,
  },
  categories: {
    engine: { enabled: true, level: 'debug' },
    ui: { enabled: true, level: 'info' },
    ecs: { enabled: true, level: 'debug' },
    ai: { enabled: true, level: 'debug' },
    persistence: { enabled: false, level: 'warn' },
    anatomy: { enabled: true, level: 'info' },
    actions: { enabled: true, level: 'debug' },
    turns: { enabled: true, level: 'info' },
    events: { enabled: false, level: 'warn' },
    validation: { enabled: false, level: 'error' },
    general: { enabled: true, level: 'debug' },
  },
  console: {
    enabled: true,
    useColors: true,
    showTimestamp: false,
    showCategory: true,
    groupSimilar: true,
  },
  performance: {
    enableMetrics: true,
    metricsInterval: 60000,
    memoryWarningThreshold: 100, // MB
  },
};
```

### 3. Environment-Specific Presets

```javascript
export const CONFIG_PRESETS = {
  production: {
    mode: 'remote',
    categories: {
      // Only errors and warnings in production
      '*': { enabled: true, level: 'warn' },
    },
  },
  development: {
    mode: 'hybrid',
    console: { enabled: true, showCategory: true },
  },
  test: {
    mode: 'test',
    remote: { enabled: false },
    console: { enabled: false },
  },
  debugging: {
    mode: 'hybrid',
    categories: {
      '*': { enabled: true, level: 'debug' },
    },
  },
};
```

## Implementation Steps

1. **Create Schema File**
   - [ ] Create `data/schemas/debug-logging-config.schema.json`
   - [ ] Define complete JSON schema
   - [ ] Add validation rules
   - [ ] Include descriptions for each field

2. **Create Default Configuration**
   - [ ] Create `src/logging/config/defaultConfig.js`
   - [ ] Export DEFAULT_CONFIG object
   - [ ] Add environment-specific presets
   - [ ] Document each configuration option

3. **Create Configuration Validator**

   ```javascript
   // src/logging/config/configValidator.js
   import Ajv from 'ajv';
   import schema from 'data/schemas/debug-logging-config.schema.json';

   export class ConfigValidator {
     constructor() {
       this.ajv = new Ajv({ allErrors: true });
       this.validate = this.ajv.compile(schema);
     }

     validateConfig(config) {
       const valid = this.validate(config);
       if (!valid) {
         throw new Error(this.formatErrors(this.validate.errors));
       }
       return true;
     }

     formatErrors(errors) {
       return errors.map((err) => `${err.dataPath}: ${err.message}`).join(', ');
     }
   }
   ```

4. **Create Configuration Merger**

   ```javascript
   // src/logging/config/configMerger.js
   export class ConfigMerger {
     merge(defaults, overrides, envVars) {
       // Deep merge with proper precedence
       const merged = this.deepMerge(defaults, overrides);
       return this.applyEnvironmentVariables(merged, envVars);
     }

     deepMerge(target, source) {
       // Recursive merge implementation
     }

     applyEnvironmentVariables(config, env) {
       // Override with env vars
       if (env.DEBUG_LOG_MODE) config.mode = env.DEBUG_LOG_MODE;
       if (env.DEBUG_LOG_ENDPOINT)
         config.remote.endpoint = env.DEBUG_LOG_ENDPOINT;
       // ... etc
       return config;
     }
   }
   ```

5. **Create Configuration Files**
   - [ ] Create `config/debug-logging-config.json` (default)
   - [ ] Create `config/debug-logging-config.development.json`
   - [ ] Create `config/debug-logging-config.production.json`
   - [ ] Create `config/debug-logging-config.test.json`

## Acceptance Criteria

- [ ] Schema validates all configuration options
- [ ] Default configuration works out of the box
- [ ] Environment variables override file config
- [ ] Invalid configurations rejected with clear errors
- [ ] Presets available for common scenarios
- [ ] Configuration documented thoroughly
- [ ] Validation provides helpful error messages
- [ ] Migration from old format supported

## Dependencies

- **Used By**: DEBUGLOGGING-005 (LoggerStrategy)
- **Used By**: DEBUGLOGGING-011 (config loading)
- **Uses**: AJV for validation

## Testing Requirements

1. **Unit Tests**
   - [ ] Test schema validation
   - [ ] Test configuration merging
   - [ ] Test environment variable override
   - [ ] Test preset application

2. **Integration Tests**
   - [ ] Test with LoggerStrategy
   - [ ] Test configuration loading
   - [ ] Test invalid configurations

## Files to Create/Modify

- **Create**: `data/schemas/debug-logging-config.schema.json`
- **Create**: `src/logging/config/defaultConfig.js`
- **Create**: `src/logging/config/configValidator.js`
- **Create**: `src/logging/config/configMerger.js`
- **Create**: `config/debug-logging-config.json`
- **Create**: `tests/unit/logging/config/configValidator.test.js`

## Configuration Documentation

```markdown
# Debug Logging Configuration

## Basic Structure

- `enabled`: Enable/disable logging system
- `mode`: Logging mode (console|remote|hybrid|test|none)
- `remote`: Remote logger settings
- `categories`: Per-category settings
- `console`: Console output settings
- `performance`: Performance monitoring

## Environment Variables

- `DEBUG_LOG_MODE`: Override mode
- `DEBUG_LOG_ENDPOINT`: Override endpoint
- `DEBUG_LOG_BATCH_SIZE`: Override batch size
- ... (complete list)

## Presets

- `production`: Minimal logging, remote only
- `development`: Hybrid mode with console
- `test`: Mock logger, no output
- `debugging`: Everything enabled
```

## Migration Support

```javascript
// Support old logger-config.json format
export function migrateOldConfig(oldConfig) {
  return {
    enabled: true,
    mode: oldConfig.logLevel === 'NONE' ? 'none' : 'console',
    categories: {
      general: {
        enabled: oldConfig.logLevel !== 'NONE',
        level: oldConfig.logLevel.toLowerCase(),
      },
    },
  };
}
```

## Notes

- Consider supporting YAML format for config
- May need config hot-reload in development
- Think about config inheritance/composition
- Consider per-user config overrides
- Document security implications of remote endpoint

## Related Tickets

- **Used By**: DEBUGLOGGING-005, DEBUGLOGGING-011
- **Related**: DEBUGLOGGING-003 (server config)
- **Next**: DEBUGLOGGING-017 (validation system)
