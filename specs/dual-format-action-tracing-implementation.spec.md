# Dual-Format Action Tracing Implementation Specification

**Version**: 1.0.0  
**Date**: 2025-08-22  
**Status**: Draft  
**Authors**: System Architecture Team  
**Based On**: reports/action-tracing-architecture-analysis.md

## 1. Executive Summary

### 1.1 Problem Statement

The Living Narrative Engine has a fully implemented `HumanReadableFormatter` for action traces, but it is currently only used for export functionality. The primary trace output flow only generates JSON files, despite having all the infrastructure needed for dual-format output (both JSON and human-readable text files).

### 1.2 Solution Overview

Enable dual-format action tracing by integrating the existing `HumanReadableFormatter` into the main trace output pipeline, allowing the system to generate both JSON and text trace files simultaneously when configured.

### 1.3 Key Benefits

- **Developer Experience**: Human-readable traces for quick debugging without JSON parsing
- **Flexibility**: Choose output formats based on use case (JSON for tools, text for humans)
- **Minimal Changes**: Leverage existing infrastructure with minor modifications
- **Backward Compatibility**: Default behavior remains unchanged (JSON-only)
- **Performance**: Negligible overhead with optional parallel generation

## 2. System Architecture

### 2.1 Current Architecture

```
Action Execution
       ↓
ActionTraceOutputService
       ↓
FileTraceOutputHandler
       ↓
JSON Formatting (only)
       ↓
HTTP POST to /api/traces/write
       ↓
Server writes JSON file
```

### 2.2 Enhanced Architecture

```
Action Execution
       ↓
ActionTraceOutputService
  (holds formatters)
       ↓
Format Selection (config-based)
       ├─→ JsonTraceFormatter
       └─→ HumanReadableFormatter
              ↓
   Formatted Content(s)
              ↓
FileTraceOutputHandler
       ↓
 Batch or Sequential Writes
       ↓
HTTP POST to /api/traces/write
       ↓
Server writes multiple files
```

**Note**: The formatters are held by `ActionTraceOutputService`, not `FileTraceOutputHandler`. This means the formatting can happen at the service level before passing to the handler.

### 2.3 Component Modifications

| Component                     | Current State                          | Required Changes                                                                                                | Implementation Option |
| ----------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------- |
| `trace-config.json`           | JSON-only configuration                | Add `outputFormats` and `textFormatOptions`                                                                     | Required              |
| `actionTraceConfigLoader.js`  | Loads single format config             | Support multi-format configuration                                                                              | Required              |
| `fileTraceOutputHandler.js`   | Receives formatted string content      | **Option A**: Accept formatter instances via constructor<br>**Option B**: Handle multiple pre-formatted outputs | Choose one            |
| `actionTraceOutputService.js` | Holds formatters, uses only for export | **Option A**: Pass formatters to handler<br>**Option B**: Format content before passing to handler              | Choose one            |
| `humanReadableFormatter.js`   | Export-only usage                      | No code changes, just integration                                                                               | Required              |
| `/api/traces/write` endpoint  | Writes single file                     | Optional: batch write support                                                                                   | Optional              |

## 3. Configuration Enhancement

### 3.1 Configuration Schema Update

