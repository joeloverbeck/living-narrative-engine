# ACTTRA-030: Integrate TraceDirectoryManager with Export Functionality

## Summary

Integrate the existing TraceDirectoryManager with ActionTraceOutputService to enable trace export from IndexedDB to the user's file system using the browser's File System Access API. This provides users with the ability to export and archive their action traces while maintaining the performance benefits of IndexedDB as primary storage.

## Status

- **Type**: Integration
- **Priority**: Low
- **Complexity**: Low
- **Estimated Time**: 1 hour
- **Dependencies**:
  - ACTTRA-024 (ActionTraceOutputService)
  - Existing TraceDirectoryManager implementation

## Context

The action tracing system currently stores traces in IndexedDB for browser-based persistence. The TraceDirectoryManager already exists at `src/actions/tracing/traceDirectoryManager.js` and implements the File System Access API for browser-based directory operations. This workflow focuses on integrating these existing components to provide export functionality.

## Objectives

### Primary Goals

1. **Export Functionality** - Enable users to export traces from IndexedDB to their file system
2. **Directory Selection** - Allow users to choose export directory via browser dialog
3. **Batch Export** - Support exporting multiple traces at once
4. **Format Options** - Export traces as JSON or formatted text files
5. **Permission Handling** - Gracefully handle browser permission requirements
6. **Progress Feedback** - Show export progress for large trace collections

### Success Criteria

- [ ] TraceDirectoryManager integrated with ActionTraceOutputService
- [ ] Export function prompts user for directory selection
- [ ] Traces exported from IndexedDB to selected directory
- [ ] Proper permission handling with user feedback
- [ ] Export progress indication for multiple traces
- [ ] Browser compatibility verified
- [ ] Error handling for denied permissions
- [ ] Clear user instructions provided

## Technical Specification

### 1. Integration with ActionTraceOutputService

#### Update: `src/actions/tracing/actionTraceOutputService.js`

