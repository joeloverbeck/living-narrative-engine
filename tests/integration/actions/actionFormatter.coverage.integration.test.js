import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';
import { targetFormatterMap } from '../../../src/actions/formatters/targetFormatters.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
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

const baseDefinition = {
  id: 'action:format-test',
  template: 'wave at {target}',
};

const createEntityManager = (entity) => ({
  getEntityInstance: jest.fn(() => entity),
});

describe('ActionCommandFormatter extended integration coverage', () => {
  let formatter;
  let logger;
  let dispatcher;
  let entityManager;

  beforeEach(() => {
    formatter = new ActionCommandFormatter();
    logger = createLogger();
    dispatcher = createDispatcher();
    entityManager = createEntityManager({
      id: 'entity-1',
      getComponentData: jest.fn(() => ({ text: 'Testy McTestface' })),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('throws when no logger is provided in options', () => {
    expect(() =>
      formatter.format(
        baseDefinition,
        { type: 'entity', entityId: 'entity-1' },
        entityManager,
        { safeEventDispatcher: dispatcher }
      )
    ).toThrow('formatActionCommand: logger is required.');
  });

  it('validates the safe event dispatcher exposes a dispatch method', () => {
    const badDispatcher = {};

    expect(() =>
      formatter.format(
        baseDefinition,
        { type: 'entity', entityId: 'entity-1' },
        entityManager,
        { logger, safeEventDispatcher: badDispatcher }
      )
    ).toThrow(InvalidArgumentError);
  });

  it('requires a safe event dispatcher even when options are omitted', () => {
    expect(() =>
      formatter.format(
        baseDefinition,
        { type: 'entity', entityId: 'entity-1' },
        entityManager
      )
    ).toThrow('formatActionCommand: logger is required.');
  });

  it('dispatches validation errors for missing action definition or template', () => {
    const result = formatter.format(
      { id: 'action:missing' },
      { type: 'entity', entityId: 'entity-1' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher }
    );

    expect(result).toEqual({
      ok: false,
      error:
        'formatActionCommand: Invalid or missing actionDefinition or template.',
    });
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message:
          'formatActionCommand: Invalid or missing actionDefinition or template.',
      })
    );
  });

  it('dispatches validation errors when the target context is missing', () => {
    const result = formatter.format(
      baseDefinition,
      null,
      entityManager,
      { logger, safeEventDispatcher: dispatcher }
    );

    expect(result.error).toBe(
      'formatActionCommand: Invalid or missing targetContext.'
    );
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(dispatcher.dispatch.mock.calls[0][0]).toBe(
      SYSTEM_ERROR_OCCURRED_ID
    );
  });

  it('dispatches validation errors for invalid entity manager dependencies', () => {
    const badManager = { getEntityInstance: 'nope' };

    const result = formatter.format(
      baseDefinition,
      { type: 'entity', entityId: 'entity-1' },
      badManager,
      { logger, safeEventDispatcher: dispatcher }
    );

    expect(result.error).toContain(
      'formatActionCommand: Invalid or missing entityManager.'
    );
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
  });

  it('dispatches validation errors when the display name utility is unavailable', () => {
    const result = formatter.format(
      baseDefinition,
      { type: 'entity', entityId: 'entity-1' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { displayNameFn: null }
    );

    expect(result.error).toBe(
      'formatActionCommand: getEntityDisplayName utility function is not available.'
    );
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
  });

  it('returns the template untouched when target formatter is missing', () => {
    const result = formatter.format(
      baseDefinition,
      { type: 'mystery' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher }
    );

    expect(result).toEqual({ ok: true, value: 'wave at {target}' });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown targetContext type: mystery')
    );
  });

  it('normalizes string formatter outputs and respects debug logging', () => {
    const customMap = {
      ...targetFormatterMap,
      entity: jest.fn(() => 'overridden value'),
    };

    const result = formatter.format(
      baseDefinition,
      { type: 'entity', entityId: 'entity-1' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher, debug: true },
      { formatterMap: customMap }
    );

    expect(result).toEqual({ ok: true, value: 'overridden value' });
    expect(customMap.entity).toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      ' <- Final formatted command: "overridden value"'
    );
  });

  it('accepts formatter outputs that are already normalized objects', () => {
    const customMap = {
      ...targetFormatterMap,
      entity: jest.fn(() => ({ ok: true, value: 'object result' })),
    };

    const result = formatter.format(
      baseDefinition,
      { type: 'entity', entityId: 'entity-1' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap: customMap }
    );

    expect(result).toEqual({ ok: true, value: 'object result' });
  });

  it('propagates formatter error responses without additional dispatching', () => {
    const customMap = {
      ...targetFormatterMap,
      entity: jest.fn(() => ({
        ok: false,
        error: 'formatter failure',
        details: { reason: 'bad placeholder' },
      })),
    };

    const result = formatter.format(
      baseDefinition,
      { type: 'entity', entityId: 'entity-1' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap: customMap }
    );

    expect(result).toEqual({
      ok: false,
      error: 'formatter failure',
      details: { reason: 'bad placeholder' },
    });
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('handles formatter exceptions by building an error result and dispatching safely', () => {
    const customMap = {
      ...targetFormatterMap,
      entity: jest.fn(() => {
        throw new Error('formatting blew up');
      }),
    };

    const result = formatter.format(
      baseDefinition,
      { type: 'entity', entityId: 'entity-1' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap: customMap }
    );

    expect(result).toEqual({
      ok: false,
      error: 'placeholder substitution failed',
      details: 'formatting blew up',
    });
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining(
          'Error during placeholder substitution'
        ),
        details: expect.objectContaining({ error: 'formatting blew up' }),
      })
    );
  });

  it('handles formatter exceptions with missing messages without attaching details', () => {
    const customMap = {
      ...targetFormatterMap,
      entity: jest.fn(() => {
        const err = new Error();
        err.message = '';
        throw err;
      }),
    };

    const result = formatter.format(
      baseDefinition,
      { type: 'entity', entityId: 'entity-1' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap: customMap }
    );

    expect(result).toEqual({
      ok: false,
      error: 'placeholder substitution failed',
    });
  });

  it('supports dependency overrides for entity display names and custom placeholders', () => {
    const customEntity = {
      id: 'entity-1',
      getComponentData: jest.fn(() => ({ text: 'Alt Name' })),
    };
    const manager = createEntityManager(customEntity);
    const customDisplayName = jest.fn(() => 'Custom Display');

    const result = formatter.format(
      { id: 'action:custom', template: 'bow to {recipient}' },
      { type: 'entity', entityId: 'entity-1', placeholder: 'recipient' },
      manager,
      { logger, safeEventDispatcher: dispatcher },
      { displayNameFn: customDisplayName }
    );

    expect(result).toEqual({ ok: true, value: 'bow to Custom Display' });
    expect(customDisplayName).toHaveBeenCalledWith(
      customEntity,
      'entity-1',
      logger
    );
  });

  it('reports lack of multi-target support through the base formatter API', () => {
    const result = formatter.formatMultiTarget(
      baseDefinition,
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
