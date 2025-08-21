# DEBUGLOGGING-013: Create Enhanced Mock Logger Test Helpers

**Status**: Not Started  
**Priority**: P1 - High  
**Phase**: 2 - Integration  
**Component**: Test Infrastructure  
**Estimated**: 3 hours

## Description

Create enhanced test helpers for the mock logger that provide convenient assertion methods and debugging utilities. These helpers will make it easier to test logging behavior across the codebase.

## Technical Requirements

### 1. Enhanced Mock Logger Interface

```javascript
export const createEnhancedMockLogger = () => {
  const logger = createMockLogger();

  // Test utilities
  logger.getDebugCalls = () => logger.debug.mock.calls;
  logger.getCallsByLevel = (level) => logger[level].mock.calls;
  logger.clearAllCalls = () => {
    /* ... */
  };

  // Assertion helpers
  logger.expectDebugMessage = (message) => {
    /* ... */
  };
  logger.expectNoDebugCalls = () => {
    /* ... */
  };
  logger.expectLogSequence = (sequence) => {
    /* ... */
  };

  // Analysis utilities
  logger.getCategories = () => {
    /* ... */
  };
  logger.getLogsByCategory = (category) => {
    /* ... */
  };
  logger.getMetadata = () => {
    /* ... */
  };

  return logger;
};
```

### 2. Assertion Helper Methods

```javascript
// Check if specific message was logged
expectDebugMessage(message, metadata?)
expectInfoMessage(message, metadata?)
expectWarnMessage(message, metadata?)
expectErrorMessage(message, metadata?)

// Check log count
expectDebugCount(count)
expectTotalLogs(count)
expectNoLogs()

// Check log sequence
expectLogSequence([
  { level: 'debug', message: 'init' },
  { level: 'info', message: 'started' }
])

// Category assertions
expectCategory(category, count?)
expectNoCategory(category)
```

### 3. Analysis Utilities

```javascript
// Get logs by various criteria
getLogsByLevel(level);
getLogsByCategory(category);
getLogsByPattern(regex);
getLogsWithMetadata();
getLogsBetween(startTime, endTime);

// Summary methods
getLogSummary(); // { debug: 5, info: 3, ... }
getCategorySummary(); // { engine: 10, ui: 5, ... }
getCallTimeline(); // Chronological list

// Debugging helpers
printLogs(); // Pretty print all logs
exportLogs(); // Export as JSON
```

## Implementation Steps

1. **Create Enhanced Mock Logger Factory**
   - [ ] Create `tests/common/mockFactories/enhancedLoggerMock.js`
   - [ ] Extend base mock logger
   - [ ] Add utility methods
   - [ ] Implement assertion helpers

2. **Implement Assertion Helpers**

   ```javascript
   class LoggerAssertions {
     constructor(logger) {
       this.logger = logger;
     }

     expectDebugMessage(message, metadata) {
       expect(this.logger.debug).toHaveBeenCalledWith(
         expect.stringContaining(message),
         metadata ? expect.objectContaining(metadata) : expect.anything()
       );
     }

     expectLogSequence(sequence) {
       const allCalls = this.getAllCallsInOrder();
       sequence.forEach((expected, index) => {
         const actual = allCalls[index];
         expect(actual.level).toBe(expected.level);
         expect(actual.message).toContain(expected.message);
       });
     }
   }
   ```

3. **Implement Analysis Utilities**

   ```javascript
   class LoggerAnalyzer {
     constructor(logger) {
       this.logger = logger;
     }

     getLogsByCategory(category) {
       const categoryDetector = new CategoryDetector();
       return this.getAllLogs().filter(
         (log) => categoryDetector.detect(log.message) === category
       );
     }

     getLogSummary() {
       return {
         debug: this.logger.debug.mock.calls.length,
         info: this.logger.info.mock.calls.length,
         warn: this.logger.warn.mock.calls.length,
         error: this.logger.error.mock.calls.length,
         total: this.getTotalLogCount(),
       };
     }
   }
   ```

