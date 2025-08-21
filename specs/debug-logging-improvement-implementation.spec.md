# Debug Logging Improvement Implementation Specification

**Version**: 1.0.0  
**Date**: December 2024  
**Status**: Draft  
**Authors**: System Architecture Team

## 1. Executive Summary

### 1.1 Problem Statement

The Living Narrative Engine currently has **2,054 debug log calls** across 404 files that, when all enabled, can generate approximately **13,000 debug log entries** on startup (due to loops and repeated calls during initialization). This volume makes browser console debugging impractical, causes browser freezes, memory exhaustion, and makes finding relevant logs nearly impossible.

### 1.2 Solution Overview

Implement a **Remote Debug Logging Service** integrated with the existing llm-proxy-server that:

- Moves debug logs from browser console to server-side storage
- Provides intelligent categorization and filtering
- Maintains 100% backward compatibility with existing tests
- Reduces browser memory usage by >95%

### 1.3 Key Benefits

- **Performance**: Eliminate browser console overload
- **Searchability**: Server-side search in <100ms
- **Persistence**: Logs survive page refreshes
- **Categorization**: Filter by component/domain
- **Test Compatibility**: Zero impact on existing tests

## 2. System Architecture

### 2.1 Component Overview

```
┌─────────────────────────┐      ┌──────────────────────┐     ┌──────────────────┐
│   Game Engine (Browser) │      │  Debug Log Service   │     │   File System    │
│                         │      │  (llm-proxy-server)  │     │                  │
│ ┌─────────────────────┐ │      │                      │     │ /logs/           │
│ │ LoggerStrategy      │─┼──────┼─► /api/debug-log    │     │   /2024-12-20/   │
│ │ ├─RemoteLogger     │ │ HTTP │                      │     │     /engine/     │
│ │ ├─ConsoleLogger    │ │      │   ┌──────────────┐   │     │     /ui/         │
│ │ └─HybridLogger     │ │      │   │ LogRouter    │───┼─────┼─►   /ecs/        │
│ └─────────────────────┘ │      │   └──────────────┘   │     │     /ai/         │
│                         │      │                      │     │     /...         │
│ ┌─────────────────────┐ │      │   ┌──────────────┐   │     │                  │
│ │ MockLogger (Tests)  │ │      │   │ LogStorage   │   │     │ /2024-12-21/     │
│ └─────────────────────┘ │      │   └──────────────┘   │     │   /...           │
└─────────────────────────┘      │                      │     └──────────────────┘
                                  │   ┌──────────────┐   │
                                  │   │ LogFilter    │   │
                                  │   └──────────────┘   │
                                  └──────────────────────┘
```

### 2.2 Data Flow

1. **Log Generation**: Components call `logger.debug(message, metadata)`
2. **Strategy Selection**: LoggerStrategy selects appropriate logger based on mode
3. **Batching**: RemoteLogger buffers logs (default: 100 entries or 1000ms)
4. **Transmission**: Batch sent to llm-proxy-server via HTTP POST
5. **Categorization**: Server categorizes logs by pattern matching
6. **Storage**: Logs written to date/category-based JSONL files
7. **Cleanup**: Automatic removal of logs older than retention period

### 2.3 Component Responsibilities

| Component          | Responsibility                    | Location                                            |
| ------------------ | --------------------------------- | --------------------------------------------------- |
| LoggerStrategy     | Mode-based logger selection       | src/logging/loggerStrategy.js                       |
| RemoteLogger       | Batching, transmission, fallback  | src/logging/remoteLogger.js                         |
| ConsoleLogger      | Browser console output (existing) | src/logging/consoleLogger.js                        |
| HybridLogger       | Dual console + remote logging     | src/logging/hybridLogger.js                         |
| MockLogger         | Test isolation                    | tests/common/mockFactories/loggerMocks.js           |
| DebugLogController | HTTP endpoint handler             | llm-proxy-server/src/handlers/debugLogController.js |
| LogStorageService  | File persistence, cleanup         | llm-proxy-server/src/services/logStorageService.js  |

## 3. Implementation Requirements

### 3.1 Logger Strategy Pattern

