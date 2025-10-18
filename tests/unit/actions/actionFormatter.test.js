import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
} from '@jest/globals';
import ActionCommandFormatter, {
  formatActionCommand,
} from '../../../src/actions/actionFormatter.js';
import * as actionFormatterModule from '../../../src/actions/actionFormatter.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { createMockLogger } from '../../common/mockFactories.js';
import { getEntityDisplayName } from '../../../src/utils/entityUtils.js';
import {
  dispatchValidationError,
  safeDispatchError,
} from '../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../src/utils/entityUtils.js', () => ({
  getEntityDisplayName: jest.fn(() => 'Mock Entity'),
}));

jest.mock('../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
  dispatchValidationError: jest.fn((dispatcher, message, details) => ({
    ok: false,
    error: message,
    ...(details !== undefined ? { details } : {}),
  })),
}));

function createEntityManager(overrides = {}) {
  return {
    getEntityInstance: jest.fn(() => ({ id: 'entity-1' })),
    ...overrides,
  };
}

function createDispatcher() {
  return { dispatch: jest.fn() };
}

describe('formatActionCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dispatchValidationError.mockImplementation(
      (dispatcher, message, details) => ({
        ok: false,
        error: message,
        ...(details !== undefined ? { details } : {}),
      })
    );
  });

  it('throws an error when logger is missing', () => {
    const actionDefinition = { id: 'missing-logger', template: 'do something' };
    const targetContext = ActionTargetContext.noTarget();
    const entityManager = createEntityManager();

    expect(() =>
      formatActionCommand(actionDefinition, targetContext, entityManager)
    ).toThrow('formatActionCommand: logger is required.');
  });

  it('throws when safeEventDispatcher lacks dispatch method', () => {
    const logger = createMockLogger();
    const actionDefinition = { id: 'no-dispatch', template: 'do it' };
    const targetContext = ActionTargetContext.noTarget();
    const entityManager = createEntityManager();

    expect(() =>
      formatActionCommand(actionDefinition, targetContext, entityManager, {
        logger,
        safeEventDispatcher: {},
      })
    ).toThrow(
      "Invalid or missing method 'dispatch' on dependency 'safeEventDispatcher'."
    );
  });

  it('dispatches validation error when actionDefinition template is missing', () => {
    const logger = createMockLogger();
    const dispatcher = createDispatcher();
    const entityManager = createEntityManager();

    const result = formatActionCommand(
      { id: 'invalid-template' },
      ActionTargetContext.noTarget(),
      entityManager,
      { logger, safeEventDispatcher: dispatcher }
    );

    expect(dispatchValidationError).toHaveBeenCalledWith(
      dispatcher,
      'formatActionCommand: Invalid or missing actionDefinition or template.',
      undefined,
      logger
    );
    expect(result).toEqual({
      ok: false,
      error: 'formatActionCommand: Invalid or missing actionDefinition or template.',
    });
  });

  it('dispatches validation error when target context is missing', () => {
    const logger = createMockLogger();
    const dispatcher = createDispatcher();
    const entityManager = createEntityManager();

    const result = formatActionCommand(
      { id: 'missing-target', template: 'say {target}' },
      null,
      entityManager,
      { logger, safeEventDispatcher: dispatcher }
    );

    expect(dispatchValidationError).toHaveBeenCalledWith(
      dispatcher,
      'formatActionCommand: Invalid or missing targetContext.',
      undefined,
      logger
    );
    expect(result).toEqual({
      ok: false,
      error: 'formatActionCommand: Invalid or missing targetContext.',
    });
  });

  it('dispatches validation error when entityManager is invalid', () => {
    const logger = createMockLogger();
    const dispatcher = createDispatcher();

    const result = formatActionCommand(
      { id: 'bad-manager', template: 'inspect {target}' },
      ActionTargetContext.noTarget(),
      {},
      { logger, safeEventDispatcher: dispatcher }
    );

    expect(dispatchValidationError).toHaveBeenCalledWith(
      dispatcher,
      'formatActionCommand: Invalid or missing entityManager.',
      undefined,
      logger
    );
    expect(result).toEqual({
      ok: false,
      error: 'formatActionCommand: Invalid or missing entityManager.',
    });
  });

  it('dispatches validation error when displayName function is invalid', () => {
    const logger = createMockLogger();
    const dispatcher = createDispatcher();
    const entityManager = createEntityManager();

    const result = formatActionCommand(
      { id: 'bad-display', template: 'inspect {target}' },
      ActionTargetContext.noTarget(),
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { displayNameFn: null }
    );

    expect(dispatchValidationError).toHaveBeenCalledWith(
      dispatcher,
      'formatActionCommand: getEntityDisplayName utility function is not available.',
      undefined,
      logger
    );
    expect(result).toEqual({
      ok: false,
      error: 'formatActionCommand: getEntityDisplayName utility function is not available.',
    });
  });

  it('returns original template when formatter for target type is missing', () => {
    const logger = createMockLogger();
    const dispatcher = createDispatcher();
    const entityManager = createEntityManager();

    const result = formatActionCommand(
      { id: 'unknown-type', template: 'look {target}' },
      { type: 'mystery' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap: {} }
    );

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown targetContext type: mystery')
    );
    expect(result).toEqual({ ok: true, value: 'look {target}' });
  });

  it('formats entity targets using default formatter with debug logging', () => {
    const logger = createMockLogger();
    const dispatcher = createDispatcher();
    const entityManager = createEntityManager({
      getEntityInstance: jest.fn(() => ({ id: 'entity-42' })),
    });

    const result = formatActionCommand(
      { id: 'attack', template: 'attack {target}' },
      ActionTargetContext.forEntity('entity-42'),
      entityManager,
      { logger, safeEventDispatcher: dispatcher, debug: true }
    );

    expect(entityManager.getEntityInstance).toHaveBeenCalledWith('entity-42');
    expect(getEntityDisplayName).toHaveBeenCalledWith(
      { id: 'entity-42' },
      'entity-42',
      logger
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Formatting command for action: attack')
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Final formatted command: "attack Mock Entity"')
    );
    expect(result).toEqual({ ok: true, value: 'attack Mock Entity' });
  });

  it('returns formatter result when placeholder substitution fails validation', () => {
    const logger = createMockLogger();
    const dispatcher = createDispatcher();
    const entityManager = createEntityManager();

    const result = formatActionCommand(
      { id: 'no-target', template: 'attack {target}' },
      { type: 'entity' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Target context type is 'entity' but entityId is missing");
  });

  it('normalizes string results from custom formatter and finalizes command', () => {
    const logger = createMockLogger();
    const dispatcher = createDispatcher();
    const entityManager = createEntityManager();
    const displayNameFn = jest.fn(() => 'Custom Name');
    const formatter = jest.fn((command, context, deps) => {
      deps.displayNameFn({ id: context.entityId }, context.entityId, logger);
      return command.replace('{target}', 'CUSTOM');
    });

    const result = formatActionCommand(
      { id: 'custom', template: 'greet {target}' },
      { type: 'custom', entityId: 'x', placeholder: 'target' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher, debug: true },
      { displayNameFn, formatterMap: { custom: formatter } }
    );

    expect(formatter).toHaveBeenCalled();
    expect(displayNameFn).toHaveBeenCalledWith(
      { id: 'x' },
      'x',
      logger
    );
    expect(result).toEqual({ ok: true, value: 'greet CUSTOM' });
  });

  it('dispatches safe error when formatter throws and returns a structured error', () => {
    const logger = createMockLogger();
    const dispatcher = createDispatcher();
    const entityManager = createEntityManager();
    const formatter = jest.fn(() => {
      throw new Error('formatter boom');
    });

    const result = formatActionCommand(
      { id: 'explosive', template: 'cast {target}' },
      { type: 'custom' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap: { custom: formatter } }
    );

    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      expect.stringContaining('placeholder substitution'),
      expect.objectContaining({ error: 'formatter boom' }),
      logger
    );
    expect(result).toEqual({
      ok: false,
      error: 'placeholder substitution failed',
      details: 'formatter boom',
    });
  });
});

