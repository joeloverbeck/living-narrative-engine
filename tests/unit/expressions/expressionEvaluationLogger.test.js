import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import ExpressionEvaluationLogger from '../../../src/expressions/expressionEvaluationLogger.js';

const createEndpointConfig = () => ({
  getExpressionLogEndpoint: jest.fn().mockReturnValue('http://localhost:3001/api/expressions/log'),
});

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('ExpressionEvaluationLogger', () => {
  let endpointConfig;
  let logger;
  let originalFetch;

  beforeEach(() => {
    endpointConfig = createEndpointConfig();
    logger = createLogger();
    originalFetch = global.fetch;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts the entry to the configured endpoint', async () => {
    global.fetch.mockResolvedValue({ ok: true });
    const evaluationLogger = new ExpressionEvaluationLogger({
      endpointConfig,
      logger,
    });

    const entry = { actorId: 'actor-1', eventType: 'ACTION_DECIDED' };
    const result = await evaluationLogger.logEvaluation(entry);

    expect(result).toBe(true);
    expect(endpointConfig.getExpressionLogEndpoint).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/expressions/log',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry }),
      })
    );
  });

  it('returns false when the request fails without throwing', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500 });
    const evaluationLogger = new ExpressionEvaluationLogger({
      endpointConfig,
      logger,
    });

    const result = await evaluationLogger.logEvaluation({ actorId: 'actor-1' });

    expect(result).toBe(false);
    expect(logger.debug).toHaveBeenCalled();
  });

  it('returns false when fetch throws', async () => {
    global.fetch.mockRejectedValue(new Error('network'));
    const evaluationLogger = new ExpressionEvaluationLogger({
      endpointConfig,
      logger,
    });

    const result = await evaluationLogger.logEvaluation({ actorId: 'actor-1' });

    expect(result).toBe(false);
    expect(logger.debug).toHaveBeenCalled();
  });

  it('returns false when entry is missing', async () => {
    const evaluationLogger = new ExpressionEvaluationLogger({
      endpointConfig,
      logger,
    });

    const result = await evaluationLogger.logEvaluation(null);

    expect(result).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalled();
  });
});