#### 3.1.1 Class Structure

```javascript
class LoggerStrategy {
  constructor({ mode, config, dependencies })

  // Core Logging Methods (ILogger interface)
  debug(message, metadata)
  info(message, metadata)
  warn(message, metadata)
  error(message, metadata)

  // Extended Console Methods (ConsoleLogger compatibility)
  groupCollapsed(label)
  groupEnd()
  table(data, columns)
  setLogLevel(logLevelInput)  // Critical for runtime configuration

  // Private Methods
  #createLogger(mode, config, dependencies)
  #validateConfig(config)
}
```

#### 3.1.2 Mode Selection Logic

| Mode        | Logger Type   | Use Case               |
| ----------- | ------------- | ---------------------- |
| production  | RemoteLogger  | Production deployments |
| development | HybridLogger  | Local development      |
| test        | MockLogger    | Unit/integration tests |
| console     | ConsoleLogger | Legacy/fallback        |

#### 3.1.3 Configuration Requirements

- Must load from `config/debug-logging-config.json`
- Must support runtime mode switching via `setLogLevel()` method
- Must validate configuration on initialization
- Must provide sensible defaults
- Must integrate with existing DI container via `tokens.ILogger`
- Must support async configuration loading via `loadAndApplyLoggerConfig` utility
- Must maintain compatibility with LogLevel enum from `consoleLogger.js`
- Must work within existing `containerConfig.js` initialization flow

### 3.2 RemoteLogger Implementation

#### 3.2.1 Core Features

- **Batching**: Configurable batch size (default: 100)
- **Buffering**: Time-based flush (default: 1000ms)
- **Categorization**: Automatic pattern-based categorization
- **Fallback**: Console logging on network failure
- **Retry**: Exponential backoff with jitter
- **Circuit Breaker**: Prevent cascade failures

#### 3.2.2 Category Detection Rules

```javascript
const CATEGORY_PATTERNS = {
  engine: /GameEngine|engineState|gameSession/i,
  ui: /UI|Renderer|domUI|display/i,
  ecs: /Entity|Component|System|entityManager/i,
  ai: /AI|LLM|notes|thoughts|memory/i,
  persistence: /Save|Load|persist|storage/i,
  anatomy: /anatomy|body|part|descriptor/i,
  actions: /action|target|resolution/i,
  turns: /turn|round|cycle/i,
  events: /event|dispatch|listener/i,
  validation: /validate|schema|ajv/i,
  general: // default fallback
};
```

#### 3.2.3 Metadata Enrichment

Each log entry must include:

- `timestamp`: ISO 8601 format
- `level`: debug|info|warn|error
- `category`: Detected category
- `source`: File:line if available
- `sessionId`: Unique session identifier
- `metadata`: User-provided context

### 3.3 Server-Side Debug Log Service

**Note**: The llm-proxy-server already has a similar pattern implemented for trace files at `/api/traces/write`. The debug log service should follow this established pattern for consistency.

#### 3.3.1 Endpoint Specification

```yaml
endpoint: POST /api/debug-log
content-type: application/json
authentication: optional (configurable)
rate-limit: 1000 req/min per IP
```

#### 3.3.2 Request Schema

```json
{
  "type": "object",
  "properties": {
    "logs": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "level": { "enum": ["debug", "info", "warn", "error"] },
          "message": { "type": "string" },
          "category": { "type": "string" },
          "timestamp": { "type": "string", "format": "date-time" },
          "source": { "type": "string" },
          "sessionId": { "type": "string" },
          "metadata": { "type": "object" }
        },
        "required": ["level", "message", "timestamp"]
      },
      "maxItems": 1000
    }
  },
  "required": ["logs"]
}
```

#### 3.3.3 Response Schema

```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "processed": { "type": "integer" },
    "errors": {
      "type": "array",
      "items": { "type": "string" }
    }
  },
  "required": ["success", "processed"]
}
```

### 3.4 Log Storage Service

#### 3.4.1 File Structure (Following Existing Trace Pattern)

