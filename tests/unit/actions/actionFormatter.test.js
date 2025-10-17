import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
  dispatchValidationError: jest.fn(),
}));

jest.mock('../../../src/utils/dependencyUtils.js', () => {
  const actual = jest.requireActual('../../../src/utils/dependencyUtils.js');
  return {
    ...actual,
    validateDependencies: jest.fn(actual.validateDependencies),
    validateDependency: jest.fn(actual.validateDependency),
  };
});

import ActionCommandFormatter, {
  formatActionCommand,
} from '../../../src/actions/actionFormatter.js';
import {
  safeDispatchError,
  dispatchValidationError,
} from '../../../src/utils/safeDispatchErrorUtils.js';
import {
  validateDependencies,
  validateDependency,
} from '../../../src/utils/dependencyUtils.js';

describe('ActionCommandFormatter', () => {
  /** @returns {import('../../../src/interfaces/coreServices.js').ILogger} */
  function createLogger() {
    return {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    };
  }

  /** @returns {{ dispatch: jest.Mock }} */
  function createDispatcher() {
    return {
      dispatch: jest.fn(),
    };
  }

  /**
   * Creates a baseline action definition for tests.
   * @param {Partial<import('../../../src/data/gameDataRepository.js').ActionDefinition>} overrides
   */
  function createAction(overrides = {}) {
    return {
      id: 'core:test-action',
      template: 'perform ${target}',
      ...overrides,
    };
  }

  /**
   * Creates a simple target context for formatting.
   * @param {Partial<import('../../../src/models/actionTargetContext.js').ActionTargetContext>} overrides
   */
  function createTargetContext(overrides = {}) {
    return {
      type: 'entity',
      placeholder: 'target',
      ...overrides,
    };
  }

  /** @returns {{ getEntityInstance: jest.Mock }} */
  function createEntityManager(returnValue = { id: 'npc-1' }) {
    return {
      getEntityInstance: jest.fn(() => returnValue),
    };
  }

  /**
   * Generates the shared options object for the formatter call.
   */
  function createOptions(overrides = {}) {
    return {
      logger: createLogger(),
      safeEventDispatcher: createDispatcher(),
      ...overrides,
    };
  }

  /**
   * Generates dependency overrides passed to the formatter.
   */
  function createDeps(overrides = {}) {
    return {
      displayNameFn: jest.fn(() => 'NPC'),
      formatterMap: {
        entity: jest.fn((command) => command.replace('${target}', 'NPC')),
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    dispatchValidationError.mockImplementation((dispatcher, message, details) => ({
      ok: false,
      error: message,
      details: { ...details, dispatched: true },
    }));
  });

  it('throws when no logger is provided', () => {
    const formatter = new ActionCommandFormatter();
    const action = createAction();
    const targetContext = createTargetContext();
    const entityManager = createEntityManager();

    expect(() =>
      formatter.format(action, targetContext, entityManager)
    ).toThrow('formatActionCommand: logger is required.');
  });

  it('returns a validation error when the action definition lacks a template', () => {
    const formatter = new ActionCommandFormatter();
    const action = createAction({ template: undefined });
    const targetContext = createTargetContext();
    const entityManager = createEntityManager();
    const options = createOptions();
    const deps = createDeps();

    const result = formatter.format(action, targetContext, entityManager, options, deps);

    expect(dispatchValidationError).toHaveBeenCalledWith(
      options.safeEventDispatcher,
      'formatActionCommand: Invalid or missing actionDefinition or template.',
      undefined,
      options.logger
    );
    expect(result).toEqual({
      ok: false,
      error: 'formatActionCommand: Invalid or missing actionDefinition or template.',
      details: { dispatched: true },
    });
    expect(validateDependency).toHaveBeenCalledWith(
      options.safeEventDispatcher,
      'safeEventDispatcher',
      options.logger,
      { requiredMethods: ['dispatch'] }
    );
  });

  it('returns a validation error when the target context is missing', () => {
    const formatter = new ActionCommandFormatter();
    const action = createAction();
    const entityManager = createEntityManager();
    const options = createOptions();
    const deps = createDeps();

    const result = formatter.format(action, null, entityManager, options, deps);

    expect(dispatchValidationError).toHaveBeenCalledWith(
      options.safeEventDispatcher,
      'formatActionCommand: Invalid or missing targetContext.',
      undefined,
      options.logger
    );
    expect(result.error).toBe(
      'formatActionCommand: Invalid or missing targetContext.'
    );
  });

  it('surfaces an entity manager validation error', () => {
    const formatter = new ActionCommandFormatter();
    const action = createAction();
    const targetContext = createTargetContext();
    const options = createOptions();
    const deps = createDeps();

    const invalidEntityManager = createEntityManager();
    delete invalidEntityManager.getEntityInstance;

    const result = formatter.format(
      action,
      targetContext,
      invalidEntityManager,
      options,
      deps
    );

    expect(result.error).toBe(
      'formatActionCommand: Invalid or missing entityManager.'
    );
    expect(validateDependencies).toHaveBeenCalledTimes(1);
  });

  it('surfaces a display name function validation error', () => {
    const formatter = new ActionCommandFormatter();
    const action = createAction();
    const targetContext = createTargetContext();
    const options = createOptions();
    const deps = createDeps({ displayNameFn: 'not-a-function' });

    const result = formatter.format(
      action,
      targetContext,
      createEntityManager(),
      options,
      deps
    );

    expect(result.error).toBe(
      'formatActionCommand: getEntityDisplayName utility function is not available.'
    );
  });

  it('continues formatting when dependency validation throws an unrelated error', () => {
    const formatter = new ActionCommandFormatter();
    const action = createAction({ template: 'observe ${target}' });
    const targetContext = createTargetContext();
    const options = createOptions();
    const deps = createDeps({
      formatterMap: {
        entity: jest.fn((command) => command.replace('${target}', 'observer')),
      },
    });

    validateDependencies.mockImplementationOnce(() => {
      throw new Error('some transient issue');
    });

    const result = formatter.format(
      action,
      targetContext,
      createEntityManager(),
      options,
      deps
    );

    expect(result).toEqual({ ok: true, value: 'observe observer' });
    expect(dispatchValidationError).not.toHaveBeenCalled();
  });

  it('throws when the safe event dispatcher is invalid', () => {
    const formatter = new ActionCommandFormatter();
    const action = createAction();
    const targetContext = createTargetContext();
    const options = createOptions({ safeEventDispatcher: {} });

    expect(() =>
      formatter.format(action, targetContext, createEntityManager(), options, createDeps())
    ).toThrow('Invalid or missing method \'dispatch\' on dependency \'safeEventDispatcher\'.');
  });

  it('warns and returns the original template when no formatter exists for the target type', () => {
    const formatter = new ActionCommandFormatter();
    const action = createAction();
    const targetContext = createTargetContext({ type: 'unknown' });
    const options = createOptions();
    const deps = createDeps({ formatterMap: {} });

    const result = formatter.format(
      action,
      targetContext,
      createEntityManager(),
      options,
      deps
    );

    expect(options.logger.warn).toHaveBeenCalledWith(
      'formatActionCommand: Unknown targetContext type: unknown for action core:test-action. Returning template unmodified.'
    );
    expect(result).toEqual({ ok: true, value: 'perform ${target}' });
    expect(safeDispatchError).not.toHaveBeenCalled();
  });

  it('falls back to default dependencies when none are provided', () => {
    const formatter = new ActionCommandFormatter();
    const action = createAction();
    const targetContext = createTargetContext({ type: 'unknown' });
    const options = createOptions();

    const result = formatter.format(
      action,
      targetContext,
      createEntityManager(),
      options
    );

    expect(options.logger.warn).toHaveBeenCalledWith(
      'formatActionCommand: Unknown targetContext type: unknown for action core:test-action. Returning template unmodified.'
    );
    expect(result).toEqual({ ok: true, value: 'perform ${target}' });
  });

  it('applies the formatter and normalizes string results', () => {
    const formatter = new ActionCommandFormatter();
    const action = createAction({ template: 'greet ${target}' });
    const targetContext = createTargetContext();
    const options = createOptions();
    const deps = createDeps({
      formatterMap: {
        entity: jest.fn((command) => command.replace('${target}', 'NPC')), 
      },
    });

    const result = formatter.format(
      action,
      targetContext,
      createEntityManager(),
      options,
      deps
    );

    expect(result).toEqual({ ok: true, value: 'greet NPC' });
    expect(options.logger.debug).not.toHaveBeenCalled();
  });

  it('propagates formatter-provided error results without modification', () => {
    const formatter = new ActionCommandFormatter();
    const action = createAction({ template: 'do ${target}' });
    const targetContext = createTargetContext();
    const options = createOptions();
    const failure = { ok: false, error: 'formatter failed' };
    const deps = createDeps({
      formatterMap: {
        entity: jest.fn(() => failure),
      },
    });

    const result = formatter.format(
      action,
      targetContext,
      createEntityManager(),
      options,
      deps
    );

    expect(result).toBe(failure);
  });

  it('dispatches errors and wraps them when the formatter throws', () => {
    const formatter = new ActionCommandFormatter();
    const action = createAction({ template: 'inspect ${target}' });
    const targetContext = createTargetContext();
    const options = createOptions();
    const deps = createDeps({
      formatterMap: {
        entity: jest.fn(() => {
          throw new Error('formatter boom');
        }),
      },
    });

    safeDispatchError.mockImplementation(() => undefined);

    const result = formatter.format(
      action,
      targetContext,
      createEntityManager(),
      options,
      deps
    );

    expect(safeDispatchError).toHaveBeenCalledWith(
      options.safeEventDispatcher,
      'formatActionCommand: Error during placeholder substitution for action core:test-action:',
      expect.objectContaining({ error: 'formatter boom' }),
      options.logger
    );
    expect(result).toEqual({
      ok: false,
      error: 'placeholder substitution failed',
      details: 'formatter boom',
    });
  });

  it('logs useful debug information when debug mode is enabled', () => {
    const formatter = new ActionCommandFormatter();
    const action = createAction({ template: 'speak ${target}' });
    const targetContext = createTargetContext();
    const logger = createLogger();
    const options = createOptions({ logger, debug: true });
    const deps = createDeps({
      formatterMap: {
        entity: jest.fn((command) => command.replace('${target}', 'NPC')), 
      },
    });

    const result = formatter.format(
      action,
      targetContext,
      createEntityManager(),
      options,
      deps
    );

    expect(logger.debug).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true, value: 'speak NPC' });
  });

  it('returns a descriptive error for unsupported multi-target formatting', () => {
    const formatter = new ActionCommandFormatter();
    const result = formatter.formatMultiTarget(
      createAction(),
      {},
      createEntityManager(),
      createOptions(),
      createDeps()
    );

    expect(result).toEqual({
      ok: false,
      error:
        'Multi-target formatting not supported by base ActionCommandFormatter. Use MultiTargetActionFormatter instead.',
    });
  });

  describe('formatActionCommand direct usage', () => {
    it('falls back to default options and still validates the logger', () => {
      expect(() =>
        formatActionCommand(
          createAction(),
          createTargetContext({ entityId: 'npc-1' }),
          createEntityManager()
        )
      ).toThrow('formatActionCommand: logger is required.');
    });

    it('uses default formatter dependencies when none are supplied', () => {
      const action = createAction({ template: 'salute {target}' });
      const entity = {
        id: 'npc-1',
        getComponentData: jest.fn(() => ({ text: 'Captain' })),
      };
      const entityManager = createEntityManager(entity);
      const targetContext = createTargetContext({
        entityId: 'npc-1',
        placeholder: 'target',
      });
      const options = createOptions();

      const result = formatActionCommand(
        action,
        targetContext,
        entityManager,
        options
      );

      expect(entityManager.getEntityInstance).toHaveBeenCalledWith('npc-1');
      expect(result).toEqual({ ok: true, value: 'salute Captain' });
    });
  });
});
