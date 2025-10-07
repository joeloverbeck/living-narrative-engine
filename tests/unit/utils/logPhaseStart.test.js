import { describe, expect, it, jest } from '@jest/globals';
import { logPhaseStart } from '../../../src/utils/logPhaseStart.js';

describe('logPhaseStart', () => {
  it('logs the standardized banner message via logger.info', () => {
    const info = jest.fn();
    const logger = { info };

    const result = logPhaseStart(logger, 'ContentPhase');

    expect(result).toBeUndefined();
    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith('— ContentPhase starting —');
    expect(info.mock.calls[0][0]).toBe('— ContentPhase starting —');
  });

  it('coerces complex phase identifiers using their toString implementation', () => {
    const toString = jest.fn(() => 'CustomPhase');
    const phase = { toString };
    const info = jest.fn();
    const logger = { info };

    logPhaseStart(logger, phase);

    expect(toString).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith('— CustomPhase starting —');
  });

  it('propagates errors thrown by the underlying logger while still attempting to log', () => {
    const error = new Error('logger unavailable');
    const info = jest.fn(() => {
      throw error;
    });
    const logger = { info };

    expect(() => logPhaseStart(logger, 'FailurePhase')).toThrow(error);
    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith('— FailurePhase starting —');
  });
});