```
logs/
├── 2024-12-20/
│   ├── engine.jsonl        # GameEngine logs
│   ├── ui.jsonl            # UI/Renderer logs
│   ├── ecs.jsonl           # Entity/Component logs
│   ├── ai.jsonl            # AI/LLM logs
│   ├── persistence.jsonl   # Save/Load logs
│   ├── anatomy.jsonl       # Anatomy system logs
│   ├── actions.jsonl       # Action system logs
│   ├── turns.jsonl         # Turn management logs
│   ├── events.jsonl        # Event system logs
│   ├── validation.jsonl    # Schema validation logs
│   └── general.jsonl       # Uncategorized
└── 2024-12-21/
    └── ...
```

#### 3.4.2 JSONL Format

```jsonl
{"level":"debug","message":"GameEngine: Constructor called","category":"engine","timestamp":"2024-12-20T10:15:30.123Z","source":"gameEngine.js:45","sessionId":"uuid-v4","metadata":{}}
{"level":"debug","message":"EntityManager: Creating entity actor_1234","category":"ecs","timestamp":"2024-12-20T10:15:30.125Z","source":"entityManager.js:123","sessionId":"uuid-v4","metadata":{"entityId":"actor_1234"}}
```

#### 3.4.3 Storage Management

- **Retention**: Configurable (default: 7 days)
- **Max File Size**: 10MB per file (rotate if exceeded)
- **Compression**: Optional gzip for archived logs
- **Cleanup**: Daily at 02:00 local time

### 3.5 Configuration System

#### 3.5.1 Configuration Schema

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
        "circuitBreakerThreshold": { "type": "integer" }
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
    },
    "storage": {
      "type": "object",
      "properties": {
        "path": { "type": "string" },
        "retentionDays": { "type": "integer", "minimum": 1, "maximum": 365 },
        "maxFileSize": { "type": "string", "pattern": "^\\d+[KMG]B$" }
      }
    }
  },
  "required": ["enabled", "mode"]
}
```

#### 3.5.2 Default Configuration

```json
{
  "enabled": true,
  "mode": "development",
  "remote": {
    "endpoint": "http://localhost:3001/api/debug-log",
    "batchSize": 100,
    "flushInterval": 1000,
    "retryAttempts": 3,
    "circuitBreakerThreshold": 5
  },
  "categories": {
    "engine": { "enabled": true, "level": "debug" },
    "ui": { "enabled": true, "level": "info" },
    "ecs": { "enabled": true, "level": "debug" },
    "ai": { "enabled": true, "level": "debug" },
    "persistence": { "enabled": false, "level": "warn" }
  },
  "storage": {
    "path": "./logs",
    "retentionDays": 7,
    "maxFileSize": "10MB"
  }
}
```

## 4. API Contracts

### 4.1 Debug Log Submission API

#### Endpoint: `POST /api/debug-log`

**Request Headers:**

```http
Content-Type: application/json
X-Session-ID: <uuid>
X-Client-Version: <version>
```

**Request Body:**

```json
{
  "logs": [
    {
      "level": "debug",
      "message": "Component initialized",
      "category": "engine",
      "timestamp": "2024-12-20T10:15:30.123Z",
      "source": "component.js:45",
      "sessionId": "550e8400-e29b-41d4-a716-446655440000",
      "metadata": {
        "componentId": "core:actor",
        "duration": 125
      }
    }
  ]
}
```

**Success Response (200):**

```json
{
  "success": true,
  "processed": 100,
  "timestamp": "2024-12-20T10:15:31.000Z"
}
```

**Error Response (400):**

```json
{
  "success": false,
  "processed": 0,
  "errors": [
    "Invalid log format at index 5",
    "Missing required field 'timestamp' at index 12"
  ]
}
```

**Error Response (503):**

```json
{
  "success": false,
  "message": "Service temporarily unavailable",
  "retryAfter": 60
}
```

### 4.2 Log Query API (Future Enhancement)

#### Endpoint: `GET /api/debug-log/query`

**Query Parameters:**

- `date`: YYYY-MM-DD format
- `category`: Category name
- `level`: Log level filter
- `search`: Text search
- `limit`: Max results (default: 1000)
- `offset`: Pagination offset

**Response:**

```json
{
  "logs": [...],
  "total": 5432,
  "hasMore": true
}
```

## 5. Test Compatibility

### 5.1 Mock Logger Requirements

#### 5.1.1 Interface Compatibility

The MockLogger must implement the complete ConsoleLogger interface including extended methods:

```javascript
class MockLogger {
  // Core ILogger methods
  debug(message, metadata) {}
  info(message, metadata) {}
  warn(message, metadata) {}
  error(message, metadata) {}