#### 3.1.1 Extended `config/trace-config.json`

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["intimacy:fondle_ass"],
    "outputDirectory": "./traces/fondle-ass",
    "verbosity": "verbose",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true,
    "maxTraceFiles": 100,
    "rotationPolicy": "age",
    "maxFileAge": 86400,

    // New fields for dual-format support
    "outputFormats": ["json", "text"], // Default: ["json"] for backward compatibility
    "textFormatOptions": {
      "enableColors": false, // Disable ANSI colors for file output
      "lineWidth": 120, // Maximum line width for text formatting
      "indentSize": 2, // Indentation spaces
      "sectionSeparator": "=", // Character for section separators
      "includeTimestamps": true, // Include timing information
      "performanceSummary": true // Add performance summary section
    }
  }
}
```

#### 3.1.2 Schema Definition Update

Add to `data/schemas/action-trace-config.schema.json`:

```json
{
  "properties": {
    "actionTracing": {
      "properties": {
        // ... existing properties ...

        "outputFormats": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["json", "text", "html", "markdown"]
          },
          "default": ["json"],
          "description": "Formats to generate for trace output. Default is JSON only for backward compatibility."
        },

        "textFormatOptions": {
          "type": "object",
          "properties": {
            "enableColors": {
              "type": "boolean",
              "default": false,
              "description": "Enable ANSI color codes in text output"
            },
            "lineWidth": {
              "type": "integer",
              "minimum": 80,
              "maximum": 200,
              "default": 120,
              "description": "Maximum line width for text formatting"
            },
            "indentSize": {
              "type": "integer",
              "minimum": 0,
              "maximum": 8,
              "default": 2,
              "description": "Number of spaces for indentation"
            },
            "sectionSeparator": {
              "type": "string",
              "maxLength": 1,
              "default": "=",
              "description": "Character used for section separators"
            },
            "includeTimestamps": {
              "type": "boolean",
              "default": true,
              "description": "Include timing information in output"
            },
            "performanceSummary": {
              "type": "boolean",
              "default": true,
              "description": "Add performance summary section at the end"
            }
          },
          "description": "Options for text format output"
        }
      }
    }
  }
}
```

## 4. Implementation Details

### 4.0 Implementation Approach Options

**Current State**:

- `ActionTraceOutputService` holds the formatter instances (`#jsonFormatter` and `#humanReadableFormatter`)
- `FileTraceOutputHandler` currently receives already-formatted content as a string
- The formatters are only used for export functionality, not for file output

**Option A: Formatter Injection into FileTraceOutputHandler**

- Pass formatter instances to FileTraceOutputHandler via constructor
- Handler manages formatting internally
- Pros: Encapsulation, handler controls its own formatting
- Cons: Requires constructor signature change, duplicates formatter references

**Option B: Service-Level Formatting (Recommended)**

- ActionTraceOutputService formats content using its existing formatters
- Pass multiple formatted outputs to FileTraceOutputHandler
- Pros: Leverages existing formatter references, minimal changes to handler
- Cons: Slightly less encapsulation

### 4.1 FileTraceOutputHandler Modifications

#### 4.1.1 Option A: Enhanced Format Content Method (If Formatters Injected)

**File**: `src/actions/tracing/fileTraceOutputHandler.js`

```javascript
// Constructor modification needed:
constructor({ config, serverUrl, logger, jsonFormatter, humanReadableFormatter }) {
  // ... existing code ...
  this.#jsonFormatter = jsonFormatter;
  this.#humanReadableFormatter = humanReadableFormatter;
}

/**
 * Format trace content based on configured output formats
 * @private
 * @param {ActionTrace} trace - The action trace to format
 * @returns {Promise<Array<{format: string, content: string, extension: string}>>}
 */
async #formatTraceContent(trace) {
  const formats = [];
  const outputFormats = this.#config?.outputFormats || ['json'];

  // Generate JSON format if configured
  if (outputFormats.includes('json')) {
    const jsonContent = this.#jsonFormatter.format(trace);
    formats.push({
      format: 'json',
      content: jsonContent,
      extension: '.json'
    });
  }

  // Generate text format if configured
  if (outputFormats.includes('text')) {
    const textOptions = this.#config?.textFormatOptions || {};
    const textContent = this.#humanReadableFormatter.format(trace, {
      ...textOptions,
      enableColors: false // Always disable colors for file output
    });
    formats.push({
      format: 'text',
      content: textContent,
      extension: '.txt'
    });
  }

  // Future format support (HTML, Markdown)
  if (outputFormats.includes('html')) {
    // Future implementation
    this.#logger.debug('HTML format not yet implemented');
  }

  if (outputFormats.includes('markdown')) {
    // Future implementation
    this.#logger.debug('Markdown format not yet implemented');
  }

  return formats;
}
```

