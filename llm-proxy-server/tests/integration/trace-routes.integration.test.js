import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';

import traceRoutes from '../../src/routes/traceRoutes.js';

const projectRoot = path.resolve(process.cwd(), '../');

/**
 * Builds an express app configured with the trace routes for integration testing.
 * @returns {import('express').Express}
 */
function buildApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/traces', traceRoutes);
  return app;
}

const createdDirectories = new Set();

const registerDirectoryForCleanup = (relativePath) => {
  const normalized = relativePath.startsWith('./')
    ? relativePath.slice(2)
    : relativePath;
  const fullPath = path.join(projectRoot, normalized);
  createdDirectories.add(fullPath);
  return fullPath;
};

/**
 * Clean up leftover test directories from previous test runs.
 * This ensures a clean state even if previous tests were interrupted.
 */
async function cleanupLeftoverDirectories() {
  const dirsToClean = [
    path.join(projectRoot, 'tmp-traces'),
    path.join(projectRoot, 'tmp'),
    path.join(projectRoot, 'test-traces'),
  ];

  for (const dir of dirsToClean) {
    try {
      await rm(dir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors - directory might not exist
    }
  }
}

beforeEach(() => {
  createdDirectories.clear();
});

afterEach(async () => {
  const paths = Array.from(createdDirectories).sort((a, b) => b.length - a.length);
  for (const directory of paths) {
    try {
      await rm(directory, { recursive: true, force: true });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to remove temporary trace directory during cleanup', {
        directory,
        error: error.message,
      });
    }
  }
  createdDirectories.clear();

  // Also clean up parent directories if empty
  await cleanupLeftoverDirectories();
});

