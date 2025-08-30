# Enhanced Logging Visibility Specification

## Overview

This specification defines the requirements and implementation guidelines for enhancing the visibility of warnings and errors in the Living Narrative Engine's logging system. The current issue is that when remote logging is enabled (`debug-logging-config.json` with `enabled: true`), warnings and errors are sent to the remote server but disappear from the browser's developer console, making it difficult for developers to immediately notice critical issues.

## Problem Statement

### Current Behavior

- When remote logging is enabled, logs are sent to the Node.js API server for storage
- The HybridLogger's default console filters restrict output to specific categories and levels
- Warnings and errors get lost in the remote logging process
- Developers lose immediate visual feedback in the browser's developer console
- No conspicuous indication when warnings or errors occur

### Impact

- Delayed bug detection during development
- Missed critical errors that could affect gameplay
- Reduced developer productivity due to lack of immediate feedback
- Potential for issues to reach production unnoticed

## Requirements

### Functional Requirements

#### FR1: Always Show Critical Logs in Console

- **FR1.1**: Warnings and errors MUST always appear in the browser console when they occur
- **FR1.2**: Console output for critical logs MUST bypass any filter configurations
- **FR1.3**: Critical console logs MUST maintain their native console styling (yellow for warnings, red for errors)
- **FR1.4**: This behavior MUST be configurable but default to enabled

#### FR2: Visual Notification System

- **FR2.1**: A floating notification badge MUST appear when warnings or errors occur
- **FR2.2**: The badge MUST show separate counts for warnings (yellow) and errors (red)
- **FR2.3**: The badge MUST be clickable to expand into a panel showing recent critical logs
- **FR2.4**: The notification MUST persist until explicitly dismissed by the developer
- **FR2.5**: The notification system MUST be toggleable via configuration

#### FR3: Critical Log Buffer

- **FR3.1**: The system MUST maintain a buffer of the last N critical logs in memory
- **FR3.2**: The buffer size MUST be configurable (default: 50 logs)
- **FR3.3**: Each buffered log MUST include: timestamp, level, message, source location, and category
- **FR3.4**: The buffer MUST be accessible to the visual notification system

#### FR4: Configuration Options

- **FR4.1**: New configuration options MUST be added to `debug-logging-config.json`
- **FR4.2**: All new options MUST have sensible defaults that work out-of-the-box
- **FR4.3**: Configuration changes MUST take effect without requiring application restart

### Non-Functional Requirements

#### NFR1: Performance

- **NFR1.1**: The visibility enhancements MUST NOT degrade logging performance by more than 5%
- **NFR1.2**: The critical log buffer MUST use minimal memory (max 10KB for 50 logs)
- **NFR1.3**: Visual notifications MUST render within 100ms of log occurrence

#### NFR2: User Experience

- **NFR2.1**: Visual notifications MUST NOT obstruct gameplay or UI elements
- **NFR2.2**: The notification badge MUST be draggable to reposition if needed
- **NFR2.3**: Console output MUST remain readable and not clutter the console

#### NFR3: Compatibility

- **NFR3.1**: The solution MUST work with all existing logging configurations
- **NFR3.2**: The solution MUST be backward compatible with current logging API
- **NFR3.3**: The solution MUST work in all supported browsers (Chrome, Firefox, Safari, Edge)

## Technical Design

**Note on Existing Architecture**: The HybridLogger already contains a sophisticated filter system with `#filters` private field and methods for managing console and remote filters (`setConsoleFilter()`, `setRemoteFilter()`, `updateFilters()`). Our enhancement will work within this existing architecture rather than bypassing it.

### Architecture Overview

```
┌─────────────────────────────────────────────┐
│           Application Code                   │
└─────────────────┬───────────────────────────┘
                  │ log.warn() / log.error()
                  ▼
┌─────────────────────────────────────────────┐
│           HybridLogger                       │
│  ┌─────────────────────────────────────┐    │
│  │   Existing Filter System (#filters)  │    │
│  │   - setConsoleFilter()              │    │
│  │   - setRemoteFilter()               │    │
│  │   - updateFilters()                 │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │   Enhanced #shouldLogToConsole()    │    │
│  │   - Check critical log override     │    │
│  │   - Apply existing filters for      │    │
│  │     non-critical logs               │    │
│  │   - Add to critical buffer          │    │
│  └─────────────────────────────────────┘    │
│                  │                           │
│     ┌────────────┴────────────┐             │
│     ▼                          ▼             │
│  ConsoleLogger            RemoteLogger       │
│  (#logToDestinations handles routing)        │
└─────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│      Critical Log Notifier (UI)             │
│  - Floating badge with counts               │
│  - Expandable log panel                     │
│  - Dismissal controls                       │
└─────────────────────────────────────────────┘
```

