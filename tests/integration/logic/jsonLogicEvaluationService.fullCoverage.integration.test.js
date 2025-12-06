import {
  jest,
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
} from '@jest/globals';
import jsonLogic from 'json-logic-js';
import JsonLogicEvaluationService, {
  evaluateConditionWithLogging,
} from '../../../src/logic/jsonLogicEvaluationService.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import * as environmentUtils from '../../../src/utils/environmentUtils.js';

/**
 * Helper to build a logger that records all log calls for assertions.
 * The logger matches the shape expected across the real services.
 */
function createTestLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe('JsonLogicEvaluationService real module integration', () => {
  let logger;
  let registry;
  let repository;
  let service;
  /** @type {string[]} */
  let registeredOperators;

  beforeEach(() => {
    logger = createTestLogger();
    registry = new InMemoryDataRegistry({ logger });
    repository = new GameDataRepository(registry, logger);
    service = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: repository,
    });
    registeredOperators = [];
  });

  afterEach(() => {
    for (const op of registeredOperators) {
      try {
        jsonLogic.rm_operation(op);
      } catch (error) {
        // ignore cleanup errors, the implementation under test logs them already
      }
    }
    registeredOperators = [];
    jest.restoreAllMocks();
  });

  /**
   *
   * @param name
   * @param impl
   */
  function registerOperator(name, impl) {
    service.addOperation(name, impl);
    registeredOperators.push(name);
    return impl;
  }

  /**
   *
   * @param name
   */
  function deregisterOperator(name) {
    const index = registeredOperators.indexOf(name);
    if (index !== -1) {
      registeredOperators.splice(index, 1);
    }
    service.removeOperation(name);
  }

  /**
   *
   * @param id
   * @param logic
   */
  function storeCondition(id, logic) {
    registry.store('conditions', id, {
      id,
      logic,
      modId: 'test-mod',
    });
  }

  it('resolves nested condition references using the real repository', () => {
    storeCondition('library:isHostile', {
      '==': [{ var: 'actor.components.mood' }, 'hostile'],
    });
    storeCondition('library:isInDanger', {
      and: [
        { condition_ref: 'library:isHostile' },
        { '==': [{ var: 'location.securityLevel' }, 'none'] },
      ],
    });

    const context = {
      actor: { id: 'npc:scout', components: { mood: 'hostile' } },
      location: { id: 'location:atrium', securityLevel: 'none' },
    };

    const result = service.evaluate(
      { condition_ref: 'library:isInDanger' },
      context
    );

    expect(result).toBe(true);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Evaluating rule:')
    );
  });

  it('warns about bracket notation var paths while still evaluating', () => {
    const context = {
      actor: { id: 'npc:hero', components: { status: 'danger' } },
    };

    const result = service.evaluate(
      {
        '==': [{ var: 'actor.components["status"]' }, 'danger'],
      },
      context
    );

    expect(result).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid var path')
    );
  });

  it('rejects rules with dangerous prototype mutations during validation', () => {
    logger.error.mockClear();
    const result = service.evaluate({ constructor: { polluted: true } }, {});

    expect(result).toBe(false);
    expect(
      logger.error.mock.calls.some(
        ([message, error]) =>
          typeof message === 'string' &&
          message.includes('JSON Logic validation failed:') &&
          error?.message.includes('Disallowed property')
      )
    ).toBe(true);
  });

  it('rejects rules with disallowed operations', () => {
    logger.error.mockClear();
    const result = service.evaluate({ evil_op: [1, 2] }, {});

    expect(result).toBe(false);
    expect(
      logger.error.mock.calls.some(
        ([message, error]) =>
          typeof message === 'string' &&
          message.includes('JSON Logic validation failed:') &&
          error?.message.includes('Disallowed operation')
      )
    ).toBe(true);
  });

  it('detects circular objects in validation and logs an error', () => {
    const circularRule = { and: [] };
    circularRule.and.push(circularRule);

    logger.error.mockClear();
    const result = service.evaluate(circularRule, {});

    expect(result).toBe(false);
    expect(
      logger.error.mock.calls.some(
        ([message, error]) =>
          typeof message === 'string' &&
          message.includes('JSON Logic validation failed:') &&
          error?.message.includes('Circular reference detected')
      )
    ).toBe(true);
  });

  it('handles missing repositories gracefully with fallback behaviour', () => {
    const fallbackLogger = createTestLogger();
    const fallbackService = new JsonLogicEvaluationService({
      logger: fallbackLogger,
    });

    const result = fallbackService.evaluate({ '==': [1, 1] }, {});

    expect(result).toBe(true);
    expect(
      fallbackLogger.warn.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes(
            'No gameDataRepository provided; condition_ref resolution disabled.'
          )
      )
    ).toBe(true);
  });

  it('applies custom AND short-circuiting logic when not in a test environment', () => {
    const envSpy = jest
      .spyOn(environmentUtils, 'isTestEnvironment')
      .mockReturnValue(false);

    const throwIfCalled = jest.fn(() => {
      throw new Error('should not evaluate');
    });
    registerOperator('throw_error_operator', throwIfCalled);

    const context = {
      entity: {
        id: 'entity:target',
        components: {
          'core:position': { error: new Error('entity position failure') },
        },
      },
      location: { id: 'location:atrium' },
      // No actor supplied to exercise the logging branch that reports missing actors
    };

    const rule = {
      and: [{ '==': [1, 1] }, { '==': [1, 0] }, { throw_error_operator: [] }],
    };

    const result = service.evaluate(rule, context);

    expect(result).toBe(false);
    expect(throwIfCalled).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('AND operation short-circuited')
    );
    expect(
      logger.error.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('Error retrieving entity position')
      )
    ).toBe(true);
    expect(
      logger.debug.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('Actor: undefined (missing from context)')
      )
    ).toBe(true);

    envSpy.mockRestore();
  });

  it('logs actor position issues and recovers when actor id is missing', () => {
    const envSpy = jest
      .spyOn(environmentUtils, 'isTestEnvironment')
      .mockReturnValue(false);

    const throwIfCalled = registerOperator('throw_error_operator', jest.fn());

    const context = {
      actor: {
        components: {
          'core:position': { error: new Error('actor position failure') },
        },
      },
      location: { id: 'location:observatory' },
    };

    const rule = {
      or: [{ '==': [0, 1] }, { '==': [1, 1] }, { throw_error_operator: [] }],
    };

    const result = service.evaluate(rule, context);

    expect(result).toBe(true);
    expect(throwIfCalled).not.toHaveBeenCalled();
    expect(
      logger.error.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('Error retrieving actor position')
      )
    ).toBe(true);
    expect(
      logger.error.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('Actor exists but actor.id is undefined!')
      )
    ).toBe(true);

    envSpy.mockRestore();
  });

  it('logs entity and actor locations when context provides them', () => {
    const envSpy = jest
      .spyOn(environmentUtils, 'isTestEnvironment')
      .mockReturnValue(false);

    registerOperator('throw_error_operator', jest.fn());

    const context = {
      entity: {
        id: 'entity:guide',
        components: {
          'core:position': { locationId: 'location:garden' },
        },
      },
      actor: {
        id: 'npc:hero',
        components: {
          'core:position': { locationId: 'location:garden' },
        },
      },
      location: { id: 'location:garden' },
    };

    const rule = {
      or: [{ '==': [1, 1] }, { throw_error_operator: [] }],
    };

    const result = service.evaluate(rule, context);

    expect(result).toBe(true);
    expect(
      logger.debug.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('OR operation short-circuited')
      )
    ).toBe(true);
    expect(
      logger.debug.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('Entity: entity:guide, Location: location:garden')
      )
    ).toBe(true);
    expect(
      logger.debug.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('Actor: npc:hero, Location: location:garden')
      )
    ).toBe(true);
    expect(
      logger.debug.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.endsWith('Location: location:garden')
      )
    ).toBe(true);

    envSpy.mockRestore();
  });

  it('handles vacuous logical identities for empty AND/OR arrays', () => {
    const andResult = service.evaluate({ and: [] }, {});
    expect(andResult).toBe(true);
    expect(
      logger.debug.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('Special-case {and: []} ⇒ true')
      )
    ).toBe(true);

    logger.debug.mockClear();
    const orResult = service.evaluate({ or: [] }, {});
    expect(orResult).toBe(false);
    expect(
      logger.debug.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('Special-case {or: []} ⇒ false')
      )
    ).toBe(true);
  });

  it('falls back to a false condition when circular condition_refs are detected', () => {
    storeCondition('cond:A', { condition_ref: 'cond:B' });
    storeCondition('cond:B', { condition_ref: 'cond:A' });

    logger.error.mockClear();
    const result = service.evaluate({ condition_ref: 'cond:A' }, {});

    expect(result).toBe(false);
    expect(
      logger.error.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('Circular condition_ref detected')
      )
    ).toBe(true);
  });

  it('falls back gracefully when condition definitions are missing', () => {
    logger.error.mockClear();
    const result = service.evaluate({ condition_ref: 'cond:missing' }, {});

    expect(result).toBe(false);
    expect(
      logger.error.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('Could not resolve condition_ref')
      )
    ).toBe(true);
  });

  it('supports registering and removing custom operations', () => {
    registerOperator('throw_error_operator', () => true);

    deregisterOperator('throw_error_operator');
  });

  it('logs errors when adding custom operations fails', () => {
    const addSpy = jest
      .spyOn(jsonLogic, 'add_operation')
      .mockImplementation(() => {
        throw new Error('add failure');
      });

    service.addOperation('broken', () => {});

    expect(
      logger.error.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('Failed to add custom JSON Logic operation "broken"')
      )
    ).toBe(true);

    addSpy.mockRestore();
  });

  it('logs errors when removing custom operations fails', () => {
    const removeSpy = jest
      .spyOn(jsonLogic, 'rm_operation')
      .mockImplementation(() => {
        throw new Error('remove failure');
      });

    service.removeOperation('ghost');

    expect(
      logger.error.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes(
            'Failed to remove custom JSON Logic operation "ghost"'
          )
      )
    ).toBe(true);

    removeSpy.mockRestore();
  });

  it('reports detailed outcomes through evaluateConditionWithLogging', () => {
    logger.debug.mockClear();
    const outcome = evaluateConditionWithLogging(
      service,
      { '==': [1, 1] },
      {},
      logger,
      '[Check]'
    );

    expect(outcome).toEqual({ result: true, errored: false, error: undefined });
    expect(logger.debug).toHaveBeenCalledWith(
      '[Check] Condition evaluation final boolean result: true'
    );
  });

  it('flags errors through evaluateConditionWithLogging when evaluation throws', () => {
    const errorLogger = createTestLogger();
    const throwingService = {
      evaluate: jest.fn(() => {
        throw new Error('boom');
      }),
    };

    const outcome = evaluateConditionWithLogging(
      throwingService,
      { '==': [1, 2] },
      {},
      errorLogger,
      '[Check]'
    );

    expect(outcome.result).toBe(false);
    expect(outcome.errored).toBe(true);
    expect(outcome.error).toBeInstanceOf(Error);
    expect(errorLogger.error).toHaveBeenCalledWith(
      '[Check] Error during condition evaluation. Treating condition as FALSE.',
      expect.any(Error)
    );
  });
});
