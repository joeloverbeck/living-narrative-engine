import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';
import path from 'node:path';

import traceRoutes from '../../src/routes/traceRoutes.js';

const projectRoot = path.resolve(process.cwd(), '../');

function buildApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/traces', traceRoutes);
  return app;
}

describe('traceRoutes path guard integration', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it('rejects batch writes that attempt to escape the project directory', async () => {
    const app = buildApp();
    const outsideDirectory = `../../tmp/outside-${Date.now()}`;

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        outputDirectory: outsideDirectory,
        traces: [
          { traceData: { attempt: 'escape' }, fileName: 'intrusion.json' },
        ],
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      error: 'Invalid output path',
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedMessage = consoleErrorSpy.mock.calls
      .map(([message]) => message)
      .find(
        (message) =>
          typeof message === 'string' &&
          message.includes(
            'Attempted to write trace batch outside project directory'
          )
      );
    expect(loggedMessage).toBeDefined();
    expect(loggedMessage).toContain(`"outputDirectory": "${outsideDirectory}"`);
    expect(loggedMessage).toContain(
      `"resolvedDirectory": "${path.resolve(projectRoot, outsideDirectory)}"`
    );
    expect(loggedMessage).toContain(`"projectRoot": "${projectRoot}"`);
  });

  it('rejects batch writes targeting absolute filesystem locations', async () => {
    const app = buildApp();
    const absoluteDirectory = path.join('/', 'tmp', `absolute-${Date.now()}`);

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        outputDirectory: absoluteDirectory,
        traces: [
          { traceData: { attempt: 'absolute' }, fileName: 'intrusion.json' },
        ],
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      error: 'Invalid output path',
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedMessage = consoleErrorSpy.mock.calls
      .map(([message]) => message)
      .find(
        (message) =>
          typeof message === 'string' &&
          message.includes(
            'Attempted to write trace batch outside project directory'
          )
      );
    expect(loggedMessage).toBeDefined();
    expect(loggedMessage).toContain(
      `"outputDirectory": "${absoluteDirectory}"`
    );
    expect(loggedMessage).toContain(
      `"resolvedDirectory": "${path.resolve(projectRoot, absoluteDirectory)}"`
    );
    expect(loggedMessage).toContain(`"projectRoot": "${projectRoot}"`);
  });
});
