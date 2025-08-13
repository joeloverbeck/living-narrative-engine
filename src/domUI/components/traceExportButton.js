/**
 * @file Export button component for action traces
 * @see actionTraceOutputService.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * UI component for exporting action traces from IndexedDB
 */
export class TraceExportButton {
  #actionTraceOutputService;
  #eventBus;
  #logger;
  #button;
  #progressBar;
  #progressText;
  #container;
  #isExporting;

  /**
   * @param {object} dependencies
   * @param {object} dependencies.actionTraceOutputService - Service for trace export
   * @param {object} [dependencies.eventBus] - Event bus for progress updates
   * @param {object} [dependencies.logger] - Logger instance
   */
  constructor({ actionTraceOutputService, eventBus, logger }) {
    validateDependency(actionTraceOutputService, 'IActionTraceOutputService', null, {
      requiredMethods: ['exportTracesToFileSystem', 'exportTracesAsDownload']
    });

    this.#actionTraceOutputService = actionTraceOutputService;
    this.#eventBus = eventBus;
    this.#logger = ensureValidLogger(logger, 'TraceExportButton');
    this.#isExporting = false;

    // Subscribe to export progress events if event bus available
    if (this.#eventBus) {
      this.#eventBus.subscribe('TRACE_EXPORT_PROGRESS', (event) => {
        this.#updateProgress(event.payload);
      });
    }
  }

  /**
   * Create and attach export button to UI
   * 
   * @param {string} containerId - ID of container element
   */
  render(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      this.#logger.error(`Container with ID "${containerId}" not found`);
      return;
    }

    this.#container = container;
    
    // Create wrapper div for export controls
    const wrapper = document.createElement('div');
    wrapper.className = 'trace-export-wrapper';
    wrapper.style.cssText = 'margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 4px;';
    
    // Create export button
    this.#button = document.createElement('button');
    this.#button.textContent = 'Export Traces';
    this.#button.className = 'trace-export-btn';
    this.#button.style.cssText = 'padding: 8px 16px; font-size: 14px; cursor: pointer; background: #4CAF50; color: white; border: none; border-radius: 4px;';
    this.#button.onclick = () => this.#handleExport();
    
    // Create format selector
    const formatSelector = document.createElement('select');
    formatSelector.id = 'trace-export-format';
    formatSelector.style.cssText = 'margin-left: 10px; padding: 8px; font-size: 14px;';
    
    const jsonOption = document.createElement('option');
    jsonOption.value = 'json';
    jsonOption.textContent = 'JSON';
    formatSelector.appendChild(jsonOption);
    
    const textOption = document.createElement('option');
    textOption.value = 'text';
    textOption.textContent = 'Text';
    formatSelector.appendChild(textOption);
    
    // Create progress container (hidden initially)
    const progressContainer = document.createElement('div');
    progressContainer.style.cssText = 'margin-top: 10px; display: none;';
    
    this.#progressBar = document.createElement('div');
    this.#progressBar.className = 'export-progress-bar';
    this.#progressBar.style.cssText = 'width: 100%; height: 20px; background: #f0f0f0; border-radius: 4px; overflow: hidden;';
    
    const progressFill = document.createElement('div');
    progressFill.className = 'export-progress-fill';
    progressFill.style.cssText = 'width: 0%; height: 100%; background: #4CAF50; transition: width 0.3s ease;';
    this.#progressBar.appendChild(progressFill);
    
    this.#progressText = document.createElement('div');
    this.#progressText.className = 'export-progress-text';
    this.#progressText.style.cssText = 'margin-top: 5px; font-size: 12px; color: #666;';
    this.#progressText.textContent = 'Ready to export';
    
    progressContainer.appendChild(this.#progressBar);
    progressContainer.appendChild(this.#progressText);
    
    // Add all elements to wrapper
    wrapper.appendChild(this.#button);
    wrapper.appendChild(formatSelector);
    wrapper.appendChild(progressContainer);
    
    // Add wrapper to container
    container.appendChild(wrapper);
    
    this.#logger.debug('TraceExportButton rendered');
  }

  /**
   * Handle export button click
   * 
   * @private
   */
  async #handleExport() {
    if (this.#isExporting) {
      this.#logger.warn('Export already in progress');
      return;
    }

    this.#isExporting = true;
    this.#button.disabled = true;
    this.#button.textContent = 'Exporting...';
    
    // Get selected format
    const formatSelector = document.getElementById('trace-export-format');
    const format = formatSelector ? formatSelector.value : 'json';
    
    // Show progress container
    const progressContainer = this.#progressBar?.parentElement;
    if (progressContainer) {
      progressContainer.style.display = 'block';
    }
    
    try {
      this.#logger.info(`Starting trace export in ${format} format`);
      
      // Try File System Access API first, will fall back to download if not supported
      const result = await this.#actionTraceOutputService.exportTracesToFileSystem(null, format);
      
      if (result.success) {
        this.#showSuccess(result);
      } else {
        this.#showError(result.reason || 'Export failed');
      }
    } catch (error) {
      this.#logger.error('Export failed with error', error);
      this.#showError(`Export failed: ${error.message}`);
    } finally {
      this.#isExporting = false;
      this.#button.disabled = false;
      this.#button.textContent = 'Export Traces';
      
      // Hide progress after a delay
      setTimeout(() => {
        const progressContainer = this.#progressBar?.parentElement;
        if (progressContainer) {
          progressContainer.style.display = 'none';
        }
      }, 3000);
    }
  }

  /**
   * Update progress display
   * 
   * @private
   * @param {object} progress - Progress data
   */
  #updateProgress(progress) {
    if (!this.#progressBar || !this.#progressText) return;
    
    const progressFill = this.#progressBar.querySelector('.export-progress-fill');
    if (progressFill) {
      progressFill.style.width = `${progress.progress}%`;
    }
    
    this.#progressText.textContent = `Exporting: ${progress.current}/${progress.total} traces (${Math.round(progress.progress)}%)`;
  }

  /**
   * Show success message
   * 
   * @private
   * @param {object} result - Export result
   */
  #showSuccess(result) {
    const message = result.exportPath 
      ? `Successfully exported ${result.exportedCount} traces to ${result.exportPath}`
      : `Successfully exported ${result.exportedCount} traces`;
    
    this.#logger.info(message);
    
    if (this.#progressText) {
      this.#progressText.textContent = message;
      this.#progressText.style.color = '#4CAF50';
    }
    
    // Update progress bar to 100%
    const progressFill = this.#progressBar?.querySelector('.export-progress-fill');
    if (progressFill) {
      progressFill.style.width = '100%';
    }
    
    // Show alert for user feedback
    if (result.method === 'download') {
      alert(`Traces exported successfully!\nFile: ${result.fileName}`);
    } else {
      alert(`Traces exported successfully!\nLocation: ${result.exportPath}\nExported: ${result.exportedCount} traces`);
    }
  }

  /**
   * Show error message
   * 
   * @private
   * @param {string} message - Error message
   */
  #showError(message) {
    this.#logger.error('Export error:', message);
    
    if (this.#progressText) {
      this.#progressText.textContent = `Error: ${message}`;
      this.#progressText.style.color = '#f44336';
    }
    
    // Reset progress bar
    const progressFill = this.#progressBar?.querySelector('.export-progress-fill');
    if (progressFill) {
      progressFill.style.width = '0%';
    }
    
    // Show alert for user feedback
    alert(`Export failed: ${message}`);
  }

  /**
   * Destroy the component and clean up
   */
  destroy() {
    if (this.#button) {
      this.#button.onclick = null;
      this.#button.remove();
    }
    
    if (this.#progressBar) {
      this.#progressBar.remove();
    }
    
    if (this.#progressText) {
      this.#progressText.remove();
    }
    
    // Unsubscribe from events if needed
    if (this.#eventBus) {
      // Note: Would need unsubscribe method on event bus
    }
    
    this.#logger.debug('TraceExportButton destroyed');
  }
}

export default TraceExportButton;