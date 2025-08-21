# DEBUGLOGGING-018: Add Runtime Mode Switching via setLogLevel

**Status**: Not Started  
**Priority**: P1 - High  
**Phase**: 3 - Configuration  
**Component**: Configuration System  
**Estimated**: 3 hours  

## Description

Implement runtime mode switching capability through the existing `setLogLevel()` method, allowing dynamic changes to logging behavior without application restart. This maintains backward compatibility while adding new functionality.

## Technical Requirements

### 1. Enhanced setLogLevel Method
```javascript
setLogLevel(input) {
  // Backward compatibility: traditional log levels
  if (this.#isLogLevel(input)) {
    this.#currentLevel = input;
    this.#logger.setLogLevel(input);
    return;
  }
  
  // New functionality: mode switching
  if (this.#isMode(input)) {
    this.#switchMode(input);
    return;
  }
  
  // New functionality: configuration object
  if (typeof input === 'object') {
    this.#applyConfiguration(input);
    return;
  }
}
```

### 2. Supported Input Types
```javascript
// Traditional log levels (backward compatible)
logger.setLogLevel('DEBUG');
logger.setLogLevel(LogLevel.ERROR);

// Mode switching (new)
logger.setLogLevel('remote');
logger.setLogLevel('hybrid');
logger.setLogLevel('console');

// Configuration updates (new)
logger.setLogLevel({
  mode: 'hybrid',
  categories: {
    engine: { level: 'debug' }
  }
});

// Special commands (new)
logger.setLogLevel('reload');  // Reload config from file
logger.setLogLevel('reset');   // Reset to defaults
```

### 3. Mode Transition Matrix
| From | To | Action |
|------|----|--------|
| console | remote | Initialize RemoteLogger, flush console |
| console | hybrid | Initialize RemoteLogger, keep console |
| remote | console | Flush remote buffer, switch |
| remote | hybrid | Keep remote, add console |
| hybrid | console | Flush remote, keep console |
| hybrid | remote | Remove console, keep remote |

## Implementation Steps

1. **Enhance LoggerStrategy.setLogLevel**
   - [ ] Detect input type (level, mode, config)
   - [ ] Route to appropriate handler
   - [ ] Maintain backward compatibility
   - [ ] Add validation for inputs

2. **Implement Mode Detection**
   ```javascript
   #isLogLevel(input) {
     const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'NONE'];
     return levels.includes(input) || 
            Object.values(LogLevel).includes(input);
   }
   
   #isMode(input) {
     const modes = ['console', 'remote', 'hybrid', 'test', 'none'];
     return modes.includes(input);
   }
   
   #isSpecialCommand(input) {
     const commands = ['reload', 'reset', 'flush', 'status'];
     return commands.includes(input);
   }
   ```

3. **Implement Mode Switching**
   ```javascript
   async #switchMode(newMode) {
     const oldMode = this.#mode;
     
     // Validate transition
     if (!this.#canTransition(oldMode, newMode)) {
       throw new Error(`Cannot transition from ${oldMode} to ${newMode}`);
     }
     
     // Flush current logger
     await this.#flushCurrentLogger();
     
     // Create new logger
     const newLogger = await this.#createLogger(newMode, this.#config);
     
     // Transition state
     await this.#transitionState(oldMode, newMode, newLogger);
     
     // Update references
     this.#logger = newLogger;
     this.#mode = newMode;
     
     // Notify
     this.#notifyModeChange(oldMode, newMode);
   }
   ```

4. **Implement State Transition**
   ```javascript
   async #transitionState(oldMode, newMode, newLogger) {
     // Transfer buffered logs if applicable
     if (this.#hasBuffer()) {
       const buffer = this.#drainBuffer();
       await newLogger.processBatch(buffer);
     }
     
     // Clean up old logger
     if (this.#logger && this.#logger.cleanup) {
       await this.#logger.cleanup();
     }
     
     // Initialize new logger
     if (newLogger.initialize) {
       await newLogger.initialize();
     }
   }
   ```

