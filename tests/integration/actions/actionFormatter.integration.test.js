import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';
import { targetFormatterMap } from '../../../src/actions/formatters/targetFormatters.js';

describe('ActionCommandFormatter integration coverage', () => {
  const createLogger = () => ({
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  });

  const createDispatcher = () => ({
    dispatch: jest.fn(),
  });

  const baseActionDefinition = {
    id: 'action:test',
    template: 'perform {target} action',
  };

  const createEntity = (name = 'Resolved Name') => ({
    id: 'entity-1',
    getComponentData: jest.fn(() => ({ text: name })),
  });

  const createEntityManager = (entity = createEntity()) => ({
    getEntityInstance: jest.fn(() => entity),
  });

  it('formats entity targets using defaults and emits debug tracing', () => {
    const formatter = new ActionCommandFormatter();
    const logger = createLogger();
    const dispatcher = createDispatcher();
    const entity = createEntity('Sir Testalot');
    const entityManager = createEntityManager(entity);

    const result = formatter.format(
      baseActionDefinition,
      { type: 'entity', entityId: 'entity-1' },
      entityManager,
      { logger, debug: true, safeEventDispatcher: dispatcher }
    );

    expect(result).toEqual({ ok: true, value: 'perform Sir Testalot action' });
    expect(entityManager.getEntityInstance).toHaveBeenCalledWith('entity-1');
    expect(logger.debug).toHaveBeenCalledWith(
      'Formatting command for action: action:test, template: "perform {target} action", targetType: entity'
    );
    expect(logger.debug).toHaveBeenCalledWith(' -> Found entity entity-1, display name: "Sir Testalot"');
    expect(logger.debug).toHaveBeenCalledWith(' <- Final formatted command: "perform Sir Testalot action"');
  });

  it('normalizes string formatter results', () => {
    const formatter = new ActionCommandFormatter();
    const logger = createLogger();
    const dispatcher = createDispatcher();
    const entityManager = createEntityManager();
    const customMap = {
      ...targetFormatterMap,
      entity: () => 'custom formatted value',
    };

    const result = formatter.format(
      baseActionDefinition,
      { type: 'entity', entityId: 'entity-1' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap: customMap }
    );

    expect(result).toEqual({ ok: true, value: 'custom formatted value' });
  });

  it('dispatches validation errors when required dependencies are missing', () => {
    const formatter = new ActionCommandFormatter();
    const logger = createLogger();
    const dispatcher = createDispatcher();

    const result = formatter.format(
      baseActionDefinition,
      { type: 'entity', entityId: 'entity-1' },
      null,
      { logger, safeEventDispatcher: dispatcher }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain('formatActionCommand: Invalid or missing entityManager');
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        message: expect.stringContaining('formatActionCommand: Invalid or missing entityManager'),
      })
    );
  });

  it('returns the template for unknown target types and logs a warning', () => {
    const formatter = new ActionCommandFormatter();
    const logger = createLogger();
    const dispatcher = createDispatcher();
    const entityManager = createEntityManager();

    const result = formatter.format(
      baseActionDefinition,
      { type: 'unknown' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher }
    );

    expect(result).toEqual({ ok: true, value: 'perform {target} action' });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown targetContext type: unknown')
    );
  });

  it('propagates formatter error results without modification', () => {
    const formatter = new ActionCommandFormatter();
    const logger = createLogger();
    const dispatcher = createDispatcher();
    const entityManager = createEntityManager();
    const customMap = {
      ...targetFormatterMap,
      entity: () => ({ ok: false, error: 'custom failure', details: { reason: 'bad' } }),
    };

    const result = formatter.format(
      baseActionDefinition,
      { type: 'entity', entityId: 'entity-1' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap: customMap }
    );

    expect(result).toEqual({ ok: false, error: 'custom failure', details: { reason: 'bad' } });
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('handles formatter exceptions by dispatching a safe error', () => {
    const formatter = new ActionCommandFormatter();
    const logger = createLogger();
    const dispatcher = createDispatcher();
    const entityManager = createEntityManager();
    const customMap = {
      ...targetFormatterMap,
      entity: () => {
        throw new Error('boom');
      },
    };

    const result = formatter.format(
      baseActionDefinition,
      { type: 'entity', entityId: 'entity-1' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap: customMap }
    );

    expect(result).toEqual({ ok: false, error: 'placeholder substitution failed', details: 'boom' });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        message: expect.stringContaining('Error during placeholder substitution'),
      })
    );
  });

  it('indicates lack of multi-target support in the base formatter', () => {
    const formatter = new ActionCommandFormatter();

    expect(
      formatter.formatMultiTarget(
        baseActionDefinition,
        [{ type: 'entity', entityId: 'entity-1' }],
        createEntityManager(),
        { logger: createLogger(), safeEventDispatcher: createDispatcher() }
      )
    ).toEqual({
      ok: false,
      error:
        'Multi-target formatting not supported by base ActionCommandFormatter. Use MultiTargetActionFormatter instead.',
    });
  });
});
