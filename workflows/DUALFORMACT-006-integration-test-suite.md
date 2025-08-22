# DUALFORMACT-006: Integration Test Suite

**Status**: Not Started  
**Priority**: P0 - Critical  
**Phase**: 3 - Testing & Validation  
**Component**: Integration Testing  
**Estimated**: 8 hours

## Description

Create comprehensive integration tests that validate end-to-end dual-format action tracing functionality. These tests ensure all components work together correctly, files are actually written to the filesystem, and the complete workflow functions as expected in realistic scenarios.

## Technical Requirements

### 1. End-to-End Dual-Format Integration Test

Create comprehensive test that validates the complete dual-format workflow:

```javascript
// tests/integration/actions/tracing/dualFormatActionTracing.test.js
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { TestBedClass } from '../../common/testbed.js';

describe('Dual-Format Action Tracing Integration', () => {
  let testBed;
  let tempDirectory;
  let actionTraceOutputService;
  let mockLlmProxyServer;

  beforeEach(async () => {
    testBed = new TestBedClass();
    tempDirectory = await testBed.createTempDirectory('dual-format-traces');
    mockLlmProxyServer = await testBed.startMockLlmProxyServer();

    const config = {
      enabled: true,
      tracedActions: ['test:dual_format_action'],
      outputDirectory: tempDirectory,
      outputToFile: true,
      outputToConsole: false,
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

    actionTraceOutputService = await testBed.createActionTraceOutputService({
      config,
      serverUrl: mockLlmProxyServer.url,
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
    await mockLlmProxyServer.stop();
  });

  it('should write both JSON and text files to filesystem', async () => {
    // Arrange
    const trace = testBed.createMockTrace({
      actionId: 'test:dual_format_action',
      actorId: 'integration_test_actor',
      timestamp: '2025-08-22T14:30:22.123Z',
      components: {
        position: { x: 10, y: 20 },
        health: { current: 100, max: 100 },
      },
      prerequisites: [
        { type: 'component', id: 'core:position', satisfied: true },
        { type: 'state', condition: 'health > 50', satisfied: true },
      ],
      targets: [{ entityId: 'target_entity', components: ['core:health'] }],
    });

    // Act
    await actionTraceOutputService.outputTrace(trace);

    // Assert
    const files = await fs.readdir(tempDirectory);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));
    const textFiles = files.filter((f) => f.endsWith('.txt'));

    expect(jsonFiles).toHaveLength(1);
    expect(textFiles).toHaveLength(1);

    // Verify file names match expected pattern
    const baseNameRegex =
      /trace_test_dual_format_action_integration_test_actor_\d{8}_\d{6}/;
    expect(jsonFiles[0]).toMatch(new RegExp(baseNameRegex.source + '\\.json$'));
    expect(textFiles[0]).toMatch(new RegExp(baseNameRegex.source + '\\.txt$'));

    // Verify JSON file content
    const jsonContent = await fs.readFile(
      path.join(tempDirectory, jsonFiles[0]),
      'utf-8'
    );
    const parsedJson = JSON.parse(jsonContent);
    expect(parsedJson.actionId).toBe('test:dual_format_action');
    expect(parsedJson.actorId).toBe('integration_test_actor');
    expect(parsedJson.components).toEqual(trace.components);

    // Verify text file content structure
    const textContent = await fs.readFile(
      path.join(tempDirectory, textFiles[0]),
      'utf-8'
    );
    expect(textContent).toContain('=== Action Trace Report ===');
    expect(textContent).toContain('Action: test:dual_format_action');
    expect(textContent).toContain('Actor: integration_test_actor');
    expect(textContent).toContain('Prerequisites:');
    expect(textContent).toContain('Targets:');
    expect(textContent).toContain('Components:');
    expect(textContent).toContain('Performance Summary:');

    // Verify no ANSI color codes in text file
    expect(textContent).not.toMatch(/\x1b\[[0-9;]*m/);
  });

  it('should maintain backward compatibility with JSON-only configuration', async () => {
    // Arrange - reconfigure for JSON-only
    const jsonOnlyConfig = {
      enabled: true,
      tracedActions: ['test:json_only_action'],
      outputDirectory: tempDirectory,
      outputToFile: true,
      outputToConsole: false,
      // No outputFormats specified - should default to JSON-only
    };

    const jsonOnlyService = await testBed.createActionTraceOutputService({
      config: jsonOnlyConfig,
      serverUrl: mockLlmProxyServer.url,
    });

    const trace = testBed.createMockTrace({
      actionId: 'test:json_only_action',
      actorId: 'backward_compatibility_test',
    });

    // Act
    await jsonOnlyService.outputTrace(trace);

    // Assert
    const files = await fs.readdir(tempDirectory);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));
    const textFiles = files.filter((f) => f.endsWith('.txt'));

    expect(jsonFiles).toHaveLength(1);
    expect(textFiles).toHaveLength(0); // No text files for JSON-only config

    // Verify JSON content is valid
    const jsonContent = await fs.readFile(
      path.join(tempDirectory, jsonFiles[0]),
      'utf-8'
    );
    const parsedJson = JSON.parse(jsonContent);
    expect(parsedJson.actionId).toBe('test:json_only_action');
  });

  it('should handle text-only configuration', async () => {
    // Arrange - configure for text-only
    const textOnlyConfig = {
      enabled: true,
      tracedActions: ['test:text_only_action'],
      outputDirectory: tempDirectory,
      outputToFile: true,
      outputToConsole: false,
      outputFormats: ['text'],
      textFormatOptions: {
        lineWidth: 100,
        indentSize: 4,
        sectionSeparator: '-',
      },
    };

    const textOnlyService = await testBed.createActionTraceOutputService({
      config: textOnlyConfig,
      serverUrl: mockLlmProxyServer.url,
    });

    const trace = testBed.createMockTrace({
      actionId: 'test:text_only_action',
      actorId: 'text_only_test',
    });

    // Act
    await textOnlyService.outputTrace(trace);

    // Assert
    const files = await fs.readdir(tempDirectory);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));
    const textFiles = files.filter((f) => f.endsWith('.txt'));

    expect(jsonFiles).toHaveLength(0); // No JSON files for text-only config
    expect(textFiles).toHaveLength(1);

    // Verify text formatting options were applied
    const textContent = await fs.readFile(
      path.join(tempDirectory, textFiles[0]),
      'utf-8'
    );
    expect(textContent).toContain('--- Action Trace Report ---'); // Custom separator
    expect(textContent.split('\n')).toEqual(
      expect.arrayContaining([
        expect.not.stringMatching(/.{101,}/), // No lines longer than 100 chars
      ])
    );
  });
});
```