5. **Implement Configuration Updates**
   ```javascript
   #applyConfiguration(config) {
     // Validate configuration
     const validation = this.#validateConfig(config);
     if (!validation.valid) {
       throw new Error(`Invalid config: ${validation.errors}`);
     }
     
     // Apply mode change if specified
     if (config.mode && config.mode !== this.#mode) {
       this.#switchMode(config.mode);
     }
     
     // Apply category updates
     if (config.categories) {
       this.#updateCategories(config.categories);
     }
     
     // Apply logger-specific config
     if (this.#logger.applyConfig) {
       this.#logger.applyConfig(config);
     }
   }
   ```

6. **Implement Special Commands**
   ```javascript
   async #handleSpecialCommand(command) {
     switch(command) {
       case 'reload':
         const config = await this.#loadConfiguration();
         this.#applyConfiguration(config);
         break;
         
       case 'reset':
         this.#applyConfiguration(DEFAULT_CONFIG);
         break;
         
       case 'flush':
         await this.#logger.flush();
         break;
         
       case 'status':
         return this.#getStatus();
         
       default:
         throw new Error(`Unknown command: ${command}`);
     }
   }
   ```

## Acceptance Criteria

- [ ] Traditional setLogLevel calls work unchanged
- [ ] Mode switching works at runtime
- [ ] Configuration updates apply immediately
- [ ] State transitions properly between modes
- [ ] No log loss during transitions
- [ ] Special commands work correctly
- [ ] Validation prevents invalid transitions
- [ ] Events emitted for mode changes

## Dependencies

- **Modifies**: DEBUGLOGGING-005 (LoggerStrategy)
- **Requires**: DEBUGLOGGING-016 (configuration)
- **Requires**: DEBUGLOGGING-017 (validation)

## Testing Requirements

1. **Unit Tests**
   - [ ] Test backward compatibility
   - [ ] Test mode switching
   - [ ] Test configuration updates
   - [ ] Test special commands
   - [ ] Test transition validation

2. **Integration Tests**
   - [ ] Test runtime mode changes
   - [ ] Test log preservation
   - [ ] Test with active logging
   - [ ] Test error scenarios

## Files to Modify

- **Modify**: `src/logging/loggerStrategy.js`
- **Create**: `src/logging/modeTransitionManager.js`
- **Create**: `tests/unit/logging/runtimeSwitching.test.js`

## Backward Compatibility

```javascript
// These must continue to work:
logger.setLogLevel('DEBUG');
logger.setLogLevel(LogLevel.ERROR);
logger.setLogLevel('NONE');

// Map old to new if needed:
const LEGACY_MAPPING = {
  'NONE': { mode: 'none' },
  'ERROR': { categories: { '*': { level: 'error' } } },
  'WARN': { categories: { '*': { level: 'warn' } } },
  'INFO': { categories: { '*': { level: 'info' } } },
  'DEBUG': { categories: { '*': { level: 'debug' } } }
};
```

## Mode Change Events

```javascript
// Emit events for monitoring
this.#eventBus.emit('logger.mode.changed', {
  from: oldMode,
  to: newMode,
  timestamp: Date.now(),
  reason: 'runtime-switch'
});

// Allow listeners to react
this.#eventBus.on('logger.mode.changed', (event) => {
  console.log(`Logger mode changed: ${event.from} → ${event.to}`);
});
```

## Performance Considerations

- Mode switches should be rare
- Minimize transition overhead
- Preserve logs during transition
- Lazy initialization where possible
- Clean up resources properly

## Error Handling

```javascript
try {
  logger.setLogLevel('invalid');
} catch (error) {
  // Should not break application
  console.error('Failed to set log level:', error);
  // Keep current configuration
}
```

## Notes

- Critical for debugging in production
- Allows runtime troubleshooting
- Consider rate limiting mode switches
- Document transition behavior clearly
- Test thoroughly with concurrent logging

## Related Tickets

- **Modifies**: DEBUGLOGGING-005
- **Depends On**: DEBUGLOGGING-016, DEBUGLOGGING-017
- **Related**: DEBUGLOGGING-011 (config loading)