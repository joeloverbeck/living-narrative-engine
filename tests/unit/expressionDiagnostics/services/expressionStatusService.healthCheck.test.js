/**
 * @file Unit tests for ExpressionStatusService health checks
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import ExpressionStatusService from '../../../../src/expressionDiagnostics/services/ExpressionStatusService.js';

describe('ExpressionStatusService health checks', () => {
  let mockLogger;
  let originalFetch;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    originalFetch = global.fetch;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('issues a HEAD request to /health/live', async () => {
    global.fetch.mockResolvedValue({ ok: true });

    const service = new ExpressionStatusService({ logger: mockLogger });
    await service.checkServerHealth();

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/health/live',
      expect.objectContaining({
        method: 'HEAD',
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('returns success when server responds', async () => {
    global.fetch.mockResolvedValue({ ok: true });

    const service = new ExpressionStatusService({ logger: mockLogger });
    const result = await service.checkServerHealth();

    expect(result).toEqual({ success: true });
  });

  it('caches successful health checks within TTL', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));

    global.fetch.mockResolvedValue({ ok: true });

    const service = new ExpressionStatusService({ logger: mockLogger });
    const first = await service.checkServerHealth();
    const second = await service.checkServerHealth();

    expect(first).toEqual({ success: true });
    expect(second).toEqual({ success: true });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('refreshes the cache after TTL expires', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));

    global.fetch
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });

    const service = new ExpressionStatusService({ logger: mockLogger });
    await service.checkServerHealth();

    jest.setSystemTime(new Date('2024-01-01T00:01:01Z'));
    await service.checkServerHealth();

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('returns connection_refused when fetch rejects with TypeError', async () => {
    global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));

    const service = new ExpressionStatusService({ logger: mockLogger });
    const result = await service.checkServerHealth();

    expect(result).toEqual({
      success: false,
      errorType: 'connection_refused',
      message:
        'Cannot connect to server at http://localhost:3001. Ensure the LLM proxy server is running.',
    });
  });

  it('returns timeout when fetch aborts', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    global.fetch.mockRejectedValue(abortError);

    const service = new ExpressionStatusService({ logger: mockLogger });
    const result = await service.checkServerHealth();

    expect(result).toEqual({
      success: false,
      errorType: 'timeout',
      message: 'Request timed out after 2000ms. Server may be overloaded.',
    });
  });

  it('returns cors_blocked when response is opaque', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 0,
      type: 'opaque',
    });

    const service = new ExpressionStatusService({ logger: mockLogger });
    const result = await service.checkServerHealth();

    expect(result).toEqual({
      success: false,
      errorType: 'cors_blocked',
      message: 'Server rejected request due to CORS policy. Check PROXY_ALLOWED_ORIGIN.',
    });
  });

  it('returns server_error for non-ok responses', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const service = new ExpressionStatusService({ logger: mockLogger });
    const result = await service.checkServerHealth();

    expect(result).toEqual({
      success: false,
      errorType: 'server_error',
      message: 'Server error: 500. Check server logs.',
    });
  });
});
