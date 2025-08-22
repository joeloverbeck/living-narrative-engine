# DUALFORMACT-004: FileTraceOutputHandler Updates

**Status**: Not Started  
**Priority**: P0 - Critical  
**Phase**: 2 - Core Implementation  
**Component**: Action Tracing System  
**Estimated**: 4 hours

## Description

Update the `FileTraceOutputHandler` to handle pre-formatted content arrays from the ActionTraceOutputService. This implements the Option B approach where the handler receives multiple formatted outputs and writes them in parallel to the server endpoint.

## Technical Requirements

### 1. New Multi-Format Write Method

Add method to handle pre-formatted content array:

```javascript
/**
 * Write multiple formatted traces using server endpoint
 * @param {Array<{content: string, fileName: string}>} formattedTraces - Pre-formatted traces from service
 * @returns {Promise<boolean>} Success status
 */
async writeFormattedTraces(formattedTraces) {
  if (!Array.isArray(formattedTraces) || formattedTraces.length === 0) {
    this.#logger.error('writeFormattedTraces requires non-empty array');
    return false;
  }

  this.#logger.debug('Writing formatted traces', {
    formatCount: formattedTraces.length,
    fileNames: formattedTraces.map(f => f.fileName)
  });

  try {
    const writePromises = formattedTraces.map(async ({ content, fileName }) => {
      const response = await fetch(`${this.#serverUrl}/api/traces/write`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          traceData: content,
          fileName: fileName,
          outputDirectory: this.#config.outputDirectory
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to write ${fileName}: ${response.statusText}`);
      }

      const result = await response.json();
      this.#logger.debug(`Successfully wrote ${fileName}`, {
        size: content.length,
        path: result.filePath
      });

      return { fileName, success: true, ...result };
    });

    // Write all formats in parallel
    const results = await Promise.allSettled(writePromises);

    // Log detailed results
    const successes = [];
    const failures = [];

    results.forEach((result, index) => {
      const fileName = formattedTraces[index].fileName;
      if (result.status === 'fulfilled') {
        successes.push(fileName);
      } else {
        failures.push({ fileName, error: result.reason.message });
        this.#logger.error(`Failed to write ${fileName}`, result.reason);
      }
    });

    // Log summary
    this.#logger.info('Multi-format write completed', {
      totalFiles: formattedTraces.length,
      successful: successes.length,
      failed: failures.length,
      successes,
      failures: failures.map(f => f.fileName)
    });

    // Consider success if at least one format was written
    return successes.length > 0;

  } catch (error) {
    this.#logger.error('Failed to write formatted traces', {
      error: error.message,
      fileCount: formattedTraces.length
    });
    return false;
  }
}
```

### 2. Backward Compatibility Method

Maintain existing single-format interface:

```javascript
/**
 * Write single trace (backward compatibility)
 * @param {ActionTrace} trace - The trace to write
 * @returns {Promise<boolean>} Success status
 */
async writeTrace(trace) {
  // Convert single trace to formatted output format
  const jsonContent = JSON.stringify(trace, null, 2);
  const fileName = this.#generateFileName(trace);

  const formattedTraces = [{
    content: jsonContent,
    fileName: fileName
  }];

  return await this.writeFormattedTraces(formattedTraces);
}
```

### 3. Enhanced Error Handling and Resilience

```javascript
/**
 * Write single formatted trace with retry logic
 * @private
 * @param {Object} formattedTrace - Single formatted trace
 * @param {number} retryCount - Current retry attempt
 * @returns {Promise<Object>} Write result
 */
async #writeSingleTrace(formattedTrace, retryCount = 0) {
  const { content, fileName } = formattedTrace;
  const maxRetries = 3;

  try {
    const response = await fetch(`${this.#serverUrl}/api/traces/write`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        traceData: content,
        fileName: fileName,
        outputDirectory: this.#config.outputDirectory
      }),
      timeout: 30000 // 30 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();

  } catch (error) {
    if (retryCount < maxRetries) {
      this.#logger.warn(`Write failed, retrying (${retryCount + 1}/${maxRetries})`, {
        fileName,
        error: error.message
      });

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, retryCount) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      return await this.#writeSingleTrace(formattedTrace, retryCount + 1);
    }

    throw error;
  }
}
```

### 4. Configuration and Initialization Updates

```javascript
/**
 * Initialize handler with configuration
 * @param {Object} config - Trace configuration
 * @param {string} serverUrl - Server endpoint URL
 * @param {Object} logger - Logger instance
 */
