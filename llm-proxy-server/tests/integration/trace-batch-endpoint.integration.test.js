/**
 * @file trace-batch-endpoint.integration.test.js
 * @description Integration tests for the trace batch write endpoint
 */

import {
  describe,
  test,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { promises as fs } from 'fs';
import path from 'path';
import traceRoutes from '../../src/routes/traceRoutes.js';

describe('Trace Batch Endpoint Integration Tests', () => {
  let app;
  let testDirectory;

  beforeEach(async () => {
    // Create Express app
    app = express();

    // Configure JSON parsing
    app.use(express.json({ limit: '10mb' }));

    // CORS
    app.use(
      cors({
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      })
    );

    // Compression
    app.use(compression());

    // Mount trace routes
    app.use('/api/traces', traceRoutes);

    // Error handler
    app.use((err, req, res, next) => {
      if (res.headersSent) {
        return next(err);
      }

      const statusCode = err.status || err.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: 'Internal server error',
        details: err.message,
      });
    });

    // Create test directory
    const projectRoot = path.resolve(process.cwd(), '../');
    testDirectory = path.join(projectRoot, 'test-traces-' + Date.now());
    await fs.mkdir(testDirectory, { recursive: true });

    jest.clearAllMocks();
  });

  afterEach(async () => {
    jest.restoreAllMocks();

    // Clean up test directory
    if (testDirectory) {
      try {
        await fs.rm(testDirectory, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('POST /api/traces/write-batch - Success Cases', () => {
    test('should successfully write multiple traces', async () => {
      const traces = [
        {
          traceData: JSON.stringify({ actionId: 'test1', result: 'success' }),
          fileName: 'trace_test1.json',
          originalTrace: { actionId: 'test1', _outputFormat: 'json' },
        },
        {
          traceData: 'Test trace 2 content',
          fileName: 'trace_test2.txt',
          originalTrace: { actionId: 'test2', _outputFormat: 'text' },
        },
      ];

      const requestBody = {
        traces,
        outputDirectory: path.relative(
          path.resolve(process.cwd(), '../'),
          testDirectory
        ),
      };

      const response = await request(app)
        .post('/api/traces/write-batch')
        .send(requestBody)
        .expect(200);

      // Verify response structure
      expect(response.body).toMatchObject({
        success: true,
        successCount: 2,
        failureCount: 0,
        totalSize: expect.any(Number),
        results: expect.arrayContaining([
          expect.objectContaining({
            index: 0,
            fileName: 'trace_test1.json',
            success: true,
            filePath: expect.stringContaining('trace_test1.json'),
            size: expect.any(Number),
            bytesWritten: expect.any(Number),
          }),
          expect.objectContaining({
            index: 1,
            fileName: 'trace_test2.txt',
            success: true,
            filePath: expect.stringContaining('trace_test2.txt'),
            size: expect.any(Number),
            bytesWritten: expect.any(Number),
          }),
        ]),
      });

      // Verify files were actually written
      const file1Path = path.join(testDirectory, 'trace_test1.json');
      const file2Path = path.join(testDirectory, 'trace_test2.txt');

      const file1Content = await fs.readFile(file1Path, 'utf8');
      const file2Content = await fs.readFile(file2Path, 'utf8');

      expect(file1Content).toBe('{"actionId":"test1","result":"success"}');
      expect(file2Content).toBe('Test trace 2 content');
    });

    test('should handle single trace in batch', async () => {
      const traces = [
        {
          traceData: { message: 'single trace test' },
          fileName: 'single_trace.json',
          originalTrace: { id: 'single', _outputFormat: 'json' },
        },
      ];

      const requestBody = {
        traces,
        outputDirectory: path.relative(
          path.resolve(process.cwd(), '../'),
          testDirectory
        ),
      };

      const response = await request(app)
        .post('/api/traces/write-batch')
        .send(requestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        successCount: 1,
        failureCount: 0,
        totalSize: expect.any(Number),
        results: [
          expect.objectContaining({
            index: 0,
            fileName: 'single_trace.json',
            success: true,
          }),
        ],
      });

      // Verify file content
      const filePath = path.join(testDirectory, 'single_trace.json');
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(JSON.parse(fileContent)).toEqual({ message: 'single trace test' });
    });

    test('should use default directory when outputDirectory not specified', async () => {
      const traces = [
        {
          traceData: 'default directory test',
          fileName: 'default_test.txt',
          originalTrace: { id: 'default' },
        },
      ];

      const requestBody = { traces };

      const response = await request(app)
        .post('/api/traces/write-batch')
        .send(requestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results[0].filePath).toMatch(
        /traces\/default_test\.txt$/
      );

      // Clean up default directory file
      const projectRoot = path.resolve(process.cwd(), '../');
      const defaultFilePath = path.join(
        projectRoot,
        'traces',
        'default_test.txt'
      );
      try {
        await fs.unlink(defaultFilePath);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test('should handle partial failures gracefully', async () => {
      // This test verifies that path traversal attempts are sanitized
      // The '../readonly/fail.txt' gets sanitized to 'fail.txt' and both files succeed
      const traces = [
        {
          traceData: 'success trace',
          fileName: 'success.txt',
          originalTrace: { id: 'success' },
        },
        {
          traceData: 'sanitized trace',
          fileName: '../readonly/fail.txt', // Will be sanitized to 'fail.txt'
          originalTrace: { id: 'sanitized' },
        },
      ];

      const requestBody = {
        traces,
        outputDirectory: path.relative(
          path.resolve(process.cwd(), '../'),
          testDirectory
        ),
      };

      const response = await request(app)
        .post('/api/traces/write-batch')
        .send(requestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.successCount).toBe(2); // Both succeed after sanitization
      expect(response.body.failureCount).toBe(0);

      // Verify both files exist with sanitized names
      const successPath = path.join(testDirectory, 'success.txt');
      const sanitizedPath = path.join(testDirectory, 'fail.txt'); // Sanitized name

      const successContent = await fs.readFile(successPath, 'utf8');
      const sanitizedContent = await fs.readFile(sanitizedPath, 'utf8');

      expect(successContent).toBe('success trace');
      expect(sanitizedContent).toBe('sanitized trace');

      // Verify the sanitized file name in response
      expect(response.body.results[1].fileName).toBe('fail.txt');
    });
  });

  describe('POST /api/traces/write-batch - Validation Errors', () => {
    test('should return 400 for missing traces array', async () => {
      const requestBody = {
        outputDirectory: './traces',
      };

      const response = await request(app)
        .post('/api/traces/write-batch')
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Missing or empty traces array',
        details: 'Request body must contain a non-empty array of traces',
      });
    });

    test('should return 400 for empty traces array', async () => {
      const requestBody = {
        traces: [],
        outputDirectory: './traces',
      };

      const response = await request(app)
        .post('/api/traces/write-batch')
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Missing or empty traces array',
      });
    });

    test('should return 400 for traces with missing required fields', async () => {
      const traces = [
        {
          traceData: 'valid trace',
          fileName: 'valid.txt',
        },
        {
          // Missing traceData
          fileName: 'missing-data.txt',
        },
        {
          traceData: 'missing filename',
          // Missing fileName
        },
      ];

      const requestBody = { traces };

      const response = await request(app)
        .post('/api/traces/write-batch')
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation failed',
        details: expect.arrayContaining([
          'Trace 1: missing required fields (traceData, fileName)',
          'Trace 2: missing required fields (traceData, fileName)',
        ]),
      });
    });

    test('should return 400 for invalid traces type', async () => {
      const requestBody = {
        traces: 'not-an-array',
        outputDirectory: './traces',
      };

      const response = await request(app)
        .post('/api/traces/write-batch')
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Missing or empty traces array',
      });
    });
  });

  describe('POST /api/traces/write-batch - Security Tests', () => {
    test('should sanitize file names to prevent path traversal', async () => {
      const traces = [
        {
          traceData: 'path traversal test',
          fileName: '../../../malicious.txt',
          originalTrace: { id: 'security' },
        },
        {
          traceData: 'another test',
          fileName: 'subdir/../escape.txt',
          originalTrace: { id: 'security2' },
        },
      ];

      const requestBody = {
        traces,
        outputDirectory: path.relative(
          path.resolve(process.cwd(), '../'),
          testDirectory
        ),
      };

      const response = await request(app)
        .post('/api/traces/write-batch')
        .send(requestBody)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify files were written with sanitized names
      expect(response.body.results[0].fileName).toBe('malicious.txt');
      expect(response.body.results[1].fileName).toBe('escape.txt');

      // Verify files are in the correct directory
      const file1Path = path.join(testDirectory, 'malicious.txt');
      const file2Path = path.join(testDirectory, 'escape.txt');

      const file1Content = await fs.readFile(file1Path, 'utf8');
      const file2Content = await fs.readFile(file2Path, 'utf8');

      expect(file1Content).toBe('path traversal test');
      expect(file2Content).toBe('another test');
    });

    test('should handle various data types in traceData', async () => {
      const traces = [
        {
          traceData: { complex: { nested: 'object' } },
          fileName: 'object.json',
          originalTrace: { id: 'obj' },
        },
        {
          traceData: ['array', 'data'],
          fileName: 'array.json',
          originalTrace: { id: 'arr' },
        },
        {
          traceData: 'plain string data',
          fileName: 'string.txt',
          originalTrace: { id: 'str' },
        },
      ];

      const requestBody = {
        traces,
        outputDirectory: path.relative(
          path.resolve(process.cwd(), '../'),
          testDirectory
        ),
      };

      const response = await request(app)
        .post('/api/traces/write-batch')
        .send(requestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.successCount).toBe(3);

      // Verify file contents
      const objContent = await fs.readFile(
        path.join(testDirectory, 'object.json'),
        'utf8'
      );
      const arrContent = await fs.readFile(
        path.join(testDirectory, 'array.json'),
        'utf8'
      );
      const strContent = await fs.readFile(
        path.join(testDirectory, 'string.txt'),
        'utf8'
      );

      expect(JSON.parse(objContent)).toEqual({ complex: { nested: 'object' } });
      expect(JSON.parse(arrContent)).toEqual(['array', 'data']);
      expect(strContent).toBe('plain string data');
    });
  });

  describe('POST /api/traces/write-batch - Error Handling', () => {
    test('should handle server errors gracefully', async () => {
      // Mock fs.mkdir to throw an error
      const originalMkdir = fs.mkdir;
      jest.spyOn(fs, 'mkdir').mockRejectedValue(new Error('Filesystem error'));

      const traces = [
        {
          traceData: 'test data',
          fileName: 'test.txt',
          originalTrace: { id: 'test' },
        },
      ];

      const requestBody = {
        traces,
        outputDirectory: './traces',
      };

      const response = await request(app)
        .post('/api/traces/write-batch')
        .send(requestBody)
        .expect(200); // Still returns 200 but with failure details

      expect(response.body.success).toBe(false);
      expect(response.body.successCount).toBe(0);
      expect(response.body.failureCount).toBe(1);
      expect(response.body.results[0].success).toBe(false);

      // Restore original function
      fs.mkdir.mockRestore();
    });

    test('should handle large batch sizes', async () => {
      const batchSize = 50;
      const traces = Array.from({ length: batchSize }, (_, i) => ({
        traceData: `trace data ${i}`,
        fileName: `trace_${i}.txt`,
        originalTrace: { id: `trace_${i}` },
      }));

      const requestBody = {
        traces,
        outputDirectory: path.relative(
          path.resolve(process.cwd(), '../'),
          testDirectory
        ),
      };

      const response = await request(app)
        .post('/api/traces/write-batch')
        .send(requestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.successCount).toBe(batchSize);
      expect(response.body.failureCount).toBe(0);
      expect(response.body.results).toHaveLength(batchSize);

      // Verify a few random files
      const file0Path = path.join(testDirectory, 'trace_0.txt');
      const file25Path = path.join(testDirectory, 'trace_25.txt');

      const file0Content = await fs.readFile(file0Path, 'utf8');
      const file25Content = await fs.readFile(file25Path, 'utf8');

      expect(file0Content).toBe('trace data 0');
      expect(file25Content).toBe('trace data 25');
    });
  });
});
