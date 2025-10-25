import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  initialParse,
  repairAndParse,
  JsonProcessingError,
} from '../../../src/utils/jsonRepair.js';
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';
import { repairJson } from '@toolsycc/json-repair';

jest.mock('@toolsycc/json-repair');
jest.mock('../../../src/utils/safeDispatchErrorUtils.js');

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('JsonProcessingError', () => {
  it('preserves stage and original error info', () => {
    const orig = new Error('boom');
    const err = new JsonProcessingError('failed', {
      stage: 'test',
      originalError: orig,
      attemptedJsonString: 'x',
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('failed');
    expect(err.stage).toBe('test');
    expect(err.originalError).toBe(orig);
    expect(err.attemptedJsonString).toBe('x');
    expect(err.stack).toContain('boom');
  });
});

describe('initialParse', () => {
  it('parses valid JSON', () => {
    const logger = createLogger();
    const obj = initialParse('{"a":1}', logger);
    expect(obj).toEqual({ a: 1 });
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('logs and rethrows parse errors', () => {
    const logger = createLogger();
    expect(() => initialParse('foo', logger)).toThrow(SyntaxError);
    expect(logger.debug).toHaveBeenCalledWith(
      'initialParse: JSON.parse failed',
      { message: expect.any(String) }
    );
  });
});

describe('repairAndParse', () => {
  it('returns repaired object on success', () => {
    const logger = createLogger();
    repairJson.mockReturnValue('{"b":2}');
    const result = repairAndParse('{"b":2}', logger, undefined, new Error('x'));
    expect(result).toEqual({ b: 2 });
    expect(logger.debug).toHaveBeenCalledWith(
      'parseAndRepairJson: Successfully parsed JSON after repair.',
      { cleanedLength: '{"b":2}'.length, repairedLength: '{"b":2}'.length }
    );
  });

  it('dispatches error when repair fails and dispatcher provided', () => {
    const logger = createLogger();
    const dispatcher = { dispatch: jest.fn() };
    const parseError = new SyntaxError('bad');
    repairJson.mockImplementation(() => {
      throw new Error('no');
    });
    expect(() => repairAndParse('bad', logger, dispatcher, parseError)).toThrow(
      JsonProcessingError
    );
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      expect.stringContaining('Failed to parse JSON even after repair attempt'),
      expect.any(Object)
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs error when repair fails without dispatcher', () => {
    const logger = createLogger();
    const parseError = new SyntaxError('bad');
    repairJson.mockImplementation(() => {
      throw new Error('oops');
    });
    expect(() => repairAndParse('bad', logger, undefined, parseError)).toThrow(
      JsonProcessingError
    );
    expect(safeDispatchError).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'parseAndRepairJson: Failed to parse JSON even after repair attempt'
      ),
      expect.any(Object)
    );
  });

  it('falls back to console logging when logger is missing', () => {
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    try {
      repairJson.mockReturnValue('{"c":3}');
      const result = repairAndParse('{"c":3}', null, undefined, new Error('boom'));
      expect(result).toEqual({ c: 3 });
      expect(debugSpy).toHaveBeenCalledWith(
        'JsonRepair: ',
        'parseAndRepairJson: Successfully parsed JSON after repair.',
        { cleanedLength: '{"c":3}'.length, repairedLength: '{"c":3}'.length }
      );
    } finally {
      debugSpy.mockRestore();
    }
  });
});