### Component Specifications

#### 1. HybridLogger Enhancements

**File**: `src/logging/hybridLogger.js`

**Existing Architecture Context**:

- HybridLogger already has a `#filters` private field containing console and remote filter configurations
- Existing methods: `setConsoleFilter()`, `setRemoteFilter()`, `updateFilters()`
- The `#logToDestinations()` method handles routing to ConsoleLogger and RemoteLogger
- The `#shouldLogToConsole()` method determines if a log should go to console based on filters

**Modifications**:

- Add `#criticalBuffer` array to store recent warnings/errors
- Add `#notifier` reference to CriticalLogNotifier instance
- **Enhance `#shouldLogToConsole()` method** to:
  1. Check if log level is 'warn' or 'error' AND critical logging is enabled
  2. If yes, return true regardless of existing filters
  3. Otherwise, apply existing filter logic
- Modify `warn()` and `error()` methods to:
  1. Add to critical buffer
  2. Notify the visual notification system
  3. Let enhanced `#shouldLogToConsole()` handle console output decision
- Add `getCriticalLogs()` method to retrieve buffered logs
- Add `clearCriticalBuffer()` method to clear the buffer

**New Configuration Interface**:

```javascript
{
  criticalLogging: {
    alwaysShowInConsole: true,      // Force warn/error to console
    enableVisualNotifications: true, // Show floating badges
    bufferSize: 50,                 // Number of critical logs to retain
    notificationPosition: 'top-right', // Badge position
    autoDismissAfter: null          // Auto-dismiss timeout (null = manual only)
  }
}
```

#### 2. Critical Log Notifier Component

**File**: `src/logging/criticalLogNotifier.js`

**Responsibilities**:

- Render floating badge with warning/error counts
- Manage expandable panel for log details
- Handle user interactions (expand/collapse/dismiss)
- Persist position preferences in localStorage
- Provide API for HybridLogger integration

**Key Methods**:

```javascript
class CriticalLogNotifier {
  constructor(config) // Initialize with configuration
  notifyWarning(logEntry) // Add warning to display
  notifyError(logEntry) // Add error to display
  render() // Create/update DOM elements
  dismiss() // Clear notifications
  destroy() // Clean up DOM and listeners
}
```

**DOM Structure**:

```html
<div class="lne-critical-log-notifier" data-position="top-right">
  <div class="lne-badge-container">
    <span class="lne-error-badge">3</span>
    <span class="lne-warning-badge">5</span>
  </div>
  <div class="lne-log-panel" hidden>
    <div class="lne-log-header">
      <span>Recent Critical Logs</span>
      <button class="lne-clear-btn">Clear</button>
      <button class="lne-close-btn">×</button>
    </div>
    <div class="lne-log-list">
      <!-- Log entries -->
    </div>
  </div>
</div>
```

#### 3. Configuration Schema Updates

**File**: `data/schemas/debug-logging-config.schema.json`

Add new properties to the schema:

```json
{
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
        "description": "Position of the notification badge"
      },
      "autoDismissAfter": {
        "type": ["integer", "null"],
        "minimum": 1000,
        "default": null,
        "description": "Auto-dismiss notifications after milliseconds (null for manual only)"
      }
    }
  }
}
```

### Implementation Plan

#### Phase 1: Core Functionality (Priority: High)

1. Modify HybridLogger to always output warnings/errors to console
2. Implement critical log buffer in HybridLogger
3. Update configuration schema and defaults
4. Write unit tests for bypass logic

#### Phase 2: Visual Notifications (Priority: High)

1. Create CriticalLogNotifier class
2. Integrate notifier with HybridLogger
3. Implement basic badge and panel UI
4. Add CSS styling for notifications
5. Write integration tests