### 2. Server Integration Tests

Test integration with the actual LLM proxy server:

```javascript
// tests/integration/actions/tracing/serverEndpointIntegration.test.js
describe('Server Endpoint Integration', () => {
  let testServer;
  let testDirectory;

  beforeEach(async () => {
    testDirectory = await createTempDirectory('server-integration-traces');
    testServer = await startTestLlmProxyServer({
      port: 0, // Use random available port
      traceOutputDirectory: testDirectory,
    });
  });

  afterEach(async () => {
    await testServer.stop();
    await cleanupTempDirectory(testDirectory);
  });

  it('should successfully write multiple formats via server endpoint', async () => {
    const fileHandler = new FileTraceOutputHandler({
      config: { outputDirectory: './traces' },
      serverUrl: testServer.url,
      logger: createMockLogger(),
    });

    const formattedTraces = [
      {
        content: JSON.stringify(
          { test: 'json', timestamp: Date.now() },
          null,
          2
        ),
        fileName: 'integration_test.json',
      },
      {
        content:
          '=== Integration Test Trace ===\nTest: successful\nTimestamp: ' +
          Date.now(),
        fileName: 'integration_test.txt',
      },
    ];

    const result = await fileHandler.writeFormattedTraces(formattedTraces);

    expect(result).toBe(true);

    // Verify files were actually written by the server
    const files = await fs.readdir(testDirectory);
    expect(files).toContain('integration_test.json');
    expect(files).toContain('integration_test.txt');

    // Verify file contents
    const jsonContent = await fs.readFile(
      path.join(testDirectory, 'integration_test.json'),
      'utf-8'
    );
    const textContent = await fs.readFile(
      path.join(testDirectory, 'integration_test.txt'),
      'utf-8'
    );

    expect(JSON.parse(jsonContent)).toEqual(
      expect.objectContaining({ test: 'json' })
    );
    expect(textContent).toContain('=== Integration Test Trace ===');
  });

  it('should handle server errors gracefully', async () => {
    // Stop server to simulate downtime
    await testServer.stop();

    const fileHandler = new FileTraceOutputHandler({
      config: { outputDirectory: './traces' },
      serverUrl: testServer.url,
      logger: createMockLogger(),
    });

    const formattedTraces = [
      { content: '{"test": "json"}', fileName: 'error_test.json' },
    ];

    const result = await fileHandler.writeFormattedTraces(formattedTraces);

    expect(result).toBe(false);
  });

  it('should retry failed requests with exponential backoff', async () => {
    let requestCount = 0;
    const flakyServer = await startFlakyTestServer({
      port: 0,
      failureRate: 0.67, // Fail 2/3 of requests
      onRequest: () => {
        requestCount++;
      },
    });

    const fileHandler = new FileTraceOutputHandler({
      config: { outputDirectory: './traces' },
      serverUrl: flakyServer.url,
      logger: createMockLogger(),
    });

    const formattedTraces = [
      { content: '{"test": "retry"}', fileName: 'retry_test.json' },
    ];

    const startTime = Date.now();
    const result = await fileHandler.writeFormattedTraces(formattedTraces);
    const endTime = Date.now();

    expect(result).toBe(true); // Should eventually succeed
    expect(requestCount).toBeGreaterThan(1); // Should have retried
    expect(endTime - startTime).toBeGreaterThan(1000); // Should have backoff delay

    await flakyServer.stop();
  }, 15000); // Longer timeout for retry logic
});
```

