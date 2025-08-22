# DUALFORMACT-003: ActionTraceOutputService Enhancement

**Status**: Not Started  
**Priority**: P0 - Critical  
**Phase**: 2 - Core Implementation  
**Component**: Action Tracing System  
**Estimated**: 5 hours

## Description

Enhance the `ActionTraceOutputService` to generate multiple formatted outputs using the existing formatter instances. This implements the recommended Option B approach where the service formats content before passing to the FileTraceOutputHandler.

## Technical Requirements

### 1. Multi-Format Content Generation

Add method to generate formatted outputs for all configured formats:

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

  // Future format support (HTML, Markdown)
  if (outputFormats.includes('html')) {
    this.#logger.debug('HTML format not yet implemented, skipping');
  }

  if (outputFormats.includes('markdown')) {
    this.#logger.debug('Markdown format not yet implemented, skipping');
  }

  return outputs;
}
```

### 2. Enhanced Output Method

Update the main output method to support multiple formats:

```javascript
/**
 * Output trace in configured formats
 * @param {ActionTrace} trace - The trace to output
 * @returns {Promise<void>}
 */
async outputTrace(trace) {
  // Existing validation
  if (!trace) {
    throw new InvalidArgumentError('trace', 'ActionTrace is required');
  }

  this.#logger.debug('Outputting action trace', {
    actionId: trace.actionId,
    actorId: trace.actorId,
    timestamp: trace.timestamp,
    outputFormats: this.#config?.outputFormats || ['json']
  });

  try {
    // Output to console (unchanged)
    if (this.#config.outputToConsole) {
      this.#consoleHandler.outputTrace(trace);
    }

    // Output to file(s) - enhanced for multiple formats
    if (this.#config.outputToFile) {
      const formattedOutputs = this.#generateFormattedOutputs(trace);
      await this.#fileHandler.writeFormattedTraces(formattedOutputs);
    }

    // Export functionality (unchanged)
    if (this.#config.autoExport) {
      await this.#exportHandler.exportTrace(trace);
    }

    this.#logger.debug('Action trace output completed');

  } catch (error) {
    this.#logger.error('Failed to output action trace', {
      actionId: trace.actionId,
      error: error.message
    });
    throw new ActionTraceError(`Output failed: ${error.message}`);
  }
}
```

### 3. File Name Generation Enhancement

Update file name generation to support multiple extensions:

```javascript
/**
 * Generate base file name for trace
 * @private
 * @param {ActionTrace} trace - The trace
 * @returns {string} Base file name with .json extension
 */
#generateFileName(trace) {
  const timestamp = new Date().toISOString()
    .replace(/[:.]/g, '')
    .replace('T', '_')
    .slice(0, 15);

  const actionName = trace.actionId?.replace(/[^a-zA-Z0-9]/g, '_') || 'unknown';
  const actorName = trace.actorId?.replace(/[^a-zA-Z0-9]/g, '_') || 'unknown';

  return `trace_${actionName}_${actorName}_${timestamp}.json`;
}

/**
 * Generate file name with specific extension
 * @private
 * @param {string} baseFileName - Base file name ending in .json
 * @param {string} format - Target format ('json', 'text', 'html', 'markdown')
 * @returns {string} File name with appropriate extension
 */
#getFileNameForFormat(baseFileName, format) {
  const extensionMap = {
    'json': '.json',
    'text': '.txt',
    'html': '.html',
    'markdown': '.md'
  };

  const extension = extensionMap[format] || '.json';
  return baseFileName.replace('.json', extension);
}
```

### 4. Configuration Integration

Ensure proper configuration access and validation:

```javascript
/**
 * Initialize service with configuration
 * @param {Object} config - Action trace configuration
 */
initialize(config) {
  // Existing initialization
  this.#config = config;

  // Validate multi-format configuration
  const outputFormats = config?.outputFormats || ['json'];
  const supportedFormats = ['json', 'text']; // HTML and Markdown future
  const unsupportedFormats = outputFormats.filter(
    format => !supportedFormats.includes(format)
  );

  if (unsupportedFormats.length > 0) {
    this.#logger.warn('Unsupported output formats configured', {
      unsupportedFormats,
      supportedFormats
    });
  }

  this.#logger.info('ActionTraceOutputService initialized', {
    outputFormats,
    textFormatEnabled: outputFormats.includes('text'),
    outputToFile: config.outputToFile,
    outputToConsole: config.outputToConsole
  });
}
```

## Implementation Steps

1. **Locate ActionTraceOutputService**
   - [ ] Find `src/actions/tracing/actionTraceOutputService.js`
   - [ ] Review existing formatter usage and architecture
   - [ ] Identify integration points for multi-format support

2. **Implement Multi-Format Generation**
   - [ ] Add `#generateFormattedOutputs()` method
   - [ ] Use existing `#jsonFormatter` and `#humanReadableFormatter` instances
   - [ ] Generate content for each enabled format
   - [ ] Create appropriate file names for each format
   - [ ] Handle unsupported formats gracefully

3. **Enhance Output Method**
   - [ ] Update `outputTrace()` to use new generation method
   - [ ] Pass formatted outputs array to file handler
   - [ ] Maintain existing console and export functionality
   - [ ] Add proper error handling and logging

