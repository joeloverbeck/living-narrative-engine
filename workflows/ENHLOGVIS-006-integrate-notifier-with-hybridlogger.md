# ENHLOGVIS-006: Integrate CriticalLogNotifier with HybridLogger

## Ticket Overview
**Type**: Integration  
**Component**: Logging System  
**Priority**: High  
**Phase**: 2 - Visual Notifications  
**Estimated Effort**: 2-3 hours  

## Objective
Integrate the CriticalLogNotifier class with HybridLogger to automatically trigger visual notifications when warnings and errors are logged, creating a seamless connection between the logging system and the UI notification system.

## Current State
- HybridLogger has critical log buffer (ENHLOGVIS-002)
- HybridLogger has bypass logic for console output (ENHLOGVIS-001)
- CriticalLogNotifier exists but is not connected (ENHLOGVIS-005)
- No automatic notification triggering

## Technical Implementation

### Files to Modify
- `src/logging/hybridLogger.js` - Add notifier integration
- `src/logging/loggerFactory.js` - Update factory to create notifier
- `src/dependencyInjection/registrations/loggingRegistrations.js` - Update DI registration

### Implementation Steps

1. **Modify HybridLogger** (`src/logging/hybridLogger.js`):
   ```javascript
   import CriticalLogNotifier from './criticalLogNotifier.js';
   
   class HybridLogger {
     #notifier = null;
     #criticalLoggingConfig;
     // ... other private fields
     
     constructor({ consoleLogger, remoteLogger, eventBus, config, configLoader }) {
       // ... existing constructor code
       
       // Initialize critical logging config
       this.#criticalLoggingConfig = config?.criticalLogging || {
         alwaysShowInConsole: true,
         enableVisualNotifications: true,
         bufferSize: 50,
         notificationPosition: 'top-right',
         autoDismissAfter: null
       };
       
       // Initialize notifier if enabled
       this.#initializeNotifier();
     }
     
     #initializeNotifier() {
       if (this.#criticalLoggingConfig.enableVisualNotifications) {
         try {
           this.#notifier = new CriticalLogNotifier({
             config: this.#criticalLoggingConfig,
             logger: this.#createNotifierLogger()
           });
           
           this.#logger.debug('CriticalLogNotifier initialized');
         } catch (error) {
           this.#logger.error('Failed to initialize CriticalLogNotifier', error);
           // Continue without notifier - non-critical feature
         }
       }
     }
     
     #createNotifierLogger() {
       // Create a minimal logger for the notifier to avoid circular dependency
       return {
         info: (msg) => console.info(`[Notifier] ${msg}`),
         warn: (msg) => console.warn(`[Notifier] ${msg}`),
         error: (msg, err) => console.error(`[Notifier] ${msg}`, err),
         debug: (msg) => {
           if (this.#config?.debug) {
             console.debug(`[Notifier] ${msg}`);
           }
         }
       };
     }
     
     warn(message, context = {}) {
       const category = this.#determineCategory(context);
       
       // Add to critical buffer (existing code from ENHLOGVIS-002)
       const bufferEntry = this.#addToCriticalBuffer('warn', message, category, context);
       
       // Notify the visual notifier
       if (this.#notifier && bufferEntry) {
         this.#notifier.notifyWarning(bufferEntry);
       }
       
       // Existing warn logic
       this.#logToDestinations('warn', message, category, context);
     }
     
     error(message, error = null, context = {}) {
       const category = this.#determineCategory(context);
       
       // Prepare error metadata
       const errorMetadata = {
         ...context,
         stack: error?.stack,
         errorName: error?.name,
         errorMessage: error?.message
       };
       
       // Add to critical buffer (existing code from ENHLOGVIS-002)
       const bufferEntry = this.#addToCriticalBuffer('error', message, category, errorMetadata);
       
       // Notify the visual notifier
       if (this.#notifier && bufferEntry) {
         this.#notifier.notifyError(bufferEntry);
       }
       
       // Existing error logic
       this.#logToDestinations('error', message, category, errorMetadata);
     }
     
     /**
      * Update configuration at runtime
      * @param {Object} newConfig
      */
     updateConfig(newConfig) {
       // ... existing config update logic
       
       // Handle critical logging config changes
       if (newConfig.criticalLogging) {
         const oldConfig = this.#criticalLoggingConfig;
         this.#criticalLoggingConfig = { ...oldConfig, ...newConfig.criticalLogging };
         
         // Recreate notifier if visual notifications setting changed
         if (oldConfig.enableVisualNotifications !== this.#criticalLoggingConfig.enableVisualNotifications) {
           this.#recreateNotifier();
         } else if (this.#notifier) {
           // Update existing notifier config
           this.#notifier.updateConfig(this.#criticalLoggingConfig);
         }
       }
     }
     
     #recreateNotifier() {
       // Clean up existing notifier
       if (this.#notifier) {
         this.#notifier.destroy();
         this.#notifier = null;
       }
       
       // Create new notifier if enabled
       this.#initializeNotifier();
     }
     
     /**
      * Get reference to the notifier (for testing)
      * @returns {CriticalLogNotifier|null}
      */
     getNotifier() {
       return this.#notifier;
     }
     
     /**
      * Clean up resources
      */
     destroy() {
       if (this.#notifier) {
         this.#notifier.destroy();
         this.#notifier = null;
       }
       
       // ... other cleanup
     }
   }
   ```

