// tests/logic/jsonLogicEvaluationService.varPathWarning.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import JsonLogicEvaluationService from '../../src/logic/jsonLogicEvaluationService.js';

/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */

/** @type {jest.Mocked<ILogger>} */
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe('JsonLogicEvaluationService bracket path warnings', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new JsonLogicEvaluationService({ logger: mockLogger });
    mockLogger.info.mockClear();
  });

  test('logs warning for direct var path containing brackets', () => {
    const rule = { var: 'actor[0]' };
    service.evaluate(rule, { actor: { id: 'a' } });
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('actor[0]')
    );
  });

  test('logs warning for nested var path with default array form', () => {
    const rule = { '==': [{ var: ['target.components[Bad]', null] }, null] };
    service.evaluate(rule, { target: null });
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('target.components[Bad]')
    );
  });
});