### 3. Configuration Integration Tests

Test configuration loading and validation in realistic scenarios:

```javascript
// tests/integration/configuration/dualFormatConfigIntegration.test.js
describe('Dual-Format Configuration Integration', () => {
  let tempConfigDir;
  let configLoader;

  beforeEach(async () => {
    tempConfigDir = await createTempDirectory('config-integration');
    configLoader = new ActionTraceConfigLoader({ logger: createMockLogger() });
  });

  afterEach(async () => {
    await cleanupTempDirectory(tempConfigDir);
  });

  it('should load and validate complete dual-format configuration', async () => {
    // Create realistic configuration file
    const configContent = {
      actionTracing: {
        enabled: true,
        tracedActions: ['intimacy:fondle_ass', 'core:move'],
        outputDirectory: './traces/integration',
        verbosity: 'verbose',
        includeComponentData: true,
        includePrerequisites: true,
        includeTargets: true,
        maxTraceFiles: 100,
        rotationPolicy: 'age',
        maxFileAge: 86400,
        outputFormats: ['json', 'text'],
        textFormatOptions: {
          enableColors: false,
          lineWidth: 120,
          indentSize: 2,
          sectionSeparator: '=',
          includeTimestamps: true,
          performanceSummary: true,
        },
      },
    };

    const configPath = path.join(tempConfigDir, 'trace-config.json');
    await fs.writeFile(configPath, JSON.stringify(configContent, null, 2));

    const loadedConfig = await configLoader.loadActionTraceConfig(configPath);

    expect(loadedConfig.actionTracing.outputFormats).toEqual(['json', 'text']);
    expect(loadedConfig.actionTracing.textFormatOptions).toEqual(
      expect.objectContaining({
        enableColors: false,
        lineWidth: 120,
        indentSize: 2,
      })
    );
  });

  it('should handle malformed configuration gracefully', async () => {
    const malformedConfig = {
      actionTracing: {
        enabled: true,
        outputFormats: ['json', 'invalid_format', 'text', 'unsupported'],
        textFormatOptions: {
          lineWidth: 500, // Invalid - too large
          indentSize: -1, // Invalid - negative
          sectionSeparator: 'too-long', // Invalid - too long
        },
      },
    };

    const configPath = path.join(tempConfigDir, 'malformed-config.json');
    await fs.writeFile(configPath, JSON.stringify(malformedConfig, null, 2));

    await expect(
      configLoader.loadActionTraceConfig(configPath)
    ).rejects.toThrow(/Configuration loading failed/);
  });

  it('should normalize partial configuration with defaults', async () => {
    const partialConfig = {
      actionTracing: {
        enabled: true,
        tracedActions: ['core:test'],
        outputFormats: ['text'],
        // Missing textFormatOptions - should get defaults
      },
    };

    const configPath = path.join(tempConfigDir, 'partial-config.json');
    await fs.writeFile(configPath, JSON.stringify(partialConfig, null, 2));

    const loadedConfig = await configLoader.loadActionTraceConfig(configPath);

    expect(loadedConfig.actionTracing.textFormatOptions).toEqual({
      enableColors: false,
      lineWidth: 120,
      indentSize: 2,
      sectionSeparator: '=',
      includeTimestamps: true,
      performanceSummary: true,
    });
  });
});
```