2. **Update Logger Factory** (`src/logging/loggerFactory.js`):
   ```javascript
   import HybridLogger from './hybridLogger.js';
   import ConsoleLogger from './consoleLogger.js';
   import RemoteLogger from './remoteLogger.js';
   
   class LoggerFactory {
     /**
      * Create a fully configured HybridLogger with notifier support
      * @param {Object} config - Logger configuration
      * @param {Object} dependencies - Additional dependencies
      * @returns {HybridLogger}
      */
     static createLogger(config, dependencies = {}) {
       const consoleLogger = new ConsoleLogger();
       const remoteLogger = new RemoteLogger({
         apiUrl: config.remoteLogging?.apiUrl,
         enabled: config.remoteLogging?.enabled
       });
       
       const hybridLogger = new HybridLogger({
         consoleLogger,
         remoteLogger,
         eventBus: dependencies.eventBus,
         config,
         configLoader: dependencies.configLoader
       });
       
       // Log that notifier integration is active if enabled
       if (config.criticalLogging?.enableVisualNotifications) {
         console.info('Critical log visual notifications enabled');
       }
       
       return hybridLogger;
     }
     
     /**
      * Create a logger with default configuration
      * @returns {HybridLogger}
      */
     static createDefaultLogger() {
       const defaultConfig = {
         criticalLogging: {
           alwaysShowInConsole: true,
           enableVisualNotifications: true,
           bufferSize: 50,
           notificationPosition: 'top-right',
           autoDismissAfter: null
         },
         remoteLogging: {
           enabled: false
         }
       };
       
       return this.createLogger(defaultConfig);
     }
   }
   
   export default LoggerFactory;
   ```

3. **Update DI Registration** (`src/dependencyInjection/registrations/loggingRegistrations.js`):
   ```javascript
   import { tokens } from '../tokens.js';
   import LoggerFactory from '../../logging/loggerFactory.js';
   
   export function registerLoggingServices(container) {
     // Register logger as singleton with notifier support
     container.register(
       tokens.ILogger,
       (dependencies) => {
         const config = dependencies[tokens.ILoggerConfig];
         const eventBus = dependencies[tokens.IEventBus];
         const configLoader = dependencies[tokens.ILoggerConfigLoader];
         
         return LoggerFactory.createLogger(config, {
           eventBus,
           configLoader
         });
       },
       { 
         singleton: true,
         dependencies: [
           tokens.ILoggerConfig,
           tokens.IEventBus,
           tokens.ILoggerConfigLoader
         ]
       }
     );
     
     // Register notifier accessor (for testing/debugging)
     container.register(
       tokens.ICriticalLogNotifier,
       (dependencies) => {
         const logger = dependencies[tokens.ILogger];
         return logger.getNotifier();
       },
       {
         singleton: true,
         dependencies: [tokens.ILogger]
       }
     );
   }
   ```

## Dependencies
- **Depends On**: ENHLOGVIS-001, ENHLOGVIS-002, ENHLOGVIS-005
- **Required By**: ENHLOGVIS-007 (UI implementation needs connected notifier)

## Acceptance Criteria
- [ ] Notifier automatically created when visual notifications enabled
- [ ] Warning logs trigger notifier.notifyWarning()
- [ ] Error logs trigger notifier.notifyError()
- [ ] Notifier gracefully handles initialization failures
- [ ] Configuration updates properly recreate/update notifier
- [ ] Notifier is properly destroyed on logger cleanup
- [ ] No circular dependencies between logger and notifier
- [ ] Integration works with dependency injection container

## Testing Requirements

### Unit Tests
- Test notifier creation when config enabled
- Test notifier not created when config disabled
- Test warning notification triggered on warn()
- Test error notification triggered on error()
- Test config update recreates notifier
- Test notifier destroy on logger destroy
- Test graceful handling of notifier init failure

### Integration Tests
- Test full flow from log to visual notification
- Test configuration changes at runtime
- Test DI container registration and resolution
- Test logger factory creates integrated logger

### Manual Testing
1. Enable visual notifications in config
2. Log warnings - verify badges appear
3. Log errors - verify error count increases
4. Disable notifications in config
5. Reload and log - verify no notifications
6. Re-enable at runtime - verify notifications resume

## Code Review Checklist
- [ ] No circular dependencies
- [ ] Proper error handling for notifier init
- [ ] Notifier lifecycle managed correctly
- [ ] Configuration changes handled properly
- [ ] Memory cleanup on destroy
- [ ] Follows existing integration patterns

## Notes
- The notifier uses a minimal logger to avoid circular dependency
- Notifier initialization failures should not break logging
- Consider adding metrics for notification display rate
- The integration should be transparent to existing logger users

## Related Tickets
- **Depends On**: ENHLOGVIS-001, ENHLOGVIS-002, ENHLOGVIS-005
- **Next**: ENHLOGVIS-007 (Implement notification UI)
- **Enables**: ENHLOGVIS-009 (Integration tests)