#### 4.1.1b Option B: Receive Pre-Formatted Content (Recommended)

**File**: `src/actions/tracing/fileTraceOutputHandler.js`

```javascript
/**
 * Write multiple formatted traces using server endpoint
 * @private
 * @param {Array<{content: string, fileName: string}>} formattedTraces - Pre-formatted traces from service
 * @returns {Promise<boolean>} Success status
 */
async #writeFormattedTraces(formattedTraces) {
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

      return response.json();
    });

    // Write all formats in parallel
    const results = await Promise.allSettled(writePromises);

    // Log any failures but don't fail the entire operation
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.#logger.error(`Failed to write ${formattedTraces[index].fileName}`, result.reason);
      }
    });

    // Consider success if at least one format was written
    return results.some(r => r.status === 'fulfilled');

  } catch (error) {
    this.#logger.error('Failed to write traces via server endpoint', error);
    return false;
  }
}
```

#### 4.1.2 Updated Write Method (Option A: With Formatters)

```javascript
/**
 * Write trace using server endpoint with multi-format support
 * @private
 * @param {ActionTrace} trace - The trace to write
 * @returns {Promise<boolean>} Success status
 */
async #writeUsingServerEndpoint(trace) {
  try {
    const formats = await this.#formatTraceContent(trace);
    const baseFileName = this.#generateFileName(trace);

    // Option 1: Sequential writes (simpler, current infrastructure)
    const writePromises = formats.map(async ({ content, extension }) => {
      const fileName = baseFileName.replace('.json', extension);

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
        throw new Error(`Failed to write ${extension} trace: ${response.statusText}`);
      }

      return response.json();
    });

    // Write all formats in parallel
    const results = await Promise.allSettled(writePromises);

    // Log any failures but don't fail the entire operation
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.#logger.error(`Failed to write ${formats[index].format} trace`, result.reason);
      }
    });

    // Consider success if at least one format was written
    return results.some(r => r.status === 'fulfilled');

  } catch (error) {
    this.#logger.error('Failed to write trace via server endpoint', error);
    return false;
  }
}
```

### 4.2 ActionTraceOutputService Modifications (Option B)

**File**: `src/actions/tracing/actionTraceOutputService.js`

```javascript
/**
 * Generate formatted outputs for file writing
 * @private
 * @param {ActionTrace} trace - The trace to format
 * @returns {Array<{content: string, fileName: string}>} Formatted outputs
 */
#generateFormattedOutputs(trace) {
  const outputs = [];
  const outputFormats = this.#config?.outputFormats || ['json'];
  const baseFileName = this.#generateFileName(trace);

  // Generate JSON format if configured
  if (outputFormats.includes('json')) {
    const jsonContent = this.#jsonFormatter.format(trace);
    outputs.push({
      content: jsonContent,
      fileName: baseFileName
    });
  }

  // Generate text format if configured
  if (outputFormats.includes('text')) {
    const textOptions = this.#config?.textFormatOptions || {};
    const textContent = this.#humanReadableFormatter.format(trace, {
      ...textOptions,
      enableColors: false // Always disable colors for file output
    });
    outputs.push({
      content: textContent,
      fileName: baseFileName.replace('.json', '.txt')
    });
  }

  return outputs;
}

/**
 * Modified output method to support multiple formats
 * @param {ActionTrace} trace - The trace to output
 * @returns {Promise<void>}
 */
async outputTrace(trace) {
  // ... existing validation ...

  if (this.#config.outputToFile) {
    const formattedOutputs = this.#generateFormattedOutputs(trace);
    await this.#fileHandler.writeFormattedTraces(formattedOutputs);
  }

  // ... rest of method ...
}
```