describe('ActionCommandFormatter class', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dispatchValidationError.mockImplementation(
      (dispatcher, message, details) => ({
        ok: false,
        error: message,
        ...(details !== undefined ? { details } : {}),
      })
    );
  });

  it('delegates to formatActionCommand when formatting', () => {
    const logger = createMockLogger();
    const dispatcher = createDispatcher();
    const entityManager = createEntityManager();
    const actionDefinition = { id: 'delegate', template: 'speak' };
    const targetContext = ActionTargetContext.noTarget();

    const formatter = new ActionCommandFormatter();

    const classResult = formatter.format(
      actionDefinition,
      targetContext,
      entityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
      }
    );

    const directResult = actionFormatterModule.formatActionCommand(
      actionDefinition,
      targetContext,
      entityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
      }
    );

    expect(classResult).toEqual(directResult);
  });

  it('returns descriptive error for unsupported multi-target formatting', () => {
    const formatter = new ActionCommandFormatter();
    const result = formatter.formatMultiTarget();

    expect(result).toEqual({
      ok: false,
      error:
        'Multi-target formatting not supported by base ActionCommandFormatter. Use MultiTargetActionFormatter instead.',
    });
  });

  it('supports passing custom dependencies through to the formatter', () => {
    const logger = createMockLogger();
    const dispatcher = createDispatcher();
    const entityManager = createEntityManager();
    const customDisplayName = jest.fn(() => 'Special Name');
    const customFormatter = jest.fn((command, context, deps) => {
      deps.displayNameFn({ id: context.entityId }, context.entityId, logger);
      return { ok: true, value: command.replace('{target}', 'Special Name') };
    });

    const formatter = new ActionCommandFormatter();
    const result = formatter.format(
      { id: 'custom-deps', template: 'greet {target}' },
      { type: 'custom', entityId: 'target-1', placeholder: 'target' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { displayNameFn: customDisplayName, formatterMap: { custom: customFormatter } }
    );

    expect(customFormatter).toHaveBeenCalled();
    expect(customDisplayName).toHaveBeenCalledWith(
      { id: 'target-1' },
      'target-1',
      logger
    );
    expect(result).toEqual({ ok: true, value: 'greet Special Name' });
  });

  it('throws when format is invoked without required logger option', () => {
    const formatter = new ActionCommandFormatter();
    const entityManager = createEntityManager();

    expect(() =>
      formatter.format(
        { id: 'missing-logger', template: 'say {target}' },
        ActionTargetContext.noTarget(),
        entityManager
      )
    ).toThrow('formatActionCommand: logger is required.');
  });
});
