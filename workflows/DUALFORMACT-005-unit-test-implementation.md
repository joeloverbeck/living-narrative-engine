# DUALFORMACT-005: Unit Test Implementation

**Status**: Not Started  
**Priority**: P0 - Critical  
**Phase**: 3 - Testing & Validation  
**Component**: Test Infrastructure  
**Estimated**: 6 hours

## Description

Implement comprehensive unit tests for all dual-format action tracing components. This ensures the new multi-format functionality works correctly, maintains backward compatibility, and provides regression protection for future changes.

## Technical Requirements

### 1. Configuration Loader Tests

Create comprehensive tests for enhanced configuration loader:

```javascript
// tests/unit/configuration/actionTraceConfigLoader.dualFormat.test.js
import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionTraceConfigLoader } from '../../../src/configuration/actionTraceConfigLoader.js';
import { createTestBed } from '../../common/testBed.js';

describe('ActionTraceConfigLoader - Dual Format Support', () => {
  let testBed;
  let configLoader;

  beforeEach(() => {
    testBed = createTestBed();
    configLoader = new ActionTraceConfigLoader({
      logger: testBed.createMockLogger(),
      validator: testBed.createMockValidator(),
    });
  });

  describe('Configuration Normalization', () => {
    it('should default to JSON-only when outputFormats not specified', () => {
      const config = { actionTracing: { enabled: true } };
      const result = configLoader.loadConfig(config);

      expect(result.actionTracing.outputFormats).toEqual(['json']);
    });

    it('should preserve valid output formats', () => {
      const config = {
        actionTracing: {
          enabled: true,
          outputFormats: ['json', 'text'],
        },
      };
      const result = configLoader.loadConfig(config);

      expect(result.actionTracing.outputFormats).toEqual(['json', 'text']);
    });

    it('should filter out invalid formats and warn', () => {
      const config = {
        actionTracing: {
          enabled: true,
          outputFormats: ['json', 'invalid', 'text', 'unsupported'],
        },
      };
      const result = configLoader.loadConfig(config);

      expect(result.actionTracing.outputFormats).toEqual(['json', 'text']);
    });

    it('should default to JSON-only when all formats invalid', () => {
      const config = {
        actionTracing: {
          enabled: true,
          outputFormats: ['invalid', 'unsupported'],
        },
      };
      const result = configLoader.loadConfig(config);

      expect(result.actionTracing.outputFormats).toEqual(['json']);
    });

    it('should normalize text format options when text format enabled', () => {
      const config = {
        actionTracing: {
          enabled: true,
          outputFormats: ['text'],
          textFormatOptions: {
            lineWidth: 100,
          },
        },
      };
      const result = configLoader.loadConfig(config);

      expect(result.actionTracing.textFormatOptions).toEqual({
        enableColors: false,
        lineWidth: 100,
        indentSize: 2,
        sectionSeparator: '=',
        includeTimestamps: true,
        performanceSummary: true,
      });
    });

    it('should force enableColors to false for file output', () => {
      const config = {
        actionTracing: {
          enabled: true,
          outputFormats: ['text'],
          textFormatOptions: {
            enableColors: true, // This should be overridden
          },
        },
      };
      const result = configLoader.loadConfig(config);

      expect(result.actionTracing.textFormatOptions.enableColors).toBe(
        false
      );
    });
  });

  describe('Configuration Validation', () => {
    it('should validate line width constraints', () => {
      const config = {
        actionTracing: {
          enabled: true,
          outputFormats: ['text'],
          textFormatOptions: {
            lineWidth: 300, // Too large
          },
        },
      };

      expect(() => configLoader.loadConfig(config)).toThrow(/lineWidth must be between 80 and 200/);
    });

    it('should validate indent size constraints', () => {
      const config = {
        actionTracing: {
          enabled: true,
          outputFormats: ['text'],
          textFormatOptions: {
            indentSize: 10, // Too large
          },
        },
      };

      expect(() => configLoader.loadConfig(config)).toThrow(/indentSize must be between 0 and 8/);
    });

    it('should validate section separator is single character', () => {
      const config = {
        actionTracing: {
          enabled: true,
          outputFormats: ['text'],
          textFormatOptions: {
            sectionSeparator: 'too-long',
          },
        },
      };

      expect(() => configLoader.loadConfig(config)).toThrow(/sectionSeparator must be a single character/);
    });
  });
});
```