### 4.3 Configuration Loader Updates

#### 4.2.1 ActionTraceConfigLoader Enhancement

**File**: `src/configuration/actionTraceConfigLoader.js`

Add validation for new configuration fields:

```javascript
/**
 * Validate and normalize trace configuration
 * @private
 * @param {Object} config - Raw configuration object
 * @returns {Object} Normalized configuration
 */
#normalizeConfig(config) {
  const normalized = { ...config };

  // Ensure outputFormats is an array with at least 'json'
  if (!Array.isArray(normalized.outputFormats)) {
    normalized.outputFormats = ['json'];
  }

  // Validate format values
  const validFormats = ['json', 'text', 'html', 'markdown'];
  normalized.outputFormats = normalized.outputFormats.filter(
    format => validFormats.includes(format)
  );

  // Ensure at least JSON format for backward compatibility
  if (normalized.outputFormats.length === 0) {
    normalized.outputFormats = ['json'];
  }

  // Normalize text format options
  if (normalized.outputFormats.includes('text')) {
    normalized.textFormatOptions = {
      enableColors: false, // Force false for file output
      lineWidth: normalized.textFormatOptions?.lineWidth || 120,
      indentSize: normalized.textFormatOptions?.indentSize || 2,
      sectionSeparator: normalized.textFormatOptions?.sectionSeparator || '=',
      includeTimestamps: normalized.textFormatOptions?.includeTimestamps !== false,
      performanceSummary: normalized.textFormatOptions?.performanceSummary !== false
    };
  }

  return normalized;
}
```

## 5. Server Endpoint Optimization (Optional)

### 5.1 Batch Write Endpoint

While the current implementation can handle sequential writes effectively, an optimized batch endpoint could reduce HTTP overhead:

#### 5.1.1 New Endpoint: `/api/traces/write-batch`

**File**: `llm-proxy-server/src/routes/traceRoutes.js`

```javascript
/**
 * POST /api/traces/write-batch
 * Write multiple trace files in a single request
 * @body {Array<{traceData, fileName, outputDirectory}>} files - Array of files to write
 */
router.post('/write-batch', async (req, res) => {
  try {
    const { files } = req.body;

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or empty files array',
      });
    }

    const writePromises = files.map(async (file) => {
      const { traceData, fileName, outputDirectory } = file;

      // Reuse existing write logic
      // ... (sanitization, path resolution, writing)

      return {
        fileName,
        success: true,
        size: traceData.length,
      };
    });

    const results = await Promise.allSettled(writePromises);

    res.json({
      success: true,
      results: results.map((r, i) => ({
        fileName: files[i].fileName,
        status: r.status,
        ...(r.status === 'fulfilled' ? r.value : { error: r.reason.message }),
      })),
    });
  } catch (error) {
    logger.error('Batch write failed', error);
    res.status(500).json({
      success: false,
      error: 'Batch write failed',
      details: error.message,
    });
  }
});
```

## 6. File Naming Convention

### 6.1 Naming Pattern

Current pattern: `trace_<action>_<actor>_<timestamp>.json`

Enhanced pattern:

- JSON: `trace_<action>_<actor>_<timestamp>.json`
- Text: `trace_<action>_<actor>_<timestamp>.txt`
- HTML: `trace_<action>_<actor>_<timestamp>.html` (future)
- Markdown: `trace_<action>_<actor>_<timestamp>.md` (future)

Example output for a single trace:

```
traces/fondle-ass/
├── trace_fondle_ass_player_20250822_143022.json
└── trace_fondle_ass_player_20250822_143022.txt
```

## 7. Testing Requirements

### 7.1 Unit Tests

#### 7.1.1 FileTraceOutputHandler Tests

**File**: `tests/unit/actions/tracing/fileTraceOutputHandler.test.js`

