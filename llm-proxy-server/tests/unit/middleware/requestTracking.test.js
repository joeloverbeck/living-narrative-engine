/**
 * @file Unit tests for request tracking middleware and response guard
 * @description Ensures correlation IDs, state transitions, and response commitment safeguards behave correctly
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  createRequestTrackingMiddleware,
  createResponseGuard,
  REQUEST_STATE,
} from '../../../src/middleware/requestTracking.js';

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-request-id'),
}));

describe('Request Tracking Middleware', () => {
  let mockLogger;
  let mockReq;
  let mockRes;
  let mockNext;
  let originalJson;
  let originalSend;
  let originalEnd;

  const setupMiddleware = () => {
    const middleware = createRequestTrackingMiddleware({ logger: mockLogger });
    middleware(mockReq, mockRes, mockNext);
  };

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockReq = {
      method: 'POST',
      path: '/proxy/llm',
    };

    mockRes = {};
    mockRes.json = jest.fn();
    mockRes.send = jest.fn();
    mockRes.end = jest.fn();
    mockRes.setHeader = jest.fn();
    mockRes.status = jest.fn(() => mockRes);
    mockRes.set = jest.fn(() => mockRes);
    mockRes.headersSent = false;

    mockNext = jest.fn();

    originalJson = mockRes.json;
    originalSend = mockRes.send;
    originalEnd = mockRes.end;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize request tracking context and transition to processing state', () => {
    setupMiddleware();

    expect(mockReq.requestId).toBe('test-request-id');
    expect(mockReq.requestState).toBe(REQUEST_STATE.PROCESSING);
    expect(mockReq.stateTransitions).toHaveLength(1);
    expect(mockReq.stateTransitions[0]).toMatchObject({
      from: REQUEST_STATE.PENDING,
      to: REQUEST_STATE.PROCESSING,
    });
    expect(typeof mockReq.transitionState).toBe('function');
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'X-Request-ID',
      'test-request-id'
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Request test-request-id: Started POST /proxy/llm',
      expect.objectContaining({
        method: 'POST',
        path: '/proxy/llm',
        requestId: 'test-request-id',
      })
    );
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('should manage response commitment lifecycle with logging and state transitions', () => {
    setupMiddleware();

    expect(mockRes.isResponseCommitted()).toBe(false);
    expect(mockRes.getCommitmentSource()).toBeNull();

    const firstCommit = mockRes.commitResponse('success');
    expect(firstCommit).toBe(true);
    expect(mockReq.requestState).toBe(REQUEST_STATE.RESPONDING);
    expect(mockReq.stateTransitions.at(-1)).toMatchObject({
      from: REQUEST_STATE.PROCESSING,
      to: REQUEST_STATE.RESPONDING,
      metadata: { source: 'success' },
    });
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "Request test-request-id: Response committed to 'success'",
      expect.objectContaining({
        requestId: 'test-request-id',
        source: 'success',
      })
    );

    const secondCommit = mockRes.commitResponse('error');
    expect(secondCommit).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "Request test-request-id: Response already committed to 'success', cannot commit to 'error'",
      expect.objectContaining({
        requestId: 'test-request-id',
        existingSource: 'success',
        attemptedSource: 'error',
      })
    );
    expect(mockRes.getCommitmentSource()).toBe('success');
    expect(mockRes.isResponseCommitted()).toBe(true);

    mockRes.json({ ok: true });
    expect(originalJson).toHaveBeenCalledWith({ ok: true });
    expect(mockReq.requestState).toBe(REQUEST_STATE.COMPLETED);
    expect(mockReq.stateTransitions.at(-1)).toMatchObject({
      from: REQUEST_STATE.RESPONDING,
      to: REQUEST_STATE.COMPLETED,
      metadata: { method: 'json' },
    });

    mockRes.send('final payload');
    expect(originalSend).toHaveBeenCalledWith('final payload');
    expect(mockReq.stateTransitions.at(-1)).toMatchObject({
      to: REQUEST_STATE.COMPLETED,
      metadata: { method: 'send' },
    });

    mockRes.end();
    expect(originalEnd).toHaveBeenCalledTimes(1);
    expect(mockReq.stateTransitions.at(-1)).toMatchObject({
      to: REQUEST_STATE.COMPLETED,
      metadata: { method: 'end' },
    });
  });

  it('should skip completion transitions when in error or timeout state', () => {
    setupMiddleware();

    mockReq.requestState = REQUEST_STATE.ERROR;
    const errorTransitions = mockReq.stateTransitions.length;
    mockRes.json({});
    expect(mockReq.stateTransitions).toHaveLength(errorTransitions);
    expect(originalJson).toHaveBeenCalledWith({});

    mockReq.requestState = REQUEST_STATE.TIMEOUT;
    const timeoutTransitions = mockReq.stateTransitions.length;
    mockRes.send('payload');
    expect(mockReq.stateTransitions).toHaveLength(timeoutTransitions);
    expect(originalSend).toHaveBeenCalledWith('payload');

    const beforeEndTransitions = mockReq.stateTransitions.length;
    mockRes.end('final');
    expect(mockReq.stateTransitions).toHaveLength(beforeEndTransitions);
    expect(originalEnd).toHaveBeenCalledWith('final');
  });

  it('should operate without a logger while maintaining tracking metadata', () => {
    const middleware = createRequestTrackingMiddleware();
    const localReq = { method: 'GET', path: '/health' };
    const localRes = {
      json: jest.fn(),
      send: jest.fn(),
      end: jest.fn(),
      setHeader: jest.fn(),
      headersSent: false,
    };
    localRes.status = jest.fn(() => localRes);
    localRes.set = jest.fn(() => localRes);
    const localNext = jest.fn();

    middleware(localReq, localRes, localNext);

    expect(localReq.requestId).toBe('test-request-id');
    expect(localReq.requestState).toBe(REQUEST_STATE.PROCESSING);
    expect(localReq.stateTransitions[0]).toMatchObject({
      from: REQUEST_STATE.PENDING,
      to: REQUEST_STATE.PROCESSING,
    });
    expect(localNext).toHaveBeenCalledTimes(1);

    expect(localRes.commitResponse('success')).toBe(true);
    expect(localReq.requestState).toBe(REQUEST_STATE.RESPONDING);
    expect(localRes.commitResponse('error')).toBe(false);

    localRes.json({ ok: true });
    expect(localReq.requestState).toBe(REQUEST_STATE.COMPLETED);
  });
});

describe('createResponseGuard', () => {
  let mockReq;
  let mockRes;
  let mockLogger;

  const createGuard = () => createResponseGuard(mockReq, mockRes, mockLogger);

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockReq = {
      requestId: 'test-request-id',
      transitionState: jest.fn((newState) => {
        mockReq.requestState = newState;
      }),
    };

    mockRes = {
      commitResponse: jest.fn().mockReturnValue(true),
      isResponseCommitted: jest.fn().mockReturnValue(false),
      getCommitmentSource: jest.fn().mockReturnValue(null),
      headersSent: false,
      status: jest.fn(() => mockRes),
      set: jest.fn(() => mockRes),
      json: jest.fn(() => mockRes),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should send success responses when not yet committed', () => {
    const guard = createGuard();
    const payload = { message: 'ok' };

    const result = guard.sendSuccess(200, payload);

    expect(result).toBe(true);
    expect(mockRes.commitResponse).toHaveBeenCalledWith('success');
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.set).toHaveBeenCalledWith(
      'Content-Type',
      'application/json'
    );
    expect(mockRes.json).toHaveBeenCalledWith(payload);
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('should block success responses when already committed', () => {
    mockRes.commitResponse.mockReturnValueOnce(false);
    mockRes.getCommitmentSource.mockReturnValue('error');

    const guard = createGuard();
    const result = guard.sendSuccess(202, { accepted: true });

    expect(result).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "Request test-request-id: Cannot send success response - already committed to 'error'",
      expect.objectContaining({
        requestId: 'test-request-id',
        statusCode: 202,
        blockedBy: 'error',
      })
    );
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should prevent success responses when headers already sent', () => {
    mockRes.headersSent = true;

    const guard = createGuard();
    const result = guard.sendSuccess(204, null, 'text/plain');

    expect(mockRes.commitResponse).toHaveBeenCalledWith('success');
    expect(result).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Request test-request-id: Headers already sent, cannot send success response',
      { requestId: 'test-request-id' }
    );
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should send error responses and transition to error state', () => {
    const guard = createGuard();
    const details = { context: 'llm-call' };

    const result = guard.sendError(
      504,
      'llm.timeout',
      'Gateway timeout',
      details
    );

    expect(result).toBe(true);
    expect(mockRes.commitResponse).toHaveBeenCalledWith('timeout');
    expect(mockReq.transitionState).toHaveBeenCalledWith(REQUEST_STATE.ERROR, {
      stage: 'llm.timeout',
      statusCode: 504,
    });
    expect(mockRes.status).toHaveBeenCalledWith(504);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: true,
      message: 'Gateway timeout',
      stage: 'llm.timeout',
      details: {
        ...details,
        requestId: 'test-request-id',
      },
      originalStatusCode: 504,
    });
  });

  it('should treat non-timeout errors as regular error commitments', () => {
    const guard = createGuard();

    guard.sendError(500, 'llm.failure', 'Processing error');

    expect(mockRes.commitResponse).toHaveBeenCalledWith('error');
  });

  it('should block error responses when already committed', () => {
    mockRes.commitResponse.mockReturnValueOnce(false);
    mockRes.getCommitmentSource.mockReturnValue('success');

    const guard = createGuard();
    const result = guard.sendError(500, 'llm.failure', 'Already sent');

    expect(result).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "Request test-request-id: Cannot send error response - already committed to 'success'",
      expect.objectContaining({
        requestId: 'test-request-id',
        blockedBy: 'success',
      })
    );
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should prevent error responses when headers already sent', () => {
    mockRes.headersSent = true;

    const guard = createGuard();
    const result = guard.sendError(500, 'llm.failure', 'Headers already sent');

    expect(result).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Request test-request-id: Headers already sent, cannot send error response',
      { requestId: 'test-request-id', stage: 'llm.failure' }
    );
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should expose commitment status via canSendResponse helper', () => {
    mockRes.isResponseCommitted
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true);
    mockRes.getCommitmentSource.mockReturnValueOnce('timeout');
    mockRes.headersSent = true;

    const guard = createGuard();
    const status = guard.canSendResponse();

    expect(status).toEqual({
      canSend: false,
      committed: true,
      source: 'timeout',
      headersSent: true,
      requestId: 'test-request-id',
    });
  });

  it('should report response as sendable when not yet committed', () => {
    mockRes.isResponseCommitted
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false);
    mockRes.headersSent = false;

    const guard = createGuard();
    const status = guard.canSendResponse();

    expect(status).toEqual({
      canSend: true,
      committed: false,
      source: null,
      headersSent: false,
      requestId: 'test-request-id',
    });
    expect(mockRes.getCommitmentSource).toHaveBeenCalled();
  });
});