```javascript
/**
 * @file Action trace output service with export functionality
 * @see traceDirectoryManager.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

// Add to imports
/** @typedef {import('./traceDirectoryManager.js').default} TraceDirectoryManager */

class ActionTraceOutputService {
  #logger;
  #storageRotationManager;
  #traceDirectoryManager;
  #exportInProgress;

  constructor({ 
    logger, 
    storageRotationManager,
    traceDirectoryManager // Add new dependency
  }) {
    validateDependency(storageRotationManager, 'IStorageRotationManager', logger, {
      requiredMethods: ['rotateStorage', 'getCurrentRotation']
    });
    
    // Add TraceDirectoryManager validation
    validateDependency(traceDirectoryManager, 'ITraceDirectoryManager', logger, {
      requiredMethods: ['ensureDirectoryExists', 'selectDirectory']
    });

    this.#logger = ensureValidLogger(logger, 'ActionTraceOutputService');
    this.#storageRotationManager = storageRotationManager;
    this.#traceDirectoryManager = traceDirectoryManager;
    this.#exportInProgress = false;
  }

  /**
   * Export traces from IndexedDB to user's file system
   * @param {Array<string>} traceIds - IDs of traces to export (optional)
   * @returns {Promise<object>} Export result
   */
  async exportTraces(traceIds = null) {
    if (this.#exportInProgress) {
      throw new Error('Export already in progress');
    }

    this.#exportInProgress = true;
    const startTime = Date.now();

    try {
      // Step 1: Prompt user to select export directory
      const directoryHandle = await this.#traceDirectoryManager.selectDirectory();
      
      if (!directoryHandle) {
        return {
          success: false,
          reason: 'User cancelled directory selection',
          duration: Date.now() - startTime
        };
      }

      // Step 2: Ensure export subdirectory exists
      const exportDir = await this.#traceDirectoryManager.ensureDirectoryExists(
        directoryHandle,
        `traces_${new Date().toISOString().split('T')[0]}`
      );

      // Step 3: Get traces from IndexedDB
      const traces = await this.#getTracesFromStorage(traceIds);
      
      if (traces.length === 0) {
        return {
          success: false,
          reason: 'No traces found to export',
          duration: Date.now() - startTime
        };
      }

      // Step 4: Export each trace to a file
      const exportResults = [];
      for (let i = 0; i < traces.length; i++) {
        const trace = traces[i];
        const progress = ((i + 1) / traces.length) * 100;
        
        // Dispatch progress event
        this.#dispatchExportProgress(progress, i + 1, traces.length);
        
        try {
          const fileName = this.#generateFileName(trace);
          const fileContent = this.#formatTraceForExport(trace);
          
          // Write file using TraceDirectoryManager
          await this.#writeTraceFile(exportDir, fileName, fileContent);
          
          exportResults.push({
            traceId: trace.id,
            fileName,
            success: true
          });
        } catch (error) {
          this.#logger.error(`Failed to export trace ${trace.id}`, error);
          exportResults.push({
            traceId: trace.id,
            success: false,
            error: error.message
          });
        }
      }

      // Step 5: Generate export summary
      const successCount = exportResults.filter(r => r.success).length;
      
      return {
        success: true,
        totalTraces: traces.length,
        exportedCount: successCount,
        failedCount: traces.length - successCount,
        exportPath: exportDir.name,
        results: exportResults,
        duration: Date.now() - startTime
      };

    } catch (error) {
      this.#logger.error('Export failed', error);
      
      // Handle specific errors
      if (error.name === 'AbortError') {
        return {
          success: false,
          reason: 'User denied file system access',
          duration: Date.now() - startTime
        };
      }
      
      throw error;
    } finally {
      this.#exportInProgress = false;
    }
  }

  /**
   * Get traces from IndexedDB storage
   * @private
   */
  async #getTracesFromStorage(traceIds) {
    // Implementation depends on IndexedDB structure
    // This would retrieve traces from the storage rotation manager
    const currentRotation = this.#storageRotationManager.getCurrentRotation();
    
    // Placeholder - actual implementation would query IndexedDB
    return [];
  }

  /**
   * Generate file name for trace export
   * @private
   */
  #generateFileName(trace) {
    const timestamp = new Date(trace.timestamp).toISOString()
      .replace(/:/g, '-')
      .replace(/\./g, '_');
    
    return `trace_${trace.actionType}_${timestamp}.json`;
  }

  /**
   * Format trace data for export
   * @private
   */
  #formatTraceForExport(trace) {
    // Pretty print JSON for readability
    return JSON.stringify(trace, null, 2);
  }

  /**
   * Write trace file using File System Access API
   * @private
   */
  async #writeTraceFile(directoryHandle, fileName, content) {
    const fileHandle = await directoryHandle.getFileHandle(fileName, { 
      create: true 
    });
    
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  /**
   * Dispatch export progress event
   * @private
   */
  #dispatchExportProgress(percentage, current, total) {
    // Would dispatch event through event bus
    this.#logger.info(
      `Export progress: ${percentage.toFixed(1)}% (${current}/${total})`
    );
  }

  /**
   * Export traces in specific format
   * @param {string} format - Export format ('json' | 'text' | 'csv')
   */
  async exportTracesWithFormat(traceIds, format = 'json') {
    // Extended export with format options
    // Implementation would handle different output formats
  }
}

export default ActionTraceOutputService;
```

### 2. Update Dependency Injection Registration

#### Update: `src/dependencyInjection/registrations/actionTracingRegistrations.js`

```javascript
// Add TraceDirectoryManager to imports
import TraceDirectoryManager from '../../actions/tracing/traceDirectoryManager.js';

// Update registration
container.register(
  tokens.IActionTraceOutputService,
  ActionTraceOutputService,
  {
    dependencies: [
      tokens.ILogger,
      tokens.IStorageRotationManager,
      tokens.ITraceDirectoryManager // Add new dependency
    ]
  }
);

// Add TraceDirectoryManager registration if not already present
container.register(
  tokens.ITraceDirectoryManager,
  TraceDirectoryManager,
  {
    dependencies: [tokens.ILogger]
  }
);
```

### 3. UI Integration for Export

#### Create: `src/domUI/components/traceExportButton.js`

