# DUALFORMACT-007: Optional Server Endpoint Enhancement

**Status**: Not Started  
**Priority**: P2 - Enhancement  
**Phase**: 2 - Core Implementation (Parallel)  
**Component**: LLM Proxy Server  
**Estimated**: 4 hours

## Description

Implement an optional batch write endpoint in the LLM proxy server to optimize HTTP overhead when writing multiple trace formats. This enhancement reduces network requests from N (one per format) to 1 (batch operation) while maintaining backward compatibility.

## Technical Requirements

### 1. New Batch Write Endpoint

Add `/api/traces/write-batch` endpoint to handle multiple file writes in a single request:

```javascript
// llm-proxy-server/src/routes/traceRoutes.js
import { Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { validateTraceWriteRequest } from '../middleware/validation.js';
import { sanitizePath } from '../utils/pathUtils.js';

const router = Router();

/**
 * POST /api/traces/write-batch
 * Write multiple trace files in a single request
 * @body {Array<{traceData, fileName, outputDirectory}>} files - Array of files to write
 */
router.post('/write-batch', async (req, res) => {
  try {
    const { files } = req.body;

    // Validate request format
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or empty files array',
        details: 'Request body must contain a non-empty array of files',
      });
    }

    // Validate each file entry
    const validationErrors = [];
    files.forEach((file, index) => {
      if (!file.traceData || !file.fileName || !file.outputDirectory) {
        validationErrors.push(
          `File ${index}: missing required fields (traceData, fileName, outputDirectory)`
        );
      }
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors,
      });
    }

    // Process all files in parallel
    const writePromises = files.map(async (file, index) => {
      try {
        const { traceData, fileName, outputDirectory } = file;

        // Sanitize and resolve file path
        const sanitizedDirectory = sanitizePath(outputDirectory);
        const sanitizedFileName = sanitizePath(fileName);
        const fullPath = path.join(sanitizedDirectory, sanitizedFileName);

        // Ensure directory exists
        await fs.mkdir(path.dirname(fullPath), { recursive: true });

        // Write file
        await fs.writeFile(fullPath, traceData, 'utf-8');

        // Get file stats
        const stats = await fs.stat(fullPath);

        return {
          index,
          fileName: sanitizedFileName,
          success: true,
          filePath: fullPath,
          size: stats.size,
          bytesWritten: traceData.length,
        };
      } catch (error) {
        req.logger?.error(`Batch write failed for file ${index}`, {
          fileName: file.fileName,
          error: error.message,
        });

        return {
          index,
          fileName: file.fileName,
          success: false,
          error: error.message,
        };
      }
    });

    // Wait for all writes to complete
    const results = await Promise.allSettled(writePromises);

    // Process results
    const processedResults = results.map((result, index) => ({
      index,
      fileName: files[index].fileName,
      status: result.status,
      ...(result.status === 'fulfilled'
        ? result.value
        : {
            success: false,
            error: result.reason?.message || 'Unknown error',
          }),
    }));

    // Calculate summary statistics
    const successful = processedResults.filter((r) => r.success);
    const failed = processedResults.filter((r) => !r.success);
    const totalBytes = successful.reduce(
      (sum, r) => sum + (r.bytesWritten || 0),
      0
    );

    // Log batch operation summary
    req.logger?.info('Batch trace write completed', {
      totalFiles: files.length,
      successful: successful.length,
      failed: failed.length,
      totalBytes,
      successRate: ((successful.length / files.length) * 100).toFixed(1) + '%',
    });

    // Return detailed results
    res.json({
      success: successful.length > 0, // Success if at least one file written
      summary: {
        totalFiles: files.length,
        successful: successful.length,
        failed: failed.length,
        totalBytes,
        processingTime: Date.now() - req.startTime,
      },
      results: processedResults,
    });
  } catch (error) {
    req.logger?.error('Batch write operation failed', {
      error: error.message,
      stack: error.stack,
      requestId: req.id,
    });

    res.status(500).json({
      success: false,
      error: 'Batch write operation failed',
      details: error.message,
      requestId: req.id,
    });
  }
});

export default router;
```

### 2. Client-Side Batch Support

Add optional batch writing support to FileTraceOutputHandler:

```javascript
// src/actions/tracing/fileTraceOutputHandler.js
/**
 * Write multiple formatted traces using batch endpoint (if available)
 * @param {Array<{content: string, fileName: string}>} formattedTraces
 * @returns {Promise<boolean>} Success status
 */
async #writeBatch(formattedTraces) {
  try {
    const response = await fetch(`${this.#serverUrl}/api/traces/write-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: formattedTraces.map(({ content, fileName }) => ({
          traceData: content,
          fileName: fileName,
          outputDirectory: this.#config.outputDirectory
        }))
      }),
      timeout: 60000 // Longer timeout for batch operations
    });

    if (!response.ok) {
      throw new Error(`Batch write failed: HTTP ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    this.#logger.info('Batch write completed', {
      totalFiles: result.summary.totalFiles,
      successful: result.summary.successful,
      failed: result.summary.failed,
      processingTime: result.summary.processingTime
    });

    // Log any individual failures
    const failures = result.results.filter(r => !r.success);
    failures.forEach(failure => {
      this.#logger.error('File write failed in batch', {
        fileName: failure.fileName,
        error: failure.error
      });
    });

    return result.success;

  } catch (error) {
    this.#logger.error('Batch write request failed', {
      error: error.message,
      fileCount: formattedTraces.length
    });
    return false;
  }
}

/**
 * Enhanced writeFormattedTraces with batch support
 */
async writeFormattedTraces(formattedTraces) {
  if (!Array.isArray(formattedTraces) || formattedTraces.length === 0) {
    this.#logger.error('writeFormattedTraces requires non-empty array');
    return false;
  }

  // Try batch endpoint first, fallback to individual writes
  if (this.#config.useBatchEndpoint !== false && formattedTraces.length > 1) {
    try {
      const batchResult = await this.#writeBatch(formattedTraces);
      if (batchResult) {
        return true;
      }

      this.#logger.warn('Batch write failed, falling back to individual writes');
    } catch (error) {
      this.#logger.warn('Batch endpoint not available, using individual writes', {
        error: error.message
      });
    }
  }

  // Fallback to existing individual write logic
  return await this.#writeIndividual(formattedTraces);
}
```

### 3. Configuration Support

Add configuration option to enable/disable batch endpoint:

```javascript
// Update trace-config.json schema to include:
{
  "actionTracing": {
    "useBatchEndpoint": true,  // Enable batch writing optimization
    "batchTimeout": 60000,     // Timeout for batch operations (ms)
    "fallbackToIndividual": true  // Fallback if batch fails
  }
}
```

### 4. Error Handling and Resilience

```javascript
/**
 * Enhanced error handling for batch operations
 */
async #writeBatchWithResilience(formattedTraces, retryCount = 0) {
  const maxRetries = 2;

  try {
    return await this.#writeBatch(formattedTraces);
  } catch (error) {
    // Handle specific error types
    if (error.message.includes('404') || error.message.includes('Not Found')) {
      // Batch endpoint not available - permanently disable for this session
      this.#batchEndpointAvailable = false;
      this.#logger.info('Batch endpoint not available, disabling for session');
      return false;
    }

    if (retryCount < maxRetries && this.#isRetryableError(error)) {
      const delay = Math.pow(2, retryCount) * 1000;
      this.#logger.warn(`Batch write failed, retrying in ${delay}ms`, {
        retryCount: retryCount + 1,
        maxRetries,
        error: error.message
      });

      await new Promise(resolve => setTimeout(resolve, delay));
      return await this.#writeBatchWithResilience(formattedTraces, retryCount + 1);
    }

    throw error;
  }
}

#isRetryableError(error) {
  // Network errors, timeouts, and temporary server errors are retryable
  return error.code === 'ECONNRESET' ||
         error.code === 'ETIMEDOUT' ||
         error.message.includes('500') ||
         error.message.includes('502') ||
         error.message.includes('503');
}
```

## Implementation Steps

1. **Create Batch Endpoint in LLM Proxy Server**
   - [ ] Add new route `/api/traces/write-batch`
   - [ ] Implement parallel file writing logic
   - [ ] Add comprehensive input validation
   - [ ] Implement detailed response format
   - [ ] Add proper error handling and logging

2. **Enhance FileTraceOutputHandler**
   - [ ] Add batch write method with fallback logic
   - [ ] Implement endpoint availability detection
   - [ ] Add configuration support for batch operations
   - [ ] Enhance error handling for batch scenarios
   - [ ] Maintain backward compatibility

3. **Add Configuration Schema Updates**
   - [ ] Add batch endpoint configuration options
   - [ ] Update schema validation
   - [ ] Add documentation for new options
   - [ ] Provide sensible defaults

4. **Implement Client-Side Optimizations**
   - [ ] Add batch size optimization
   - [ ] Implement intelligent fallback logic
   - [ ] Add performance monitoring
   - [ ] Optimize timeout handling

5. **Add Comprehensive Testing**
   - [ ] Unit tests for batch endpoint
   - [ ] Integration tests with client
   - [ ] Error scenario testing
   - [ ] Performance validation tests

## Acceptance Criteria

- [ ] Batch endpoint accepts multiple trace files in single request
- [ ] Parallel file writing reduces total operation time
- [ ] Individual file failures don't prevent other files from writing
- [ ] Detailed response provides status for each file
- [ ] Client automatically falls back to individual writes if batch fails
- [ ] Batch endpoint is backward compatible (doesn't break existing functionality)
- [ ] Configuration allows enabling/disabling batch optimization
- [ ] Error handling provides clear feedback for troubleshooting
- [ ] Performance improvement measurable (>30% reduction in total time for dual-format)
- [ ] Server logs provide operational visibility
- [ ] Endpoint handles edge cases (empty arrays, malformed requests)

## Dependencies

- **Can Run in Parallel**: Independent of core dual-format implementation
- **Integrates With**: DUALFORMACT-004 (FileTraceOutputHandler Updates)
- **Tested By**: DUALFORMACT-006 (Integration Test Suite)

## Testing Requirements

1. **Server Endpoint Tests**
   - [ ] Test successful batch writing
   - [ ] Test partial failure scenarios
   - [ ] Test input validation and error responses
   - [ ] Test concurrent batch requests
   - [ ] Test large batch sizes and timeout handling

2. **Client Integration Tests**
   - [ ] Test batch vs individual write performance
   - [ ] Test fallback logic when batch endpoint unavailable
   - [ ] Test error handling and retry logic
   - [ ] Test configuration options

3. **Performance Tests**
   - [ ] Measure time reduction for dual-format writes
   - [ ] Test memory usage during batch operations
   - [ ] Validate network request reduction
   - [ ] Test with various batch sizes

## Files to Create/Modify

- **New**: `llm-proxy-server/src/routes/traceRoutes.batch.js`
- **Modify**: `llm-proxy-server/src/routes/index.js` (add batch route)
- **Modify**: `src/actions/tracing/fileTraceOutputHandler.js`
- **Modify**: `config/trace-config.json` (add batch options)
- **Modify**: `data/schemas/action-trace-config.schema.json`

## API Specification

### Request Format

```json
POST /api/traces/write-batch
Content-Type: application/json

{
  "files": [
    {
      "traceData": "{\"actionId\":\"test\"}",
      "fileName": "trace_test_actor_123.json",
      "outputDirectory": "./traces"
    },
    {
      "traceData": "=== Test Trace ===\n...",
      "fileName": "trace_test_actor_123.txt",
      "outputDirectory": "./traces"
    }
  ]
}
```

### Response Format

```json
{
  "success": true,
  "summary": {
    "totalFiles": 2,
    "successful": 2,
    "failed": 0,
    "totalBytes": 1024,
    "processingTime": 45
  },
  "results": [
    {
      "index": 0,
      "fileName": "trace_test_actor_123.json",
      "success": true,
      "filePath": "/full/path/to/file.json",
      "size": 512,
      "bytesWritten": 512
    },
    {
      "index": 1,
      "fileName": "trace_test_actor_123.txt",
      "success": true,
      "filePath": "/full/path/to/file.txt",
      "size": 512,
      "bytesWritten": 512
    }
  ]
}
```

## Performance Benefits

1. **Network Reduction**: N HTTP requests → 1 HTTP request
2. **Time Reduction**: ~30-50% faster for dual-format writes
3. **Server Efficiency**: Batch processing reduces overhead
4. **Concurrency**: Parallel file writes within single request
5. **Connection Reuse**: Single HTTP connection vs multiple

## Configuration Options

```json
{
  "actionTracing": {
    "useBatchEndpoint": true,
    "batchTimeout": 60000,
    "fallbackToIndividual": true,
    "maxBatchSize": 10
  }
}
```

## Migration Guide

### For Existing Users

- **No Changes Required**: Batch optimization is optional and automatic
- **Performance Benefit**: Dual-format writes become faster automatically
- **Configuration**: Can disable batch optimization if needed

### For Server Operators

- **New Endpoint**: `/api/traces/write-batch` available alongside existing endpoint
- **Backward Compatible**: Existing `/api/traces/write` endpoint unchanged
- **Monitoring**: New batch operation logs for visibility

## Risk Mitigation

1. **Fallback Strategy**
   - Client automatically falls back to individual writes
   - Batch failure doesn't prevent trace output
   - Configuration allows disabling batch optimization

2. **Error Isolation**
   - Individual file failures don't affect other files
   - Detailed error reporting for troubleshooting
   - Retry logic for transient failures

3. **Resource Management**
   - Reasonable timeout for batch operations
   - Maximum batch size limits prevent server overload
   - Proper cleanup on failure scenarios

## Notes

- **Optional Enhancement**: Not required for core dual-format functionality
- **Performance Optimization**: Primary benefit is reduced HTTP overhead
- **Backward Compatible**: Doesn't affect existing functionality
- **Graceful Degradation**: Falls back to individual writes if unavailable
- **Future-Proof**: Supports additional formats (HTML, Markdown) when added

## Related Tickets

- **Integrates With**: DUALFORMACT-004 (FileTraceOutputHandler Updates)
- **Tested By**: DUALFORMACT-006 (Integration Test Suite)
- **Enhances**: Overall dual-format performance and efficiency