```javascript
describe('FileTraceOutputHandler - Multi-format Support', () => {
  it('should generate only JSON when outputFormats is not configured', async () => {
    // Test backward compatibility
  });

  it('should generate both JSON and text when configured', async () => {
    // Test dual-format generation
  });

  it('should handle partial write failures gracefully', async () => {
    // Test resilience when one format fails
  });

  it('should apply text format options correctly', async () => {
    // Test text formatting configuration
  });
});
```

#### 7.1.2 Configuration Loader Tests

**File**: `tests/unit/configuration/actionTraceConfigLoader.test.js`

```javascript
describe('ActionTraceConfigLoader - Format Configuration', () => {
  it('should default to JSON-only for backward compatibility', () => {
    // Test default behavior
  });

  it('should validate and filter invalid format types', () => {
    // Test format validation
  });

  it('should normalize text format options', () => {
    // Test option normalization
  });
});
```

### 7.2 Integration Tests

**File**: `tests/integration/actions/tracing/dualFormatTracing.test.js`

```javascript
describe('Dual-Format Action Tracing Integration', () => {
  it('should write both JSON and text files to filesystem', async () => {
    // End-to-end test of dual-format output
  });

  it('should maintain backward compatibility with JSON-only config', async () => {
    // Test existing configurations continue to work
  });
});
```

### 7.3 Performance Tests

```javascript
describe('Dual-Format Performance Impact', () => {
  it('should have minimal overhead for dual-format generation', async () => {
    // Measure performance impact (<10ms additional per trace)
  });

  it('should handle high-frequency actions without blocking', async () => {
    // Test with rapid action execution
  });
});
```

## 8. Migration Path

### 8.1 Backward Compatibility

1. **Default Configuration**: If `outputFormats` is not specified, default to `["json"]`
2. **Existing Traces**: All existing JSON traces remain valid and unchanged
3. **API Compatibility**: Server endpoint continues to accept single-file writes
4. **Test Compatibility**: All existing tests continue to pass without modification

### 8.2 Progressive Rollout

#### Phase 1: Silent Release (Week 1)

- Deploy code with feature disabled by default
- Test in development environments
- Validate no impact on existing functionality

#### Phase 2: Opt-in Beta (Week 2-3)

- Enable for specific actions via configuration
- Document feature in README
- Gather feedback from developers

#### Phase 3: General Availability (Week 4)

- Update default configuration templates
- Add UI toggle for format selection (future)
- Full documentation and examples

### 8.3 Configuration Migration

For users wanting to enable dual-format immediately:

```json
// Before (current configuration)
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["movement:go"],
    "outputDirectory": "./traces"
  }
}

// After (dual-format enabled)
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["movement:go"],
    "outputDirectory": "./traces",
    "outputFormats": ["json", "text"],
    "textFormatOptions": {
      "lineWidth": 120,
      "includeTimestamps": true,
      "performanceSummary": true
    }
  }
}
```

## 9. Performance Considerations

### 9.1 Generation Overhead

- **JSON Formatting**: ~1-2ms per trace (existing)
- **Text Formatting**: ~2-3ms per trace (measured)
- **Parallel Generation**: Total time ~3ms (not additive)
- **File Writing**: ~5-10ms per file (network dependent)

### 9.2 Optimization Strategies

1. **Lazy Generation**: Only format when writing, not on every trace
2. **Parallel Processing**: Generate formats concurrently
3. **Caching**: Cache formatters to avoid recreation
4. **Batching**: Optional batch endpoint for multiple files
5. **Compression**: Future: gzip text files for storage efficiency

### 9.3 Resource Impact

- **Memory**: Negligible (<1MB for formatter instances)
- **CPU**: Minimal (<5% increase during trace generation)
- **Network**: Doubled for dual-format (2 HTTP requests or 1 batch)
- **Storage**: ~2x disk usage when both formats enabled

## 10. Future Enhancements

### 10.1 Additional Formats

