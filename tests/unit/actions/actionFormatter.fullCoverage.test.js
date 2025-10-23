import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ActionCommandFormatter, {
  formatActionCommand,
} from '../../../src/actions/actionFormatter.js';
import { createMockLogger } from '../../common/mockFactories/index.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import * as dependencyUtils from '../../../src/utils/dependencyUtils.js';
import * as entityUtils from '../../../src/utils/entityUtils.js';

jest.mock('../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
  dispatchValidationError: jest.fn(),
}));

import {
  safeDispatchError,
  dispatchValidationError,
} from '../../../src/utils/safeDispatchErrorUtils.js';

const createEntityManager = () => ({
  getEntityInstance: jest.fn(() => ({ id: 'entity-1', name: 'Entity' })),
});

const createDispatcher = () => ({
  dispatch: jest.fn(),
});

describe('actionFormatter comprehensive coverage', () => {
  let baseAction;
  let baseContext;
  let entityManager;
  let logger;
  let dispatcher;

  beforeEach(() => {
    baseAction = { id: 'core:test', template: 'perform {target}' };
    baseContext = { type: 'custom', entityId: 'entity-1' };
    entityManager = createEntityManager();
    logger = createMockLogger();
    dispatcher = createDispatcher();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('formats command and logs debug output when formatter returns a string', () => {
    const formatterMap = {
      custom: jest.fn(() => 'perform hero'),
    };

    const result = formatActionCommand(
      baseAction,
      baseContext,
      entityManager,
      { logger, safeEventDispatcher: dispatcher, debug: true },
      { formatterMap, displayNameFn: jest.fn(() => 'Hero') }
    );

    expect(result).toEqual({ ok: true, value: 'perform hero' });
    expect(formatterMap.custom).toHaveBeenCalledWith(
      'perform {target}',
      baseContext,
      expect.objectContaining({
        actionId: baseAction.id,
        entityManager,
        logger,
        debug: true,
      })
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Formatting command for action')
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Final formatted command')
    );
  });

  it('supports formatter results already wrapped in success objects', () => {
    const formatterMap = {
      custom: jest.fn(() => ({ ok: true, value: 'wrapped result' })),
    };

    const result = formatActionCommand(
      baseAction,
      baseContext,
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap, displayNameFn: jest.fn() }
    );

    expect(result).toEqual({ ok: true, value: 'wrapped result' });
  });

  it('propagates formatter error objects without modification', () => {
    const formatterError = { ok: false, error: 'formatter failed' };
    const formatterMap = {
      custom: jest.fn(() => formatterError),
    };

    const result = formatActionCommand(
      baseAction,
      baseContext,
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap, displayNameFn: jest.fn() }
    );

    expect(result).toBe(formatterError);
  });

  it('dispatches validation error when action definition template is missing', () => {
    const validationResult = { ok: false, error: 'missing template' };
    dispatchValidationError.mockReturnValue(validationResult);

    const result = formatActionCommand(
      { id: 'core:invalid' },
      baseContext,
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap: { custom: jest.fn() }, displayNameFn: jest.fn() }
    );

    expect(dispatchValidationError).toHaveBeenCalledWith(
      dispatcher,
      'formatActionCommand: Invalid or missing actionDefinition or template.',
      undefined,
      logger
    );
    expect(result).toBe(validationResult);
  });

  it('dispatches validation error when target context is missing', () => {
    const validationResult = { ok: false, error: 'missing target' };
    dispatchValidationError.mockReturnValue(validationResult);

    const result = formatActionCommand(
      baseAction,
      null,
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap: { custom: jest.fn() }, displayNameFn: jest.fn() }
    );

    expect(dispatchValidationError).toHaveBeenCalledWith(
      dispatcher,
      'formatActionCommand: Invalid or missing targetContext.',
      undefined,
      logger
    );
    expect(result).toBe(validationResult);
  });

  it('warns and returns the template when the target type is unknown', () => {
    const result = formatActionCommand(
      baseAction,
      { type: 'unknown' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap: {}, displayNameFn: jest.fn() }
    );

    expect(result).toEqual({ ok: true, value: baseAction.template });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown targetContext type: unknown')
    );
  });

  it('dispatches error details when the formatter throws', () => {
    const formatterMap = {
      custom: jest.fn(() => {
        throw new Error('boom');
      }),
    };

    const result = formatActionCommand(
      baseAction,
      baseContext,
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap, displayNameFn: jest.fn() }
    );

    expect(result).toEqual({
      ok: false,
      error: 'placeholder substitution failed',
      details: 'boom',
    });
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      expect.stringContaining('placeholder substitution for action core:test'),
      expect.objectContaining({ error: 'boom' }),
      logger
    );
  });

  it('dispatches validation errors when display name dependency fails validation', () => {
    const validationResult = { ok: false, error: 'validation failure' };
    dispatchValidationError.mockReturnValue(validationResult);
    jest
      .spyOn(dependencyUtils, 'validateDependencies')
      .mockImplementation(() => {
        throw new Error('displayNameFn missing');
      });

    const result = formatActionCommand(
      baseAction,
      baseContext,
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap: { custom: jest.fn() }, displayNameFn: jest.fn() }
    );

    expect(dispatchValidationError).toHaveBeenCalledWith(
      dispatcher,
      'formatActionCommand: getEntityDisplayName utility function is not available.',
      undefined,
      logger
    );
    expect(result).toBe(validationResult);
  });

  it('dispatches validation errors when entity manager is invalid', () => {
    const validationResult = { ok: false, error: 'entity manager invalid' };
    dispatchValidationError.mockReturnValue(validationResult);
    jest
      .spyOn(dependencyUtils, 'validateDependencies')
      .mockImplementation(() => {
        throw new Error('entityManager missing');
      });

    const result = formatActionCommand(
      baseAction,
      baseContext,
      { getEntityInstance: undefined },
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap: { custom: jest.fn() }, displayNameFn: jest.fn() }
    );

    expect(dispatchValidationError).toHaveBeenCalledWith(
      dispatcher,
      'formatActionCommand: Invalid or missing entityManager.',
      undefined,
      logger
    );
    expect(result).toBe(validationResult);
  });

  it('continues formatting when validation error message is unrecognized', () => {
    jest
      .spyOn(dependencyUtils, 'validateDependencies')
      .mockImplementation(() => {
        throw new Error('unexpected failure');
      });
    const formatterMap = {
      custom: jest.fn(() => 'fallback result'),
    };

    const result = formatActionCommand(
      baseAction,
      baseContext,
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap, displayNameFn: jest.fn() }
    );

    expect(formatterMap.custom).toHaveBeenCalled();
    expect(result).toEqual({ ok: true, value: 'fallback result' });
  });

  it('throws when logger is missing in options or omitted entirely', () => {
    expect(() =>
      formatActionCommand(baseAction, baseContext, entityManager)
    ).toThrow('formatActionCommand: logger is required.');

    expect(() =>
      formatActionCommand(baseAction, baseContext, entityManager, {
        safeEventDispatcher: dispatcher,
      })
    ).toThrow('formatActionCommand: logger is required.');
  });

  it('uses default formatter map and display name utility when overrides are absent', () => {
    const entityContext = { type: 'entity', entityId: 'entity-1' };
    jest
      .spyOn(entityUtils, 'getEntityDisplayName')
      .mockReturnValue('Rendered Name');

    const result = formatActionCommand(
      { id: 'core:inspect', template: 'inspect {target}' },
      entityContext,
      entityManager,
      { logger, safeEventDispatcher: dispatcher, debug: true }
    );

    expect(entityUtils.getEntityDisplayName).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'entity-1' }),
      'entity-1',
      logger
    );
    expect(result).toEqual({ ok: true, value: 'inspect Rendered Name' });
  });

  it('throws when safe event dispatcher is missing required methods', () => {
    expect(() =>
      formatActionCommand(
        baseAction,
        baseContext,
        entityManager,
        { logger, safeEventDispatcher: {} },
        { formatterMap: { custom: jest.fn() }, displayNameFn: jest.fn() }
      )
    ).toThrow(InvalidArgumentError);
  });

  it('ActionCommandFormatter.format delegates to formatActionCommand', () => {
    const formatter = new ActionCommandFormatter();
    const formatterMap = {
      custom: jest.fn(() => 'delegated result'),
    };

    const result = formatter.format(
      baseAction,
      baseContext,
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap, displayNameFn: jest.fn() }
    );

    expect(result).toEqual({ ok: true, value: 'delegated result' });
  });

  it('ActionCommandFormatter.formatMultiTarget reports unsupported usage', () => {
    const formatter = new ActionCommandFormatter();

    const result = formatter.formatMultiTarget(
      baseAction,
      [baseContext],
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      {}
    );

    expect(result).toEqual({
      ok: false,
      error:
        'Multi-target formatting not supported by base ActionCommandFormatter. Use MultiTargetActionFormatter instead.',
    });
  });

  it('ActionCommandFormatter.format applies default arguments when omitted', () => {
    const formatter = new ActionCommandFormatter();

    expect(() =>
      formatter.format(baseAction, baseContext, entityManager)
    ).toThrow('formatActionCommand: logger is required.');
  });
});