### 2. ActionTraceOutputService Tests

Create tests for multi-format output generation:

```javascript
// tests/unit/actions/tracing/actionTraceOutputService.multiFormat.test.js
describe('ActionTraceOutputService - Multi-Format Support', () => {
  let testBed;
  let outputService;
  let mockFileOutputHandler;
  let mockJsonFormatter;
  let mockHumanReadableFormatter;

  beforeEach(() => {
    testBed = createTestBed();
    mockFileOutputHandler = testBed.createMock('fileOutputHandler', ['writeBatch']);
    mockJsonFormatter = testBed.createMock('jsonFormatter', ['format']);
    mockHumanReadableFormatter = testBed.createMock('humanReadableFormatter', ['format']);

    outputService = new ActionTraceOutputService({
      fileOutputHandler: mockFileOutputHandler,
      jsonFormatter: mockJsonFormatter,
      humanReadableFormatter: mockHumanReadableFormatter,
      logger: testBed.createMockLogger(),
    });
  });

  describe('Format Generation', () => {
    it('should generate JSON-only output for default configuration', () => {
      const config = { outputFormats: ['json'], outputToFile: true };
      const trace = testBed.createMockTrace();

      mockJsonFormatter.format.mockReturnValue('{"test": "json"}');
      outputService.initialize(config);

      const result = outputService.outputTrace(trace);

      expect(mockFileOutputHandler.writeBatch).toHaveBeenCalledWith([{
        content: '{"test": "json"}',
        fileName: expect.stringMatching(/\.json$/),
      }]);
    });

    it('should generate dual-format output when both formats configured', () => {
      const config = {
        outputFormats: ['json', 'text'],
        outputToFile: true,
        textFormatOptions: { lineWidth: 120 },
      };
      const trace = testBed.createMockTrace();

      mockJsonFormatter.format.mockReturnValue('{"test": "json"}');
      mockHumanReadableFormatter.format.mockReturnValue('=== Test Trace ===');
      outputService.initialize(config);

      const result = outputService.outputTrace(trace);

      expect(mockFileOutputHandler.writeBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ fileName: expect.stringMatching(/\.json$/) }),
          expect.objectContaining({ fileName: expect.stringMatching(/\.txt$/) }),
        ])
      );
      expect(mockHumanReadableFormatter.format).toHaveBeenCalledWith(
        trace,
        expect.objectContaining({
          enableColors: false,
          lineWidth: 120,
        })
      );
    });

    it('should handle formatter errors gracefully', () => {
      const config = { outputFormats: ['json', 'text'], outputToFile: true };
      const trace = testBed.createMockTrace();

      mockJsonFormatter.format.mockReturnValue('{"test": "json"}');
      mockHumanReadableFormatter.format.mockImplementation(() => {
        throw new Error('Formatting failed');
      });
      outputService.initialize(config);

      const result = outputService.outputTrace(trace);

      // Should still attempt to write JSON output despite text formatting failure
      expect(mockFileOutputHandler.writeBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ fileName: expect.stringMatching(/\.json$/) }),
        ])
      );
    });
  });

  describe('File Name Generation', () => {
    it('should generate appropriate extensions for different formats', () => {
      const trace = testBed.createMockTrace({
        actionId: 'test_action',
        actorId: 'test_actor',
      });
      const config = { outputFormats: ['json', 'text'], outputToFile: true };
      
      mockJsonFormatter.format.mockReturnValue('{"test": "json"}');
      mockHumanReadableFormatter.format.mockReturnValue('=== Test Trace ===');
      outputService.initialize(config);

      outputService.outputTrace(trace);

      expect(mockFileOutputHandler.writeBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ fileName: expect.stringMatching(/\.json$/) }),
          expect.objectContaining({ fileName: expect.stringMatching(/\.txt$/) }),
        ])
      );
    });
  });

  describe('Configuration Validation', () => {
    it('should log warnings for unsupported formats', () => {
      const mockLogger = testBed.createMockLogger();
      const config = { outputFormats: ['json', 'html', 'unsupported'] };

      outputService = new ActionTraceOutputService({
        fileOutputHandler: mockFileOutputHandler,
        jsonFormatter: mockJsonFormatter,
        humanReadableFormatter: mockHumanReadableFormatter,
        logger: mockLogger,
      });

      outputService.initialize(config);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Unsupported output formats configured',
        expect.objectContaining({
          unsupportedFormats: ['html', 'unsupported'],
        })
      );
    });
  });
});
```

