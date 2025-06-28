import {
  describe,
  test,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import JsonLogicEvaluationService, {
  evaluateConditionWithLogging,
} from '../../../src/logic/jsonLogicEvaluationService.js';
import { createMockLogger } from '../testUtils.js';
import * as resolver from '../../../src/utils/conditionRefResolver.js';
import jsonLogic from 'json-logic-js';

// Mock for conditionRefResolver
jest.mock('../../../src/utils/conditionRefResolver.js');

describe('JsonLogicEvaluationService uncovered branches', () => {
  /** @type {ReturnType<typeof createMockLogger>} */
  let logger;
  /** @type {JsonLogicEvaluationService} */
  let service;

  beforeEach(() => {
    logger = createMockLogger();
    service = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: { getConditionDefinition: jest.fn() },
    });
    resolver.resolveConditionRefs.mockReset();
    resolver.resolveConditionRefs.mockImplementation((r) => r);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('rethrows unexpected errors from resolveConditionRefs', () => {
    resolver.resolveConditionRefs.mockImplementation(() => {
      throw new Error('Unexpected');
    });
    expect(() => service.evaluate({ condition_ref: 'foo' }, {})).toThrow(
      'Unexpected'
    );
  });

  test('returns false when condition_ref cannot be resolved', () => {
    resolver.resolveConditionRefs.mockImplementation(() => {
      throw new Error('Could not resolve condition_ref "foo"');
    });
    expect(service.evaluate({ condition_ref: 'foo' }, {})).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Could not resolve condition_ref')
    );
  });

  test('detailed logging path executes outside test environment', () => {
    const origJest = global.jest;
    const origEnv = process.env.NODE_ENV;
    global.jest = undefined; // simulate non-test env
    process.env.NODE_ENV = 'production';

    const rule = { and: [true, false, true] };
    const result = service.evaluate(rule, {
      entity: {
        id: 'e',
        components: { 'core:position': { locationId: 'loc' } },
      },
    });

    expect(result).toBe(false);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Detailed evaluation of AND operation with 3 conditions:'
      )
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('AND operation short-circuited at condition 2')
    );

    global.jest = origJest;
    process.env.NODE_ENV = origEnv;
  });

  test('addOperation logs success and forwards to jsonLogic', () => {
    const spy = jest.spyOn(jsonLogic, 'add_operation');
    const fn = () => true;
    service.addOperation('myOp', fn);
    expect(spy).toHaveBeenCalledWith('myOp', fn);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Custom JSON Logic operation "myOp" added successfully.'
      )
    );
    spy.mockRestore();
  });

  test('addOperation logs error when jsonLogic throws', () => {
    const spy = jest
      .spyOn(jsonLogic, 'add_operation')
      .mockImplementation(() => {
        throw new Error('boom');
      });
    service.addOperation('bad', () => {});
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Failed to add custom JSON Logic operation "bad":'
      ),
      expect.any(Error)
    );
    spy.mockRestore();
  });
});

describe('evaluateConditionWithLogging', () => {
  test('logs and returns result when successful', () => {
    const logger = createMockLogger();
    const service = { evaluate: jest.fn().mockReturnValue(true) };
    const res = evaluateConditionWithLogging(
      service,
      { and: [true] },
      {},
      logger,
      'TEST'
    );
    expect(res).toEqual({ result: true, errored: false, error: undefined });
    expect(logger.debug).toHaveBeenCalledWith(
      'TEST Condition evaluation raw result: true'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'TEST Condition evaluation final boolean result: true'
    );
  });

  test('handles errors from service.evaluate', () => {
    const logger = createMockLogger();
    const service = {
      evaluate: jest.fn(() => {
        throw new Error('fail');
      }),
    };
    const res = evaluateConditionWithLogging(
      service,
      { and: [true] },
      {},
      logger,
      'ERR'
    );
    expect(res.result).toBe(false);
    expect(res.errored).toBe(true);
    expect(res.error).toBeInstanceOf(Error);
    expect(logger.error).toHaveBeenCalledWith(
      'ERR Error during condition evaluation. Treating condition as FALSE.',
      expect.any(Error)
    );
  });
});
