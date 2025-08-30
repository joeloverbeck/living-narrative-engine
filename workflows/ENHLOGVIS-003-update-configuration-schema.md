# ENHLOGVIS-003: Update Configuration Schema and Defaults

## Ticket Overview
**Type**: Configuration Enhancement  
**Component**: Configuration System  
**Priority**: High  
**Phase**: 1 - Core Functionality  
**Estimated Effort**: 2 hours  

## Objective
Update the debug logging configuration schema to include new critical logging options, and ensure default values provide out-of-the-box functionality for enhanced logging visibility.

## Current State
- Debug logging configuration exists in `debug-logging-config.json`
- Schema validation exists in `data/schemas/debug-logging-config.schema.json`
- No configuration options for critical log visibility enhancements
- System uses two config files:
  - `config/debug-logging-config.json` - Debug logging settings
  - `config/logger-config.json` - General logger configuration

## Technical Implementation

### Files to Modify
- `data/schemas/debug-logging-config.schema.json` - Add new schema properties
- `config/debug-logging-config.json` - Update with new default configuration
- `src/logging/config/loggerConfigLoader.js` - Ensure proper loading of new config

### Implementation Steps

1. **Update JSON Schema** (`data/schemas/debug-logging-config.schema.json`):
   ```json
   {
     "type": "object",
     "properties": {
       // ... existing properties ...
       
       "criticalLogging": {
         "type": "object",
         "description": "Configuration for enhanced critical log visibility",
         "properties": {
           "alwaysShowInConsole": {
             "type": "boolean",
             "default": true,
             "description": "Always show warnings and errors in console regardless of filters"
           },
           "enableVisualNotifications": {
             "type": "boolean",
             "default": true,
             "description": "Show floating notification badges for warnings and errors"
           },
           "bufferSize": {
             "type": "integer",
             "minimum": 10,
             "maximum": 200,
             "default": 50,
             "description": "Number of critical logs to retain in memory"
           },
           "notificationPosition": {
             "type": "string",
             "enum": ["top-left", "top-right", "bottom-left", "bottom-right"],
             "default": "top-right",
             "description": "Position of the notification badge on screen"
           },
           "autoDismissAfter": {
             "oneOf": [
               { "type": "integer", "minimum": 1000 },
               { "type": "null" }
             ],
             "default": null,
             "description": "Auto-dismiss notifications after milliseconds (null for manual only)"
           },
           "soundEnabled": {
             "type": "boolean",
             "default": false,
             "description": "Play sound when critical logs occur (optional feature)"
           },
           "minimumLevel": {
             "type": "string",
             "enum": ["warn", "error"],
             "default": "warn",
             "description": "Minimum level to consider as critical (warn includes both warnings and errors)"
           }
         },
         "additionalProperties": false
       }
     }
   }
   ```

2. **Update default configuration** (`config/debug-logging-config.json`):
   ```json
   {
     // ... existing configuration ...
     
     "criticalLogging": {
       "alwaysShowInConsole": true,
       "enableVisualNotifications": true,
       "bufferSize": 50,
       "notificationPosition": "top-right",
       "autoDismissAfter": null,
       "soundEnabled": false,
       "minimumLevel": "warn"
     }
   }
   ```

3. **Create migration helper** for existing configurations:
   ```javascript
   // src/logging/config/criticalLoggingMigration.js
   
   /**
    * Migrates existing debug-logging-config to include critical logging defaults
    */
   export function migrateCriticalLoggingConfig(existingConfig) {
     if (!existingConfig.criticalLogging) {
       return {
         ...existingConfig,
         criticalLogging: {
           alwaysShowInConsole: true,
           enableVisualNotifications: true,
           bufferSize: 50,
           notificationPosition: 'top-right',
           autoDismissAfter: null,
           soundEnabled: false,
           minimumLevel: 'warn'
         }
       };
     }
     
     // Ensure all properties exist with defaults
     const defaults = {
       alwaysShowInConsole: true,
       enableVisualNotifications: true,
       bufferSize: 50,
       notificationPosition: 'top-right',
       autoDismissAfter: null,
       soundEnabled: false,
       minimumLevel: 'warn'
     };
     
     return {
       ...existingConfig,
       criticalLogging: {
         ...defaults,
         ...existingConfig.criticalLogging
       }
     };
   }
   ```

4. **Update LoggerConfigLoader** to handle new configuration:
   ```javascript
   // In src/logging/config/loggerConfigLoader.js
   
   import { migrateCriticalLoggingConfig } from './criticalLoggingMigration.js';
   
   class LoggerConfigLoader {
     async loadDebugConfig() {
       try {
         const response = await fetch('/config/debug-logging-config.json');
         let config = await response.json();
         
         // Apply migration for critical logging
         config = migrateCriticalLoggingConfig(config);
         
         // Validate against schema
         this.#validateConfig(config);
         
         return config;
       } catch (error) {
         console.warn('Failed to load debug config, using defaults', error);
         return this.#getDefaultDebugConfig();
       }
     }
     
     #getDefaultDebugConfig() {
       return {
         // ... existing defaults ...
         criticalLogging: {
           alwaysShowInConsole: true,
           enableVisualNotifications: true,
           bufferSize: 50,
           notificationPosition: 'top-right',
           autoDismissAfter: null,
           soundEnabled: false,
           minimumLevel: 'warn'
         }
       };
     }
   }
   ```

## Dependencies
- **Required By**: ENHLOGVIS-001 (Uses config for bypass logic)
- **Required By**: ENHLOGVIS-002 (Uses config for buffer size)
- **Required By**: ENHLOGVIS-005 (Uses config for notification settings)

## Acceptance Criteria
- [ ] Schema includes all new critical logging properties
- [ ] Schema validates property types and constraints correctly
- [ ] Default configuration provides sensible out-of-the-box values
- [ ] Migration handles existing configurations without critical logging section
- [ ] Configuration changes can be made without app restart
- [ ] Invalid configuration values fall back to defaults gracefully
- [ ] Schema documentation clearly explains each option

## Testing Requirements

### Unit Tests
- Test schema validation accepts valid critical logging config
- Test schema validation rejects invalid values
- Test migration adds critical logging to existing configs
- Test migration preserves existing critical logging values
- Test default values are applied when config is missing
- Test enum constraints (position, minimumLevel)
- Test numeric constraints (bufferSize min/max)

### Integration Tests
- Test full configuration loading with critical logging section
- Test configuration loading without critical logging (migration)
- Test runtime configuration updates
- Test fallback to defaults on invalid config

### Manual Testing
1. Start with no criticalLogging section - verify defaults applied
2. Add invalid bufferSize (e.g., 5) - verify validation error
3. Set invalid position value - verify validation error
4. Set all valid values - verify accepted
5. Change configuration at runtime - verify takes effect
6. Test with malformed JSON - verify graceful fallback

## Code Review Checklist
- [ ] Schema follows existing patterns
- [ ] Default values are production-ready
- [ ] Migration is backward compatible
- [ ] Documentation is clear and complete
- [ ] Error messages are helpful
- [ ] No breaking changes to existing config

## Notes
- Consider versioning the configuration schema for future migrations
- The `soundEnabled` option is included for future enhancement but won't be implemented initially
- The `minimumLevel` option allows flexibility for what's considered "critical"
- Ensure schema validation error messages are user-friendly
- Consider adding config examples to documentation

## Related Tickets
- **Next**: ENHLOGVIS-004 (Write unit tests)
- **Blocks**: ENHLOGVIS-001, ENHLOGVIS-002, ENHLOGVIS-005 (All need config)