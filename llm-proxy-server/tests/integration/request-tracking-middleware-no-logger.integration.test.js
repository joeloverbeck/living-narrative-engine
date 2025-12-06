import express from 'express';
import request from 'supertest';
import {
  createRequestTrackingMiddleware,
  createResponseGuard,
  REQUEST_STATE,
} from '../../src/middleware/requestTracking.js';

const mapTransitions = (transitions) =>
  transitions.map(({ from, to, metadata }) => ({
    from,
    to,
    metadata,
  }));

describe('request tracking middleware without explicit logger', () => {
  it('tracks lifecycle and commitment metadata when no logger is supplied', async () => {
    const app = express();
    app.use(createRequestTrackingMiddleware());

    let capturedTransitions = [];
    let capturedRequestId = null;
    let commitmentResults = null;
    let commitmentSource = null;

    app.get('/plain-response', (req, res) => {
      const firstCommit = res.commitResponse('manual-success');
      const secondCommit = res.commitResponse('duplicate-success');

      commitmentResults = { firstCommit, secondCommit };

      res.on('finish', () => {
        capturedTransitions = mapTransitions(req.stateTransitions);
        capturedRequestId = req.requestId;
        commitmentSource = res.getCommitmentSource();
      });

      res.send('plain-body');
    });

    const response = await request(app).get('/plain-response');

    expect(response.status).toBe(200);
    expect(response.text).toBe('plain-body');
    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.headers['x-request-id']).toBe(capturedRequestId);

    expect(commitmentResults).toEqual({
      firstCommit: true,
      secondCommit: false,
    });
    expect(commitmentSource).toBe('manual-success');

    const transitionPath = capturedTransitions.map(
      (transition) => transition.to
    );
    expect(transitionPath[0]).toBe(REQUEST_STATE.PROCESSING);
    expect(transitionPath[1]).toBe(REQUEST_STATE.RESPONDING);
    expect(
      transitionPath.filter((state) => state === REQUEST_STATE.COMPLETED).length
    ).toBeGreaterThan(0);
    expect(capturedTransitions[1].metadata).toMatchObject({
      source: 'manual-success',
    });
    expect(capturedTransitions[2].metadata).toMatchObject({ method: 'send' });
  });

  it('still exposes guard protections when response headers have already been sent', async () => {
    const app = express();
    app.use(createRequestTrackingMiddleware());

    let guardResult = null;
    let finalTransitions = [];
    let commitmentSnapshot = null;

    app.get('/partial-stream', (req, res) => {
      const guard = createResponseGuard(req, res, console);

      res.write('chunk-1');
      guardResult = guard.sendError(500, 'llm.failure', 'llm failure', {
        attempt: 2,
      });

      res.on('finish', () => {
        finalTransitions = mapTransitions(req.stateTransitions);
        commitmentSnapshot = {
          committed: res.isResponseCommitted(),
          source: res.getCommitmentSource(),
        };
      });

      res.end('chunk-2');
    });

    const response = await request(app).get('/partial-stream');

    expect(response.status).toBe(200);
    expect(response.text).toBe('chunk-1chunk-2');
    expect(guardResult).toBe(false);
    expect(commitmentSnapshot).toEqual({ committed: true, source: 'error' });

    const respondingTransition = finalTransitions.find(
      (transition) =>
        transition.to === REQUEST_STATE.RESPONDING &&
        transition.metadata?.source === 'error'
    );
    expect(respondingTransition).toBeDefined();
    expect(finalTransitions.at(-1)?.to).toBe(REQUEST_STATE.COMPLETED);
  });
});