  // Extended ConsoleLogger methods
  groupCollapsed(label) {}
  groupEnd() {}
  table(data, columns) {}
  setLogLevel(logLevelInput) {}
}
```

#### 5.1.2 Test Helper Extensions

```javascript
// Maintain existing pattern with complete interface
export const createMockLogger = () =>
  createSimpleMock([
    'info',
    'warn',
    'error',
    'debug',
    'groupCollapsed',
    'groupEnd',
    'table',
    'setLogLevel',
  ]);

// Add enhanced version with helpers
export const createEnhancedMockLogger = () => {
  const logger = createMockLogger();

  // Test utilities
  logger.getDebugCalls = () => logger.debug.mock.calls;
  logger.getCallsByLevel = (level) => logger[level].mock.calls;
  logger.clearAllCalls = () => {
    ['debug', 'info', 'warn', 'error'].forEach((level) =>
      logger[level].mockClear()
    );
  };

  // Assertion helpers
  logger.expectDebugMessage = (message) => {
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(message),
      expect.anything()
    );
  };

  logger.expectNoDebugCalls = () => {
    expect(logger.debug).not.toHaveBeenCalled();
  };

  return logger;
};
```

### 5.2 Test Configuration

#### 5.2.1 Test Mode Configuration

```json
{
  "enabled": true,
  "mode": "test",
  "mock": {
    "captureAll": true,
    "silent": true,
    "validateCalls": true
  }
}
```

#### 5.2.2 Test Setup Pattern

```javascript
// In test setup files
beforeEach(() => {
  process.env.DEBUG_LOG_MODE = 'test';
});

afterEach(() => {
  delete process.env.DEBUG_LOG_MODE;
});
```

## 6. Migration Strategy

### 6.1 Phase 1: Infrastructure (Week 1)

#### Tasks:

1. **Server-Side Service**
   - [ ] Create `/api/debug-log` endpoint
   - [ ] Implement LogStorageService
   - [ ] Add configuration loading
   - [ ] Setup file rotation and cleanup

2. **Client-Side Logger**
   - [ ] Create LoggerStrategy class
   - [ ] Implement RemoteLogger with batching
   - [ ] Add fallback mechanisms
   - [ ] Create category detection

3. **Configuration**
   - [ ] Create configuration schema
   - [ ] Add default configurations
   - [ ] Implement validation

### 6.2 Phase 2: Integration (Week 2)

#### Tasks:

1. **Logger DI Registration Update**
   - [ ] Modify containerConfig.js to use LoggerStrategy
   - [ ] Update minimalContainerConfig.js similarly
   - [ ] Integrate with existing tokens.ILogger registration
   - [ ] Update loadAndApplyLoggerConfig utility
   - [ ] Maintain backward compatibility with all consumers

2. **Hybrid Logger**
   - [ ] Create HybridLogger class
   - [ ] Add development features
   - [ ] Implement filtering

3. **Test Infrastructure**
   - [ ] Update mock factories
   - [ ] Ensure all tests pass
   - [ ] Add new test helpers

### 6.3 Phase 3: Rollout (Week 3)

#### Rollout Strategy:

1. **Alpha Testing**
   - Deploy to development environment
   - Monitor performance metrics
   - Gather developer feedback

2. **Beta Testing**
   - Enable for 10% of sessions
   - Monitor error rates
   - Validate log completeness

3. **General Availability**
   - Enable for all users
   - Maintain console fallback
   - Document configuration

### 6.4 Phase 4: Optimization (Week 4)

#### Optimization Tasks:

1. **Performance Tuning**
   - [ ] Optimize batch sizes based on metrics
   - [ ] Implement compression
   - [ ] Add caching layer

2. **Developer Tools**
   - [ ] Create log viewer UI
   - [ ] Add search capabilities
   - [ ] Implement real-time streaming

## 7. Performance Requirements

### 7.1 Client-Side Performance

| Metric          | Current         | Target | Measurement       |
| --------------- | --------------- | ------ | ----------------- |
| Browser Memory  | ~50MB           | <1MB   | Chrome DevTools   |
| Console Entries | 13,000+         | <100   | console.log count |
| Search Time     | 5-10s (freezes) | N/A    | Not applicable    |
| Startup Impact  | +500ms          | <50ms  | Performance.now() |

### 7.2 Server-Side Performance

| Metric          | Target       | Measurement         |
| --------------- | ------------ | ------------------- |
| Request Latency | <100ms p99   | Server metrics      |
| Throughput      | 1000 req/min | Load testing        |
| Storage Write   | <10ms        | File system metrics |
| Query Response  | <100ms       | API monitoring      |

### 7.3 Network Performance

| Metric          | Target        | Measurement      |
| --------------- | ------------- | ---------------- |
| Batch Size      | 5-10KB        | Request size     |
| Compression     | 70% reduction | Gzip ratio       |
| Retry Success   | >95%          | Success metrics  |
| Circuit Breaker | <1% trips     | Error monitoring |

## 8. Security Considerations

### 8.1 Data Protection

#### 8.1.1 Sensitive Data Filtering

```javascript
const SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /password/i,
  /token/i,
  /secret/i,
  /credential/i,
];