constructor({ config, serverUrl, logger }) {
  validateDependency(config, 'configuration object');
  validateDependency(serverUrl, 'server URL');
  validateDependency(logger, 'ILogger');

  this.#config = config;
  this.#serverUrl = serverUrl;
  this.#logger = logger;

  // Validate server URL format
  if (!this.#isValidUrl(serverUrl)) {
    throw new InvalidArgumentError('serverUrl', 'Must be a valid URL');
  }

  // Log configuration for debugging
  this.#logger.debug('FileTraceOutputHandler initialized', {
    serverUrl,
    outputDirectory: config.outputDirectory,
    outputFormats: config.outputFormats || ['json']
  });
}

/**
 * Validate URL format
 * @private
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
#isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
```

## Implementation Steps

1. **Locate FileTraceOutputHandler**
   - [ ] Find `src/actions/tracing/fileTraceOutputHandler.js`
   - [ ] Review existing write methods and server integration
   - [ ] Identify backward compatibility requirements

2. **Implement Multi-Format Write Method**
   - [ ] Add `writeFormattedTraces()` method
   - [ ] Implement parallel HTTP requests to server endpoint
   - [ ] Add comprehensive error handling and logging
   - [ ] Handle partial failures gracefully

3. **Add Backward Compatibility Layer**
   - [ ] Keep existing `writeTrace()` method signature
   - [ ] Convert single trace to formatted output format internally
   - [ ] Ensure no breaking changes to existing usage

4. **Enhance Error Handling and Resilience**
   - [ ] Add retry logic for failed writes
   - [ ] Implement exponential backoff for retries
   - [ ] Add timeout handling for HTTP requests
   - [ ] Provide detailed error reporting

5. **Update Constructor and Validation**
   - [ ] Enhance constructor validation
   - [ ] Add URL validation for server endpoint
   - [ ] Improve configuration logging
   - [ ] Add health check capabilities if needed

6. **Add Utility Methods**
   - [ ] File name validation methods
   - [ ] Content size validation
   - [ ] Server connectivity testing

## Acceptance Criteria

- [ ] Handler accepts array of formatted traces
- [ ] Handler writes multiple files in parallel
- [ ] Partial failures don't prevent other files from being written
- [ ] Existing `writeTrace()` method still works unchanged
- [ ] Retry logic handles temporary server issues
- [ ] Clear logging for success and failure cases
- [ ] Server endpoint receives properly formatted requests
- [ ] File paths are correctly constructed for each format
- [ ] Configuration validation prevents invalid setups
- [ ] Performance impact is minimal for single format usage
- [ ] HTTP timeouts prevent indefinite blocking
- [ ] Error messages provide actionable information

## Dependencies

- **Depends On**: DUALFORMACT-003 (ActionTraceOutputService Enhancement)
- **Required By**: DUALFORMACT-005 (Unit Test Implementation)
- **Required By**: DUALFORMACT-006 (Integration Test Suite)

## Testing Requirements

1. **Unit Tests**
   - [ ] Test `writeFormattedTraces()` with multiple formats
   - [ ] Test `writeFormattedTraces()` with single format
   - [ ] Test backward compatibility with `writeTrace()`
   - [ ] Test error handling for server failures
   - [ ] Test partial failure scenarios
   - [ ] Test retry logic with exponential backoff
   - [ ] Test configuration validation
   - [ ] Test URL validation

2. **Integration Tests**
   - [ ] Test actual HTTP requests to server endpoint
   - [ ] Test file writing with real server
   - [ ] Test error scenarios with server down
   - [ ] Test large trace content handling

3. **Mock Requirements**
   - [ ] Mock fetch for HTTP request testing
   - [ ] Mock server responses for different scenarios
   - [ ] Mock configuration objects
   - [ ] Mock logger for verification

## Files to Modify

- **Primary**: `src/actions/tracing/fileTraceOutputHandler.js`

## Search Patterns for Impact Analysis

```bash
# Find FileTraceOutputHandler usage
grep -r "FileTraceOutputHandler" src/

# Find writeTrace method usage
grep -r "writeTrace" src/ | grep -v test

# Find server endpoint interactions
grep -r "/api/traces/write" src/ llm-proxy-server/
```

## Method Signatures Update

```javascript
// New primary method
async writeFormattedTraces(formattedTraces: Array<{content: string, fileName: string}>) -> Promise<boolean>

// Existing method (maintained for compatibility)
async writeTrace(trace: ActionTrace) -> Promise<boolean>

// New utility methods
#writeSingleTrace(formattedTrace: Object, retryCount: number = 0) -> Promise<Object>
#isValidUrl(url: string) -> boolean
#generateFileName(trace: ActionTrace) -> string
```

## HTTP Request Format

```javascript
// Request payload for each formatted trace
{
  "traceData": "formatted trace content (JSON string or text)",
  "fileName": "trace_action_actor_timestamp.json|txt",
  "outputDirectory": "./traces/action-name"
}

// Expected response
{
  "success": true,
  "filePath": "/full/path/to/written/file.json",
  "size": 1024
}
```

## Error Scenarios and Handling

```javascript
// Server connection errors
catch (error) {
  if (error.code === 'ECONNREFUSED') {
    this.#logger.error('Server unavailable for trace writing', {
      serverUrl: this.#serverUrl,
      fileName
    });
  }
}

// HTTP errors
if (!response.ok) {
  const errorBody = await response.text().catch(() => 'No error details');
  throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorBody}`);
}

// Timeout handling
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);
```

## Performance Considerations

1. **Parallel Writes**: Multiple formats written simultaneously
2. **Memory Usage**: Brief peak during parallel operations
3. **Network Overhead**: Multiple HTTP requests (optimizable with batch endpoint)
4. **Error Isolation**: Failure in one write doesn't block others
5. **Retry Logic**: Exponential backoff prevents server overload

## Migration Guide

### For Handler Users

- **No Changes Required**: Existing usage patterns work unchanged
- **New Capability**: Multi-format writing automatically enabled

### For Server Endpoint

- **No Changes Required**: Existing `/api/traces/write` endpoint works as-is
- **Optional Enhancement**: Batch endpoint could optimize performance

## Risk Mitigation

1. **Network Resilience**
   - Retry logic for temporary failures
   - Timeouts prevent indefinite blocking
   - Clear error reporting for debugging

2. **Backward Compatibility**
   - Existing method signatures unchanged
   - Single-format usage patterns preserved
   - No breaking changes to public interface

3. **Server Load**
   - Parallel writes could increase server load
   - Consider rate limiting if needed
   - Monitor server performance during rollout

## Notes

- Critical for dual-format file output functionality
- Maintains strict backward compatibility
- Parallel writing provides performance benefits
- Resilient error handling for production use
- Foundation for optional batch endpoint enhancement

## Related Tickets

- **Depends On**: DUALFORMACT-003 (ActionTraceOutputService Enhancement)
- **Blocks**: DUALFORMACT-005 (Unit Test Implementation)
- **Blocks**: DUALFORMACT-006 (Integration Test Suite)
- **Related**: DUALFORMACT-007 (Optional Server Endpoint Enhancement)
