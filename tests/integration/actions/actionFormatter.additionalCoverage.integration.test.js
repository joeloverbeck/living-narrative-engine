import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { targetFormatterMap } from '../../../src/actions/formatters/targetFormatters.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

const createLogger = () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
});

const createDispatcher = () => ({
  dispatch: jest.fn(),
});

const createEntityManager = (entity) => ({
  getEntityInstance: jest.fn(() => entity),
});

describe('ActionCommandFormatter integration regression coverage', () => {
  let formatter;
  let logger;
  let dispatcher;
  let entityManager;

  const actionDefinition = {
    id: 'action:test',
    template: 'salute {target}',
  };

  beforeEach(() => {
    formatter = new ActionCommandFormatter();
    logger = createLogger();
    dispatcher = createDispatcher();
    entityManager = createEntityManager({
      id: 'entity-1',
      getComponentData: jest.fn(() => ({ text: 'Entity Prime' })),
    });
  });

  it('formats a command with debug logging using a custom display name resolver', () => {
    const displayNameFn = jest.fn(() => 'Captain Hero');

    const result = formatter.format(
      actionDefinition,
      { type: 'entity', entityId: 'entity-1' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher, debug: true },
      { displayNameFn }
    );

    expect(result).toEqual({ ok: true, value: 'salute Captain Hero' });
    expect(displayNameFn).toHaveBeenCalledWith(
      entityManager.getEntityInstance.mock.results[0].value,
      'entity-1',
      logger
    );
    expect(logger.debug).toHaveBeenCalledWith(
      ' <- Final formatted command: "salute Captain Hero"'
    );
  });

  it('falls back to the template and logs a warning when the target formatter is missing', () => {
    const result = formatter.format(
      actionDefinition,
      { type: 'unknown' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher }
    );

    expect(result).toEqual({ ok: true, value: 'salute {target}' });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown targetContext type: unknown')
    );
  });

  it('normalizes string responses from formatter overrides', () => {
    const customMap = {
      ...targetFormatterMap,
      entity: jest.fn(() => 'formatted value'),
    };

    const result = formatter.format(
      actionDefinition,
      { type: 'entity', entityId: 'entity-1' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap: customMap }
    );

    expect(result).toEqual({ ok: true, value: 'formatted value' });
    expect(customMap.entity).toHaveBeenCalled();
  });

  it('propagates formatter error objects without dispatching', () => {
    const customMap = {
      ...targetFormatterMap,
      entity: jest.fn(() => ({
        ok: false,
        error: 'formatter rejected input',
        details: { reason: 'bad placeholder' },
      })),
    };

    const result = formatter.format(
      actionDefinition,
      { type: 'entity', entityId: 'entity-1' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap: customMap }
    );

    expect(result).toEqual({
      ok: false,
      error: 'formatter rejected input',
      details: { reason: 'bad placeholder' },
    });
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('dispatches safely when the formatter throws with a message', () => {
    const customMap = {
      ...targetFormatterMap,
      entity: jest.fn(() => {
        throw new Error('exploded');
      }),
    };

    const result = formatter.format(
      actionDefinition,
      { type: 'entity', entityId: 'entity-1' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap: customMap }
    );

    expect(result).toEqual({
      ok: false,
      error: 'placeholder substitution failed',
      details: 'exploded',
    });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('placeholder substitution'),
        details: expect.objectContaining({ error: 'exploded' }),
      })
    );
  });

  it('omits details when the thrown formatter error lacks a message', () => {
    const customMap = {
      ...targetFormatterMap,
      entity: jest.fn(() => {
        const error = new Error('');
        error.message = '';
        throw error;
      }),
    };

    const result = formatter.format(
      actionDefinition,
      { type: 'entity', entityId: 'entity-1' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap: customMap }
    );

    expect(result).toEqual({ ok: false, error: 'placeholder substitution failed' });
  });

  it('returns validation errors when required inputs are missing', () => {
    const result = formatter.format(
      { id: 'missing-template' },
      { type: 'entity', entityId: 'entity-1' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher }
    );

    expect(result).toEqual({
      ok: false,
      error: 'formatActionCommand: Invalid or missing actionDefinition or template.',
    });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'formatActionCommand: Invalid or missing actionDefinition or template.',
      })
    );
  });

  it('fails validation when the target context is absent', () => {
    const result = formatter.format(
      actionDefinition,
      null,
      entityManager,
      { logger, safeEventDispatcher: dispatcher }
    );

    expect(result).toEqual({
      ok: false,
      error: 'formatActionCommand: Invalid or missing targetContext.',
    });
  });

  it('identifies invalid entity manager dependencies', () => {
    const badManager = { getEntityInstance: 'not-a-function' };

    const result = formatter.format(
      actionDefinition,
      { type: 'entity', entityId: 'entity-1' },
      badManager,
      { logger, safeEventDispatcher: dispatcher }
    );

    expect(result.error).toBe(
      'formatActionCommand: Invalid or missing entityManager.'
    );
  });

  it('surfaces missing display name utilities', () => {
    const result = formatter.format(
      actionDefinition,
      { type: 'entity', entityId: 'entity-1' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { displayNameFn: null }
    );

    expect(result.error).toBe(
      'formatActionCommand: getEntityDisplayName utility function is not available.'
    );
  });

  it('throws an InvalidArgumentError when the dispatcher lacks a dispatch method', () => {
    const badDispatcher = {};

    expect(() =>
      formatter.format(
        actionDefinition,
        { type: 'entity', entityId: 'entity-1' },
        entityManager,
        { logger, safeEventDispatcher: badDispatcher }
      )
    ).toThrow(InvalidArgumentError);
  });

  it('requires a logger within the options object', () => {
    expect(() =>
      formatter.format(
        actionDefinition,
        { type: 'entity', entityId: 'entity-1' },
        entityManager,
        { safeEventDispatcher: dispatcher }
      )
    ).toThrow('formatActionCommand: logger is required.');
  });

  it('states that multi-target formatting is unsupported by the base formatter', () => {
    const result = formatter.formatMultiTarget(
      actionDefinition,
      [{ type: 'entity', entityId: 'entity-1' }],
      entityManager,
      { logger, safeEventDispatcher: dispatcher }
    );

    expect(result).toEqual({
      ok: false,
      error:
        'Multi-target formatting not supported by base ActionCommandFormatter. Use MultiTargetActionFormatter instead.',
    });
  });
});