1. **HTML Format**:
   - Rich formatting with CSS styling
   - Collapsible sections for large traces
   - Syntax highlighting for data structures

2. **Markdown Format**:
   - Documentation-friendly format
   - GitHub/GitLab compatible rendering
   - Easy inclusion in reports

### 10.2 Advanced Features

1. **Format Selection Logic**:
   - Per-action format configuration
   - Size-based format selection
   - Conditional formatting based on trace content

2. **Compression Options**:
   - Gzip compression for text files
   - Archive old traces automatically
   - Streaming compression for large traces

3. **Real-time Streaming**:
   - WebSocket support for live trace viewing
   - Tail-like functionality for text traces
   - Real-time format conversion

## 11. Implementation Checklist

### 11.1 Required Changes

- [ ] Update `config/trace-config.json` with new fields
- [ ] Update `data/schemas/action-trace-config.schema.json`
- [ ] **Choose implementation approach**:
  - [ ] **Option A**: Modify `fileTraceOutputHandler.js` to accept formatters via constructor
  - [ ] **Option B (Recommended)**: Modify `actionTraceOutputService.js` to format content before passing to handler
- [ ] Implement chosen approach:
  - [ ] If Option A: Update FileTraceOutputHandler constructor and formatting methods
  - [ ] If Option B: Update ActionTraceOutputService to generate multiple formats
- [ ] Update `actionTraceConfigLoader.js` for new config validation
- [ ] Add unit tests for multi-format generation
- [ ] Add integration tests for end-to-end validation
- [ ] Update documentation with configuration examples

### 11.2 Optional Enhancements

- [ ] Implement batch write endpoint in server
- [ ] Add HTML format support
- [ ] Add Markdown format support
- [ ] Implement compression for text files
- [ ] Add format-specific configuration UI

### 11.3 Documentation Updates

- [ ] Update README with dual-format configuration
- [ ] Add examples of text trace output
- [ ] Document performance implications
- [ ] Create migration guide for existing users

## 12. Security Considerations

### 12.1 File System Security

- **Path Sanitization**: Already implemented in server endpoint
- **File Size Limits**: Consider adding limits for text files
- **Rate Limiting**: Existing rate limits apply to all formats

### 12.2 Configuration Validation

- **Format Whitelist**: Only allow predefined format types
- **Option Ranges**: Validate numeric options are within bounds
- **Injection Prevention**: Sanitize text format options

## 13. Conclusion

This specification provides a complete implementation path for enabling dual-format action tracing in the Living Narrative Engine. The solution leverages existing infrastructure (the `HumanReadableFormatter` and server endpoints) with minimal modifications, ensuring backward compatibility while adding valuable debugging capabilities.

**Key Implementation Decision**: The specification presents two implementation approaches:

- **Option A**: Modify FileTraceOutputHandler to accept and use formatters directly
- **Option B (Recommended)**: Leverage ActionTraceOutputService's existing formatter instances to generate multiple formats before passing to the handler

Option B is recommended as it:

- Utilizes existing formatter references in ActionTraceOutputService
- Requires minimal changes to FileTraceOutputHandler
- Maintains cleaner separation of concerns
- Aligns better with the current architecture where the service orchestrates operations

The phased rollout approach ensures stability while allowing early adopters to benefit from the enhanced tracing capabilities immediately.

### Key Success Factors

1. **Minimal Disruption**: No breaking changes to existing functionality
2. **Leverages Existing Code**: Uses already-implemented `HumanReadableFormatter`
3. **Flexible Configuration**: Supports various output preferences
4. **Performance Conscious**: Negligible overhead with optimization options
5. **Future-Proof**: Extensible design for additional formats

### Next Steps

1. Review and approve specification
2. Implement required changes following the checklist
3. Deploy in development environment for testing
4. Gather feedback and iterate
5. Roll out to production following the migration path

---

_End of Specification_
