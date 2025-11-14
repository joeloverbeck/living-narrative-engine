# Living Narrative Engine - Logging System Exploration

## Executive Summary

The Living Narrative Engine has a **comprehensive, well-architected logging system** with sophisticated infrastructure for managing log levels, filtering, categorization, and multi-modal output (console, remote, production). The system is mature and includes advanced features like category detection, critical log notifications, and per-category log level control.

---

## 1. Logger Implementation

### Main Components

#### **ConsoleLogger** (`src/logging/consoleLogger.js`)
- **Purpose**: Core logger implementation that handles console output
- **Log Levels** (numerical):
  - `DEBUG: 0` (most verbose)
  - `INFO: 1` (default)
  - `WARN: 2`
  - `ERROR: 3`
  - `NONE: 4` (disables all logging)
- **Key Methods**:
  - `debug(message, ...args)` - Only logs if level <= DEBUG
  - `info(message, ...args)` - Only logs if level <= INFO
  - `warn(message, ...args)` - Only logs if level <= WARN
  - `error(message, ...args)` - Only logs if level <= ERROR
  - `setLogLevel(input)` - Changes log level at runtime
  - `groupCollapsed(label)` - Console grouping (DEBUG only)
  - `table(data, columns)` - Display tabular data (DEBUG only)

**Special Feature**: Debug-tagged message detection
- Messages with `[DEBUG]` prefix or pattern like `prefix: [DEBUG]` are routed through debug channel
- Can bypass normal log level restrictions for forced debug output

#### **LoggerStrategy** (`src/logging/loggerStrategy.js`)
- **Purpose**: High-level logger abstraction that handles mode switching and configuration
- **Logger Modes**:
  - `CONSOLE` - Basic console output
  - `PRODUCTION` - Remote logging with console fallback
  - `DEVELOPMENT` - Hybrid local + remote
  - `TEST` - No-op or mock logger
  - `NONE` - Complete logging disabled
- **Key Features**:
  - Runtime mode switching (e.g., `logger.setLogLevel('production')`)
  - Configuration management with defaults
  - Log buffering during mode transitions
  - Special commands: `status`, `reload`, `reset`, `flush`
  - Dependency injection of custom loggers (for testing)

#### **NoOpLogger** (`src/logging/noOpLogger.js`)
- **Purpose**: Null object pattern - implements ILogger but does nothing
- **Used**: In test mode or when logging is disabled
- **All methods** are no-ops that silently do nothing

### Dependency Injection

- **Token**: `tokens.ILogger`
- **Registered**: Via `infrastructureRegistrations.js`
- **Pattern**: Logger is injected as dependency throughout codebase
- **Bootstrap**: Early registration to support infrastructure initialization

---

## 2. Debug Call Patterns

### Frequency and Usage

**Very High Frequency of `.debug()` calls:**
- Pattern search for `\.debug\s*\(` returns 174K+ characters (too large to enumerate)
- Indicates debug logging is **heavily used throughout the codebase**
- Likely in hundreds or thousands of locations

### Common Call Patterns

1. **Initialization/Startup Logging**:
   ```javascript
   this.logger.debug(`[SystemName] Initialized with mode: ${mode}`);
   ```

2. **State Change Logging**:
   ```javascript
   this.logger.debug(`Changed from ${oldState} to ${newState}`);
   ```

3. **Component Registration**:
   ```javascript
   logger.debug(`Registered ${String(tokens.ServiceName)}.`);
   ```

4. **Data Processing**:
   ```javascript
   logger.debug('Filter criteria updated', criteria);
   ```

5. **Tagged Debug Messages**:
   ```javascript
   logger.info(`[DEBUG] Some explicit debug message`);
   ```

---

## 3. Configuration System

### Default Configuration Location
**File**: `src/logging/config/defaultConfig.js`

### Configuration Structure

