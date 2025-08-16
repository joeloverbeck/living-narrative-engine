/**
 * @file File-based trace output handler for browser environments
 * @description Handles writing trace files using File System Access API or fallback to downloads
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * Handles file-based output of trace data in browser environments
 * Uses File System Access API when available, falls back to downloads
 */
class FileTraceOutputHandler {
  #logger;
  #outputDirectory;
  #traceDirectoryManager;
  #rootDirectoryHandle;
  #tracesDirectoryHandle;
  #isInitialized = false;
  #queuedTraces = [];
  #isProcessingQueue = false;

  /**
   * @param {object} dependencies
   * @param {string} dependencies.outputDirectory - Directory path for trace output
   * @param {object} dependencies.traceDirectoryManager - Directory manager for file operations
   * @param {object} dependencies.logger - Logger instance
   */
  constructor({ outputDirectory, traceDirectoryManager, logger }) {
    this.#logger = ensureValidLogger(logger, 'FileTraceOutputHandler');
    this.#outputDirectory = outputDirectory || './traces';

    if (traceDirectoryManager) {
      validateDependency(
        traceDirectoryManager,
        'ITraceDirectoryManager',
        null,
        {
          requiredMethods: ['selectDirectory', 'ensureSubdirectoryExists'],
        }
      );
      this.#traceDirectoryManager = traceDirectoryManager;
    }

    this.#logger.debug('FileTraceOutputHandler initialized', {
      outputDirectory: this.#outputDirectory,
      hasDirectoryManager: !!this.#traceDirectoryManager,
    });
  }

  /**
   * Initialize the file output system
   *
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    if (this.#isInitialized) {
      return true;
    }

    try {
      // Check if File System Access API is supported
      if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
        this.#logger.info(
          'File System Access API supported - traces can be saved to filesystem'
        );
      } else {
        this.#logger.info(
          'File System Access API not supported - will use download fallback'
        );
      }

      this.#isInitialized = true;
      return true;
    } catch (error) {
      this.#logger.error('Failed to initialize FileTraceOutputHandler', error);
      return false;
    }
  }

  /**
   * Write a trace to file system
   *
   * @param {object} traceData - Formatted trace data
   * @param {object} originalTrace - Original trace object
   * @returns {Promise<boolean>} Success status
   */
  async writeTrace(traceData, originalTrace) {
    // CRITICAL DEBUG: Log every call to writeTrace - DISABLED
    // Debug logging removed - was causing log pollution

    if (!this.#isInitialized) {
      await this.initialize();
    }

    try {
      // Queue the trace for processing
      this.#queuedTraces.push({
        traceData,
        originalTrace,
        timestamp: Date.now(),
      });

      this.#logger.warn('FileTraceOutputHandler: Trace queued for processing', {
        actionId: originalTrace?.actionId,
        actorId: originalTrace?.actorId,
        queueLength: this.#queuedTraces.length,
      });

      // Start processing if not already running
      if (!this.#isProcessingQueue) {
        this.#processTraceQueue();
      }

      return true;
    } catch (error) {
      this.#logger.error('Failed to queue trace for writing', error);
      return false;
    }
  }

  /**
   * Process queued traces
   *
   * @private
   */
  async #processTraceQueue() {
    if (this.#isProcessingQueue || this.#queuedTraces.length === 0) {
      return;
    }

    this.#isProcessingQueue = true;

    try {
      while (this.#queuedTraces.length > 0) {
        const { traceData, originalTrace, timestamp } =
          this.#queuedTraces.shift();
        await this.#writeTraceToFile(traceData, originalTrace, timestamp);
      }
    } catch (error) {
      this.#logger.error('Error processing trace queue', error);
    } finally {
      this.#isProcessingQueue = false;
    }
  }

  /**
   * Write individual trace to file
   *
   * @private
   * @param {object} traceData - Formatted trace data
   * @param {object} originalTrace - Original trace object
   * @param {number} timestamp - Write timestamp
   */
  async #writeTraceToFile(traceData, originalTrace, timestamp) {
    try {
      const fileName = this.#generateFileName(originalTrace, timestamp);
      const fileContent = this.#formatTraceContent(traceData, originalTrace);

      this.#logger.info('FileTraceOutputHandler: Writing trace to file', {
        fileName,
        actionId: originalTrace?.actionId,
        actorId: originalTrace?.actorId,
        outputDirectory: this.#outputDirectory,
      });

      // Try server endpoint first if available
      if (await this.#writeUsingServerEndpoint(fileName, fileContent)) {
        this.#logger.debug(`Trace written via server endpoint: ${fileName}`);
        return;
      }

      // Try File System Access API as second option
      if (await this.#writeUsingFileSystemAPI(fileName, fileContent)) {
        this.#logger.debug(`Trace written to file system: ${fileName}`);
        return;
      }

      // Fall back to download
      this.#downloadTrace(fileName, fileContent);
      this.#logger.debug(`Trace downloaded as file: ${fileName}`);
    } catch (error) {
      this.#logger.error('Failed to write trace to file', {
        error: error.message,
        actionId: originalTrace?.actionId,
        actorId: originalTrace?.actorId,
      });
    }
  }

  /**
   * Attempt to write using server endpoint
   *
   * @private
   * @param {string} fileName - Name of the file
   * @param {string} content - File content
   * @returns {Promise<boolean>} Success status
   */
  async #writeUsingServerEndpoint(fileName, content) {
    try {
      // Check if we're in a browser environment and have fetch available
      if (typeof window === 'undefined' || !window.fetch) {
        this.#logger.warn(
          'FileTraceOutputHandler: Not in browser environment or fetch unavailable',
          {
            hasWindow: typeof window !== 'undefined',
            hasFetch: typeof window !== 'undefined' && !!window.fetch,
            environment: typeof window !== 'undefined' ? 'browser' : 'node',
          }
        );
        return false;
      }

      this.#logger.info(
        'FileTraceOutputHandler: Attempting to write trace via server endpoint',
        {
          fileName,
          outputDirectory: this.#outputDirectory,
          contentLength: content.length,
        }
      );

      // Prepare the request to the LLM proxy server
      const requestBody = {
        traceData: content,
        fileName: fileName,
        outputDirectory: this.#outputDirectory,
      };

      this.#logger.info('FileTraceOutputHandler: Sending POST to server', {
        url: 'http://localhost:3001/api/traces/write',
        bodySize: JSON.stringify(requestBody).length,
      });

      const response = await fetch('http://localhost:3001/api/traces/write', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.#logger.error(
          'FileTraceOutputHandler: Server endpoint write failed',
          {
            status: response.status,
            statusText: response.statusText,
            error: errorData.error || 'Unknown error',
            details: errorData.details || 'No details',
          }
        );
        return false;
      }

      const result = await response.json();
      this.#logger.info(
        'FileTraceOutputHandler: Trace written to server successfully',
        {
          path: result.path,
          size: result.size,
          fileName: result.fileName,
        }
      );

      return true;
    } catch (error) {
      this.#logger.error(
        'FileTraceOutputHandler: Failed to write to server endpoint',
        {
          error: error.message,
          stack: error.stack,
          fileName,
        }
      );

      // Log specific error types for better debugging
      if (error.message.includes('Failed to fetch')) {
        this.#logger.error(
          'FileTraceOutputHandler: Server appears to be offline or unreachable at http://localhost:3001'
        );
      } else if (error.message.includes('CORS')) {
        this.#logger.error(
          'FileTraceOutputHandler: CORS error - check server CORS configuration'
        );
      }

      return false;
    }
  }

  /**
   * Attempt to write using File System Access API
   *
   * @private
   * @param {string} fileName - Name of the file
   * @param {string} content - File content
   * @returns {Promise<boolean>} Success status
   */
  async #writeUsingFileSystemAPI(fileName, content) {
    if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
      return false;
    }

    try {
      // Lazy initialization of directory handle
      if (!this.#tracesDirectoryHandle) {
        await this.#ensureDirectoryHandle();
      }

      if (!this.#tracesDirectoryHandle) {
        return false;
      }

      // Write the file
      const fileHandle = await this.#tracesDirectoryHandle.getFileHandle(
        fileName,
        {
          create: true,
        }
      );

      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      return true;
    } catch (error) {
      this.#logger.debug(
        'File System API write failed, will use download fallback',
        error.message
      );
      return false;
    }
  }

  /**
   * Ensure directory handle is available
   *
   * @private
   */
  async #ensureDirectoryHandle() {
    try {
      if (!this.#traceDirectoryManager) {
        return;
      }

      // This would prompt user to select directory on first use
      this.#rootDirectoryHandle =
        await this.#traceDirectoryManager.selectDirectory();

      if (this.#rootDirectoryHandle) {
        // Create traces subdirectory
        this.#tracesDirectoryHandle =
          await this.#traceDirectoryManager.ensureSubdirectoryExists(
            this.#rootDirectoryHandle,
            'traces'
          );
      }
    } catch (error) {
      this.#logger.debug('Could not establish directory handle', error.message);
    }
  }

  /**
   * Download trace as file (fallback method)
   *
   * @private
   * @param {string} fileName - Name of the file
   * @param {string} content - File content
   */
  #downloadTrace(fileName, content) {
    try {
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (error) {
      this.#logger.error('Failed to download trace file', error);
    }
  }

  /**
   * Generate filename for trace
   *
   * @private
   * @param {object} trace - Original trace object
   * @param {number} timestamp - Write timestamp
   * @returns {string} Generated filename
   */
  #generateFileName(trace, timestamp) {
    const date = new Date(timestamp);
    const dateStr = date.toISOString().replace(/:/g, '-').replace(/\./g, '_');

    const actionId = trace?.actionId || 'unknown';
    const actorId = trace?.actorId || 'unknown';

    // Create safe filename
    const safeActionId = actionId.replace(/[^a-z0-9_-]/gi, '_');
    const safeActorId = actorId.replace(/[^a-z0-9_-]/gi, '_');

    return `trace_${safeActionId}_${safeActorId}_${dateStr}.json`;
  }

  /**
   * Format trace content for file output
   *
   * @private
   * @param {object} traceData - Formatted trace data
   * @param {object} originalTrace - Original trace object
   * @returns {string} Formatted content
   */
  #formatTraceContent(traceData, originalTrace) {
    const output = {
      timestamp: new Date().toISOString(),
      outputDirectory: this.#outputDirectory,
      trace: traceData,
      metadata: {
        actionId: originalTrace?.actionId,
        actorId: originalTrace?.actorId,
        isComplete: originalTrace?.isComplete,
        hasError: originalTrace?.hasError,
        generatedBy: 'Living Narrative Engine Action Tracing System',
      },
    };

    return JSON.stringify(output, null, 2);
  }

  /**
   * Get statistics about file output
   *
   * @returns {object} Statistics
   */
  getStatistics() {
    return {
      isInitialized: this.#isInitialized,
      outputDirectory: this.#outputDirectory,
      queuedTraces: this.#queuedTraces.length,
      isProcessingQueue: this.#isProcessingQueue,
      hasDirectoryManager: !!this.#traceDirectoryManager,
      hasDirectoryHandle: !!this.#tracesDirectoryHandle,
      supportsFileSystemAPI:
        typeof window !== 'undefined' && 'showDirectoryPicker' in window,
    };
  }

  /**
   * Set output directory
   *
   * @param {string} directory - New output directory
   */
  setOutputDirectory(directory) {
    this.#outputDirectory = directory;
    this.#logger.debug(`Output directory set to: ${directory}`);

    // Reset directory handles to force re-initialization
    this.#rootDirectoryHandle = null;
    this.#tracesDirectoryHandle = null;
  }
}

export default FileTraceOutputHandler;
