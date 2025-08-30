# ENHLOGVIS-004: Write Unit Tests for Critical Log Bypass Logic

## Ticket Overview
**Type**: Testing  
**Component**: Logging System Tests  
**Priority**: High  
**Phase**: 1 - Core Functionality  
**Estimated Effort**: 3 hours  

## Objective
Create comprehensive unit tests for the critical log bypass logic implemented in ENHLOGVIS-001 and ENHLOGVIS-002, ensuring the feature works correctly and maintains performance requirements.

## Current State
- Unit tests exist for HybridLogger in `tests/unit/logging/hybridLogger.test.js`
- No tests for critical log bypass functionality
- No tests for critical log buffer
- No performance benchmarks for the new features

## Technical Implementation

### Files to Create/Modify
- `tests/unit/logging/hybridLogger.criticalLogging.test.js` - New test file for critical logging features
- `tests/unit/logging/criticalLogBuffer.test.js` - New test file for buffer functionality
- `tests/performance/logging/criticalLogging.performance.test.js` - Performance tests
- `tests/common/mocks/mockLoggerConfig.js` - Update mock configurations

### Test Structure

1. **Critical Log Bypass Tests** (`hybridLogger.criticalLogging.test.js`):
   ```javascript
   import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
   import HybridLogger from '../../../src/logging/hybridLogger.js';
   import { createMockLogger } from '../../common/mocks/mockLogger.js';
   import { createMockEventBus } from '../../common/mocks/mockEventBus.js';
   
   describe('HybridLogger - Critical Logging Feature', () => {
     let hybridLogger;
     let mockConsoleLogger;
     let mockRemoteLogger;
     let mockEventBus;
     let mockConfig;
     
     beforeEach(() => {
       mockConsoleLogger = createMockLogger();
       mockRemoteLogger = createMockLogger();
       mockEventBus = createMockEventBus();
       
       mockConfig = {
         criticalLogging: {
           alwaysShowInConsole: true,
           enableVisualNotifications: true,
           bufferSize: 50,
           notificationPosition: 'top-right',
           autoDismissAfter: null
         },
         filters: {
           console: {
             categories: ['none'], // Restrictive filter
             levels: ['none'] // Should be bypassed for critical logs
           }
         }
       };
       
       hybridLogger = new HybridLogger({
         consoleLogger: mockConsoleLogger,
         remoteLogger: mockRemoteLogger,
         eventBus: mockEventBus,
         config: mockConfig
       });
     });
     
     describe('Critical Log Bypass', () => {
       it('should always log warnings to console when alwaysShowInConsole is true', () => {
         hybridLogger.warn('Test warning');
         
         expect(mockConsoleLogger.warn).toHaveBeenCalledWith(
           expect.stringContaining('Test warning'),
           expect.any(Object)
         );
       });
       
       it('should always log errors to console when alwaysShowInConsole is true', () => {
         const error = new Error('Test error');
         hybridLogger.error('Test error message', error);
         
         expect(mockConsoleLogger.error).toHaveBeenCalledWith(
           expect.stringContaining('Test error message'),
           expect.any(Object)
         );
       });
       
       it('should respect filters for non-critical logs', () => {
         hybridLogger.info('Test info');
         hybridLogger.debug('Test debug');
         
         expect(mockConsoleLogger.info).not.toHaveBeenCalled();
         expect(mockConsoleLogger.debug).not.toHaveBeenCalled();
       });
       
       it('should not bypass when alwaysShowInConsole is false', () => {
         mockConfig.criticalLogging.alwaysShowInConsole = false;
         hybridLogger = new HybridLogger({
           consoleLogger: mockConsoleLogger,
           remoteLogger: mockRemoteLogger,
           eventBus: mockEventBus,
           config: mockConfig
         });
         
         hybridLogger.warn('Test warning');
         
         expect(mockConsoleLogger.warn).not.toHaveBeenCalled();
       });
       
       it('should handle missing criticalLogging config gracefully', () => {
         delete mockConfig.criticalLogging;
         
         expect(() => {
           hybridLogger = new HybridLogger({
             consoleLogger: mockConsoleLogger,
             remoteLogger: mockRemoteLogger,
             eventBus: mockEventBus,
             config: mockConfig
           });
         }).not.toThrow();
         
         // Should use defaults
         hybridLogger.warn('Test warning');
         expect(mockConsoleLogger.warn).toHaveBeenCalled();
       });
     });
   });
   ```

