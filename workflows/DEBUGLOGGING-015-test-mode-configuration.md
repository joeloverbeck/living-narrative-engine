# DEBUGLOGGING-015: Add Test Mode Configuration Support

**Status**: Not Started  
**Priority**: P0 - Critical  
**Phase**: 2 - Integration  
**Component**: Test Infrastructure  
**Estimated**: 2 hours

## Description

Implement test mode configuration that ensures all tests use the MockLogger and prevents any network calls or file I/O during test execution. This maintains test isolation and performance.

## Technical Requirements

### 1. Test Mode Detection

```javascript
function isTestMode() {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.JEST_WORKER_ID !== undefined ||
    typeof global.it === 'function'
  );
}
```

### 2. Test Configuration

```json
{
  "enabled": true,
  "mode": "test",
  "mock": {
    "captureAll": true,
    "silent": true,
    "validateCalls": true,
    "trackMetadata": true
  }
}
```

### 3. Environment Setup

```javascript
// jest.setup.js
beforeEach(() => {
  process.env.DEBUG_LOG_MODE = 'test';
  process.env.DEBUG_LOG_SILENT = 'true';
});

afterEach(() => {
  delete process.env.DEBUG_LOG_MODE;
  delete process.env.DEBUG_LOG_SILENT;
});
```

## Implementation Steps

1. **Update Jest Setup File**
   - [ ] Modify `jest.setup.js`
   - [ ] Set test environment variables
   - [ ] Configure global test mode
   - [ ] Disable console output in tests

2. **Create Test Mode Configuration**

   ```javascript
   // src/logging/testModeConfig.js
   export const TEST_MODE_CONFIG = {
     enabled: true,
     mode: 'test',
     mock: {
       captureAll: true,
       silent: true,
       validateCalls: true,
       trackMetadata: true,
       maxCallHistory: 1000,
     },
     // Disable all external communication
     remote: {
       enabled: false,
     },
     // Disable file I/O
     file: {
       enabled: false,
     },
   };
   ```

3. **Update LoggerStrategy for Test Mode**

   ```javascript
   class LoggerStrategy {
     constructor({ mode, config, dependencies }) {
       // Force test mode if in test environment
       if (this.#isTestEnvironment()) {
         mode = 'test';
         config = TEST_MODE_CONFIG;
       }

       this.#logger = this.#createLogger(mode, config, dependencies);
     }

     #isTestEnvironment() {
       return (
         process.env.NODE_ENV === 'test' ||
         process.env.JEST_WORKER_ID !== undefined
       );
     }
   }
   ```

4. **Create Test Mode Logger**

   ```javascript
   // src/logging/testModeLogger.js
   export class TestModeLogger {
     constructor(config) {
       this.config = config;
       this.calls = [];
       this.silent = config.mock.silent;

       // Create jest mocks for all methods
       ['debug', 'info', 'warn', 'error'].forEach((level) => {
         this[level] = jest.fn((message, metadata) => {
           if (config.mock.captureAll) {
             this.calls.push({
               level,
               message,
               metadata,
               timestamp: Date.now(),
             });
           }
           if (!this.silent && level === 'error') {
             console.error(message); // Allow error visibility
           }
         });
       });
     }
   }
   ```

5. **Test Isolation Enforcement**
   - [ ] Block all HTTP requests in test mode
   - [ ] Prevent file system writes
   - [ ] Disable timers/intervals
   - [ ] Clear state between tests

## Acceptance Criteria

- [ ] Tests always use MockLogger
- [ ] No network calls during tests
- [ ] No file I/O during tests
- [ ] Test mode auto-detected
- [ ] Console output suppressed (except errors)
- [ ] Test performance maintained
- [ ] Call history available for assertions
- [ ] Test isolation guaranteed

## Dependencies

- **Requires**: DEBUGLOGGING-012 (MockLogger)
- **Requires**: DEBUGLOGGING-005 (LoggerStrategy)
- **Affects**: All test execution

## Testing Requirements

1. **Unit Tests**
   - [ ] Test mode detection works
   - [ ] Configuration applied correctly
   - [ ] Network calls blocked
   - [ ] File I/O prevented

2. **Integration Tests**
   - [ ] Test suite runs with test mode
   - [ ] No external side effects
   - [ ] Performance acceptable

## Files to Create/Modify

- **Modify**: `jest.setup.js`
- **Create**: `src/logging/testModeConfig.js`
- **Create**: `src/logging/testModeLogger.js`
- **Modify**: `src/logging/loggerStrategy.js`
- **Create**: `tests/unit/logging/testMode.test.js`

## Test Environment Variables

```javascript
// Complete list of test mode variables
process.env.DEBUG_LOG_MODE = 'test';
process.env.DEBUG_LOG_SILENT = 'true';
process.env.DEBUG_LOG_CAPTURE = 'true';
process.env.DEBUG_LOG_NO_NETWORK = 'true';
process.env.DEBUG_LOG_NO_FILE = 'true';
```

## Performance Considerations

- Mock logger should have minimal overhead
- Avoid deep cloning of metadata
- Limit call history size to prevent memory issues
- Use lazy evaluation where possible

## Test Helper Integration

```javascript
// tests/common/testEnvironment.js
export function setupTestLogging() {
  const logger = createMockLogger();

  // Ensure test mode
  process.env.DEBUG_LOG_MODE = 'test';

  // Reset between tests
  beforeEach(() => {
    logger.clearAllCalls();
  });

  return logger;
}
```

## CI/CD Configuration

```yaml
# .github/workflows/test.yml
env:
  NODE_ENV: test
  DEBUG_LOG_MODE: test
  DEBUG_LOG_SILENT: true
```

## Validation Checklist

- [ ] No console output during test runs
- [ ] No network requests made
- [ ] No files created in logs/
- [ ] Tests run faster than baseline
- [ ] Memory usage stable
- [ ] All assertions work

## Notes

- Critical for maintaining test performance
- Prevents test pollution and flakiness
- Ensures reproducible test results
- Consider adding test mode indicator in logs
- May need special handling for E2E tests

## Related Tickets

- **Depends On**: DEBUGLOGGING-012, DEBUGLOGGING-005
- **Required For**: DEBUGLOGGING-014 (compatibility)
- **Related**: Test infrastructure tickets
