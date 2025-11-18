import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockGetEntityDisplayName = jest.fn(() => 'Default Entity Name');

jest.mock('../../../src/utils/entityUtils.js', () => ({
  getEntityDisplayName: (...args) => mockGetEntityDisplayName(...args),
}));

jest.mock('../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
  dispatchValidationError: jest.fn((dispatcher, message, details) => ({
    ok: false,
    error: message,
    details,
  })),
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
import { targetFormatterMap } from '../../../src/actions/formatters/targetFormatters.js';
import {
  validateDependency,
  validateDependencies,
} from '../../../src/utils/dependencyUtils.js';
import { dispatchValidationError } from '../../../src/utils/safeDispatchErrorUtils.js';

describe('ActionCommandFormatter default dependency fallbacks', () => {
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
    return { dispatch: jest.fn() };
  }

  /**
   * Creates a baseline action definition for tests.
   *
   * @param {Partial<import('../../../src/data/gameDataRepository.js').ActionDefinition>} overrides
   */
  function createAction(overrides = {}) {
    return {
      id: 'core:inspect-entity',
      template: 'inspect {target}',
      ...overrides,
    };
  }

  /**
   * Creates a standard target context representing an entity target.
   *
   * @param {Partial<import('../../../src/models/actionTargetContext.js').ActionTargetContext>} overrides
   */
  function createTargetContext(overrides = {}) {
    return {
      type: 'entity',
      entityId: 'npc-42',
      placeholder: 'target',
      ...overrides,
    };
  }

  /**
   * @param entityOverrides
   * @returns {{ getEntityInstance: jest.Mock }}
   */
  function createEntityManager(entityOverrides = {}) {
    return {
      getEntityInstance: jest.fn(() => ({ id: 'npc-42', ...entityOverrides })),
    };
  }

  /**
   * Generates the shared options object for the formatter call.
   *
   * @param overrides
   */
  function createOptions(overrides = {}) {
    return {
      logger: createLogger(),
      safeEventDispatcher: createDispatcher(),
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEntityDisplayName.mockReturnValue('Default Entity Name');
  });

  it('uses the default displayNameFn when the dependency object omits it', () => {
    const formatter = new ActionCommandFormatter();
    const action = createAction();
    const targetContext = createTargetContext();
    const entityManager = createEntityManager({ name: 'Inspector' });
    const options = createOptions();

    const result = formatter.format(action, targetContext, entityManager, options, {
      formatterMap: targetFormatterMap,
    });

    expect(result).toEqual({ ok: true, value: 'inspect Default Entity Name' });
    expect(mockGetEntityDisplayName).toHaveBeenCalledTimes(1);
    expect(mockGetEntityDisplayName).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'npc-42', name: 'Inspector' }),
      'npc-42',
      options.logger
    );
    expect(validateDependency).toHaveBeenCalledWith(
      options.safeEventDispatcher,
      'safeEventDispatcher',
      options.logger,
      { requiredMethods: ['dispatch'] }
    );
    expect(dispatchValidationError).not.toHaveBeenCalled();
  });

  it('uses the default formatterMap when the dependency object omits it', () => {
    const formatter = new ActionCommandFormatter();
    const action = createAction({ template: 'observe {target}' });
    const targetContext = createTargetContext({ entityId: 'npc-7' });
    const entityManager = {
      getEntityInstance: jest.fn(() => ({ id: 'npc-7' })),
    };
    const options = createOptions();
    const customDisplayName = jest.fn(() => 'Custom Display');

    const result = formatter.format(action, targetContext, entityManager, options, {
      displayNameFn: customDisplayName,
    });

    expect(result).toEqual({ ok: true, value: 'observe Custom Display' });
    expect(customDisplayName).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'npc-7' }),
      'npc-7',
      options.logger
    );
    expect(mockGetEntityDisplayName).not.toHaveBeenCalled();
    expect(entityManager.getEntityInstance).toHaveBeenCalledWith('npc-7');
    expect(dispatchValidationError).not.toHaveBeenCalled();
  });

  it('falls back to the default dependency bundle when omitted entirely', () => {
    const action = createAction({ template: 'inspect {target}' });
    const targetContext = createTargetContext({ entityId: 'npc-21' });
    const entityManager = {
      getEntityInstance: jest.fn(() => ({ id: 'npc-21', name: 'Watcher' })),
    };
    const options = createOptions();

    const result = formatActionCommand(
      action,
      targetContext,
      entityManager,
      options
    );

    expect(result).toEqual({ ok: true, value: 'inspect Default Entity Name' });
    expect(mockGetEntityDisplayName).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'npc-21', name: 'Watcher' }),
      'npc-21',
      options.logger
    );
    expect(entityManager.getEntityInstance).toHaveBeenCalledWith('npc-21');
    expect(dispatchValidationError).not.toHaveBeenCalled();
  });

  it('throws a descriptive error when required logger is missing', () => {
    const action = createAction();
    const targetContext = createTargetContext();
    const entityManager = createEntityManager();

    expect(() =>
      formatActionCommand(action, targetContext, entityManager)
    ).toThrow('formatActionCommand: logger is required.');
  });

  it('continues formatting when dependency validation throws an unexpected error', () => {
    const formatter = new ActionCommandFormatter();
    const action = createAction({ id: 'core:resilient', template: 'use {target}' });
    const targetContext = createTargetContext({ type: 'custom' });
    const entityManager = createEntityManager({ label: 'Fallback Target' });
    const options = createOptions();
    const customDisplayName = jest.fn(() => 'Fallback Target');
    const customFormatter = jest
      .fn()
      .mockImplementation((command, context, deps) => {
        const entity = entityManager.getEntityInstance(context.entityId);
        const resolvedName = deps.displayNameFn(entity, context.entityId, options.logger);
        return { ok: true, value: command.replace('{target}', resolvedName) };
      });

    validateDependencies.mockImplementationOnce(() => {
      throw new Error('mismatched dependency failure');
    });

    const result = formatter.format(
      action,
      targetContext,
      entityManager,
      { ...options },
      { displayNameFn: customDisplayName, formatterMap: { custom: customFormatter } }
    );

    expect(result).toEqual({ ok: true, value: 'use Fallback Target' });
    expect(validateDependencies).toHaveBeenCalledTimes(1);
    expect(customFormatter).toHaveBeenCalledWith(
      'use {target}',
      expect.objectContaining({ type: 'custom', entityId: 'npc-42' }),
      expect.objectContaining({
        actionId: 'core:resilient',
        displayNameFn: customDisplayName,
        logger: options.logger,
      })
    );
    expect(entityManager.getEntityInstance).toHaveBeenCalledWith('npc-42');
    expect(customDisplayName).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'npc-42', label: 'Fallback Target' }),
      'npc-42',
      options.logger
    );
    expect(dispatchValidationError).not.toHaveBeenCalled();
  });
});
