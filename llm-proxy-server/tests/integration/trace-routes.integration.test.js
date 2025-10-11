import express from 'express';
import request from 'supertest';
import path from 'path';
import { promises as fsPromises, existsSync } from 'fs';
import traceRoutes from '../../src/routes/traceRoutes.js';

const { readFile, rm, mkdir } = fsPromises;

describe('Trace routes integration', () => {
  let app;
  let projectRoot;
  let baseRelative;
  let baseAbsolute;

  beforeAll(async () => {
    projectRoot = path.resolve(process.cwd(), '..');
    baseRelative = path.join('llm-proxy-server', 'tests', 'tmp', 'trace-routes');
    baseAbsolute = path.join(projectRoot, baseRelative);

    app = express();
    app.use(express.json({ limit: '2mb' }));
    app.use('/api/traces', traceRoutes);

    await rm(baseAbsolute, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await rm(baseAbsolute, { recursive: true, force: true });
    await mkdir(baseAbsolute, { recursive: true });
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await rm(baseAbsolute, { recursive: true, force: true });
  });

  const buildPaths = async (name, { precreate = false } = {}) => {
    const relative = path.join(baseRelative, name);
    const absolute = path.join(baseAbsolute, name);
    if (precreate) {
      await mkdir(absolute, { recursive: true });
    }
    return { relative, absolute };
  };

  it('writes a single trace file and lists it', async () => {
    const { relative, absolute } = await buildPaths('single-write');
    const traceData = {
      sessionId: 'abc123',
      steps: ['gather-context', 'synthesize-response'],
    };

    const response = await request(app)
      .post('/api/traces/write')
      .send({
        traceData,
        fileName: 'trace.json',
        outputDirectory: relative,
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      fileName: 'trace.json',
      path: path.join(relative, 'trace.json'),
    });

    const writtenPath = path.join(absolute, 'trace.json');
    const fileContent = await readFile(writtenPath, 'utf8');
    expect(JSON.parse(fileContent)).toEqual(traceData);

    const listResponse = await request(app)
      .get('/api/traces/list')
      .query({ directory: relative });

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.success).toBe(true);
    expect(listResponse.body.count).toBe(1);
    expect(listResponse.body.files[0].name).toBe('trace.json');
  });

  it('rejects write requests missing required fields', async () => {
    const response = await request(app)
      .post('/api/traces/write')
      .send({
        traceData: { step: 'incomplete' },
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Missing required fields');
  });

  it('prevents trace writes outside of the project directory', async () => {
    const response = await request(app)
      .post('/api/traces/write')
      .send({
        traceData: { step: 'escape' },
        fileName: 'trace.json',
        outputDirectory: '../outside-project',
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Invalid output path');
  });

  it('returns an informative error when the filesystem write fails', async () => {
    const { relative } = await buildPaths('write-failure');
    const originalWriteFile = fsPromises.writeFile;
    const writeSpy = jest
      .spyOn(fsPromises, 'writeFile')
      .mockImplementation(async (...args) => {
        if (args[0].endsWith('trace.json')) {
          throw new Error('disk full');
        }
        return originalWriteFile(...args);
      });

    const response = await request(app)
      .post('/api/traces/write')
      .send({
        traceData: { step: 'will-fail' },
        fileName: 'trace.json',
        outputDirectory: relative,
      });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Failed to write trace file');
    expect(response.body.details).toBe('disk full');

    writeSpy.mockRestore();
  });

  it('writes a batch of traces and reports partial failures', async () => {
    const { relative, absolute } = await buildPaths('batch-write');
    const originalWriteFile = fsPromises.writeFile;
    const writeSpy = jest
      .spyOn(fsPromises, 'writeFile')
      .mockImplementation(async (...args) => {
        if (args[0].endsWith('error.json')) {
          throw new Error('disk quota exceeded');
        }
        return originalWriteFile(...args);
      });

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        outputDirectory: relative,
        traces: [
          { traceData: { step: 1 }, fileName: 'first.json' },
          { traceData: { step: 2 }, fileName: 'error.json' },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.successCount).toBe(1);
    expect(response.body.failureCount).toBe(1);

    const successFile = path.join(absolute, 'first.json');
    const failedFile = path.join(absolute, 'error.json');
    expect(existsSync(successFile)).toBe(true);
    expect(existsSync(failedFile)).toBe(false);

    const failureEntry = response.body.results.find(
      (result) => result.fileName === 'error.json'
    );
    expect(failureEntry.success).toBe(false);
    expect(failureEntry.error).toContain('disk quota exceeded');

    writeSpy.mockRestore();
  });

  it('validates batch requests before processing', async () => {
    const { relative } = await buildPaths('batch-validation');

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        outputDirectory: relative,
        traces: [
          { traceData: { ok: true }, fileName: 'valid.json' },
          { traceData: null, fileName: 'missing-trace.json' },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
    expect(response.body.details[0]).toContain('missing required fields');
  });

  it('lists trace directories and handles missing folders gracefully', async () => {
    const missingDirectory = path.join(baseRelative, 'not-created-yet');

    const missingResponse = await request(app)
      .get('/api/traces/list')
      .query({ directory: missingDirectory });

    expect(missingResponse.status).toBe(200);
    expect(missingResponse.body.success).toBe(true);
    expect(missingResponse.body.files).toEqual([]);
    expect(missingResponse.body.message).toBe('Directory does not exist');

    const { relative, absolute } = await buildPaths('listing', { precreate: true });
    await fsPromises.writeFile(
      path.join(absolute, 'trace-a.json'),
      JSON.stringify({ step: 'a' }),
      'utf8'
    );
    await fsPromises.writeFile(
      path.join(absolute, 'trace-b.txt'),
      'plain text trace',
      'utf8'
    );

    const listResponse = await request(app)
      .get('/api/traces/list')
      .query({ directory: relative });

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.success).toBe(true);
    expect(listResponse.body.count).toBe(2);
    const fileNames = listResponse.body.files.map((file) => file.name).sort();
    expect(fileNames).toEqual(['trace-a.json', 'trace-b.txt']);
  });

  it('rejects list requests that escape the project root', async () => {
    const response = await request(app)
      .get('/api/traces/list')
      .query({ directory: '../outside-project' });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Invalid directory path');
  });
});