2. **Critical Log Buffer Tests** (`criticalLogBuffer.test.js`):
   ```javascript
   describe('HybridLogger - Critical Log Buffer', () => {
     describe('Buffer Management', () => {
       it('should add warnings to critical buffer', () => {
         hybridLogger.warn('Warning 1');
         hybridLogger.warn('Warning 2');
         
         const logs = hybridLogger.getCriticalLogs();
         expect(logs).toHaveLength(2);
         expect(logs[0].level).toBe('warn');
         expect(logs[0].message).toBe('Warning 1');
       });
       
       it('should add errors to critical buffer', () => {
         hybridLogger.error('Error 1');
         
         const logs = hybridLogger.getCriticalLogs();
         expect(logs).toHaveLength(1);
         expect(logs[0].level).toBe('error');
       });
       
       it('should not add info/debug logs to buffer', () => {
         hybridLogger.info('Info log');
         hybridLogger.debug('Debug log');
         
         const logs = hybridLogger.getCriticalLogs();
         expect(logs).toHaveLength(0);
       });
       
       it('should maintain circular buffer behavior', () => {
         mockConfig.criticalLogging.bufferSize = 3;
         hybridLogger = new HybridLogger({ ...dependencies, config: mockConfig });
         
         hybridLogger.warn('Log 1');
         hybridLogger.warn('Log 2');
         hybridLogger.warn('Log 3');
         hybridLogger.warn('Log 4'); // Should remove Log 1
         
         const logs = hybridLogger.getCriticalLogs();
         expect(logs).toHaveLength(3);
         expect(logs[0].message).toBe('Log 2');
         expect(logs[2].message).toBe('Log 4');
       });
       
       it('should filter logs by level', () => {
         hybridLogger.warn('Warning');
         hybridLogger.error('Error');
         
         const warnings = hybridLogger.getCriticalLogs({ level: 'warn' });
         expect(warnings).toHaveLength(1);
         expect(warnings[0].level).toBe('warn');
         
         const errors = hybridLogger.getCriticalLogs({ level: 'error' });
         expect(errors).toHaveLength(1);
         expect(errors[0].level).toBe('error');
       });
       
       it('should limit returned logs', () => {
         for (let i = 0; i < 10; i++) {
           hybridLogger.warn(`Warning ${i}`);
         }
         
         const limited = hybridLogger.getCriticalLogs({ limit: 3 });
         expect(limited).toHaveLength(3);
         expect(limited[2].message).toBe('Warning 9'); // Most recent
       });
       
       it('should clear buffer correctly', () => {
         hybridLogger.warn('Warning');
         hybridLogger.error('Error');
         
         hybridLogger.clearCriticalBuffer();
         
         const logs = hybridLogger.getCriticalLogs();
         expect(logs).toHaveLength(0);
         
         const stats = hybridLogger.getCriticalBufferStats();
         expect(stats.totalWarnings).toBe(0);
         expect(stats.totalErrors).toBe(0);
       });
       
       it('should track buffer statistics', () => {
         hybridLogger.warn('Warning 1');
         hybridLogger.warn('Warning 2');
         hybridLogger.error('Error 1');
         
         const stats = hybridLogger.getCriticalBufferStats();
         expect(stats.currentSize).toBe(3);
         expect(stats.maxSize).toBe(50);
         expect(stats.totalWarnings).toBe(2);
         expect(stats.totalErrors).toBe(1);
         expect(stats.oldestTimestamp).toBeDefined();
         expect(stats.newestTimestamp).toBeDefined();
       });
     });
     
     describe('Buffer Entry Structure', () => {
       it('should include all required fields in buffer entries', () => {
         const testContext = { userId: '123', action: 'test' };
         hybridLogger.warn('Test warning', testContext);
         
         const logs = hybridLogger.getCriticalLogs();
         const entry = logs[0];
         
         expect(entry).toHaveProperty('id');
         expect(entry).toHaveProperty('timestamp');
         expect(entry).toHaveProperty('level', 'warn');
         expect(entry).toHaveProperty('message', 'Test warning');
         expect(entry).toHaveProperty('category');
         expect(entry).toHaveProperty('metadata');
         expect(entry.metadata).toMatchObject(testContext);
       });
       
       it('should include error stack traces in metadata', () => {
         const error = new Error('Test error');
         hybridLogger.error('Error occurred', error);
         
         const logs = hybridLogger.getCriticalLogs();
         const entry = logs[0];
         
         expect(entry.metadata.stack).toBeDefined();
         expect(entry.metadata.errorName).toBe('Error');
         expect(entry.metadata.errorMessage).toBe('Test error');
       });
     });
   });
   ```