4. **Create Matcher Extensions**

   ```javascript
   // Custom Jest matchers
   expect.extend({
     toHaveLoggedDebug(logger, message) {
       const calls = logger.debug.mock.calls;
       const pass = calls.some(([msg]) => msg.includes(message));
       return {
         pass,
         message: () =>
           pass
             ? `Expected not to log debug: "${message}"`
             : `Expected to log debug: "${message}"`,
       };
     },
   });
   ```

5. **Create Test Utilities Module**
   - [ ] Combine all helpers in single module
   - [ ] Export convenient functions
   - [ ] Add TypeScript definitions
   - [ ] Create usage documentation

## Acceptance Criteria

- [ ] Enhanced mock includes all helper methods
- [ ] Assertion helpers provide clear error messages
- [ ] Analysis utilities correctly categorize logs
- [ ] Custom matchers integrate with Jest
- [ ] All helpers maintain test isolation
- [ ] Documentation includes usage examples
- [ ] Backward compatible with existing tests
- [ ] Performance overhead is minimal

## Dependencies

- **Requires**: DEBUGLOGGING-012 (base mock logger)
- **Uses**: DEBUGLOGGING-007 (category detection)

## Testing Requirements

1. **Unit Tests**
   - [ ] Test each assertion helper
   - [ ] Test analysis utilities
   - [ ] Test custom matchers
   - [ ] Test error messages

2. **Integration Tests**
   - [ ] Test with real test scenarios
   - [ ] Test helper combinations
   - [ ] Test performance impact

## Files to Create/Modify

- **Create**: `tests/common/mockFactories/enhancedLoggerMock.js`
- **Create**: `tests/common/matchers/loggerMatchers.js`
- **Create**: `tests/common/utils/loggerTestUtils.js`
- **Create**: `tests/unit/mockFactories/enhancedLoggerMock.test.js`
- **Modify**: `tests/common/index.js` (export new helpers)

## Usage Examples

```javascript
// Basic usage
const logger = createEnhancedMockLogger();
service.doSomething(logger);

// Assertion examples
logger.expectDebugMessage('Initialization complete');
logger.expectErrorMessage('Failed to connect', { code: 'ERR_001' });
logger.expectLogSequence([
  { level: 'debug', message: 'Starting' },
  { level: 'info', message: 'Connected' },
  { level: 'debug', message: 'Ready' },
]);

// Analysis examples
const engineLogs = logger.getLogsByCategory('engine');
const summary = logger.getLogSummary();
console.log(`Total logs: ${summary.total}`);

// Custom matcher usage
expect(logger).toHaveLoggedDebug('Component initialized');
expect(logger).not.toHaveLoggedError();

// Debugging helper
if (testFailed) {
  logger.printLogs(); // Pretty print for debugging
}
```

## Performance Considerations

- Lazy evaluation of categories
- Cache computed values
- Minimize string operations
- Use efficient data structures

## Documentation Template

````markdown
# Logger Test Helpers

## Quick Start

```javascript
import { createEnhancedMockLogger } from 'tests/common';

const logger = createEnhancedMockLogger();
// ... use logger in tests ...
logger.expectDebugMessage('Expected message');
```
````

## Assertion Methods

- `expectDebugMessage(message, metadata?)` - Assert debug was called
- `expectLogSequence(array)` - Assert sequence of logs
- ...

## Analysis Methods

- `getLogsByCategory(category)` - Filter by category
- `getLogSummary()` - Get count summary
- ...

```

## Notes

- Consider adding snapshot testing support
- May need timeout handling for async logs
- Consider memory cleanup for large test suites
- Could add performance profiling helpers
- Think about integration with test reporters

## Related Tickets

- **Depends On**: DEBUGLOGGING-012 (base mock)
- **Enhances**: Test infrastructure
- **Used By**: All future test writing
```