### 3. FileTraceOutputHandler Tests

Create tests for multi-format file writing:

```javascript
// tests/unit/actions/tracing/fileTraceOutputHandler.multiFormat.test.js
describe('FileTraceOutputHandler - Multi-Format Support', () => {
  let testBed;
  let handler;
  let mockFetch;

  beforeEach(() => {
    testBed = createTestBed();
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    handler = new FileTraceOutputHandler({
      config: { outputDirectory: './test-traces' },
      serverUrl: 'http://localhost:3001',
      logger: testBed.createMockLogger(),
    });
  });

  describe('Multi-Format Writing', () => {
    it('should write multiple formatted traces in parallel', async () => {
      const formattedTraces = [
        { content: '{"test": "json"}', fileName: 'test.json' },
        { content: '=== Test Trace ===', fileName: 'test.txt' },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ success: true, filePath: '/path/to/file' }),
      });

      const result = await handler.writeBatch(formattedTraces);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/traces/write',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test.json'),
        })
      );
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/traces/write',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test.txt'),
        })
      );
    });

    it('should handle partial failures gracefully', async () => {
      const formattedTraces = [
        { content: '{"test": "json"}', fileName: 'test.json' },
        { content: '=== Test Trace ===', fileName: 'test.txt' },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await handler.writeBatch(formattedTraces);

      // Should succeed if at least one format writes successfully
      expect(result).toBe(true);
    });

    it('should return false if all writes fail', async () => {
      const formattedTraces = [
        { content: '{"test": "json"}', fileName: 'test.json' },
      ];

      mockFetch.mockRejectedValue(new Error('Server down'));

      const result = await handler.writeBatch(formattedTraces);

      expect(result).toBe(false);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing writeTrace interface', async () => {
      const trace = testBed.createMockTrace();

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await handler.writeTrace(trace);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should retry failed writes with exponential backoff', async () => {
      const formattedTraces = [
        { content: '{"test": "json"}', fileName: 'test.json' },
      ];

      mockFetch
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Still failing'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      const result = await handler.writeBatch(formattedTraces);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 10000); // Longer timeout for retry delays

    it('should validate input parameters', async () => {
      await expect(handler.writeBatch(null)).resolves.toBe(false);
      await expect(handler.writeBatch([])).resolves.toBe(false);
    });
  });
});
```

## Implementation Steps

1. **Set Up Test Infrastructure**
   - [ ] Update existing test bed to support dual-format components
   - [ ] Set up mock factories using existing mock patterns
   - [ ] Create sample trace data for testing
   - [ ] Set up fetch mocking utilities with current patterns

2. **Implement Configuration Loader Tests**
   - [ ] Test configuration normalization logic
   - [ ] Test validation constraints and error handling
   - [ ] Test backward compatibility scenarios
   - [ ] Test edge cases and malformed configurations

3. **Implement ActionTraceOutputService Tests**
   - [ ] Test multi-format output generation
   - [ ] Test formatter integration and error handling
   - [ ] Test configuration validation and warnings
   - [ ] Test file name generation for different formats

4. **Implement FileTraceOutputHandler Tests**
   - [ ] Test multi-format writing with parallel requests
   - [ ] Test error handling and partial failures
   - [ ] Test retry logic and resilience
   - [ ] Test backward compatibility with existing interface

5. **Create Integration Test Helpers**
   - [ ] Mock HTTP server responses
   - [ ] Create realistic trace data generators
   - [ ] Set up test configuration examples
   - [ ] Add performance measurement helpers

6. **Add Edge Case and Error Testing**
   - [ ] Test with large trace content
   - [ ] Test with special characters in file names
   - [ ] Test network timeout scenarios
   - [ ] Test server error responses

## Acceptance Criteria

- [ ] All new functionality has comprehensive unit test coverage
- [ ] Existing functionality maintains 100% backward compatibility
- [ ] Error scenarios are properly tested and handled
- [ ] Mock factories provide consistent test data
- [ ] Test execution is fast (<5 seconds total)
- [ ] Tests are deterministic and don't rely on external services
- [ ] Code coverage remains above 80% for all modified files
- [ ] Tests validate both success and failure paths
- [ ] Configuration edge cases are thoroughly tested
- [ ] Performance impact is validated through tests

## Dependencies

