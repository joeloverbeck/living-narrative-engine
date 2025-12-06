/**
 * @jest-environment node
 */
import {
  describe,
  expect,
  test,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import jsonLogic from 'json-logic-js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import * as conditionResolver from '../../../src/utils/conditionRefResolver.js';

/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */

const createLogger = () =>
  /** @type {jest.Mocked<ILogger>} */ ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  });

const createRepository = () => ({
  getConditionDefinition: jest.fn(),
});

describe('JsonLogicEvaluationService additional coverage', () => {
  let mockLogger;
  let mockRepository;
  let service;

  beforeEach(() => {
    mockLogger = createLogger();
    mockRepository = createRepository();
    service = new JsonLogicEvaluationService({
      logger: mockLogger,
      gameDataRepository: mockRepository,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('has operator returns true when the property exists', () => {
    const rule = {
      has: [{ var: 'inventory' }, 'potion'],
    };
    const context = {
      inventory: {
        potion: 3,
        antidote: 1,
      },
    };

    const result = service.evaluate(rule, context);

    expect(result).toBe(true);
  });

  test('has operator returns false when the target is not an object', () => {
    const rule = {
      has: [{ var: 'target' }, 'missingProperty'],
    };
    const context = {
      target: 'not-an-object',
    };

    const result = service.evaluate(rule, context);

    expect(result).toBe(false);
  });

  test('validateJsonLogic detects dangerous properties discovered via getOwnPropertyNames', () => {
    const suspiciousRule = { safe: true };
    const originalGetOwnPropertyNames = Object.getOwnPropertyNames;
    jest.spyOn(Object, 'getOwnPropertyNames').mockImplementation((target) => {
      if (target === suspiciousRule) {
        return ['safe', '__proto__'];
      }
      return originalGetOwnPropertyNames(target);
    });

    const result = service.evaluate(suspiciousRule, {});

    expect(result).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'JsonLogicEvaluationService: JSON Logic validation failed:',
      expect.objectContaining({
        message: expect.stringContaining("Disallowed property '__proto__'"),
      })
    );
  });

  test('logs diagnostics when evaluation proceeds with an unresolved condition_ref', () => {
    const conditionRefSpy = jest
      .spyOn(conditionResolver, 'resolveConditionRefs')
      .mockReturnValue({ condition_ref: 'unresolved_condition' });
    let appliedRule;
    const applySpy = jest
      .spyOn(jsonLogic, 'apply')
      .mockImplementation((rule) => {
        appliedRule = rule;
        return false;
      });

    const context = {
      actor: { id: 'actor-1' },
      entity: { id: 'entity-9' },
    };

    service.evaluate({ condition_ref: 'root_condition' }, context);

    expect(conditionRefSpy).toHaveBeenCalled();
    expect(conditionRefSpy).toHaveReturnedWith({
      condition_ref: 'unresolved_condition',
    });
    const diagnosticCall = mockLogger.debug.mock.calls.find(([message]) =>
      message.includes('[DIAGNOSTIC] Evaluating condition_ref:')
    );
    expect(diagnosticCall).toBeDefined();
    expect(diagnosticCall?.[1]).toEqual(
      expect.objectContaining({
        conditionRef: 'unresolved_condition',
        contextKeys: ['actor', 'entity'],
        actorId: 'actor-1',
        entityId: 'entity-9',
      })
    );
    expect(applySpy).toHaveBeenCalled();
    expect(appliedRule).toEqual({ condition_ref: 'unresolved_condition' });
  });

  test('removeOperation logs an error when jsonLogic.rm_operation throws', () => {
    jest.spyOn(jsonLogic, 'rm_operation').mockImplementation(() => {
      throw new Error('rm_operation failed');
    });

    service.removeOperation('unknown');

    expect(mockLogger.error).toHaveBeenCalledWith(
      'JsonLogicEvaluationService: Failed to remove custom JSON Logic operation "unknown":',
      expect.objectContaining({ message: 'rm_operation failed' })
    );
  });
});