#### Phase 3: Enhanced Features (Priority: Medium)

1. Add drag-to-reposition functionality
2. Implement localStorage persistence for position
3. Add keyboard shortcuts for quick dismissal
4. Implement log filtering in panel
5. Add export functionality for critical logs

#### Phase 4: Polish and Optimization (Priority: Low)

1. Add animations for badge appearance
2. Implement smart positioning to avoid UI conflicts
3. Add sound notifications (optional, configurable)
4. Optimize memory usage for large buffers
5. Add telemetry for critical log patterns

## Testing Strategy

### Unit Tests

- Test HybridLogger bypass logic for critical logs
- Test critical buffer management (add, retrieve, clear)
- Test configuration loading and validation
- Test CriticalLogNotifier methods in isolation

### Integration Tests

- Test end-to-end flow from log call to console output
- Test visual notification triggering
- Test configuration changes taking effect
- Test interaction between HybridLogger and CriticalLogNotifier

### Manual Testing Checklist

- [ ] Warnings appear in console when remote logging is enabled
- [ ] Errors appear in console when remote logging is enabled
- [ ] Notification badge appears for warnings
- [ ] Notification badge appears for errors
- [ ] Badge shows correct counts
- [ ] Panel expands on click
- [ ] Logs display correctly in panel
- [ ] Clear button works
- [ ] Dismiss button works
- [ ] Position persists across sessions
- [ ] Configuration options work as expected

## Migration Guide

### For Existing Users

1. Update to the latest version
2. No configuration changes required (defaults will work)
3. Optional: Customize settings in `debug-logging-config.json`
4. Note: The system uses two configuration files:
   - `config/debug-logging-config.json` - For debug logging settings including the new critical logging options
   - `config/logger-config.json` - For general logger configuration loaded by LoggerConfigLoader

### For Developers

1. No API changes required
2. Existing logging code continues to work
3. New features are automatically available
4. Can optionally use new methods like `getCriticalLogs()`

## Security Considerations

- Critical log buffer must not expose sensitive data in DOM
- Notification system must sanitize log messages to prevent XSS
- Configuration must validate position values to prevent injection
- Buffer size limits prevent memory exhaustion attacks

## Performance Metrics

### Success Criteria

- Console output latency: < 10ms additional overhead
- Notification render time: < 100ms from log occurrence
- Memory usage: < 10KB for 50 log entries
- CPU usage: < 1% additional during active logging

### Monitoring

- Track notification render performance
- Monitor critical buffer memory usage
- Log any performance degradation warnings
- Collect metrics on critical log frequency

## Rollback Plan

If issues arise:

1. Set `criticalLogging.alwaysShowInConsole` to `false`
2. Set `criticalLogging.enableVisualNotifications` to `false`
3. System reverts to original behavior
4. No data loss or corruption risk

## Future Enhancements

### Potential Features (Not in Current Scope)

- Integration with browser DevTools API
- Remote notification to other developers
- Critical log analytics dashboard
- AI-powered error pattern detection
- Integration with error tracking services (Sentry, Rollbar)
- Custom notification themes
- Log grouping by error type
- Stack trace expansion in panel

## Acceptance Criteria

The implementation is complete when:

1. All functional requirements are met
2. All non-functional requirements are satisfied
3. All tests pass with >80% coverage
4. Documentation is updated
5. Migration guide is tested
6. Performance metrics meet targets
7. Security review is completed
8. Rollback plan is verified

## References

- [Original Issue Discussion](#problem-statement)
- [HybridLogger Documentation](../src/logging/hybridLogger.js)
- [Debug Logging Configuration](../config/debug-logging-config.json)
- [Logger Configuration](../config/logger-config.json)
- [ConsoleLogger Implementation](../src/logging/consoleLogger.js)
- [RemoteLogger Implementation](../src/logging/remoteLogger.js)
- [LoggerConfigLoader](../src/logging/config/loggerConfigLoader.js)

---

**Document Version**: 1.1.0  
**Last Updated**: 2024  
**Status**: Ready for Implementation  
**Changes in v1.1.0**: Corrected assumptions about HybridLogger's existing filter architecture and dual configuration system  
**Author**: Claude (AI Assistant)  
**Reviewer**: Pending
