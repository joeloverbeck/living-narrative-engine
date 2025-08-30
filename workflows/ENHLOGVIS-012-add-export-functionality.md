# ENHLOGVIS-012: Add Export Functionality for Critical Logs

## Ticket Overview
**Type**: Feature Enhancement  
**Component**: Data Export/UI  
**Priority**: Medium  
**Phase**: 3 - Enhanced Features  
**Estimated Effort**: 2-3 hours  

## Objective
Implement functionality to export critical logs in various formats (JSON, CSV, text) for debugging, analysis, and sharing purposes. Include both filtered and complete log exports with metadata.

## Current State
- LogFilter has export methods (JSON, CSV) from ENHLOGVIS-011
- No UI for triggering exports
- No file download implementation
- No clipboard copy functionality
- No export metadata (timestamp, filters applied)

## Technical Implementation

### Files to Create/Modify
- `src/logging/ui/logExporter.js` - Export functionality
- Update `criticalLogNotifier.js` - Add export methods
- Update `criticalLogNotifierRenderer.js` - Add export UI
- Update `criticalLogNotifierEvents.js` - Connect export actions

### Implementation Steps

1. **Create Log Exporter Utility** (`src/logging/ui/logExporter.js`):
   ```javascript
   /**
    * @file Export functionality for critical logs
    */
   
   import { validateDependency } from '../../utils/dependencyUtils.js';
   
   class LogExporter {
     #logger;
     #appInfo;
     
     constructor({ logger, appInfo = {} }) {
       validateDependency(logger, 'ILogger', console, {
         requiredMethods: ['debug', 'error']
       });
       
       this.#logger = logger;
       this.#appInfo = {
         name: 'Living Narrative Engine',
         version: '1.0.0',
         ...appInfo
       };
     }
     
     /**
      * Export logs as JSON with metadata
      * @param {Array} logs - Logs to export
      * @param {Object} options - Export options
      * @returns {string}
      */
     exportAsJSON(logs, options = {}) {
       const exportData = {
         metadata: this.#createMetadata(options),
         logs: logs.map(this.#sanitizeLog),
         summary: this.#createSummary(logs)
       };
       
       return JSON.stringify(exportData, null, 2);
     }
     
     /**
      * Export logs as CSV
      * @param {Array} logs - Logs to export
      * @param {Object} options - Export options
      * @returns {string}
      */
     exportAsCSV(logs, options = {}) {
       const headers = [
         'Timestamp',
         'ISO Time',
         'Level',
         'Category',
         'Message',
         'Has Metadata',
         'Stack Trace'
       ];
       
       const rows = logs.map(log => {
         const isoTime = new Date(log.timestamp).toISOString();
         const localTime = new Date(log.timestamp).toLocaleString();
         
         return [
           localTime,
           isoTime,
           log.level.toUpperCase(),
           log.category || 'general',
           this.#escapeCSV(log.message),
           log.metadata && Object.keys(log.metadata).length > 0 ? 'Yes' : 'No',
           this.#escapeCSV(log.metadata?.stack || '')
         ];
       });
       
       // Add metadata as comments
       const metadata = [
         `# Exported: ${new Date().toISOString()}`,
         `# Application: ${this.#appInfo.name} v${this.#appInfo.version}`,
         `# Total Logs: ${logs.length}`,
         `# Filters Applied: ${options.filters ? 'Yes' : 'No'}`,
         ''
       ];
       
       return [
         ...metadata,
         headers.join(','),
         ...rows.map(row => row.join(','))
       ].join('\n');
     }
     
     /**
      * Export logs as plain text
      * @param {Array} logs - Logs to export
      * @param {Object} options - Export options
      * @returns {string}
      */
     exportAsText(logs, options = {}) {
       const lines = [
         '='.repeat(80),
         'CRITICAL LOGS EXPORT',
         '='.repeat(80),
         '',
         `Application: ${this.#appInfo.name} v${this.#appInfo.version}`,
         `Exported: ${new Date().toLocaleString()}`,
         `Total Logs: ${logs.length}`,
         ''
       ];
       
       if (options.filters) {
         lines.push('Applied Filters:');
         Object.entries(options.filters).forEach(([key, value]) => {
           if (value && value !== 'all') {
             lines.push(`  - ${key}: ${value}`);
           }
         });
         lines.push('');
       }
       
       lines.push('-'.repeat(80));
       lines.push('');
       
       // Group logs by level
       const warnings = logs.filter(l => l.level === 'warn');
       const errors = logs.filter(l => l.level === 'error');
       
       if (warnings.length > 0) {
         lines.push(`WARNINGS (${warnings.length}):`);
         lines.push('-'.repeat(40));
         warnings.forEach(log => {
           lines.push(this.#formatLogAsText(log));
           lines.push('');
         });
       }
       
       if (errors.length > 0) {
         lines.push(`ERRORS (${errors.length}):`);
         lines.push('-'.repeat(40));
         errors.forEach(log => {
           lines.push(this.#formatLogAsText(log));
           lines.push('');
         });
       }
       
       lines.push('='.repeat(80));
       lines.push('END OF EXPORT');
       
       return lines.join('\n');
     }
     
     /**
      * Export logs as Markdown
      * @param {Array} logs - Logs to export
      * @param {Object} options - Export options
      * @returns {string}
      */
     exportAsMarkdown(logs, options = {}) {
       const lines = [
         '# Critical Logs Export',
         '',
         '## Metadata',
         '',
         `- **Application**: ${this.#appInfo.name} v${this.#appInfo.version}`,
         `- **Exported**: ${new Date().toLocaleString()}`,
         `- **Total Logs**: ${logs.length}`,
         `- **Browser**: ${navigator.userAgent}`,
         ''
       ];
       
       if (options.filters) {
         lines.push('### Applied Filters');
         lines.push('');
         Object.entries(options.filters).forEach(([key, value]) => {
           if (value && value !== 'all') {
             lines.push(`- **${key}**: ${value}`);
           }
         });
         lines.push('');
       }
       
       // Summary statistics
       const stats = this.#createSummary(logs);
       lines.push('## Summary');
       lines.push('');
       lines.push(`- Warnings: ${stats.warnings}`);
       lines.push(`- Errors: ${stats.errors}`);
       lines.push(`- Time Range: ${stats.timeRange}`);
       lines.push('');
       
       // Logs table
       lines.push('## Logs');
       lines.push('');
       lines.push('| Time | Level | Category | Message |');
       lines.push('|------|-------|----------|---------|');
       
       logs.forEach(log => {
         const time = new Date(log.timestamp).toLocaleTimeString();
         const level = log.level === 'warn' ? '⚠️ WARN' : '❌ ERROR';
         const category = log.category || 'general';
         const message = this.#escapeMarkdown(log.message);
         
         lines.push(`| ${time} | ${level} | ${category} | ${message} |`);
       });
       
       return lines.join('\n');
     }
     
     /**
      * Download logs as file
      * @param {string} content - Content to download
      * @param {string} filename - Filename for download
      * @param {string} mimeType - MIME type
      */
     downloadAsFile(content, filename, mimeType = 'text/plain') {
       try {
         const blob = new Blob([content], { type: mimeType });
         const url = URL.createObjectURL(blob);
         
         const link = document.createElement('a');
         link.href = url;
         link.download = filename;
         link.style.display = 'none';
         
         document.body.appendChild(link);
         link.click();
         
         // Cleanup
         setTimeout(() => {
           document.body.removeChild(link);
           URL.revokeObjectURL(url);
         }, 100);
         
         this.#logger.debug(`Downloaded logs as ${filename}`);
       } catch (error) {
         this.#logger.error('Failed to download logs', error);
         throw error;
       }
     }
     
     /**
      * Copy content to clipboard
      * @param {string} content - Content to copy
      * @returns {Promise<boolean>}
      */
     async copyToClipboard(content) {
       try {
         if (navigator.clipboard && window.isSecureContext) {
           await navigator.clipboard.writeText(content);
           this.#logger.debug('Logs copied to clipboard');
           return true;
         } else {
           // Fallback for older browsers
           const textarea = document.createElement('textarea');
           textarea.value = content;
           textarea.style.position = 'fixed';
           textarea.style.opacity = '0';
           
           document.body.appendChild(textarea);
           textarea.select();
           
           const success = document.execCommand('copy');
           document.body.removeChild(textarea);
           
           if (success) {
             this.#logger.debug('Logs copied to clipboard (fallback)');
           }
           return success;
         }
       } catch (error) {
         this.#logger.error('Failed to copy to clipboard', error);
         return false;
       }
     }
     
     /**
      * Generate filename with timestamp
      * @param {string} prefix - Filename prefix
      * @param {string} extension - File extension
      * @returns {string}
      */
     generateFilename(prefix = 'critical-logs', extension = 'json') {
       const timestamp = new Date().toISOString()
         .replace(/[:.]/g, '-')
         .replace('T', '_')
         .slice(0, -5); // Remove milliseconds and Z
       
       return `${prefix}_${timestamp}.${extension}`;
     }
     
     #createMetadata(options) {
       return {
         application: this.#appInfo,
         exportedAt: new Date().toISOString(),
         exportedBy: 'CriticalLogNotifier',
         browser: {
           userAgent: navigator.userAgent,
           platform: navigator.platform,
           language: navigator.language
         },
         filters: options.filters || null,
         exportFormat: options.format || 'json',
         totalLogs: options.totalLogs || 0
       };
     }
     
     #createSummary(logs) {
       const warnings = logs.filter(l => l.level === 'warn').length;
       const errors = logs.filter(l => l.level === 'error').length;
       
       const timestamps = logs.map(l => new Date(l.timestamp).getTime());
       const minTime = timestamps.length > 0 ? Math.min(...timestamps) : null;
       const maxTime = timestamps.length > 0 ? Math.max(...timestamps) : null;
       
       return {
         total: logs.length,
         warnings,
         errors,
         timeRange: minTime && maxTime
           ? `${new Date(minTime).toLocaleString()} - ${new Date(maxTime).toLocaleString()}`
           : 'N/A',
         categories: [...new Set(logs.map(l => l.category || 'general'))]
       };
     }
     
     #sanitizeLog(log) {
       // Remove circular references and sensitive data
       const sanitized = {
         timestamp: log.timestamp,
         level: log.level,
         message: log.message,
         category: log.category
       };
       
       if (log.metadata) {
         sanitized.metadata = {};
         
         // Only include safe metadata fields
         const safeFields = ['stack', 'errorName', 'errorMessage', 'userId', 'action'];
         Object.keys(log.metadata).forEach(key => {
           if (safeFields.includes(key)) {
             sanitized.metadata[key] = log.metadata[key];
           }
         });
       }
       
       return sanitized;
     }
     
     #formatLogAsText(log) {
       const time = new Date(log.timestamp).toLocaleString();
       const level = log.level.toUpperCase().padEnd(5);
       const category = (log.category || 'general').padEnd(15);
       
       let text = `[${time}] ${level} [${category}] ${log.message}`;
       
       if (log.metadata?.stack) {
         text += '\n  Stack Trace:\n';
         text += log.metadata.stack.split('\n').map(line => '    ' + line).join('\n');
       }
       
       return text;
     }
     
     #escapeCSV(value) {
       if (value == null) return '';
       
       const stringValue = String(value);
       
       // Escape quotes and wrap in quotes if contains comma, newline, or quotes
       if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
         return `"${stringValue.replace(/"/g, '""')}"`;
       }
       
       return stringValue;
     }
     
     #escapeMarkdown(text) {
       if (!text) return '';
       
       // Escape markdown special characters
       return text
         .replace(/\|/g, '\\|')
         .replace(/\*/g, '\\*')
         .replace(/_/g, '\\_')
         .replace(/\[/g, '\\[')
         .replace(/\]/g, '\\]')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;');
     }
   }
   
   export default LogExporter;
   ```

2. **Add Export UI to Renderer**:
   ```javascript
   // Add to CriticalLogNotifierRenderer
   
   #createExportMenu() {
     const menu = document.createElement('div');
     menu.className = 'lne-export-menu';
     menu.hidden = true;
     
     const formats = [
       { value: 'json', label: 'JSON', icon: '📄' },
       { value: 'csv', label: 'CSV', icon: '📊' },
       { value: 'text', label: 'Text', icon: '📝' },
       { value: 'markdown', label: 'Markdown', icon: '📑' },
       { value: 'clipboard', label: 'Copy to Clipboard', icon: '📋' }
     ];
     
     formats.forEach(format => {
       const button = document.createElement('button');
       button.className = 'lne-export-option';
       button.setAttribute('data-format', format.value);
       button.innerHTML = `${format.icon} Export as ${format.label}`;
       menu.appendChild(button);
     });
     
     return menu;
   }
   
   #addExportButton() {
     const header = this.#panel.querySelector('.lne-log-header');
     
     const exportBtn = document.createElement('button');
     exportBtn.className = 'lne-export-btn';
     exportBtn.innerHTML = '📥 Export';
     exportBtn.setAttribute('aria-label', 'Export logs');
     exportBtn.setAttribute('title', 'Export logs (Ctrl+Shift+E)');
     
     header.insertBefore(exportBtn, header.querySelector('.lne-clear-btn'));
     
     const exportMenu = this.#createExportMenu();
     header.appendChild(exportMenu);
   }
   ```

3. **Update CriticalLogNotifier to handle exports**:
   ```javascript
   // Add to CriticalLogNotifier
   
   import LogExporter from './ui/logExporter.js';
   
   class CriticalLogNotifier {
     #exporter;
     
     constructor({ config, logger }) {
       // ... existing constructor ...
       
       this.#exporter = new LogExporter({
         logger: this.#logger,
         appInfo: {
           name: 'Living Narrative Engine',
           version: '1.0.0' // Get from config or package.json
         }
       });
     }
     
     /**
      * Export logs in specified format
      * @param {string} format - Export format
      * @param {Object} options - Export options
      */
     async exportLogs(format, options = {}) {
       const logs = options.filtered 
         ? this.#filter.getFilteredLogs()
         : this.#recentLogs;
       
       const exportOptions = {
         filters: this.#filter.getFilter(),
         totalLogs: this.#recentLogs.length,
         format
       };
       
       let content;
       let filename;
       let mimeType;
       
       switch (format) {
         case 'json':
           content = this.#exporter.exportAsJSON(logs, exportOptions);
           filename = this.#exporter.generateFilename('critical-logs', 'json');
           mimeType = 'application/json';
           break;
           
         case 'csv':
           content = this.#exporter.exportAsCSV(logs, exportOptions);
           filename = this.#exporter.generateFilename('critical-logs', 'csv');
           mimeType = 'text/csv';
           break;
           
         case 'text':
           content = this.#exporter.exportAsText(logs, exportOptions);
           filename = this.#exporter.generateFilename('critical-logs', 'txt');
           mimeType = 'text/plain';
           break;
           
         case 'markdown':
           content = this.#exporter.exportAsMarkdown(logs, exportOptions);
           filename = this.#exporter.generateFilename('critical-logs', 'md');
           mimeType = 'text/markdown';
           break;
           
         case 'clipboard':
           // Default to JSON for clipboard
           content = this.#exporter.exportAsJSON(logs, exportOptions);
           const success = await this.#exporter.copyToClipboard(content);
           
           if (success) {
             this.#showNotification('Logs copied to clipboard', 'success');
           } else {
             this.#showNotification('Failed to copy to clipboard', 'error');
           }
           return;
           
         default:
           this.#logger.error(`Unknown export format: ${format}`);
           return;
       }
       
       // Download file
       this.#exporter.downloadAsFile(content, filename, mimeType);
       this.#showNotification(`Exported ${logs.length} logs`, 'success');
     }
     
     #showNotification(message, type = 'info') {
       // Simple notification (could be enhanced with toast UI)
       this.#logger.info(message);
       
       // Emit event for UI feedback
       if (this.#eventHandler) {
         this.#eventHandler.emit('export-notification', { message, type });
       }
     }
   }
   ```

## Dependencies
- **Depends On**: ENHLOGVIS-002 (Log buffer)
- **Depends On**: ENHLOGVIS-011 (Filter functionality)
- **Uses**: LogFilter export methods from ENHLOGVIS-011

## Acceptance Criteria
- [ ] Export as JSON includes metadata and summary
- [ ] Export as CSV properly escapes values
- [ ] Export as text is human-readable
- [ ] Export as Markdown renders correctly
- [ ] Copy to clipboard works
- [ ] File download triggers correctly
- [ ] Filename includes timestamp
- [ ] Filtered exports only include visible logs
- [ ] Export respects current filters
- [ ] Keyboard shortcut (Ctrl+Shift+E) works
- [ ] Export menu UI is accessible

## Testing Requirements

### Unit Tests
- Test JSON export format validity
- Test CSV escaping for special characters
- Test text formatting
- Test Markdown table generation
- Test filename generation
- Test metadata creation
- Test log sanitization

### Manual Testing
1. Click Export button - menu appears
2. Select JSON - downloads valid JSON file
3. Select CSV - opens in Excel/Sheets correctly
4. Select Text - readable in text editor
5. Select Markdown - renders in MD viewer
6. Click Copy - paste works in other apps
7. Apply filters then export - only filtered logs
8. Press Ctrl+Shift+E - export menu toggles
9. Export with no logs - handles gracefully
10. Export large log set - performance acceptable

## Code Review Checklist
- [ ] No sensitive data in exports
- [ ] Proper error handling for downloads
- [ ] Clipboard fallback for older browsers
- [ ] File size reasonable for large exports
- [ ] MIME types correct
- [ ] Escaping prevents injection

## Notes
- Consider compression for large exports
- Could add email export option in future
- Markdown format useful for GitHub issues
- Consider adding custom export templates
- May want to limit export size for performance

## Related Tickets
- **Depends On**: ENHLOGVIS-002, ENHLOGVIS-011
- **Completes**: Phase 3 Enhanced Features
- **Future**: Could add cloud upload, email integration