- **Depends On**: DUALFORMACT-003 (ActionTraceOutputService Enhancement)
- **Depends On**: DUALFORMACT-004 (FileTraceOutputHandler Updates)
- **Required By**: DUALFORMACT-006 (Integration Test Suite)

## Testing Requirements

1. **Test Coverage Targets**
   - [ ] Configuration loader: >90% branch coverage
   - [ ] Output service: >90% branch coverage
   - [ ] File handler: >90% branch coverage
   - [ ] All error paths covered

2. **Performance Testing**
   - [ ] Test execution time <5 seconds
   - [ ] Memory usage remains stable
   - [ ] No test isolation issues

3. **Reliability Testing**
   - [ ] Tests pass consistently (100 consecutive runs)
   - [ ] No flaky tests due to timing or external dependencies
   - [ ] Proper test cleanup prevents interference

## Files to Create/Modify

- **New**: `tests/unit/configuration/actionTraceConfigLoader.dualFormat.test.js`
- **New**: `tests/unit/actions/tracing/actionTraceOutputService.multiFormat.test.js`
- **New**: `tests/unit/actions/tracing/fileTraceOutputHandler.multiFormat.test.js`
- **Modify**: `tests/common/testBed.js` (add dual-format helpers)
- **Modify**: `tests/common/mockFactories/tracingMocks.js` (add new mocks using existing patterns)

## Test Helper Enhancements

```javascript
// tests/common/testBed.js additions
export function createTestBed() {
  const testBed = {
    createMockDualFormatConfig() {
      return {
        outputFormats: ['json', 'text'],
        textFormatOptions: {
          enableColors: false,
          lineWidth: 120,
          indentSize: 2,
          sectionSeparator: '=',
          includeTimestamps: true,
          performanceSummary: true,
        },
      };
    },

    createFormattedTraceArray() {
      return [
        { content: '{"test": "json"}', fileName: 'test.json' },
        { content: '=== Test Trace ===', fileName: 'test.txt' },
      ];
    },

    createMock(name, methods) {
      const mock = {};
      methods.forEach(method => {
        mock[method] = jest.fn();
      });
      return mock;
    },

    createMockLogger() {
      return {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
    },

    createMockValidator() {
      return {
        validate: jest.fn(),
        validateSchema: jest.fn(),
      };
    },

    createMockTrace(overrides = {}) {
      return {
        id: 'test-trace-123',
        actionId: 'test_action',
        actorId: 'test_actor',
        timestamp: new Date().toISOString(),
        data: { test: 'data' },
        ...overrides,
      };
    },
  };

  return testBed;
}
```

## Mock Factory Extensions

```javascript
// tests/common/mockFactories/tracingMocks.js additions
export const createMockFileTraceOutputHandler = () => ({
  writeBatch: jest.fn(),
  writeTrace: jest.fn(),
  isReady: jest.fn().mockReturnValue(true),
});

export const createMockJsonFormatter = () => ({
  format: jest.fn().mockReturnValue('{"mock": "json"}'),
});

export const createMockHumanReadableFormatter = () => ({
  format: jest.fn().mockReturnValue('=== Mock Trace ==='),
});
```

## Performance Test Examples

```javascript
describe('Performance Impact', () => {
  it('should have minimal overhead for dual-format generation', () => {
    const startTime = performance.now();

    // Run dual-format generation
    const result = outputService.outputTrace(trace);

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(10); // <10ms per spec requirement
    expect(result).toBeDefined();
  });
});
```

## Risk Mitigation

1. **Test Isolation**
   - Each test cleans up after itself
   - No shared state between tests
   - Mock all external dependencies

2. **Deterministic Testing**
   - Fixed timestamps and IDs for reproducible results
   - No random data in assertions
   - Proper async/await handling

3. **Comprehensive Coverage**
   - Test both success and failure scenarios
   - Cover all configuration combinations
   - Validate error messages and logging

## Notes

- Critical for ensuring dual-format functionality works correctly
- Must maintain 100% backward compatibility
- Performance impact should be validated through tests
- Error handling is particularly important for file operations
- Mock factories should provide consistent, realistic test data

## Related Tickets

- **Depends On**: DUALFORMACT-003, DUALFORMACT-004 (Core Implementation)
- **Blocks**: DUALFORMACT-006 (Integration Test Suite)
- **Supports**: DUALFORMACT-009 (Performance Validation Testing)