4. **Update File Name Handling**
   - [ ] Enhance file name generation for multiple formats
   - [ ] Add format-specific extension mapping
   - [ ] Ensure consistent naming across formats

5. **Integrate Configuration Support**
   - [ ] Add configuration validation in initialization
   - [ ] Log multi-format configuration details
   - [ ] Handle unsupported formats gracefully
   - [ ] Maintain backward compatibility

6. **Update Constructor and Dependencies**
   - [ ] Ensure proper formatter instance access
   - [ ] Validate file handler compatibility
   - [ ] Update dependency injection if needed

## Acceptance Criteria

- [ ] Service generates JSON format when configured
- [ ] Service generates text format when configured
- [ ] Service generates both formats when both configured
- [ ] Text format uses proper file extension (.txt)
- [ ] Text format disables colors for file output
- [ ] Unsupported formats are logged but don't cause failures
- [ ] Existing functionality (console, export) unchanged
- [ ] Multiple formatted outputs passed to file handler
- [ ] Proper error handling for format generation failures
- [ ] Configuration validation provides clear feedback
- [ ] File naming consistent across all formats
- [ ] Backward compatibility maintained for single format

## Dependencies

- **Depends On**: DUALFORMACT-002 (Configuration Loader Enhancement)
- **Required By**: DUALFORMACT-004 (FileTraceOutputHandler Updates)
- **Required By**: DUALFORMACT-005 (Unit Test Implementation)

## Testing Requirements

1. **Unit Tests**
   - [ ] Test `#generateFormattedOutputs()` with JSON-only config
   - [ ] Test `#generateFormattedOutputs()` with text-only config
   - [ ] Test `#generateFormattedOutputs()` with dual-format config
   - [ ] Test file name generation for different formats
   - [ ] Test configuration validation and warnings
   - [ ] Test error handling for formatter failures
   - [ ] Test text format options are properly passed

2. **Integration Tests**
   - [ ] Test with actual formatter instances
   - [ ] Test output method with different configurations
   - [ ] Test file handler integration with multiple formats
   - [ ] Test existing export functionality unchanged

3. **Mocking Requirements**
   - [ ] Mock file handler `writeFormattedTraces()` method
   - [ ] Mock formatters for consistent test data
   - [ ] Mock configuration loader for different configs

## Files to Modify

- **Primary**: `src/actions/tracing/actionTraceOutputService.js`
- **Interface Update**: File handler interface for `writeFormattedTraces()` method

## Search Patterns for Impact Analysis

```bash
# Find ActionTraceOutputService usage
grep -r "ActionTraceOutputService" src/

# Find outputTrace method usage
grep -r "outputTrace" src/ | grep -v test

# Find file handler interactions
grep -r "fileHandler" src/actions/tracing/
```

## Format Generation Examples

```javascript
// Example output for dual-format configuration
const formattedOutputs = [
  {
    content:
      '{"actionId":"fondle_ass","timestamp":"2025-08-22T14:30:22.123Z",...}',
    fileName: 'trace_fondle_ass_player_20250822_143022.json',
  },
  {
    content:
      '=== Action Trace Report ===\nAction: fondle_ass\nActor: player\n...',
    fileName: 'trace_fondle_ass_player_20250822_143022.txt',
  },
];
```

## Error Handling Strategy

```javascript
// Graceful handling of formatter errors
try {
  const jsonContent = this.#jsonFormatter.format(trace);
  outputs.push({ content: jsonContent, fileName: baseFileName });
} catch (error) {
  this.#logger.error('JSON formatting failed', {
    actionId: trace.actionId,
    error: error.message,
  });
  // Don't fail entire operation if one format fails
}
```

## Performance Considerations

1. **Parallel Generation**: Formats generated sequentially but could be parallel
2. **Memory Usage**: Multiple formats in memory briefly (acceptable for typical trace sizes)
3. **CPU Impact**: ~2-3ms additional per format (measured in spec)
4. **Caching**: Formatter instances cached, no recreation overhead

## Migration Guide

### For Service Users

- **No Changes Required**: Existing service usage unchanged
- **New Capability**: Multi-format output automatically enabled based on configuration

### For File Handler

- **Interface Update**: Must implement `writeFormattedTraces()` method
- **Backward Compatibility**: Existing single-format methods still work

## Risk Mitigation

1. **Formatter Failure Isolation**
   - Each format generated independently
   - Failure in one format doesn't affect others
   - Clear error logging for troubleshooting

2. **Memory Management**
   - Generate formats just-in-time
   - Don't store multiple formats long-term
   - Clean up after file writing

3. **Configuration Robustness**
   - Validate formats during initialization
   - Graceful handling of unsupported formats
   - Clear warning messages for user guidance

## Notes

- Core implementation of dual-format feature
- Leverages existing formatter infrastructure
- Maintains strict backward compatibility
- Option B approach per specification recommendation
- Foundation for all subsequent dual-format functionality

## Related Tickets

- **Depends On**: DUALFORMACT-002 (Configuration Loader Enhancement)
- **Blocks**: DUALFORMACT-004 (FileTraceOutputHandler Updates)
- **Blocks**: DUALFORMACT-005 (Unit Test Implementation)
- **Integrates With**: DUALFORMACT-006 (Integration Test Suite)
