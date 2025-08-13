# ACTTRA-032: Create Unit Tests for ActionTraceOutputService

## Summary

Create comprehensive unit tests for the ActionTraceOutputService class to ensure correct trace output generation, file management, and asynchronous queue processing.

## Parent Issue

- **Phase**: Phase 5 - Testing & Documentation
- **Specification**: [Action Tracing System Implementation Specification](../specs/action-tracing-implementation.spec.md)
- **Overview**: [ACTTRA-000](./ACTTRA-000-implementation-overview.md)

## Description

The ActionTraceOutputService is responsible for writing trace data to files, managing output queues, formatting traces in JSON and human-readable formats, and handling file rotation policies. This ticket involves creating comprehensive unit tests for all these functionalities.

## Acceptance Criteria

- [ ] Unit test file created at `tests/unit/actions/tracing/actionTraceOutputService.unit.test.js`
- [ ] Test coverage of 80%+ branches and 90%+ lines for ActionTraceOutputService
- [ ] All output formats tested (JSON and human-readable)
- [ ] Queue processing logic thoroughly tested
- [ ] File rotation policies validated
- [ ] Error handling and recovery tested
- [ ] Tests follow project testing conventions
- [ ] All tests pass in CI/CD pipeline

## Technical Requirements

### Test File Structure

```javascript
// tests/unit/actions/tracing/actionTraceOutputService.unit.test.js

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionTraceOutputServiceTestBed } from '../../../common/actions/actionTraceOutputServiceTestBed.js';

describe('ActionTraceOutputService - File Output', () => {
  let testBed;

  beforeEach(() => {
    testBed = new ActionTraceOutputServiceTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  // Test suites...
});
```

### Test Scenarios

#### 1. Service Initialization Tests

```javascript
describe('Service Initialization', () => {
  it('should initialize with required dependencies');
  it('should validate file system dependency');
  it('should validate logger dependency');
  it('should validate action trace filter dependency');
  it('should initialize output queue as empty');
  it('should set processing flag to false initially');
});
```

#### 2. Directory Management Tests

```javascript
describe('Directory Management', () => {
  it('should create output directory if it does not exist');
  it('should handle existing directory gracefully');
  it('should handle permission errors when creating directory');
  it('should use configured output directory path');
  it('should handle nested directory creation');
  it('should validate directory path format');
  it('should cache directory creation status');
});
```

#### 3. File Naming Tests

```javascript
describe('File Naming Conventions', () => {
  it('should generate unique filename with timestamp');
  it('should sanitize action ID in filename');
  it('should handle action IDs with colons');
  it('should include ISO timestamp format');
  it('should ensure filename uniqueness');
  it('should handle missing action ID');
  it('should limit filename length');
});
```

#### 4. Queue Processing Tests

```javascript
describe('Async Queue Processing', () => {
  it('should queue traces for async processing');
  it('should process queue without blocking');
  it('should handle multiple traces in queue');
  it('should process queue in FIFO order');
  it('should handle queue processing errors');
  it('should prevent concurrent queue processing');
  it('should handle empty queue gracefully');
  it('should continue processing after errors');
});
```

#### 5. JSON Output Tests

```javascript
describe('JSON Output Formatting', () => {
  it('should format ActionExecutionTrace to JSON');
  it('should format ActionAwareStructuredTrace to JSON');
  it('should include all trace metadata');
  it('should handle circular references safely');
  it('should pretty-print JSON with indentation');
  it('should handle large trace data');
  it('should validate JSON structure');
  it('should include timestamp in output');
});
```

#### 6. Human-Readable Output Tests

```javascript
describe('Human-Readable Output Formatting', () => {
  it('should generate readable text for minimal verbosity');
  it('should generate detailed text for standard verbosity');
  it('should generate comprehensive text for detailed verbosity');
  it('should generate full text for verbose level');
  it('should format timestamps in readable format');
  it('should include section headers');
  it('should align columns properly');
  it('should handle missing data gracefully');
});
```

#### 7. File Writing Tests

```javascript
describe('File Writing', () => {
  it('should write JSON file with correct extension');
  it('should write text file for non-minimal verbosity');
  it('should handle file write errors');
  it('should use UTF-8 encoding');
  it('should handle concurrent write requests');
  it('should verify file contents after writing');
  it('should handle disk space issues');
});
```

#### 8. File Rotation Tests

