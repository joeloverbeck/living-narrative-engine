/**
 * @file Trace file writing endpoint for action tracing system
 * @description Handles writing trace files from the browser to the filesystem
 */

import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { ConsoleLogger } from '../consoleLogger.js';

const router = express.Router();
const logger = new ConsoleLogger();

/**
 * POST /api/traces/write
 * Write a trace file to the filesystem
 * @body {object} traceData - The trace data to write
 * @body {string} fileName - The name of the file to write
 * @body {string} outputDirectory - The directory to write to (relative to project root)
 */
router.post('/write', async (req, res) => {
  try {
    const { traceData, fileName, outputDirectory } = req.body;

    // Validate required fields
    if (!traceData || !fileName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: traceData and fileName',
      });
    }

    // Sanitize file name to prevent path traversal
    const sanitizedFileName = path.basename(fileName);

    // Default output directory if not specified
    const targetDirectory = outputDirectory || './traces';

    // Resolve the full path (relative to project root, not llm-proxy-server)
    const projectRoot = path.resolve(process.cwd(), '../');
    const fullDirectoryPath = path.join(projectRoot, targetDirectory);

    // Ensure the directory exists
    await fs.mkdir(fullDirectoryPath, { recursive: true });

    // Construct the full file path
    const fullFilePath = path.join(fullDirectoryPath, sanitizedFileName);

    // Ensure we're not writing outside the project directory (security check)
    if (!fullFilePath.startsWith(projectRoot)) {
      logger.error('Attempted to write trace file outside project directory', {
        attemptedPath: fullFilePath,
        projectRoot,
      });
      return res.status(403).json({
        success: false,
        error: 'Invalid output path',
      });
    }

    // Write the trace file
    const jsonContent =
      typeof traceData === 'string'
        ? traceData
        : JSON.stringify(traceData, null, 2);

    await fs.writeFile(fullFilePath, jsonContent, 'utf8');

    logger.info('Trace file written successfully', {
      fileName: sanitizedFileName,
      directory: targetDirectory,
      fullPath: fullFilePath,
      size: jsonContent.length,
    });

    res.json({
      success: true,
      message: 'Trace file written successfully',
      path: path.relative(projectRoot, fullFilePath),
      fileName: sanitizedFileName,
      size: jsonContent.length,
    });
  } catch (error) {
    logger.error('Failed to write trace file', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to write trace file',
      details: error.message,
    });
  }
});

/**
 * POST /api/traces/write-batch
 * Write multiple trace files in a single request
 * @body {Array<{traceData, fileName, originalTrace}>} traces - Array of traces to write
 * @body {string} outputDirectory - Directory to write to (relative to project root)
 */
router.post('/write-batch', async (req, res) => {
  try {
    const { traces, outputDirectory } = req.body;

    // Validate request format
    if (!Array.isArray(traces) || traces.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or empty traces array',
        details: 'Request body must contain a non-empty array of traces',
      });
    }

    // Default output directory if not specified
    const targetDirectory = outputDirectory || './traces';

    // Validate each trace entry
    const validationErrors = [];
    traces.forEach((trace, index) => {
      if (!trace.traceData || !trace.fileName) {
        validationErrors.push(
          `Trace ${index}: missing required fields (traceData, fileName)`
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

    // Resolve the full path (same as single write endpoint)
    const projectRoot = path.resolve(__dirname, '../../../');
    const fullDirectoryPath = path.join(projectRoot, targetDirectory);

    // Process all traces in parallel
    const writePromises = traces.map(async (trace, index) => {
      try {
        const { traceData, fileName } = trace;

        // Sanitize file name to prevent path traversal
        const sanitizedFileName = path.basename(fileName);
        const fullPath = path.join(fullDirectoryPath, sanitizedFileName);

        // Ensure directory exists
        await fs.mkdir(fullDirectoryPath, { recursive: true });

        // Write the trace file (same logic as single endpoint)
        const jsonContent =
          typeof traceData === 'string'
            ? traceData
            : JSON.stringify(traceData, null, 2);

        await fs.writeFile(fullPath, jsonContent, 'utf8');

        // Get file stats
        const stats = await fs.stat(fullPath);

        return {
          index,
          fileName: sanitizedFileName,
          success: true,
          filePath: path.relative(projectRoot, fullPath),
          size: stats.size,
          bytesWritten: jsonContent.length,
        };
      } catch (error) {
        logger.error(`Batch write failed for trace ${index}`, {
          fileName: trace.fileName,
          error: error.message,
        });

        return {
          index,
          fileName: trace.fileName,
          success: false,
          error: error.message,
        };
      }
    });

    // Wait for all writes to complete
    const results = await Promise.allSettled(writePromises);

    // Process results
    const processedResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          index,
          fileName: traces[index].fileName,
          success: false,
          error: result.reason?.message || 'Unknown error',
        };
      }
    });

    // Calculate summary statistics
    const successful = processedResults.filter((r) => r.success);
    const failed = processedResults.filter((r) => !r.success);
    const totalBytes = successful.reduce(
      (sum, r) => sum + (r.bytesWritten || 0),
      0
    );

    // Log batch operation summary
    logger.info('Batch trace write completed', {
      totalFiles: traces.length,
      successful: successful.length,
      failed: failed.length,
      totalBytes,
      successRate: ((successful.length / traces.length) * 100).toFixed(1) + '%',
    });

    // Return detailed results (matching client expectations)
    res.json({
      success: successful.length > 0, // Success if at least one file written
      successCount: successful.length,
      failureCount: failed.length,
      totalSize: totalBytes,
      results: processedResults,
    });
  } catch (error) {
    logger.error('Batch write operation failed', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: 'Batch write operation failed',
      details: error.message,
    });
  }
});

/**
 * GET /api/traces/list
 * List trace files in a directory
 * @query {string} directory - The directory to list (relative to project root)
 */
router.get('/list', async (req, res) => {
  try {
    const { directory = './traces' } = req.query;

    // Resolve the full path (same as write endpoint)
    const projectRoot = path.resolve(__dirname, '../../../');
    const fullDirectoryPath = path.join(projectRoot, directory);

    // Security check
    if (!fullDirectoryPath.startsWith(projectRoot)) {
      return res.status(403).json({
        success: false,
        error: 'Invalid directory path',
      });
    }

    // Check if directory exists
    try {
      await fs.access(fullDirectoryPath);
    } catch {
      return res.json({
        success: true,
        files: [],
        message: 'Directory does not exist',
      });
    }

    // List files
    const files = await fs.readdir(fullDirectoryPath);
    const traceFiles = files.filter(
      (file) => file.endsWith('.json') || file.endsWith('.txt')
    );

    // Get file stats
    const fileStats = await Promise.all(
      traceFiles.map(async (file) => {
        const filePath = path.join(fullDirectoryPath, file);
        const stats = await fs.stat(filePath);
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime,
          created: stats.birthtime,
        };
      })
    );

    res.json({
      success: true,
      directory: directory,
      count: fileStats.length,
      files: fileStats.sort((a, b) => b.created - a.created),
    });
  } catch (error) {
    logger.error('Failed to list trace files', {
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to list trace files',
      details: error.message,
    });
  }
});

export default router;