```javascript
{
  enabled: boolean,
  mode: 'development' | 'production' | 'test' | 'hybrid' | 'none',
  fallbackToConsole: boolean,
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'NONE',
  
  // Per-category configuration
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
    entities: { enabled: true, level: 'info' },
    llm: { enabled: true, level: 'info' },
  },
  
  // Console output configuration
  console: {
    enabled: true,
    useColors: true,
    showTimestamp: false,
    showCategory: true,
    groupSimilar: true,
  },
  
  // Remote logging configuration
  remote: {
    endpoint: string,
    batchSize: number,
    flushInterval: number,
    retryAttempts: number,
    compression: { enabled, threshold, algorithm, level, maxPayloadSize },
    batching: { adaptive, minBatchSize, maxBatchSize, targetLatency, adjustmentFactor },
  },
  
  // Performance monitoring
  performance: {
    enableMetrics: boolean,
    metricsInterval: number,
    memoryWarningThreshold: number,
    slowLogThreshold: number,
  },
}
```

### Environment-Specific Presets

Four presets in `CONFIG_PRESETS`:
1. **Production**: ERROR/WARN only, remote logging, no console
2. **Development**: DEBUG level, hybrid mode, full console output
3. **Test**: Logging disabled, validation errors only
4. **Debugging**: Everything enabled, very low thresholds

### Environment Variable Mappings

Supports configuration override via environment variables (from `ENV_VAR_MAPPINGS`):
- `DEBUG_LOG_ENABLED`
- `DEBUG_LOG_MODE`
- `DEBUG_LOG_ENDPOINT`
- `DEBUG_LOG_LEVEL`
- `DEBUG_LOG_CONSOLE_ENABLED`
- `DEBUG_LOG_CONSOLE_COLORS`
- `DEBUG_LOG_CONSOLE_TIMESTAMP`
- `DEBUG_LOG_CONSOLE_CATEGORY`
- `DEBUG_LOG_PERFORMANCE_METRICS`
- `DEBUG_LOG_CRITICAL_SOUND_ENABLED`
- And 5+ more for remote and circuit breaker configuration

### Mode Detection Priority

1. **Explicit mode parameter** (highest priority)
2. **Environment variable** (`DEBUG_LOG_MODE`)
3. **Config file mode**
4. **NODE_ENV mapping** (test/production/development)
5. **Default** to CONSOLE mode

---

## 4. Related Systems

### A. Log Filtering System

**File**: `src/logging/logFilter.js`

**Class**: `LogFilter`

**Filtering Capabilities**:
- **By Level**: 'all', 'warn', 'error'
- **By Search Text**: Substring matching in message or category
- **By Category**: Specific category selection
- **By Time Range**: 'last5min', 'last15min', 'last30min', 'lasthour'

**Export Formats**:
- JSON export
- CSV export

**Statistics**:
- Total logs vs filtered
- Warning/error counts
- Per-category breakdown

### B. Log Category Detection System

**File**: `src/logging/logCategoryDetector.js`

**Class**: `LogCategoryDetector`

**Purpose**: Automatically categorizes log messages based on content

**Detection Priority**:
1. **Log Level** (error → 'error', warn → 'warning')
2. **Category Hint** (metadata-provided hint)
3. **Source-Based** (optional, for future enhancement)
4. **Pattern Matching** (fallback to regex patterns)

**Built-in Categories** (with priority ordering):
- Priority 95: `ecs` (EntityManager, ComponentManager, SystemManager)
- Priority 90: `engine`, `ai`, `anatomy`
- Priority 85: `persistence`, `actions`, `turns`, `events`, `validation`
- Priority 70: `ui`, `network`
- Priority 65: `configuration`, `initialization`
- Priority 60: `performance`

**Features**:
- **LRU Caching**: Hashed cache key strategy for memory efficiency
- **Pattern Registration**: Dynamic pattern addition via `addPattern(category, regex, priority)`
- **Cache Statistics**: Hit rate tracking and stats reporting
- **Batch Detection**: `detectCategories(messages, metadataArray)`

### C. Critical Log Notifier

**File**: `src/logging/criticalLogNotifier.js`

**Purpose**: Provides special handling for critical (warn/error) logs

**Features**:
- Visual notifications for critical logs
- Sound notifications (configurable)
- Auto-dismiss after configurable time
- Buffer management with size limits
- Integration with event bus for critical events

### D. Bootstrap Logger

**File**: `src/logging/bootstrapLogger.js`

**Purpose**: Early logging during application startup before full DI container is ready

