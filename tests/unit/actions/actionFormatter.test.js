import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createMockLogger } from '../../common/mockFactories/index.js';

const defaultFormatterResult = 'template-default';

jest.mock('../../../src/utils/entityUtils.js', () => ({
  getEntityDisplayName: jest.fn(() => 'Mock Display Name'),
}));

const mockSafeDispatchError = jest.fn();
const mockDispatchValidationError = jest.fn();

jest.mock('../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: (...args) => mockSafeDispatchError(...args),
  dispatchValidationError: (...args) => mockDispatchValidationError(...args),
}));

jest.mock('../../../src/actions/formatters/targetFormatters.js', () => ({
  targetFormatterMap: {
    defaultType: jest.fn(() => defaultFormatterResult),
  },
}));

import ActionCommandFormatter, {
  formatActionCommand,
} from '../../../src/actions/actionFormatter.js';
import { getEntityDisplayName } from '../../../src/utils/entityUtils.js';
import { targetFormatterMap } from '../../../src/actions/formatters/targetFormatters.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import * as dependencyUtils from '../../../src/utils/dependencyUtils.js';

const createEntityManager = () => ({
  getEntityInstance: jest.fn(() => ({ id: 'entity-1', name: 'Entity' })),
});

const createDispatcher = () => ({
  dispatch: jest.fn(),
});

const createBaseParams = () => ({
  actionDefinition: {
    id: 'action-1',
    template: 'template',
    name: 'Test Action',
  },
  targetContext: { type: 'defaultType', id: 'target-1' },
  entityManager: createEntityManager(),
  options: {
    logger: createMockLogger(),
    safeEventDispatcher: createDispatcher(),
    debug: false,
  },
});