## Implementation Steps

1. **Set Up Integration Test Infrastructure**
   - [ ] Create temp directory management utilities
   - [ ] Set up mock LLM proxy server for testing
   - [ ] Create test configuration file generators
   - [ ] Add cleanup utilities for test isolation

2. **Implement End-to-End Tests**
   - [ ] Create dual-format file writing test
   - [ ] Test backward compatibility with JSON-only
   - [ ] Test text-only configuration
   - [ ] Verify actual file system operations

3. **Implement Server Integration Tests**
   - [ ] Test real HTTP communication with server
   - [ ] Test error handling and resilience
   - [ ] Test retry logic with flaky server simulation
   - [ ] Validate server endpoint compliance

4. **Implement Configuration Integration Tests**
   - [ ] Test realistic configuration loading scenarios
   - [ ] Test malformed configuration handling
   - [ ] Test partial configuration normalization
   - [ ] Test schema validation integration

5. **Add Performance and Load Testing**
   - [ ] Test with high-frequency action execution
   - [ ] Test with large trace content
   - [ ] Validate memory usage during integration tests
   - [ ] Test concurrent trace writing

6. **Create Test Utilities and Helpers**
   - [ ] Mock server implementations (stable and flaky)
   - [ ] Trace data generators with realistic content
   - [ ] File system assertion helpers
   - [ ] Configuration file template generators

## Acceptance Criteria

- [ ] End-to-end dual-format trace writing works correctly
- [ ] Both JSON and text files are written to filesystem
- [ ] File content matches expected format and structure
- [ ] Backward compatibility maintained for JSON-only configs
- [ ] Text-only configuration works correctly
- [ ] Server integration handles success and failure scenarios
- [ ] Configuration loading works with realistic config files
- [ ] Error handling provides meaningful feedback
- [ ] Performance meets specification requirements (<10ms overhead)
- [ ] Tests are reliable and deterministic
- [ ] Test cleanup prevents interference between tests
- [ ] Integration with actual LLM proxy server works

## Dependencies

- **Depends On**: DUALFORMACT-005 (Unit Test Implementation)
- **Required By**: DUALFORMACT-009 (Performance Validation Testing)
- **Required By**: DUALFORMACT-010 (Migration and Backward Compatibility Validation)

