import { describe, it, beforeEach, expect } from '@jest/globals';
import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import { NAME_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(...args) {
    this.debugLogs.push(args);
  }

  info(...args) {
    this.infoLogs.push(args);
  }

  warn(...args) {
    this.warnLogs.push(args);
  }

  error(...args) {
    this.errorLogs.push(args);
  }
}

class RecordingSafeDispatcher {
  constructor() {
    this.events = [];
  }

  dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
  }
}

describe('ActionCommandFormatter integration', () => {
  /** @type {SimpleEntityManager} */
  let entityManager;
  /** @type {RecordingLogger} */
  let logger;
  /** @type {RecordingSafeDispatcher} */
  let dispatcher;
  /** @type {ActionCommandFormatter} */
  let formatter;

  const buildActor = (id, name) => ({
    id,
    components: {
      [NAME_COMPONENT_ID]: name ? { text: name } : undefined,
    },
  });

  beforeEach(() => {
    const entities = [
      buildActor('hero', 'Astra the Bold'),
      buildActor('wanderer', null),
    ];

    entityManager = new SimpleEntityManager(entities);
    logger = new RecordingLogger();
    dispatcher = new RecordingSafeDispatcher();
    formatter = new ActionCommandFormatter();
  });

  const runFormat = (definition, context, options = {}, deps = {}) =>
    formatter.format(
      definition,
      context,
      entityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
        ...options,
      },
      deps
    );

  it('formats entity targets using real entity data and debugging', () => {
    const actionDef = {
      id: 'core:greet',
      template: 'greet {target}',
    };
    const targetContext = ActionTargetContext.forEntity('hero');

    const result = runFormat(actionDef, targetContext, { debug: true });

    expect(result).toEqual({ ok: true, value: 'greet Astra the Bold' });
    expect(
      logger.debugLogs.some((args) =>
        args[0].includes('Final formatted command')
      )
    ).toBe(true);
    expect(dispatcher.events).toHaveLength(0);
  });

  it('falls back to entity id when name component is missing', () => {
    const actionDef = {
      id: 'core:salute',
      template: 'salute {target}',
    };
    const targetContext = ActionTargetContext.forEntity('wanderer');

    const result = runFormat(actionDef, targetContext);

    expect(result).toEqual({ ok: true, value: 'salute wanderer' });
    expect(
      logger.warnLogs.some((args) => args[0].includes('no usable name'))
    ).toBe(true);
  });

  it('supports custom placeholders on the target context', () => {
    const actionDef = {
      id: 'core:embrace',
      template: 'embrace {companion}',
    };
    const targetContext = ActionTargetContext.forEntity('hero');
    targetContext.placeholder = 'companion';

    const result = runFormat(actionDef, targetContext);

    expect(result).toEqual({ ok: true, value: 'embrace Astra the Bold' });
  });

  it('warns and keeps template when formatter map lacks target type', () => {
    const actionDef = {
      id: 'core:signal',
      template: 'signal {target}',
    };
    const targetContext = ActionTargetContext.forEntity('hero');

    const result = runFormat(
      actionDef,
      targetContext,
      {},
      { formatterMap: {} }
    );

    expect(result).toEqual({ ok: true, value: 'signal {target}' });
    expect(
      logger.warnLogs.some((args) =>
        args[0].includes('Unknown targetContext type')
      )
    ).toBe(true);
  });

  it('warns and uses target id when entity is missing from the manager', () => {
    entityManager.setEntities([buildActor('hero', 'Astra the Bold')]);

    const actionDef = {
      id: 'core:ping',
      template: 'ping {target}',
    };
    const targetContext = ActionTargetContext.forEntity('ghost');

    const result = runFormat(actionDef, targetContext);

    expect(result).toEqual({ ok: true, value: 'ping ghost' });
    expect(
      logger.warnLogs.some((args) =>
        args[0].includes('Could not find entity instance for ID ghost')
      )
    ).toBe(true);
  });

  it('returns formatter error when entity id is missing for entity targets', () => {
    const actionDef = {
      id: 'core:inspect',
      template: 'inspect {target}',
    };
    const malformedContext = { type: 'entity' };

    const result = runFormat(actionDef, malformedContext);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('entityId is missing');
  });

  it('normalizes string formatter results from custom formatter maps', () => {
    const actionDef = {
      id: 'core:signal',
      template: 'signal {target}',
    };
    const targetContext = ActionTargetContext.forEntity('hero');

    const result = runFormat(
      actionDef,
      targetContext,
      {},
      {
        formatterMap: {
          entity: () => 'custom broadcast',
        },
      }
    );

    expect(result).toEqual({ ok: true, value: 'custom broadcast' });
  });

  it('dispatches validation errors when inputs are invalid', () => {
    const actionDef = {
      id: 'core:invalid',
    };
    const targetContext = ActionTargetContext.noTarget();

    const result = runFormat(actionDef, targetContext);

    expect(result.ok).toBe(false);
    expect(dispatcher.events).toHaveLength(1);
    expect(dispatcher.events[0].payload.message).toContain(
      'Invalid or missing actionDefinition'
    );
  });

  it('warns when templates with none targets contain placeholders', () => {
    const actionDef = {
      id: 'core:wait',
      template: 'wait {target}',
    };
    const targetContext = ActionTargetContext.noTarget();

    const result = runFormat(actionDef, targetContext);

    expect(result).toEqual({ ok: true, value: 'wait {target}' });
    expect(
      logger.warnLogs.some((args) => args[0].includes('target_domain'))
    ).toBe(true);
  });

  it('dispatches system errors when target formatter throws', () => {
    const actionDef = {
      id: 'core:signal',
      template: 'signal {target}',
    };
    const targetContext = ActionTargetContext.forEntity('hero');
    const failure = new Error('formatter boom');

    const result = runFormat(
      actionDef,
      targetContext,
      {},
      {
        formatterMap: {
          entity: () => {
            throw failure;
          },
        },
      }
    );

    expect(result).toEqual({
      ok: false,
      error: 'placeholder substitution failed',
      details: failure.message,
    });
    expect(dispatcher.events).toHaveLength(1);
    expect(dispatcher.events[0].eventId).toBe(SYSTEM_ERROR_OCCURRED_ID);
    expect(dispatcher.events[0].payload.details).toMatchObject({
      error: failure.message,
    });
  });

  it('throws InvalidArgumentError when safeEventDispatcher lacks dispatch', () => {
    const actionDef = {
      id: 'core:greet',
      template: 'greet {target}',
    };
    const targetContext = ActionTargetContext.forEntity('hero');

    expect(() =>
      formatter.format(actionDef, targetContext, entityManager, {
        logger,
        safeEventDispatcher: {},
      })
    ).toThrow(InvalidArgumentError);
  });
});