**Exports**:
- `createBootstrapLogger()` - Creates logger without full dependencies
- `resolveBootstrapLogLevel()` - Determines log level during bootstrap
- Safe environment variable access functions

### E. Structured Logging Infrastructure

**LoggerStrategy** supports configuration objects:
```javascript
logger.setLogLevel({
  mode: 'development',
  categories: {
    ai: { level: 'debug' },
    persistence: { level: 'error' },
  },
  logLevel: 'INFO',
  remote: {
    batchSize: 100,
    flushInterval: 1000,
  },
});
```

---

## 5. Granular Control Mechanisms

### A. Per-Category Log Levels

Each category can have independent configuration:
- `categories.ai.enabled: true/false`
- `categories.ai.level: 'debug' | 'info' | 'warn' | 'error'`

### B. Conditional Logging Patterns

Current practice in codebase:
```javascript
if (this.logger) {
  this.logger.debug(message); // Respects current log level
}
```

### C. Category Hints in Logging

Can provide metadata:
```javascript
logger.detectCategory(message, {
  level: 'error',
  categoryHint: 'ai',  // Forces category detection
  sourceCategory: 'llm', // For source-based categorization
});
```

### D. SafeErrorLogger

**File**: `src/logging/safeErrorLogger.js` (implied from LoggerStrategy references)

**Purpose**: Wraps loggers to prevent recursion during error handling
- Prevents infinite loops when logging errors about logging

---

## 6. Advanced Features

### A. Log Exporter

**File**: `src/logging/logExporter.js`

**Purpose**: Export logs in multiple formats
- JSON format
- CSV format
- Batch export capabilities

### B. Keyboard Shortcuts Manager

**File**: `src/logging/keyboardShortcutsManager.js`

**Purpose**: Runtime log control via keyboard shortcuts
- Likely supports: mode switching, level changes, filtering

### C. Drag Handler & Critical UI Components

**Files**: 
- `src/logging/dragHandler.js`
- Related UI components for log visualization

**Purpose**: Interactive logging UI for development/debugging

### D. Configuration Validation

**Files**:
- `src/logging/config/configValidator.js`
- `src/logging/config/configMerger.js`

**Purpose**: Validates and merges configurations safely

---

## 7. Integration Points

### Dependency Injection
- Token: `tokens.ILogger`
- Registered early in infrastructure bootstrap
- Available to all services that need it

### Event Bus Integration
- Logger can dispatch events via event bus
- `LOGGER_CREATION_FAILED` event on logger errors
- `logger.mode.changed` event on mode transitions

### Configuration Management
- Loads from `endpointConfig.js` for remote endpoints
- Supports environment variable overrides
- Merge strategy for config objects

### Error Handling
- `SafeErrorLogger` wrapper prevents recursion
- Fallback to console if logger creation fails
- Graceful degradation to `NoOpLogger`

---

## Key Observations

### Strengths
1. **Comprehensive**: Covers debug levels, categories, remote logging, filtering, export
2. **Flexible**: Per-category control, environment-based presets, runtime switching
3. **Robust**: Fallback mechanisms, safe error handling, buffer management
4. **Extensible**: Support for custom patterns, category hints, dynamic configuration
5. **Memory-Efficient**: LRU caching with hash-based keys in category detector

### Current State
- Very mature logging infrastructure
- Heavy use of debug logging throughout codebase (hundreds/thousands of calls)
- Sophisticated category detection system
- Advanced features like critical notifications, remote logging, buffering

### Configuration Granularity
- **Global log level** via `logLevel`
- **Per-category levels** via `categories.{category}.level`
- **Per-category enabling** via `categories.{category}.enabled`
- **Mode-based presets** for different environments
- **Environment variable overrides** for deployment configuration

---

## Next Steps for Optimization

Based on this exploration, potential improvements could include:
1. **Category-aware filtering**: Leverage existing detector for runtime filtering
2. **Debug performance analysis**: Measure impact of high-frequency debug calls
3. **Conditional debug calls**: Implement pattern for checking level before expensive operations
4. **Documentation**: Update CLAUDE.md with logging architecture overview
5. **Testing**: Ensure debug filtering doesn't break test scenarios