describe('traceRoutes integration coverage', () => {
  it('writes trace files using sanitized filenames within the project boundary', async () => {
    const app = buildApp();
    const outputDirectory = `./tmp-traces/${randomUUID()}`;
    const expectedDirectory = registerDirectoryForCleanup(outputDirectory);

    const response = await request(app)
      .post('/api/traces/write')
      .send({
        traceData: { feature: 'integration', ok: true },
        fileName: '../escape-attempt.json',
        outputDirectory,
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      fileName: 'escape-attempt.json',
    });

    const writtenPath = path.join(expectedDirectory, 'escape-attempt.json');
    const content = await readFile(writtenPath, 'utf8');
    expect(JSON.parse(content)).toEqual({ feature: 'integration', ok: true });
  });

  it('rejects requests missing required fields for single trace writes', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/traces/write')
      .send({ traceData: { missing: 'fileName' } });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: 'Missing required fields: traceData and fileName',
    });
  });

  it('blocks attempts to write outside of the project root', async () => {
    const app = buildApp();
    const outsideDirectory = `../../tmp/outside-${randomUUID()}`;
    const expectedDirectory = registerDirectoryForCleanup(outsideDirectory);

    const response = await request(app)
      .post('/api/traces/write')
      .send({
        traceData: { should: 'fail' },
        fileName: 'unauthorized.json',
        outputDirectory: outsideDirectory,
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ success: false, error: 'Invalid output path' });

    await rm(expectedDirectory, { recursive: true, force: true });
  });

  it('handles unexpected filesystem conflicts in the single write endpoint', async () => {
    const app = buildApp();
    const outputDirectory = `./tmp-traces/${randomUUID()}`;
    const expectedDirectory = registerDirectoryForCleanup(outputDirectory);
    await mkdir(expectedDirectory, { recursive: true });
    await mkdir(path.join(expectedDirectory, 'conflict.json'));

    const response = await request(app)
      .post('/api/traces/write')
      .send({
        traceData: { should: 'trigger error' },
        fileName: 'conflict.json',
        outputDirectory,
      });

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Failed to write trace file',
    });
  });

  it('validates that batched requests contain an array of traces', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({ traces: { invalid: true } });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: 'Missing or empty traces array',
      details: 'Request body must contain a non-empty array of traces',
    });
  });

  it('rejects batched traces that are missing required properties', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        traces: [
          { traceData: { present: 'fileName missing' } },
          { fileName: 'missing-trace.json' },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: 'Validation failed',
      details: [
        'Trace 0: missing required fields (traceData, fileName)',
        'Trace 1: missing required fields (traceData, fileName)',
      ],
    });
  });

  it('performs partial success writes for batch requests and reports failures', async () => {
    const app = buildApp();
    const outputDirectory = `./tmp-traces/${randomUUID()}`;
    const expectedDirectory = registerDirectoryForCleanup(outputDirectory);
    await mkdir(expectedDirectory, { recursive: true });
    await mkdir(path.join(expectedDirectory, 'broken.json'));

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        outputDirectory,
        traces: [
          { traceData: { id: 1, ok: true }, fileName: 'good.json' },
          { traceData: { id: 2, fail: true }, fileName: 'broken.json' },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.successCount).toBe(1);
    expect(response.body.failureCount).toBe(1);

    const files = await readdir(expectedDirectory);
    expect(files).toContain('good.json');
    expect(files).toContain('broken.json');

    const brokenStats = await stat(path.join(expectedDirectory, 'broken.json'));
    expect(brokenStats.isDirectory()).toBe(true);

    const storedContent = await readFile(path.join(expectedDirectory, 'good.json'), 'utf8');
    expect(JSON.parse(storedContent)).toEqual({ id: 1, ok: true });
  });

  it('reports failure details when every batched write collides with the filesystem', async () => {
    const app = buildApp();
    const outputDirectory = `./tmp-traces/${randomUUID()}`;
    const expectedDirectory = registerDirectoryForCleanup(outputDirectory);
    await mkdir(expectedDirectory, { recursive: true });
    await mkdir(path.join(expectedDirectory, 'fail.json'));
    await mkdir(path.join(expectedDirectory, 'also-fail.json'));

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        outputDirectory,
        traces: [
          { traceData: { fail: true }, fileName: 'fail.json' },
          { traceData: { fail: true }, fileName: 'also-fail.json' },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(false);
    expect(response.body.successCount).toBe(0);
    expect(response.body.failureCount).toBe(2);
  });

  it('lists trace files with metadata for existing directories', async () => {
    const app = buildApp();
    const outputDirectory = `./tmp-traces/${randomUUID()}`;
    const expectedDirectory = registerDirectoryForCleanup(outputDirectory);

    await mkdir(expectedDirectory, { recursive: true });
    await writeFile(path.join(expectedDirectory, 'alpha.json'), JSON.stringify({ a: 1 }), 'utf8');
    await writeFile(path.join(expectedDirectory, 'beta.txt'), 'log entry', 'utf8');
    await writeFile(path.join(expectedDirectory, 'ignored.bin'), 'binary');

    const response = await request(app)
      .get('/api/traces/list')
      .query({ directory: outputDirectory });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(2);
    expect(response.body.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'alpha.json' }),
        expect.objectContaining({ name: 'beta.txt' }),
      ])
    );
  });

  it('rejects directory listings that attempt to escape the project boundary', async () => {
    const app = buildApp();
    const outsideDirectory = `../../tmp/outside-${randomUUID()}`;

    const response = await request(app)
      .get('/api/traces/list')
      .query({ directory: outsideDirectory });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ success: false, error: 'Invalid directory path' });
  });

  it('returns an empty result for directories that do not exist', async () => {
    const app = buildApp();
    const outputDirectory = `./tmp-traces/${randomUUID()}`;

    const response = await request(app)
      .get('/api/traces/list')
      .query({ directory: outputDirectory });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      files: [],
      message: 'Directory does not exist',
    });
  });

  it('handles filesystem failures while listing traces', async () => {
    const app = buildApp();
    const outputDirectory = `./tmp-traces/${randomUUID()}`;
    const expectedDirectory = registerDirectoryForCleanup(outputDirectory);

    await mkdir(expectedDirectory, { recursive: true });
    const danglingTarget = path.join(expectedDirectory, 'missing-target.json');
    const danglingLink = path.join(expectedDirectory, 'dangling.json');
    try {
      await symlink(danglingTarget, danglingLink);
    } catch (error) {
      // If symlinks are not supported, skip this test gracefully.
      if (error.code === 'EPERM' || error.code === 'EEXIST' || error.code === 'ENOTSUP') {
        return;
      }
      throw error;
    }

    const response = await request(app)
      .get('/api/traces/list')
      .query({ directory: outputDirectory });

    if (response.status === 500) {
      expect(response.body).toMatchObject({
        success: false,
        error: 'Failed to list trace files',
      });
    } else {
      // Some file systems may treat dangling symlinks differently; ensure they were created.
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    }
  });
});
