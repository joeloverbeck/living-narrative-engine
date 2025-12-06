import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import path from 'node:path';
import { access, readFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

import traceRoutes from '../../src/routes/traceRoutes.js';

const projectRoot = path.resolve(process.cwd(), '../');

/**
 * Normalizes a repository-relative path to an absolute filesystem location.
 * @param {string} relativePath - Path relative to the repository root.
 * @returns {string}
 */
const resolveWithinRepo = (relativePath) => {
  if (path.isAbsolute(relativePath)) {
    throw new Error(`Refusing to resolve absolute path: ${relativePath}`);
  }
  const sanitized = relativePath.replace(/^\.\/+/, '');
  return path.join(projectRoot, sanitized);
};

const trackedFiles = new Set();
const trackedDirectories = new Set();

const trackFile = (relativePath) => {
  const fullPath = resolveWithinRepo(relativePath);
  trackedFiles.add(fullPath);
  return fullPath;
};

const trackDirectory = (relativePath) => {
  const fullPath = resolveWithinRepo(relativePath);
  trackedDirectories.add(fullPath);
  return fullPath;
};

const buildApp = () => {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/traces', traceRoutes);
  return app;
};

beforeEach(() => {
  trackedFiles.clear();
  trackedDirectories.clear();
});

afterEach(async () => {
  for (const filePath of trackedFiles) {
    await rm(filePath, { force: true });
  }

  const directories = Array.from(trackedDirectories).sort(
    (a, b) => b.length - a.length
  );

  for (const directory of directories) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe('traceRoutes supplemental integration coverage', () => {
  it('rejects batch writes that target absolute output directories', async () => {
    const app = buildApp();
    const outsideDirectory = path.join(
      path.sep,
      'tmp',
      `absolute-outside-${randomUUID()}`
    );

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        outputDirectory: outsideDirectory,
        traces: [{ traceData: { attempt: 'escape' }, fileName: 'escape.json' }],
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      error: 'Invalid output path',
    });
    await expect(access(outsideDirectory)).rejects.toThrow();
  });

  it('writes batch traces to the default directory and preserves raw payloads', async () => {
    const app = buildApp();
    const stringPayload = 'batch-raw-payload';
    const stringFile = `raw-trace-${randomUUID()}.txt`;
    const objectFile = `object-trace-${randomUUID()}.json`;

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        traces: [
          { traceData: stringPayload, fileName: stringFile },
          { traceData: { instrumented: true }, fileName: objectFile },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.successCount).toBe(2);

    const stringRecord = response.body.results.find(
      (entry) => entry.fileName === stringFile
    );
    expect(stringRecord).toMatchObject({
      success: true,
      bytesWritten: stringPayload.length,
    });

    const normalizedStringPath = trackFile(path.join('traces', stringFile));
    const normalizedObjectPath = trackFile(path.join('traces', objectFile));

    const stringContent = await readFile(normalizedStringPath, 'utf8');
    expect(stringContent).toBe(stringPayload);

    const parsedObject = JSON.parse(
      await readFile(normalizedObjectPath, 'utf8')
    );
    expect(parsedObject).toEqual({ instrumented: true });

    const listing = await request(app).get('/api/traces/list');
    expect(listing.status).toBe(200);
    expect(listing.body.success).toBe(true);
    expect(listing.body.directory).toBe('./traces');
    const listedNames = listing.body.files.map((file) => file.name);
    expect(listedNames).toEqual(
      expect.arrayContaining([stringFile, objectFile])
    );
  });

  it('records unknown error results when settlements omit rejection reasons', async () => {
    const app = buildApp();
    const outputDirectory = `./tmp-traces/${randomUUID()}`;
    const normalizedDirectory = outputDirectory.replace(/^\.\/+/, '');
    trackDirectory(outputDirectory);
    trackFile(path.join(normalizedDirectory, 'success.json'));
    trackFile(path.join(normalizedDirectory, 'rejected.json'));

    const originalAllSettled = Promise.allSettled;
    Promise.allSettled = async (iterable) => {
      const results = await originalAllSettled.call(Promise, iterable);
      return results.map((result, index) =>
        index === 1 ? { status: 'rejected' } : result
      );
    };

    try {
      const response = await request(app)
        .post('/api/traces/write-batch')
        .send({
          outputDirectory,
          traces: [
            { traceData: { order: 'first' }, fileName: 'success.json' },
            { traceData: { order: 'second' }, fileName: 'rejected.json' },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.successCount).toBe(1);
      expect(response.body.failureCount).toBe(1);

      const failure = response.body.results.find(
        (entry) => entry.fileName === 'rejected.json'
      );
      expect(failure).toMatchObject({ success: false, error: 'Unknown error' });
    } finally {
      Promise.allSettled = originalAllSettled;
    }
  });

  it('surfaces catastrophic settlement failures from Promise.allSettled', async () => {
    const app = buildApp();
    const outputDirectory = `./tmp-traces/${randomUUID()}`;
    const normalizedDirectory = outputDirectory.replace(/^\.\/+/, '');
    trackDirectory(outputDirectory);
    trackFile(path.join(normalizedDirectory, 'unwritten.json'));

    const originalAllSettled = Promise.allSettled;
    Promise.allSettled = async (...args) => {
      throw new Error('forced settlement failure');
    };

    try {
      const response = await request(app)
        .post('/api/traces/write-batch')
        .send({
          outputDirectory,
          traces: [
            { traceData: { severity: 'high' }, fileName: 'unwritten.json' },
          ],
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Batch write operation failed',
        details: 'forced settlement failure',
      });
    } finally {
      Promise.allSettled = originalAllSettled;
    }
  });
});