3. **Performance Tests** (`criticalLogging.performance.test.js`):
   ```javascript
   describe('Critical Logging Performance', () => {
     it('should not degrade performance by more than 5%', () => {
       const iterations = 10000;
       
       // Baseline without critical logging
       mockConfig.criticalLogging.alwaysShowInConsole = false;
       mockConfig.criticalLogging.bufferSize = 0;
       const baselineLogger = new HybridLogger({ ...dependencies, config: mockConfig });
       
       const baselineStart = performance.now();
       for (let i = 0; i < iterations; i++) {
         baselineLogger.warn(`Warning ${i}`);
       }
       const baselineTime = performance.now() - baselineStart;
       
       // With critical logging enabled
       mockConfig.criticalLogging.alwaysShowInConsole = true;
       mockConfig.criticalLogging.bufferSize = 50;
       const enhancedLogger = new HybridLogger({ ...dependencies, config: mockConfig });
       
       const enhancedStart = performance.now();
       for (let i = 0; i < iterations; i++) {
         enhancedLogger.warn(`Warning ${i}`);
       }
       const enhancedTime = performance.now() - enhancedStart;
       
       const overhead = ((enhancedTime - baselineTime) / baselineTime) * 100;
       expect(overhead).toBeLessThan(5);
     });
     
     it('should maintain memory efficiency for buffer', () => {
       mockConfig.criticalLogging.bufferSize = 50;
       const logger = new HybridLogger({ ...dependencies, config: mockConfig });
       
       // Fill buffer
       for (let i = 0; i < 50; i++) {
         logger.warn(`Warning with some additional metadata ${i}`, {
           timestamp: Date.now(),
           userId: 'test-user',
           action: 'test-action'
         });
       }
       
       // Rough estimation of memory usage
       const logs = logger.getCriticalLogs();
       const jsonSize = JSON.stringify(logs).length;
       const memorySizeKB = jsonSize / 1024;
       
       expect(memorySizeKB).toBeLessThan(10); // Should be under 10KB
     });
   });
   ```

## Dependencies
- **Tests**: ENHLOGVIS-001 (shouldLogToConsole enhancement)
- **Tests**: ENHLOGVIS-002 (Critical log buffer)
- **Tests**: ENHLOGVIS-003 (Configuration schema)

## Acceptance Criteria
- [ ] All bypass logic scenarios have test coverage
- [ ] All buffer operations have test coverage
- [ ] Performance tests verify < 5% overhead
- [ ] Memory tests verify < 10KB for 50 logs
- [ ] Edge cases are tested (missing config, invalid values)
- [ ] Tests follow existing test patterns in the project
- [ ] Test coverage remains above 80% for modified files

## Testing Requirements

### Test Execution
```bash
# Run unit tests
npm run test:unit tests/unit/logging/hybridLogger.criticalLogging.test.js
npm run test:unit tests/unit/logging/criticalLogBuffer.test.js

# Run performance tests
npm run test:performance tests/performance/logging/criticalLogging.performance.test.js

# Check coverage
npm run test:unit -- --coverage src/logging/hybridLogger.js
```

### Manual Verification
1. Run all new tests - verify they pass
2. Run existing HybridLogger tests - verify no regression
3. Check test coverage report - verify > 80% coverage
4. Review test output - verify clear test descriptions

## Code Review Checklist
- [ ] Tests are independent and don't rely on execution order
- [ ] Mocks are properly cleaned up in afterEach
- [ ] Test descriptions clearly explain what's being tested
- [ ] Edge cases and error conditions are covered
- [ ] Performance tests use appropriate metrics
- [ ] Tests follow project testing conventions

## Notes
- Consider adding snapshot tests for buffer entry structure
- Performance tests should run in isolation to avoid interference
- May need to adjust performance thresholds based on CI environment
- Consider adding integration tests in a separate ticket
- Ensure tests work with jest's --runInBand flag for debugging

## Related Tickets
- **Depends On**: ENHLOGVIS-001, ENHLOGVIS-002, ENHLOGVIS-003
- **Next**: ENHLOGVIS-005 (Create CriticalLogNotifier class)
- **Related**: ENHLOGVIS-009 (Integration tests)