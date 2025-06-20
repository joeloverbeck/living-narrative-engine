// tests/logic/jsonLogicEvaluationService.bracketWarning.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';

/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */

/** @type {jest.Mocked<ILogger>} */
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe('JsonLogicEvaluationService bracket notation warning', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new JsonLogicEvaluationService({
      logger: mockLogger,
      gameDataRepository: { getConditionDefinition: () => null },
    });
  });

  test('returns false and logs warning for bracket notation component access', () => {
    const rule = { var: "actor.components.['bad:component']" };
    const result = service.evaluate(rule, { actor: { components: {} } });
    expect(result).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("actor.components.['bad:component']")
    );
  });
});