```javascript
/**
 * @file Export button component for action traces
 */

export class TraceExportButton {
  #actionTraceOutputService;
  #button;
  #progressBar;

  constructor({ actionTraceOutputService }) {
    this.#actionTraceOutputService = actionTraceOutputService;
  }

  /**
   * Create and attach export button to UI
   */
  render(containerId) {
    const container = document.getElementById(containerId);
    
    // Create export button
    this.#button = document.createElement('button');
    this.#button.textContent = 'Export Traces';
    this.#button.className = 'trace-export-btn';
    this.#button.onclick = () => this.#handleExport();
    
    // Create progress bar (hidden initially)
    this.#progressBar = document.createElement('div');
    this.#progressBar.className = 'export-progress';
    this.#progressBar.style.display = 'none';
    
    container.appendChild(this.#button);
    container.appendChild(this.#progressBar);
  }

  async #handleExport() {
    this.#button.disabled = true;
    this.#progressBar.style.display = 'block';
    
    try {
      const result = await this.#actionTraceOutputService.exportTraces();
      
      if (result.success) {
        this.#showSuccess(
          `Exported ${result.exportedCount} traces to ${result.exportPath}`
        );
      } else {
        this.#showError(result.reason);
      }
    } catch (error) {
      this.#showError('Export failed: ' + error.message);
    } finally {
      this.#button.disabled = false;
      this.#progressBar.style.display = 'none';
    }
  }

  #showSuccess(message) {
    // Display success notification
    console.log('Export success:', message);
  }

  #showError(message) {
    // Display error notification
    console.error('Export error:', message);
  }
}
```

## Implementation Notes

### Browser Compatibility

1. **File System Access API Support**
   - Chrome/Edge: Full support (v86+)
   - Firefox: Not supported (use fallback)
   - Safari: Not supported (use fallback)

2. **Fallback Options**
   - Download as ZIP using blob URLs
   - Copy to clipboard as JSON
   - Display in modal for manual save

### Permission Handling

1. **User Prompts**
   - Clear explanation of why permission is needed
   - Handle permission denial gracefully
   - Remember user's directory choice (if API allows)

2. **Security Considerations**
   - Browser sandboxing limits file system access
   - User must explicitly grant permission
   - No automatic file writes without user action

### IndexedDB Integration

1. **Storage Structure**
   - Traces stored with rotation management
   - Query by date range or action type
   - Batch retrieval for performance

2. **Memory Management**
   - Stream large exports
   - Process in chunks
   - Clear progress indication

## Testing Requirements

### Unit Tests

```javascript
// tests/unit/actions/tracing/actionTraceOutputService.export.test.js

describe('ActionTraceOutputService - Export Functionality', () => {
  it('should prompt user for directory selection');
  it('should handle permission denial gracefully');
  it('should export traces to selected directory');
  it('should generate appropriate file names');
  it('should format traces correctly for export');
  it('should handle export errors');
  it('should prevent concurrent exports');
  it('should dispatch progress events');
});
```

### Integration Tests

```javascript
// tests/integration/actions/tracing/traceExport.integration.test.js

describe('Trace Export Integration', () => {
  it('should export traces from IndexedDB to mock file system');
  it('should integrate with TraceDirectoryManager');
  it('should handle browser API limitations');
  it('should provide fallback for unsupported browsers');
});
```

## Error Handling

### Error Scenarios

1. **Permission Denied**
   - User denies file system access
   - Browser blocks access
   - Solution: Show clear explanation, offer alternatives

2. **Browser Incompatibility**
   - File System Access API not supported
   - Solution: Use fallback export methods

3. **Storage Issues**
   - IndexedDB unavailable
   - No traces to export
   - Solution: Clear error messages

### User Communication

1. **Permission Request**
   ```
   "This app needs permission to save trace files to your computer. 
    You'll be prompted to select a folder for the export."
   ```

2. **Success Message**
   ```
   "Successfully exported X traces to [folder name]"
   ```

3. **Error Message**
   ```
   "Export failed: [specific reason]. 
    Try using the 'Download as ZIP' option instead."
   ```

## Dependencies

- `TraceDirectoryManager` - Browser file system operations
- `StorageRotationManager` - IndexedDB trace storage
- `ILogger` - Logging service
- Browser File System Access API

## Next Steps

This completes the integration of export functionality. Future enhancements could include:

- Scheduled automatic exports
- Export filtering (by date, type, etc.)
- Multiple export formats (CSV, plain text)
- Cloud storage integration
- Export compression for large datasets

---

**Ticket Status**: Ready for Implementation
**Last Updated**: 2025-01-12
**Author**: System Architect