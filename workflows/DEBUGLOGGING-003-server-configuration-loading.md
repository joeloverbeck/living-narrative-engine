# DEBUGLOGGING-003: Add Server-Side Configuration Loading and Validation

**Status**: Not Started  
**Priority**: P0 - Critical  
**Phase**: 1 - Infrastructure  
**Component**: Server-Side Service  
**Estimated**: 3 hours  

## Description

Implement configuration loading and validation for the debug logging service in llm-proxy-server. This will manage server-side settings for log storage, retention, and file management.

## Technical Requirements

### 1. Configuration Schema
```json
{
  "debugLogging": {
    "enabled": true,
    "storage": {
      "path": "./logs",
      "retentionDays": 7,
      "maxFileSize": "10MB",
      "compression": false
    },
    "performance": {
      "writeBufferSize": 100,
      "flushInterval": 1000,
      "maxConcurrentWrites": 5
    },
    "cleanup": {
      "schedule": "0 2 * * *",
      "enabled": true
    }
  }
}
```

### 2. Configuration Sources (Priority Order)
1. Environment variables (highest priority)
2. Configuration file (`config/debug-logging-server.json`)
3. Default values (lowest priority)

### 3. Environment Variable Mapping
```
DEBUG_LOG_ENABLED=true
DEBUG_LOG_PATH=./logs
DEBUG_LOG_RETENTION_DAYS=7
DEBUG_LOG_MAX_FILE_SIZE=10MB
DEBUG_LOG_CLEANUP_ENABLED=true
```

## Implementation Steps

1. **Create Configuration Loader**
   - [ ] Create `llm-proxy-server/src/config/debugLogConfigLoader.js`
   - [ ] Implement environment variable parsing
   - [ ] Load JSON configuration file
   - [ ] Merge configurations with proper precedence

2. **Create Configuration Validator**
   - [ ] Create `llm-proxy-server/src/config/debugLogConfigValidator.js`
   - [ ] Validate path exists and is writable
   - [ ] Validate retention days (1-365)
   - [ ] Parse and validate file size format (KB, MB, GB)
   - [ ] Validate cron schedule format

3. **Default Configuration**
   ```javascript
   const DEFAULT_CONFIG = {
     enabled: true,
     storage: {
       path: './logs',
       retentionDays: 7,
       maxFileSize: '10MB',
       compression: false
     },
     performance: {
       writeBufferSize: 100,
       flushInterval: 1000,
       maxConcurrentWrites: 5
     },
     cleanup: {
       schedule: '0 2 * * *', // 2 AM daily
       enabled: true
     }
   };
   ```

4. **Configuration Service**
   - [ ] Create singleton configuration service
   - [ ] Implement hot-reload capability (watch file changes)
   - [ ] Add configuration validation on load
   - [ ] Provide getter methods for config values

5. **Integration Points**
   - [ ] Inject config into LogStorageService
   - [ ] Use config in debugLogController
   - [ ] Configure cleanup scheduler with cron settings

## Acceptance Criteria

- [ ] Configuration loads from environment variables
- [ ] Configuration loads from JSON file
- [ ] Default values are applied for missing config
- [ ] Invalid configurations are rejected with clear errors
- [ ] File size parsing handles KB, MB, GB formats
- [ ] Path validation ensures directory is writable
- [ ] Configuration changes can be reloaded without restart
- [ ] All configuration values are accessible via service

## Dependencies

- **Parallel with**: DEBUGLOGGING-001, DEBUGLOGGING-002
- **Required for**: DEBUGLOGGING-004 (cleanup scheduling)

## Testing Requirements

1. **Unit Tests**
   - [ ] Test environment variable parsing
   - [ ] Test configuration merging precedence
   - [ ] Test file size parsing (10MB, 1GB, 500KB)
   - [ ] Test validation of all config fields

2. **Integration Tests**
   - [ ] Test loading from file
   - [ ] Test loading from environment
   - [ ] Test hot-reload functionality
   - [ ] Test invalid configuration handling

## Files to Create/Modify

- **Create**: `llm-proxy-server/src/config/debugLogConfigLoader.js`
- **Create**: `llm-proxy-server/src/config/debugLogConfigValidator.js`
- **Create**: `llm-proxy-server/config/debug-logging-server.json`
- **Create**: `llm-proxy-server/tests/debugLogConfig.test.js`
- **Modify**: `llm-proxy-server/.env.example` (add new variables)

## Configuration Validation Rules

1. **Path Validation**
   - Must be a valid directory path
   - Directory must be writable
   - Create directory if it doesn't exist

2. **Retention Days**
   - Must be integer between 1 and 365
   - Default to 7 if invalid

3. **Max File Size**
   - Must match pattern: `^\d+[KMG]B$`
   - Convert to bytes for internal use
   - Minimum 1MB, maximum 1GB

4. **Cron Schedule**
   - Must be valid cron expression
   - Default to '0 2 * * *' if invalid

## Error Handling

- Configuration errors should be logged clearly
- Service should start with defaults if config is invalid
- Provide detailed validation error messages
- Non-critical config errors shouldn't prevent startup

## Notes

- Follow existing proxy server configuration patterns
- Consider adding JSON schema validation in future
- Ensure config works in both development and production
- Document all environment variables in README

## Related Tickets

- **Parallel**: DEBUGLOGGING-001, DEBUGLOGGING-002
- **Required By**: DEBUGLOGGING-004 (cleanup scheduling)
- **Related**: DEBUGLOGGING-016 (client-side configuration)