```javascript
describe('File Rotation Policies', () => {
  describe('Age-Based Rotation', () => {
    it('should delete files older than max age');
    it('should keep files within age limit');
    it('should handle invalid file timestamps');
    it('should process all files in directory');
  });

  describe('Count-Based Rotation', () => {
    it('should keep only max number of files');
    it('should delete oldest files first');
    it('should handle file count limits correctly');
    it('should preserve most recent files');
  });

  it('should handle rotation errors gracefully');
  it('should log rotation activities');
  it('should respect configuration settings');
});
```

#### 9. Error Handling Tests

```javascript
describe('Error Handling and Recovery', () => {
  it('should handle file system errors gracefully');
  it('should retry failed writes with backoff');
  it('should log errors appropriately');
  it('should continue processing after errors');
  it('should handle corrupted trace data');
  it('should handle invalid configuration');
  it('should recover from temporary failures');
  it('should implement circuit breaker pattern');
});
```

#### 10. Performance Tests

```javascript
describe('Performance Characteristics', () => {
  it('should handle high-frequency trace writes');
  it('should batch file operations efficiently');
  it('should limit memory usage');
  it('should process large traces efficiently');
  it('should handle 100+ traces per second');
  it('should not block on file I/O');
});
```

### Test Bed Requirements

Create `tests/common/actions/actionTraceOutputServiceTestBed.js`:

```javascript
export class ActionTraceOutputServiceTestBed {
  constructor() {
    this.mockFileSystem = this.createMockFileSystem();
    this.mockLogger = this.createMockLogger();
    this.mockActionTraceFilter = this.createMockActionTraceFilter();
    this.service = null;
    this.writtenFiles = new Map();
  }

  createMockFileSystem() {
    return {
      writeFile: jest.fn((path, content) => {
        this.writtenFiles.set(path, content);
        return Promise.resolve();
      }),
      mkdir: jest.fn(() => Promise.resolve()),
      readdir: jest.fn(() => Promise.resolve([])),
      stat: jest.fn(() => Promise.resolve({ mtime: new Date() })),
      unlink: jest.fn(() => Promise.resolve()),
      exists: jest.fn(() => Promise.resolve(false))
    };
  }

  createMockLogger() {
    return {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
  }

  createMockActionTraceFilter() {
    return {
      shouldTrace: jest.fn(() => true),
      getOutputDirectory: jest.fn(() => './traces/actions'),
      getVerbosityLevel: jest.fn(() => 'standard'),
      getInclusionConfig: jest.fn(() => ({
        componentData: true,
        prerequisites: true,
        targets: true
      }))
    };
  }

  createService() {
    this.service = new ActionTraceOutputService({
      fileSystem: this.mockFileSystem,
      logger: this.mockLogger,
      actionTraceFilter: this.mockActionTraceFilter
    });
    return this.service;
  }

  createMockTrace(type = 'execution') {
    if (type === 'execution') {
      return {
        actionId: 'core:go',
        actorId: 'player-1',
        toJSON: () => ({
          actionId: 'core:go',
          actorId: 'player-1',
          execution: {
            startTime: Date.now(),
            endTime: Date.now() + 100,
            duration: 100,
            result: 'success'
          }
        })
      };
    } else {
      return {
        getTracedActions: () => new Map([
          ['core:go', {
            actionId: 'core:go',
            actorId: 'player-1',
            stages: {
              component_filtering: { timestamp: Date.now(), data: {} },
              prerequisite_evaluation: { timestamp: Date.now(), data: {} }
            }
          }]
        ]),
        getSpans: () => []
      };
    }
  }

  async waitForQueueProcessing(timeout = 100) {
    return new Promise(resolve => setTimeout(resolve, timeout));
  }

  getWrittenFile(filename) {
    for (const [path, content] of this.writtenFiles) {
      if (path.includes(filename)) {
        return content;
      }
    }
    return null;
  }

  cleanup() {
    jest.clearAllMocks();
    this.writtenFiles.clear();
  }
}
```

### Sample Test Implementations