describe('formatActionCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSafeDispatchError.mockClear();
    mockDispatchValidationError.mockClear();
  });

  it('throws when logger is missing', () => {
    const { actionDefinition, targetContext, entityManager } =
      createBaseParams();
    expect(() =>
      formatActionCommand(actionDefinition, targetContext, entityManager, {
        safeEventDispatcher: createDispatcher(),
      })
    ).toThrow('formatActionCommand: logger is required.');
  });

  it('throws when options argument is omitted and logger defaults to missing', () => {
    const { actionDefinition, targetContext, entityManager } =
      createBaseParams();

    expect(() =>
      formatActionCommand(actionDefinition, targetContext, entityManager)
    ).toThrow('formatActionCommand: logger is required.');
  });

  it('dispatches validation error when action definition template is missing', () => {
    const { targetContext, entityManager, options } = createBaseParams();
    const invalidAction = { id: 'invalid' };
    const expectedResult = { ok: false, error: 'validation failed' };
    mockDispatchValidationError.mockReturnValue(expectedResult);

    const result = formatActionCommand(
      invalidAction,
      targetContext,
      entityManager,
      options
    );

    expect(mockDispatchValidationError).toHaveBeenCalledWith(
      options.safeEventDispatcher,
      'formatActionCommand: Invalid or missing actionDefinition or template.',
      undefined,
      options.logger
    );
    expect(result).toBe(expectedResult);
  });

  it('dispatches validation error when target context is missing', () => {
    const { actionDefinition, entityManager, options } = createBaseParams();
    const expectedResult = { ok: false, error: 'missing target' };
    mockDispatchValidationError.mockReturnValue(expectedResult);

    const result = formatActionCommand(
      actionDefinition,
      null,
      entityManager,
      options
    );

    expect(mockDispatchValidationError).toHaveBeenCalledWith(
      options.safeEventDispatcher,
      'formatActionCommand: Invalid or missing targetContext.',
      undefined,
      options.logger
    );
    expect(result).toBe(expectedResult);
  });

  it('dispatches validation error when entity manager is invalid', () => {
    const { actionDefinition, targetContext, options } = createBaseParams();
    const badEntityManager = {};
    const expectedResult = { ok: false, error: 'bad entity manager' };
    mockDispatchValidationError.mockReturnValue(expectedResult);

    const result = formatActionCommand(
      actionDefinition,
      targetContext,
      badEntityManager,
      options
    );

    expect(mockDispatchValidationError).toHaveBeenCalledWith(
      options.safeEventDispatcher,
      'formatActionCommand: Invalid or missing entityManager.',
      undefined,
      options.logger
    );
    expect(result).toBe(expectedResult);
  });

  it('dispatches validation error when displayNameFn dependency is invalid', () => {
    const { actionDefinition, targetContext, entityManager, options } =
      createBaseParams();
    const expectedResult = { ok: false, error: 'bad display function' };
    mockDispatchValidationError.mockReturnValue(expectedResult);

    const result = formatActionCommand(
      actionDefinition,
      targetContext,
      entityManager,
      options,
      { displayNameFn: 'not-a-function' }
    );

    expect(mockDispatchValidationError).toHaveBeenCalledWith(
      options.safeEventDispatcher,
      'formatActionCommand: getEntityDisplayName utility function is not available.',
      undefined,
      options.logger
    );
    expect(result).toBe(expectedResult);
  });

  it('throws when safeEventDispatcher dependency is invalid', () => {
    const { actionDefinition, targetContext, entityManager, options } =
      createBaseParams();
    options.safeEventDispatcher = {};

    expect(() =>
      formatActionCommand(
        actionDefinition,
        targetContext,
        entityManager,
        options
      )
    ).toThrow(InvalidArgumentError);
  });

  it('throws when safeEventDispatcher dependency is missing', () => {
    const { actionDefinition, targetContext, entityManager, options } =
      createBaseParams();
    options.safeEventDispatcher = undefined;

    expect(() =>
      formatActionCommand(
        actionDefinition,
        targetContext,
        entityManager,
        options
      )
    ).toThrow('Missing required dependency: safeEventDispatcher.');
  });

  it('continues when dependency validation throws an unrelated error', () => {
    const { actionDefinition, targetContext, entityManager, options } =
      createBaseParams();
    const spy = jest.spyOn(dependencyUtils, 'validateDependencies');
    spy.mockImplementation(() => {
      throw new Error('some other dependency failure');
    });

    try {
      const result = formatActionCommand(
        actionDefinition,
        targetContext,
        entityManager,
        options
      );

      expect(result).toEqual({ ok: true, value: defaultFormatterResult });
      expect(mockDispatchValidationError).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('returns template unmodified and logs warning when formatter is missing', () => {
    const { actionDefinition, targetContext, entityManager, options } =
      createBaseParams();
    const customLogger = createMockLogger();
    options.logger = customLogger;
    const customDispatcher = createDispatcher();
    options.safeEventDispatcher = customDispatcher;
    const result = formatActionCommand(
      actionDefinition,
      { ...targetContext, type: 'unknown' },
      entityManager,
      options,
      { formatterMap: {} }
    );

    expect(customLogger.warn).toHaveBeenCalledWith(
      'formatActionCommand: Unknown targetContext type: unknown for action action-1. Returning template unmodified.'
    );
    expect(result).toEqual({ ok: true, value: 'template' });
  });

  it('uses default formatter map when no overrides are provided', () => {
    const { actionDefinition, targetContext, entityManager, options } =
      createBaseParams();
    const result = formatActionCommand(
      actionDefinition,
      targetContext,
      entityManager,
      options
    );

    expect(targetFormatterMap.defaultType).toHaveBeenCalled();
    expect(result).toEqual({ ok: true, value: defaultFormatterResult });
  });

  it('returns formatter result when formatter provides error object', () => {
    const { actionDefinition, targetContext, entityManager, options } =
      createBaseParams();
    const formatterResult = { ok: false, error: 'formatter error' };

    const result = formatActionCommand(
      actionDefinition,
      targetContext,
      entityManager,
      options,
      { formatterMap: { defaultType: jest.fn(() => formatterResult) } }
    );

    expect(result).toBe(formatterResult);
  });

  it('normalizes string formatter results and returns formatted command', () => {
    const { actionDefinition, targetContext, entityManager, options } =
      createBaseParams();
    const formatter = jest.fn(() => 'formatted-command');

    const result = formatActionCommand(
      actionDefinition,
      targetContext,
      entityManager,
      options,
      { formatterMap: { defaultType: formatter } }
    );

    expect(formatter).toHaveBeenCalledWith(
      'template',
      targetContext,
      expect.objectContaining({
        actionId: actionDefinition.id,
        entityManager,
        displayNameFn: expect.any(Function),
        logger: options.logger,
        debug: options.debug,
      })
    );
    expect(result).toEqual({ ok: true, value: 'formatted-command' });
  });

  it('dispatches safe error and returns standardized result when formatter throws', () => {
    const { actionDefinition, targetContext, entityManager, options } =
      createBaseParams();
    const error = new Error('boom');
    const formatter = jest.fn(() => {
      throw error;
    });

    const result = formatActionCommand(
      actionDefinition,
      targetContext,
      entityManager,
      options,
      { formatterMap: { defaultType: formatter } }
    );

    expect(mockSafeDispatchError).toHaveBeenCalledWith(
      options.safeEventDispatcher,
      'formatActionCommand: Error during placeholder substitution for action action-1:',
      expect.objectContaining({ error: 'boom' }),
      options.logger
    );
    expect(result).toEqual({
      ok: false,
      error: 'placeholder substitution failed',
      details: 'boom',
    });
  });

  it('logs debug information when debug mode is enabled', () => {
    const params = createBaseParams();
    params.options.debug = true;
    const formatter = jest.fn(() => 'debug-result');

    const result = formatActionCommand(
      params.actionDefinition,
      params.targetContext,
      params.entityManager,
      params.options,
      { formatterMap: { defaultType: formatter } }
    );

    expect(params.options.logger.debug).toHaveBeenCalledWith(
      'Formatting command for action: action-1, template: "template", targetType: defaultType'
    );
    expect(params.options.logger.debug).toHaveBeenCalledWith(
      ' <- Final formatted command: "debug-result"'
    );
    expect(result).toEqual({ ok: true, value: 'debug-result' });
  });

  it('uses default display name function when none is provided', () => {
    const { actionDefinition, targetContext, entityManager, options } =
      createBaseParams();
    const formatter = jest.fn((command, context, formatterOptions) => {
      formatterOptions.displayNameFn(
        { id: 'entity-2' },
        'fallback',
        options.logger
      );
      return 'with-display';
    });

    formatActionCommand(
      actionDefinition,
      targetContext,
      entityManager,
      options,
      { formatterMap: { defaultType: formatter } }
    );

    expect(getEntityDisplayName).toHaveBeenCalledWith(
      { id: 'entity-2' },
      'fallback',
      options.logger
    );
  });
});

describe('ActionCommandFormatter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('formats commands using the shared implementation', () => {
    const instance = new ActionCommandFormatter();
    const params = createBaseParams();

    const expected = formatActionCommand(
      params.actionDefinition,
      params.targetContext,
      params.entityManager,
      params.options,
      {}
    );

    const result = instance.format(
      params.actionDefinition,
      params.targetContext,
      params.entityManager,
      params.options,
      {}
    );

    expect(result).toEqual(expected);
  });

  it('requires logger even when invoked without explicit options', () => {
    const instance = new ActionCommandFormatter();
    const { actionDefinition, targetContext, entityManager } =
      createBaseParams();

    expect(() =>
      instance.format(actionDefinition, targetContext, entityManager)
    ).toThrow('formatActionCommand: logger is required.');
  });

  it('returns error for unsupported multi-target formatting', () => {
    const instance = new ActionCommandFormatter();
    const result = instance.formatMultiTarget(
      {},
      {},
      createEntityManager(),
      {},
      {}
    );

    expect(result).toEqual({
      ok: false,
      error:
        'Multi-target formatting not supported by base ActionCommandFormatter. Use MultiTargetActionFormatter instead.',
    });
  });
});
