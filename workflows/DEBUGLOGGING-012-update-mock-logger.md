# DEBUGLOGGING-012: Update MockLogger with Complete Interface

**Status**: Not Started  
**Priority**: P1 - High  
**Phase**: 2 - Integration  
**Component**: Test Infrastructure  
**Estimated**: 3 hours

## Description

Update the MockLogger implementation to include all ConsoleLogger methods, ensuring complete interface compatibility. This is important for maintaining test infrastructure integrity, particularly for logging infrastructure tests that use extended logger features.

## Technical Requirements

### 1. Complete Interface Implementation

```javascript
class MockLogger {
  // Core ILogger methods
  debug(message, metadata) {}
  info(message, metadata) {}
  warn(message, metadata) {}
  error(message, metadata) {}

  // Extended ConsoleLogger methods (REQUIRED)
  groupCollapsed(label) {}
  groupEnd() {}
  table(data, columns) {}
  setLogLevel(logLevelInput) {}
}
```

### 2. Current Implementation Location

```javascript
// tests/common/mockFactories/loggerMocks.js
export const createMockLogger = () =>
  createSimpleMock(['info', 'warn', 'error', 'debug']);
```

### 3. Enhanced Implementation Required

```javascript
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
```

## Implementation Steps

1. **Update Base Mock Logger**
   - [ ] Locate `tests/common/mockFactories/loggerMocks.js`
   - [ ] Add missing methods to mock array
   - [ ] Ensure all methods are jest.fn()
   - [ ] Maintain existing mock behavior

2. **Verify createSimpleMock Compatibility**

   ```javascript
   // Located in tests/common/mockFactories/coreServices.js
   // Ensure createSimpleMock handles all methods
   export function createSimpleMock(methods) {
     const mock = {};
     methods.forEach((method) => {
       mock[method] = jest.fn();
     });
     return mock;
   }
   ```

3. **Add Method-Specific Behavior**

   ```javascript
   export const createMockLogger = () => {
     const logger = createSimpleMock([
       'info',
       'warn',
       'error',
       'debug',
       'groupCollapsed',
       'groupEnd',
       'table',
       'setLogLevel',
     ]);

     // Add default behavior for setLogLevel
     logger.setLogLevel.mockImplementation((level) => {
       logger.currentLevel = level;
     });

     // Track group nesting
     logger._groupDepth = 0;
     logger.groupCollapsed.mockImplementation(() => {
       logger._groupDepth++;
     });
     logger.groupEnd.mockImplementation(() => {
       logger._groupDepth = Math.max(0, logger._groupDepth - 1);
     });

     return logger;
   };
   ```

4. **Update Test Helper Usage**
   - [ ] Search for all createMockLogger() usage
   - [ ] Verify tests don't break with new methods
   - [ ] Update any direct mock creation
   - [ ] Add deprecation warnings if needed

5. **Create Compatibility Layer**

   ```javascript
   // Ensure backward compatibility
   export const createLegacyMockLogger = () =>
     createSimpleMock(['info', 'warn', 'error', 'debug']);

   // New complete mock
   export const createCompleteMockLogger = () => {
     // Full implementation with all methods
   };

   // Default export uses complete version
   export const createMockLogger = createCompleteMockLogger;
   ```

## Acceptance Criteria

- [ ] MockLogger implements all ConsoleLogger methods
- [ ] All existing tests continue to pass
- [ ] New methods can be spied upon with jest
- [ ] Mock maintains call history for assertions
- [ ] setLogLevel tracks level changes
- [ ] Group methods track nesting depth
- [ ] No breaking changes to test infrastructure
- [ ] Helper functions work with new interface

## Dependencies

- **Required By**: All test files using mock logger
- **Affects**: Primarily logging infrastructure tests, performance tests, and debug configuration tests. Most application tests use basic logging methods only.

## Testing Requirements

1. **Unit Tests**
   - [ ] Test mock logger creation
   - [ ] Test all methods are callable
   - [ ] Test jest spy functionality
   - [ ] Test method-specific behavior

2. **Integration Tests**
   - [ ] Run full test suite
   - [ ] Verify no test failures
   - [ ] Check mock assertions work

3. **Regression Tests**
   - [ ] Test with LoggerStrategy
   - [ ] Test with ConsoleLogger
   - [ ] Test with test helpers

## Files to Modify

- **Primary**: `tests/common/mockFactories/loggerMocks.js`
- **Secondary**: `tests/common/mockFactories/coreServices.js` (contains createSimpleMock function)
- **Check**: Any test files with custom logger mocks

## Search Patterns for Impact Analysis

```bash
# Find all test files using createMockLogger
grep -r "createMockLogger" tests/

# Find direct logger mocking
grep -r "jest.fn.*logger" tests/

# Find setLogLevel usage in tests
grep -r "setLogLevel" tests/

# Find group method usage - more targeted search
grep -r "\.groupCollapsed\|\.groupEnd\|\.table\|\.setLogLevel" tests/
grep -r "logger\." tests/ | grep -E "(groupCollapsed|groupEnd|table|setLogLevel)"
```

## Migration Guide for Test Authors

```javascript
// Old pattern (if found)
const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// New pattern (use helper)
const logger = createMockLogger();

// Assertions work the same
expect(logger.debug).toHaveBeenCalledWith('message');

// New methods available
expect(logger.setLogLevel).toHaveBeenCalledWith('DEBUG');
expect(logger.groupCollapsed).toHaveBeenCalled();
```

## Risk Mitigation

1. **Gradual Rollout**
   - Keep legacy mock available temporarily
   - Add deprecation warnings
   - Provide migration period

2. **Test Suite Validation**

   ```bash
   # Run tests in batches to identify failures
   npm run test:unit
   npm run test:integration
   npm run test:e2e
   ```

3. **Rollback Plan**
   - Keep backup of original mock
   - Use feature flag if needed
   - Quick revert capability

## Notes

- Important for test infrastructure stability, particularly for logging infrastructure tests
- Extended methods are primarily used in:
  - Performance logging tests (noOpLogger.performance.test.js)
  - Logger strategy integration tests
  - Debug logging configuration utilities
- Most application tests (majority of the 2,000+ tests) use only basic logging methods
- Must be done before LoggerStrategy integration
- Focus validation on logging infrastructure tests that actually use extended methods
- Document changes in test guidelines
- Consider creating createCompleteMockLogger() alongside existing basic version for backward compatibility

## Related Tickets

- **Blocks**: DEBUGLOGGING-013 (enhanced helpers)
- **Required For**: DEBUGLOGGING-014 (backward compatibility)
- **Related**: DEBUGLOGGING-005 (LoggerStrategy)