function sanitizeLog(message) {
  // Redact sensitive patterns
  return message.replace(SENSITIVE_PATTERNS, '[REDACTED]');
}
```

#### 8.1.2 Access Control

- Logs stored locally only (default)
- Optional authentication for remote access
- IP-based rate limiting
- CORS configuration for API endpoints

### 8.2 Privacy Compliance

- No PII in log messages
- Session IDs are anonymous UUIDs
- Automatic log expiration
- No third-party data sharing

## 9. Monitoring & Observability

### 9.1 Metrics to Track

#### Client Metrics:

- Log generation rate
- Batch transmission success rate
- Fallback activation frequency
- Network error rate

#### Server Metrics:

- Request processing time
- Storage write latency
- File rotation frequency
- Disk usage trends

### 9.2 Alerts

| Alert                   | Condition             | Action               |
| ----------------------- | --------------------- | -------------------- |
| High Error Rate         | >5% failed batches    | Check network/server |
| Storage Full            | >80% disk usage       | Trigger cleanup      |
| Circuit Open            | Circuit breaker trips | Investigate server   |
| Performance Degradation | p99 >200ms            | Scale/optimize       |

## 10. Rollback Plan

### 10.1 Rollback Triggers

1. **Performance Regression**: >10% increase in startup time
2. **Error Rate**: >5% log transmission failures
3. **Test Failures**: Any test regression
4. **User Impact**: Browser freezes or crashes

### 10.2 Rollback Procedure

1. **Immediate**: Set `mode: "console"` in config
2. **Gradual**: Reduce rollout percentage
3. **Full**: Revert code changes via git
4. **Verification**: Confirm normal operation

### 10.3 Rollback Testing

Before deployment:

1. Test mode switching at runtime
2. Verify fallback mechanisms
3. Confirm test compatibility
4. Validate performance baselines

## 11. Success Criteria

### 11.1 Functional Requirements

- [ ] All 2,054 debug calls work unchanged
- [ ] All tests pass without modification
- [ ] Logs are categorized correctly
- [ ] Search completes in <100ms

### 11.2 Performance Requirements

- [ ] Browser memory reduced by >95%
- [ ] No console freezing
- [ ] Startup time impact <50ms
- [ ] Log transmission success >95%

### 11.3 Quality Requirements

- [ ] 100% backward compatibility
- [ ] Zero test regressions
- [ ] Full documentation
- [ ] Configuration validation

## 12. Documentation Requirements

### 12.1 Developer Documentation

- Architecture overview
- Configuration guide
- Debugging guide
- API reference

### 12.2 Operations Documentation

- Deployment procedures
- Monitoring setup
- Troubleshooting guide
- Rollback procedures

### 12.3 User Documentation

- Feature overview
- Configuration options
- Common use cases
- FAQ

## 13. Future Enhancements

### 13.1 Short-Term (3-6 months)

- Log viewer UI
- Advanced search capabilities
- Real-time log streaming
- Performance profiling integration

### 13.2 Long-Term (6-12 months)

- Distributed tracing
- Log analytics dashboard
- Machine learning insights
- Cross-service correlation

## Appendix A: File Mappings

| Current File                                      | New/Modified File                                   | Change Type                     |
| ------------------------------------------------- | --------------------------------------------------- | ------------------------------- |
| src/logging/consoleLogger.js                      | (unchanged)                                         | None                            |
| -                                                 | src/logging/loggerStrategy.js                       | New                             |
| -                                                 | src/logging/remoteLogger.js                         | New                             |
| -                                                 | src/logging/hybridLogger.js                         | New                             |
| src/dependencyInjection/containerConfig.js        | (modified)                                          | Update DI registration          |
| src/dependencyInjection/minimalContainerConfig.js | (modified)                                          | Update DI registration          |
| src/configuration/utils/loggerConfigUtils.js      | (modified)                                          | Support new config format       |
| tests/common/mockFactories/loggerMocks.js         | (modified)                                          | Add extended methods            |
| config/logger-config.json                         | config/debug-logging-config.json                    | New                             |
| -                                                 | llm-proxy-server/src/handlers/debugLogController.js | New                             |
| -                                                 | llm-proxy-server/src/services/logStorageService.js  | New                             |
| -                                                 | llm-proxy-server/src/routes/debugRoutes.js          | New (similar to traceRoutes.js) |

## Appendix B: Dependencies

### New Dependencies

```json
{
  "dependencies": {
    // No new production dependencies required
  },
  "devDependencies": {
    // No new dev dependencies required
  }
}
```

### Existing Dependencies Used

- Built-in: fs, path, http
- Existing: uuid (session IDs)
- Existing: compression middleware (optional)

## Appendix C: Architectural Integration Notes

### Dependency Injection Integration

The logger is currently registered as a singleton early in the container configuration process:

1. Created as `ConsoleLogger` instance in `containerConfig.js` line 46
2. Registered via `tokens.ILogger` for all consumers
3. Configuration loaded asynchronously via `loadAndApplyLoggerConfig`
4. Used by 400+ files throughout the system

**Critical Integration Points**:

- The LoggerStrategy must be a drop-in replacement for ConsoleLogger
- Must support all ConsoleLogger methods including extended ones
- Must maintain the same async configuration loading flow
- Must not break existing test infrastructure

### Test Infrastructure Considerations

- No central TestBedClass exists; domain-specific test beds are used
- MockLogger created via `createSimpleMock()` utility pattern
- Tests expect specific method signatures and behavior
- 2,000+ tests may be affected by logger changes

## Appendix D: Risk Matrix

| Risk                   | Probability | Impact | Mitigation            |
| ---------------------- | ----------- | ------ | --------------------- |
| Network failures       | Medium      | Low    | Console fallback      |
| Storage exhaustion     | Low         | High   | Automatic cleanup     |
| Performance regression | Low         | Medium | Monitoring & rollback |
| Test incompatibility   | Low         | High   | Extensive testing     |
| Security breach        | Low         | High   | Local-only default    |

---

**Document Status**: This specification has been updated and corrected based on comprehensive codebase analysis. All discrepancies between initial assumptions and production reality have been addressed. The specification now accurately reflects:

- 2,054 debug calls across 404 files (not 13,000 as initially stated)
- Complete ConsoleLogger interface including extended methods
- Existing DI container integration requirements
- Actual test infrastructure organization
- Leveraging existing llm-proxy-server patterns

**Next Steps**:

1. Review and approve specification
2. Create implementation tickets
3. Begin Phase 1 development
4. Setup monitoring infrastructure
