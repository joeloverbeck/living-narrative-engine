/**
 * @file Unit tests for trace management routes
 * @description Covers single write, batch write, and listing endpoints for trace files
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';
import path from 'path';

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    promises: {
      mkdir: jest.fn(),
      writeFile: jest.fn(),
      stat: jest.fn(),
      access: jest.fn(),
      readdir: jest.fn(),
    },
  };
});

import traceRoutes from '../../../src/routes/traceRoutes.js';
import { promises as fs } from 'fs';

describe('Trace Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/traces', traceRoutes);

    fs.mkdir.mockReset();
    fs.writeFile.mockReset();
    fs.stat.mockReset();
    fs.access.mockReset();
    fs.readdir.mockReset();

    fs.mkdir.mockResolvedValue();
    fs.writeFile.mockResolvedValue();
    fs.stat.mockResolvedValue({
      size: 128,
      mtime: new Date(),
      birthtime: new Date(),
    });
    fs.access.mockResolvedValue();
    fs.readdir.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should write a single trace file successfully', async () => {
    const projectRoot = path.resolve(process.cwd(), '../');

    const response = await request(app)
      .post('/api/traces/write')
      .send({
        traceData: { id: 42, events: [] },
        fileName: 'session.json',
        outputDirectory: './traces/run',
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      fileName: 'session.json',
      message: 'Trace file written successfully',
    });
    expect(fs.mkdir).toHaveBeenCalledWith(
      expect.stringContaining(path.join(projectRoot, 'traces/run')),
      { recursive: true }
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining(path.join('traces', 'run', 'session.json')),
      expect.stringContaining('"id": 42'),
      'utf8'
    );
  });

  it('should accept serialized trace payloads without re-stringifying them', async () => {
    const serializedTrace = '{"session":"abc","events":[]}';

    const response = await request(app).post('/api/traces/write').send({
      traceData: serializedTrace,
      fileName: 'raw.json',
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      fileName: 'raw.json',
      size: serializedTrace.length,
    });
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining(path.join('traces', 'raw.json')),
      serializedTrace,
      'utf8'
    );
  });

  it('should sanitize file names with directory segments during single writes', async () => {
    const response = await request(app)
      .post('/api/traces/write')
      .send({
        traceData: { session: true },
        fileName: '../dangerous/escape.json',
        outputDirectory: './traces/sessions',
      });

    expect(response.status).toBe(200);

    const expectedRelativePath = path.join('traces', 'sessions', 'escape.json');

    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining(expectedRelativePath),
      expect.any(String),
      'utf8'
    );

    const [writtenPath] = fs.writeFile.mock.calls[0];
    expect(writtenPath).not.toContain('..');

    expect(response.body).toMatchObject({
      success: true,
      fileName: 'escape.json',
    });
    expect(response.body.path.replace(/\\/g, '/')).toBe(
      expectedRelativePath.replace(/\\/g, '/')
    );
  });

  it('should reject requests missing required fields', async () => {
    const response = await request(app).post('/api/traces/write').send({
      traceData: null,
      fileName: '',
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Missing required fields: traceData and fileName',
    });
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('should block writes that escape the project directory', async () => {
    const response = await request(app).post('/api/traces/write').send({
      traceData: '{}',
      fileName: 'escape.json',
      outputDirectory: '../../outside',
    });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Invalid output path',
    });
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('should treat Windows-style absolute paths as invalid during single writes', async () => {
    const originalIsAbsolute = path.isAbsolute;
    const isAbsoluteSpy = jest
      .spyOn(path, 'isAbsolute')
      .mockImplementation((inputPath, ...rest) => {
        if (
          typeof inputPath === 'string' &&
          inputPath.includes('C:/windows-breach')
        ) {
          return true;
        }
        return originalIsAbsolute(inputPath, ...rest);
      });

    try {
      const response = await request(app)
        .post('/api/traces/write')
        .send({
          traceData: { session: 'windows' },
          fileName: 'trace.json',
          outputDirectory: 'C:/windows-breach',
        });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid output path',
      });
      expect(fs.mkdir).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
    } finally {
      isAbsoluteSpy.mockRestore();
    }
  });

  it('should block batch writes that resolve outside the project directory', async () => {
    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        outputDirectory: '../../outside',
        traces: [{ traceData: { foo: 'bar' }, fileName: 'escape.json' }],
      });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Invalid output path',
    });
    expect(fs.mkdir).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('should block batch writes targeting absolute directories', async () => {
    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        outputDirectory: '/tmp/malicious',
        traces: [{ traceData: { foo: 'bar' }, fileName: 'escape.json' }],
      });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Invalid output path',
    });
    expect(fs.mkdir).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('should reject Windows-style absolute directories during batch writes', async () => {
    const originalIsAbsolute = path.isAbsolute;
    const isAbsoluteSpy = jest
      .spyOn(path, 'isAbsolute')
      .mockImplementation((inputPath, ...rest) => {
        if (
          typeof inputPath === 'string' &&
          inputPath.includes('C:/batch-windows')
        ) {
          return true;
        }
        return originalIsAbsolute(inputPath, ...rest);
      });

    try {
      const response = await request(app)
        .post('/api/traces/write-batch')
        .send({
          outputDirectory: 'C:/batch-windows',
          traces: [
            {
              traceData: { foo: 'bar' },
              fileName: 'nested.json',
            },
          ],
        });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid output path',
      });
      expect(fs.mkdir).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
    } finally {
      isAbsoluteSpy.mockRestore();
    }
  });

  it('should return 500 when file writing fails', async () => {
    fs.writeFile.mockRejectedValueOnce(new Error('disk failure'));

    const response = await request(app)
      .post('/api/traces/write')
      .send({
        traceData: { hello: 'world' },
        fileName: 'error.json',
      });

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Failed to write trace file',
      details: 'disk failure',
    });
  });

  it('should return 500 when directory creation fails for single write', async () => {
    fs.mkdir.mockRejectedValueOnce(new Error('mkdir failure'));

    const response = await request(app)
      .post('/api/traces/write')
      .send({
        traceData: { hello: 'world' },
        fileName: 'mkdir-error.json',
      });

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Failed to write trace file',
      details: 'mkdir failure',
    });
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('should validate batch payload shape', async () => {
    const response = await request(app).post('/api/traces/write-batch').send({
      traces: [],
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Missing or empty traces array',
    });
  });

  it('should reject batch requests with missing trace details', async () => {
    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        traces: [{ fileName: 'only-name.json' }],
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Validation failed',
    });
    expect(response.body.details[0]).toContain('missing required fields');
  });

  it('should handle unexpected failures during batch processing', async () => {
    const allSettledSpy = jest
      .spyOn(Promise, 'allSettled')
      .mockRejectedValueOnce(new Error('batch explosion'));

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        traces: [{ traceData: { ok: true }, fileName: 'good.json' }],
      });

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Batch write operation failed',
      details: 'batch explosion',
    });

    allSettledSpy.mockRestore();
  });

  it('should process batch writes with mixed outcomes', async () => {
    const projectRoot = path.resolve(process.cwd(), '../');

    fs.writeFile.mockImplementation((filePath) => {
      if (filePath.includes('fail')) {
        return Promise.reject(new Error('permission denied'));
      }
      return Promise.resolve();
    });

    fs.stat
      .mockResolvedValueOnce({
        size: 50,
        mtime: new Date('2024-01-01'),
        birthtime: new Date('2024-01-01'),
      })
      .mockResolvedValueOnce({
        size: 80,
        mtime: new Date('2024-01-02'),
        birthtime: new Date('2024-01-02'),
      });

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        outputDirectory: './batch',
        traces: [
          { traceData: { ok: true }, fileName: 'good.json' },
          { traceData: { ok: false }, fileName: 'fail.json' },
        ],
      });

    expect(response.status).toBe(200);
    expect(fs.mkdir).toHaveBeenCalledWith(
      expect.stringContaining(path.join(projectRoot, 'batch')),
      { recursive: true }
    );
    expect(response.body).toMatchObject({
      success: true,
      successCount: 1,
      failureCount: 1,
    });
    expect(response.body.results).toHaveLength(2);
    const [firstResult, secondResult] = response.body.results;
    expect(firstResult).toMatchObject({ success: true, fileName: 'good.json' });
    expect(secondResult).toMatchObject({
      success: false,
      fileName: 'fail.json',
    });
  });

  it('should surface metadata failures when stat rejects after a successful write', async () => {
    const metadataError = new Error('stat failure during batch');

    fs.stat
      .mockImplementationOnce(() => Promise.reject(metadataError))
      .mockImplementationOnce(() =>
        Promise.resolve({
          size: 64,
          mtime: new Date('2024-04-02T00:00:00Z'),
          birthtime: new Date('2024-04-02T00:00:00Z'),
        })
      );

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        traces: [
          { traceData: { id: 1 }, fileName: 'first.json' },
          { traceData: { id: 2 }, fileName: 'second.json' },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.successCount).toBe(1);
    expect(response.body.failureCount).toBe(1);
    expect(response.body.results[0]).toMatchObject({
      index: 0,
      fileName: 'first.json',
      success: false,
      error: metadataError.message,
    });
    expect(response.body.results[1]).toMatchObject({
      index: 1,
      fileName: 'second.json',
      success: true,
    });
  });

  it('should report serialization failures for circular trace payloads', async () => {
    const circularTrace = {};
    circularTrace.self = circularTrace;

    const writeBatchLayer = traceRoutes.stack.find(
      (layer) =>
        layer.route &&
        layer.route.path === '/write-batch' &&
        layer.route.methods.post
    );
    const writeBatchHandler = writeBatchLayer.route.stack[0].handle;

    fs.stat.mockResolvedValue({
      size: 48,
      mtime: new Date('2024-05-01T00:00:00Z'),
      birthtime: new Date('2024-05-01T00:00:00Z'),
    });

    const res = {
      json: jest.fn().mockReturnThis(),
    };

    await writeBatchHandler(
      {
        body: {
          traces: [
            { traceData: circularTrace, fileName: 'circular.json' },
            { traceData: { stable: true }, fileName: 'normal.json' },
          ],
        },
      },
      res
    );

    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile.mock.calls[0][0]).toContain('normal.json');

    const payload = res.json.mock.calls[0][0];
    expect(payload.successCount).toBe(1);
    expect(payload.failureCount).toBe(1);
    expect(payload.results[0]).toMatchObject({
      index: 0,
      fileName: 'circular.json',
      success: false,
      error: expect.stringContaining('circular'),
    });
    expect(payload.results[1]).toMatchObject({
      index: 1,
      fileName: 'normal.json',
      success: true,
    });
  });

  it('should sanitize file names during batch writes to prevent traversal', async () => {
    fs.stat
      .mockResolvedValueOnce({
        size: 30,
        mtime: new Date('2024-03-01T00:00:00Z'),
        birthtime: new Date('2024-03-01T00:00:00Z'),
      })
      .mockResolvedValueOnce({
        size: 15,
        mtime: new Date('2024-03-02T00:00:00Z'),
        birthtime: new Date('2024-03-02T00:00:00Z'),
      });

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        traces: [
          { traceData: { secure: true }, fileName: '../escape.json' },
          { traceData: { secure: true }, fileName: 'legit.json' },
        ],
      });

    expect(response.status).toBe(200);

    const sanitizedCall = fs.writeFile.mock.calls.find(([filePath]) =>
      filePath.endsWith(path.join('traces', 'escape.json'))
    );

    expect(sanitizedCall).toBeDefined();
    expect(sanitizedCall[0]).not.toContain('..');
    expect(response.body.results[0]).toMatchObject({
      fileName: 'escape.json',
      success: true,
    });
  });

  it('should persist pre-serialized traces correctly during batch writes', async () => {
    const serializedTrace = '{"batch":true}';

    fs.stat
      .mockResolvedValueOnce({
        size: serializedTrace.length,
        mtime: new Date('2024-02-01'),
        birthtime: new Date('2024-02-01'),
      })
      .mockResolvedValueOnce({
        size: 20,
        mtime: new Date('2024-02-02'),
        birthtime: new Date('2024-02-02'),
      });

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        traces: [
          { traceData: serializedTrace, fileName: 'raw.json' },
          { traceData: { ok: true }, fileName: 'object.json' },
        ],
      });

    expect(response.status).toBe(200);
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining(path.join('traces', 'raw.json')),
      serializedTrace,
      'utf8'
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining(path.join('traces', 'object.json')),
      expect.stringContaining('"ok": true'),
      'utf8'
    );
    expect(response.body.results[0]).toMatchObject({
      index: 0,
      fileName: 'raw.json',
      bytesWritten: serializedTrace.length,
    });
  });

  it('should convert rejected batch promises into standardized failure results', async () => {
    const allSettledSpy = jest
      .spyOn(Promise, 'allSettled')
      .mockResolvedValueOnce([
        {
          status: 'fulfilled',
          value: {
            index: 0,
            fileName: 'good.json',
            success: true,
            filePath: 'traces/good.json',
            size: 42,
            bytesWritten: 42,
          },
        },
        { status: 'rejected', reason: new Error('filesystem exploded') },
      ]);

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        outputDirectory: './batch',
        traces: [
          { traceData: { ok: true }, fileName: 'good.json' },
          { traceData: { ok: false }, fileName: 'fail.json' },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.successCount).toBe(1);
    expect(response.body.failureCount).toBe(1);
    expect(response.body.results[0]).toMatchObject({
      index: 0,
      fileName: 'good.json',
      success: true,
    });
    expect(response.body.results[1]).toMatchObject({
      index: 1,
      fileName: 'fail.json',
      success: false,
      error: 'filesystem exploded',
    });

    allSettledSpy.mockRestore();
  });

  it('should fall back to a generic error message when rejection reason is unavailable', async () => {
    const allSettledSpy = jest
      .spyOn(Promise, 'allSettled')
      .mockResolvedValueOnce([
        {
          status: 'fulfilled',
          value: { index: 0, fileName: 'good.json', success: true },
        },
        { status: 'rejected', reason: undefined },
      ]);

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        traces: [
          { traceData: { ok: true }, fileName: 'good.json' },
          { traceData: { ok: false }, fileName: 'fail.json' },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.failureCount).toBe(1);
    expect(response.body.results[1]).toMatchObject({
      index: 1,
      fileName: 'fail.json',
      success: false,
      error: 'Unknown error',
    });

    allSettledSpy.mockRestore();
  });

  it('should report failure when all batch writes fail', async () => {
    fs.writeFile.mockRejectedValue(new Error('unavailable'));

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        traces: [{ traceData: {}, fileName: 'a.json' }],
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: false,
      successCount: 0,
      failureCount: 1,
    });
    expect(response.body.results[0]).toMatchObject({
      success: false,
      fileName: 'a.json',
      error: 'unavailable',
    });
  });

  it('should mark traces as failed when directory creation rejects during batch write', async () => {
    const projectRoot = path.resolve(process.cwd(), '../');

    fs.mkdir.mockRejectedValueOnce(new Error('mkdir failure'));
    fs.mkdir.mockResolvedValue();

    fs.stat.mockResolvedValueOnce({
      size: 42,
      mtime: new Date('2024-05-01T00:00:00Z'),
      birthtime: new Date('2024-05-01T00:00:00Z'),
    });

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        outputDirectory: './batch',
        traces: [
          { traceData: { ok: true }, fileName: 'first.json' },
          { traceData: { ok: true }, fileName: 'second.json' },
        ],
      });

    expect(response.status).toBe(200);
    expect(fs.mkdir).toHaveBeenCalledWith(
      expect.stringContaining(path.join(projectRoot, 'batch')),
      { recursive: true }
    );
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(response.body).toMatchObject({
      success: true,
      successCount: 1,
      failureCount: 1,
    });
    expect(response.body.results[0]).toMatchObject({
      index: 0,
      fileName: 'first.json',
      success: false,
      error: 'mkdir failure',
    });
    expect(response.body.results[1]).toMatchObject({
      index: 1,
      fileName: 'second.json',
      success: true,
    });
  });

  it('should block directory traversal during listing', async () => {
    const response = await request(app)
      .get('/api/traces/list')
      .query({ directory: '../../etc' });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Invalid directory path',
    });
    expect(fs.readdir).not.toHaveBeenCalled();
  });

  it('should return empty list when directory does not exist', async () => {
    fs.access.mockRejectedValueOnce(new Error('missing'));

    const response = await request(app)
      .get('/api/traces/list')
      .query({ directory: './missing' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      files: [],
      message: 'Directory does not exist',
    });
  });

  it('should list available trace files with metadata', async () => {
    const projectRoot = path.resolve(process.cwd(), '../');
    const directory = './available';

    fs.readdir.mockResolvedValueOnce(['one.json', 'two.txt', 'ignore.log']);
    fs.stat
      .mockResolvedValueOnce({
        size: 10,
        mtime: new Date('2024-01-03T10:00:00Z'),
        birthtime: new Date('2024-01-03T09:00:00Z'),
      })
      .mockResolvedValueOnce({
        size: 20,
        mtime: new Date('2024-01-04T10:00:00Z'),
        birthtime: new Date('2024-01-04T09:00:00Z'),
      });

    const response = await request(app)
      .get('/api/traces/list')
      .query({ directory });

    expect(response.status).toBe(200);
    expect(fs.access).toHaveBeenCalledWith(path.join(projectRoot, directory));
    expect(fs.readdir).toHaveBeenCalledWith(path.join(projectRoot, directory));
    expect(response.body).toMatchObject({ success: true, count: 2 });
    expect(response.body.files[0].name).toBe('two.txt');
    expect(response.body.files[1].name).toBe('one.json');
  });

  it('should handle errors when listing files', async () => {
    fs.readdir.mockRejectedValueOnce(new Error('io failure'));

    const response = await request(app).get('/api/traces/list');

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Failed to list trace files',
      details: 'io failure',
    });
  });

  it('should report metadata failures when stat calls reject', async () => {
    fs.readdir.mockResolvedValueOnce(['corrupt.json']);
    fs.stat.mockRejectedValueOnce(new Error('stat failure'));

    const response = await request(app)
      .get('/api/traces/list')
      .query({ directory: './traces' });

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Failed to list trace files',
      details: 'stat failure',
    });
  });
});