## Testing Requirements

1. **Test Environment Setup**
   - [ ] Isolated temp directories for each test
   - [ ] Mock server instances with proper cleanup
   - [ ] Realistic configuration scenarios
   - [ ] File system permission handling

2. **Test Data Requirements**
   - [ ] Comprehensive trace objects with all components
   - [ ] Various configuration combinations
   - [ ] Edge cases and boundary conditions
   - [ ] Realistic action and entity names

3. **Performance and Reliability**
   - [ ] Tests complete within reasonable time (<30 seconds)
   - [ ] No test flakiness or race conditions
   - [ ] Proper async/await handling
   - [ ] Memory leaks prevented through cleanup

## Files to Create

- **New**: `tests/integration/actions/tracing/dualFormatActionTracing.test.js`
- **New**: `tests/integration/actions/tracing/serverEndpointIntegration.test.js`
- **New**: `tests/integration/configuration/dualFormatConfigIntegration.test.js`
- **New**: `tests/integration/common/testServerUtils.js`
- **New**: `tests/integration/common/tempDirectoryUtils.js`

## Test Server Utilities

```javascript
// tests/integration/common/testServerUtils.js
import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';

export async function startTestLlmProxyServer({
  port = 0,
  traceOutputDirectory,
}) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.post('/api/traces/write', async (req, res) => {
    try {
      const { traceData, fileName, outputDirectory } = req.body;
      const filePath = path.join(traceOutputDirectory, fileName);

      await fs.writeFile(filePath, traceData, 'utf-8');

      res.json({
        success: true,
        filePath,
        size: traceData.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  const server = app.listen(port);
  const actualPort = server.address().port;

  return {
    url: `http://localhost:${actualPort}`,
    port: actualPort,
    stop: () => new Promise((resolve) => server.close(resolve)),
  };
}

export async function startFlakyTestServer({
  port = 0,
  failureRate = 0.5,
  onRequest,
}) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.post('/api/traces/write', async (req, res) => {
    if (onRequest) onRequest();

    if (Math.random() < failureRate) {
      res.status(500).json({ success: false, error: 'Simulated failure' });
      return;
    }

    res.json({ success: true, filePath: '/mock/path', size: 100 });
  });

  const server = app.listen(port);
  const actualPort = server.address().port;

  return {
    url: `http://localhost:${actualPort}`,
    port: actualPort,
    stop: () => new Promise((resolve) => server.close(resolve)),
  };
}
```

## Temp Directory Management

```javascript
// tests/integration/common/tempDirectoryUtils.js
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

export async function createTempDirectory(prefix = 'test') {
  const tempDir = path.join(
    tmpdir(),
    `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

export async function cleanupTempDirectory(directory) {
  try {
    await fs.rm(directory, { recursive: true, force: true });
  } catch (error) {
    console.warn(
      `Failed to cleanup temp directory ${directory}:`,
      error.message
    );
  }
}
```

## Risk Mitigation

1. **Test Isolation**
   - Each test uses unique temp directories
   - Mock servers use random ports
   - Proper cleanup prevents test interference

2. **File System Operations**
   - Handle permission errors gracefully
   - Clean up test files even on failure
   - Validate file content thoroughly

3. **Network Operations**
   - Mock server handles concurrent requests
   - Timeout handling for network operations
   - Graceful degradation on server failures

## Notes

- Critical for validating end-to-end dual-format functionality
- Tests actual file system operations, not just mocks
- Validates integration with real server endpoints
- Ensures configuration loading works in practice
- Foundation for performance and migration validation

## Related Tickets

- **Depends On**: DUALFORMACT-005 (Unit Test Implementation)
- **Blocks**: DUALFORMACT-009 (Performance Validation Testing)
- **Blocks**: DUALFORMACT-010 (Migration and Backward Compatibility Validation)
- **Supports**: All DUALFORMACT tickets with integration validation