```javascript
describe('Queue Processing', () => {
  it('should process multiple traces in order', async () => {
    const service = testBed.createService();
    const trace1 = testBed.createMockTrace();
    const trace2 = testBed.createMockTrace();
    const trace3 = testBed.createMockTrace();

    await service.writeTrace(trace1);
    await service.writeTrace(trace2);
    await service.writeTrace(trace3);

    await testBed.waitForQueueProcessing();

    expect(testBed.mockFileSystem.writeFile).toHaveBeenCalledTimes(6); // 3 JSON + 3 text
    
    const calls = testBed.mockFileSystem.writeFile.mock.calls;
    expect(calls[0][0]).toContain('core-go');
    expect(calls[0][0]).toContain('.json');
  });

  it('should handle errors without stopping queue', async () => {
    const service = testBed.createService();
    
    testBed.mockFileSystem.writeFile
      .mockRejectedValueOnce(new Error('Write failed'))
      .mockResolvedValue();

    const trace1 = testBed.createMockTrace();
    const trace2 = testBed.createMockTrace();

    await service.writeTrace(trace1);
    await service.writeTrace(trace2);

    await testBed.waitForQueueProcessing();

    expect(testBed.mockLogger.error).toHaveBeenCalledWith(
      'Failed to write trace',
      expect.any(Error)
    );
    
    // Second trace should still be processed
    expect(testBed.mockFileSystem.writeFile).toHaveBeenCalledTimes(3);
  });
});
```

## Implementation Steps

1. **Create Test Bed** (45 minutes)
   - Implement comprehensive mock system
   - Add helper methods for common scenarios
   - Create mock trace generators

2. **Implement Basic Tests** (30 minutes)
   - Service initialization tests
   - Directory management tests
   - Basic file writing tests

3. **Implement Queue Tests** (45 minutes)
   - Async queue processing
   - Error handling in queue
   - Concurrent processing prevention

4. **Implement Format Tests** (45 minutes)
   - JSON formatting tests
   - Human-readable formatting tests
   - Verbosity level handling

5. **Implement Rotation Tests** (30 minutes)
   - Age-based rotation
   - Count-based rotation
   - Rotation error handling

6. **Implement Performance Tests** (15 minutes)
   - Throughput testing
   - Memory usage validation
   - Non-blocking verification

## Dependencies

### Depends On
- ACTTRA-024: Create ActionTraceOutputService class (must be completed first)
- ACTTRA-025: Implement async queue processing
- ACTTRA-028: Implement file rotation policies

### Blocks
- Integration testing that depends on output validation
- End-to-end testing of trace generation

## Test Data

### Sample Traces

```javascript
const executionTrace = {
  actionId: 'core:go',
  actorId: 'player-1',
  turnAction: {
    commandString: 'go north',
    actionDefinitionId: 'core:go',
    parameters: { direction: 'north' }
  },
  execution: {
    startTime: 1234567890000,
    endTime: 1234567890100,
    duration: 100,
    eventPayload: { /* ... */ },
    result: { success: true }
  }
};

const pipelineTrace = {
  actionId: 'core:take',
  actorId: 'player-1',
  stages: {
    component_filtering: {
      timestamp: 1234567890000,
      data: {
        actorComponents: ['core:inventory'],
        passed: true
      }
    },
    prerequisite_evaluation: {
      timestamp: 1234567890010,
      data: {
        prerequisites: [],
        passed: true
      }
    }
  }
};
```

## Documentation Requirements

- Update test coverage reports
- Document test bed usage patterns
- Add examples to developer guide
- Document mock system architecture

## Estimated Effort

- **Estimated Hours**: 3 hours
- **Complexity**: Low to Medium
- **Risk**: Low

## Success Metrics

- [ ] All tests pass consistently
- [ ] Code coverage meets requirements (80%+ branches, 90%+ lines)
- [ ] No flaky tests with async operations
- [ ] Clear test organization and naming
- [ ] Comprehensive error scenario coverage
- [ ] Performance tests validate requirements

## Notes

- Pay special attention to async queue testing
- Ensure proper cleanup in afterEach hooks
- Mock file system operations thoroughly
- Test both success and failure paths
- Consider edge cases with file system limits
- Validate memory management in queue processing

## Related Files

- Source: `src/actions/tracing/actionTraceOutputService.js`
- Test: `tests/unit/actions/tracing/actionTraceOutputService.unit.test.js`
- Test Bed: `tests/common/actions/actionTraceOutputServiceTestBed.js`
- Similar Tests: `tests/unit/services/fileSystemService.unit.test.js`

---

**Ticket Status**: Ready for Development
**Priority**: High (Phase 5 - Testing)
**Labels**: testing, unit-test, action-tracing, phase-5, async, file-io