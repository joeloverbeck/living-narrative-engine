// tests/logic/jsonLogicEvaluationService.bracketWarning.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import * as logicUtils from '../../../src/utils/jsonLogicUtils.js';

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
    jest.spyOn(logicUtils, 'warnOnBracketPaths');
    service = new JsonLogicEvaluationService({
      logger: mockLogger,
      gameDataRepository: { getConditionDefinition: () => null },
    });
  });

  afterEach(() => {
    logicUtils.warnOnBracketPaths.mockRestore();
  });

  test('returns null and logs warning for bracket notation component access', () => {
    const rule = { var: "actor.components.['bad:component']" };
    const result = service.evaluate(rule, { actor: { components: {} } });
    expect(result).toBe(null);
    expect(logicUtils.warnOnBracketPaths).toHaveBeenCalledTimes(1);
    expect(logicUtils.warnOnBracketPaths).toHaveBeenCalledWith(
      rule,
      expect.objectContaining({ warn: expect.any(Function) })
    );
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("actor.components.['bad:component']")
    );
  });
});
