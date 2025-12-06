import { describe, it, expect, beforeEach } from '@jest/globals';
import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { targetFormatterMap } from '../../../src/actions/formatters/targetFormatters.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

class TestLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(message, ...args) {
    this.debugLogs.push({ message, args });
  }

  info(message, ...args) {
    this.infoLogs.push({ message, args });
  }

  warn(message, ...args) {
    this.warnLogs.push({ message, args });
  }

  error(message, ...args) {
    this.errorLogs.push({ message, args });
  }
}

class TestEntity {
  constructor(id, components = {}, type = 'npc') {
    this.id = id;
    this.type = type;
    this.components = components;
  }

  getComponentData(componentId) {
    return this.components[componentId] ?? null;
  }
}

class TestEntityManager {
  constructor() {
    this.entities = new Map();
  }

  addEntity(entity) {
    this.entities.set(entity.id, entity);
  }

  getEntityInstance(entityId) {
    return this.entities.get(entityId) ?? null;
  }
}

class TestEventDispatcher {
  constructor() {
    this.events = [];
  }

  dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
  }

  get lastEvent() {
    return this.events[this.events.length - 1] ?? null;
  }
}

describe('ActionCommandFormatter integration with real formatter map', () => {
  let formatter;
  let logger;
  let dispatcher;
  let entityManager;
  let baseAction;

  beforeEach(() => {
    formatter = new ActionCommandFormatter();
    logger = new TestLogger();
    dispatcher = new TestEventDispatcher();
    entityManager = new TestEntityManager();
    entityManager.addEntity(
      new TestEntity('npc-1', { 'core:name': { text: 'Friendly NPC' } })
    );
    entityManager.addEntity(
      new TestEntity('npc-2', { 'core:name': { value: 'Fallback Name' } })
    );

    baseAction = {
      id: 'core:wave',
      name: 'Wave',
      description: 'Offer a friendly greeting.',
      template: 'wave at {target}',
    };
  });

  it('formats entity targets with debug output using the default formatter map', () => {
    const context = ActionTargetContext.forEntity('npc-1');
    context.placeholder = 'target';

    const result = formatter.format(baseAction, context, entityManager, {
      logger,
      safeEventDispatcher: dispatcher,
      debug: true,
    });

    expect(result).toEqual({ ok: true, value: 'wave at Friendly NPC' });
    expect(logger.debugLogs[0].message).toContain(
      'Formatting command for action'
    );
    expect(
      logger.debugLogs.some((log) =>
        log.message.includes('Final formatted command')
      )
    ).toBe(true);
    expect(dispatcher.events).toHaveLength(0);
  });

  it('respects custom placeholders when formatting entity targets', () => {
    const context = ActionTargetContext.forEntity('npc-1');
    context.placeholder = 'friend';
    const action = { ...baseAction, template: 'wave at {friend}' };

    const result = formatter.format(action, context, entityManager, {
      logger,
      safeEventDispatcher: dispatcher,
    });

    expect(result).toEqual({ ok: true, value: 'wave at Friendly NPC' });
  });

  it('falls back to the entity id when no name component is present', () => {
    entityManager.addEntity(new TestEntity('npc-3'));
    const context = ActionTargetContext.forEntity('npc-3');

    const result = formatter.format(baseAction, context, entityManager, {
      logger,
      safeEventDispatcher: dispatcher,
      debug: true,
    });

    expect(result).toEqual({ ok: true, value: 'wave at npc-3' });
    expect(
      logger.warnLogs.some((entry) =>
        entry.message.includes("Entity 'npc-3' has no usable name")
      )
    ).toBe(true);
  });

  it('warns when the entity cannot be resolved and uses the raw template', () => {
    const context = ActionTargetContext.forEntity('missing-entity');

    const result = formatter.format(baseAction, context, entityManager, {
      logger,
      safeEventDispatcher: dispatcher,
    });

    expect(result).toEqual({ ok: true, value: 'wave at missing-entity' });
    expect(
      logger.warnLogs.some((entry) =>
        entry.message.includes('Could not find entity instance')
      )
    ).toBe(true);
  });

  it('returns the template unchanged for unknown target types and logs a warning', () => {
    const unknownContext = { type: 'mystery' };

    const result = formatter.format(baseAction, unknownContext, entityManager, {
      logger,
      safeEventDispatcher: dispatcher,
    });

    expect(result).toEqual({ ok: true, value: 'wave at {target}' });
    expect(
      logger.warnLogs.some((entry) =>
        entry.message.includes('Unknown targetContext type: mystery')
      )
    ).toBe(true);
  });

  it('dispatches a validation error when the action template is missing', () => {
    const brokenAction = { id: 'broken', name: 'Broken Action' };
    const result = formatter.format(
      brokenAction,
      ActionTargetContext.noTarget(),
      entityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
      }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe(
      'formatActionCommand: Invalid or missing actionDefinition or template.'
    );
    expect(dispatcher.events).toHaveLength(1);
    expect(dispatcher.lastEvent.eventId).toBe(SYSTEM_ERROR_OCCURRED_ID);
    expect(dispatcher.lastEvent.payload.message).toBe(
      'formatActionCommand: Invalid or missing actionDefinition or template.'
    );
  });

  it('dispatches a validation error when the target context is missing', () => {
    const result = formatter.format(baseAction, null, entityManager, {
      logger,
      safeEventDispatcher: dispatcher,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe(
      'formatActionCommand: Invalid or missing targetContext.'
    );
    expect(dispatcher.events).toHaveLength(1);
    expect(dispatcher.lastEvent.payload.message).toBe(
      'formatActionCommand: Invalid or missing targetContext.'
    );
  });

  it('dispatches a validation error when the entity manager is invalid', () => {
    const badEntityManager = { getEntityInstance: 'not-a-function' };

    const result = formatter.format(
      baseAction,
      ActionTargetContext.noTarget(),
      badEntityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
      }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe(
      'formatActionCommand: Invalid or missing entityManager.'
    );
    expect(dispatcher.lastEvent.payload.message).toBe(
      'formatActionCommand: Invalid or missing entityManager.'
    );
  });

  it('dispatches a validation error when the display name helper is missing', () => {
    const result = formatter.format(
      baseAction,
      ActionTargetContext.forEntity('npc-1'),
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { displayNameFn: null }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe(
      'formatActionCommand: getEntityDisplayName utility function is not available.'
    );
    expect(dispatcher.lastEvent.payload.message).toBe(
      'formatActionCommand: getEntityDisplayName utility function is not available.'
    );
  });

  it('throws when no logger is provided in options', () => {
    expect(() =>
      formatter.format(
        baseAction,
        ActionTargetContext.forEntity('npc-1'),
        entityManager,
        { safeEventDispatcher: dispatcher }
      )
    ).toThrow('formatActionCommand: logger is required.');
  });

  it('throws when the dispatcher does not provide a dispatch method', () => {
    expect(() =>
      formatter.format(
        baseAction,
        ActionTargetContext.forEntity('npc-1'),
        entityManager,
        { logger, safeEventDispatcher: {} }
      )
    ).toThrow(InvalidArgumentError);
  });

  it('returns formatter errors directly when the formatter map reports a failure', () => {
    const failingMap = {
      ...targetFormatterMap,
      entity: () => ({ ok: false, error: 'custom failure' }),
    };

    const result = formatter.format(
      baseAction,
      ActionTargetContext.forEntity('npc-1'),
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap: failingMap }
    );

    expect(result).toEqual({ ok: false, error: 'custom failure' });
    expect(dispatcher.events).toHaveLength(0);
  });

  it('dispatches a system error when a formatter throws and returns a normalized error', () => {
    const explodingMap = {
      ...targetFormatterMap,
      entity: () => {
        throw new Error('formatter exploded');
      },
    };

    const result = formatter.format(
      baseAction,
      ActionTargetContext.forEntity('npc-1'),
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap: explodingMap }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe('placeholder substitution failed');
    expect(dispatcher.lastEvent.eventId).toBe(SYSTEM_ERROR_OCCURRED_ID);
    expect(dispatcher.lastEvent.payload.message).toBe(
      'formatActionCommand: Error during placeholder substitution for action core:wave:'
    );
    expect(dispatcher.lastEvent.payload.details.error).toBe(
      'formatter exploded'
    );
  });

  it('accepts formatter outputs that are plain strings and normalizes them', () => {
    const stringMap = {
      ...targetFormatterMap,
      entity: () => 'formatted via string',
    };

    const result = formatter.format(
      baseAction,
      ActionTargetContext.forEntity('npc-2'),
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap: stringMap }
    );

    expect(result).toEqual({ ok: true, value: 'formatted via string' });
  });

  it('logs warnings for templates with placeholders when target type is none', () => {
    const action = { ...baseAction, template: 'wait here {target}' };

    const result = formatter.format(
      action,
      ActionTargetContext.noTarget(),
      entityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
        debug: true,
      }
    );

    expect(result).toEqual({ ok: true, value: 'wait here {target}' });
    expect(
      logger.warnLogs.some(
        (entry) =>
          entry.message.includes('target_domain') &&
          entry.message.includes('wait here {target}')
      )
    ).toBe(true);
  });
});
