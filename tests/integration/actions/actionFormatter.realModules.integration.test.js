import { describe, it, expect, beforeEach } from '@jest/globals';
import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { NAME_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

class RecordingLogger {
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

class RecordingDispatcher {
  constructor() {
    this.events = [];
  }

  dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
  }
}

class TestEntity {
  constructor(id, components = {}) {
    this.id = id;
    this.components = components;
  }

  getComponentData(componentId) {
    return this.components[componentId];
  }
}

class TestEntityManager {
  constructor(entities = {}) {
    this.entities = new Map(Object.entries(entities));
  }

  getEntityInstance(id) {
    return this.entities.get(id) ?? null;
  }

  getComponentData(id, componentId) {
    return this.entities.get(id)?.getComponentData(componentId);
  }
}

describe('ActionCommandFormatter integration', () => {
  let formatter;
  let logger;
  let dispatcher;
  let entityManager;

  beforeEach(() => {
    formatter = new ActionCommandFormatter();
    logger = new RecordingLogger();
    dispatcher = new RecordingDispatcher();
    entityManager = new TestEntityManager({
      hero: new TestEntity('hero', {
        [NAME_COMPONENT_ID]: { text: 'Valiant Hero' },
      }),
      relic: new TestEntity('relic', {
        [NAME_COMPONENT_ID]: { text: 'Ancient Relic' },
      }),
    });
  });

  it('formats an entity target using real formatter utilities and logs debug output', () => {
    const definition = {
      id: 'quest:inspect_relic',
      template: 'Inspect {target} carefully',
    };
    const targetContext = ActionTargetContext.forEntity('relic');

    const result = formatter.format(definition, targetContext, entityManager, {
      logger,
      safeEventDispatcher: dispatcher,
      debug: true,
    });

    expect(result).toEqual({
      ok: true,
      value: 'Inspect Ancient Relic carefully',
    });
    expect(dispatcher.events).toHaveLength(0);
    expect(
      logger.debugLogs.some(({ message }) =>
        message.includes(
          'Final formatted command: "Inspect Ancient Relic carefully"'
        )
      )
    ).toBe(true);
  });

  it('normalizes raw string results from custom formatter implementations', () => {
    const definition = { id: 'quest:shout', template: 'Shout at {target}' };
    const targetContext = ActionTargetContext.forEntity('hero');

    const result = formatter.format(
      definition,
      targetContext,
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      {
        formatterMap: {
          entity: (command) => command.toUpperCase(),
          none: (command) => command,
        },
      }
    );

    expect(result).toEqual({ ok: true, value: 'SHOUT AT {TARGET}' });
    expect(dispatcher.events).toHaveLength(0);
  });

  it('dispatches validation errors when the action definition is invalid', () => {
    const definition = { id: 'quest:broken_action' }; // missing template
    const targetContext = ActionTargetContext.noTarget();

    const result = formatter.format(definition, targetContext, entityManager, {
      logger,
      safeEventDispatcher: dispatcher,
    });

    expect(result.ok).toBe(false);
    expect(dispatcher.events).toHaveLength(1);
    expect(dispatcher.events[0]).toEqual({
      eventId: SYSTEM_ERROR_OCCURRED_ID,
      payload: {
        message:
          'formatActionCommand: Invalid or missing actionDefinition or template.',
        details: {},
      },
    });
  });

  it('reports placeholder substitution failures through the dispatcher', () => {
    const definition = {
      id: 'quest:volatile_format',
      template: 'Focus on {target}',
    };
    const targetContext = ActionTargetContext.forEntity('hero');
    const explodingFormatter = () => {
      throw new Error('formatter boom');
    };

    const result = formatter.format(
      definition,
      targetContext,
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      {
        formatterMap: {
          entity: explodingFormatter,
          none: (command) => command,
        },
      }
    );

    expect(result).toEqual({
      ok: false,
      error: 'placeholder substitution failed',
      details: 'formatter boom',
    });
    expect(dispatcher.events).toHaveLength(1);
    expect(dispatcher.events[0].payload.message).toContain(
      'formatActionCommand: Error during placeholder substitution'
    );
  });

  it('warns when formatting a none target that still contains placeholders', () => {
    const definition = { id: 'quest:wait', template: 'Wait for {target}' };
    const targetContext = ActionTargetContext.noTarget();

    const result = formatter.format(definition, targetContext, entityManager, {
      logger,
      safeEventDispatcher: dispatcher,
    });

    expect(result).toEqual({ ok: true, value: 'Wait for {target}' });
    expect(
      logger.warnLogs.some(({ message }) =>
        message.includes(
          'target_domain \'none\' but template "Wait for {target}"'
        )
      )
    ).toBe(true);
  });

  it('returns informative errors when entity target context lacks an entity id', () => {
    const definition = {
      id: 'quest:incomplete',
      template: 'Investigate {target}',
    };
    const malformedContext = { type: 'entity', placeholder: 'target' };

    const result = formatter.format(
      definition,
      malformedContext,
      entityManager,
      { logger, safeEventDispatcher: dispatcher }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain('entityId is missing');
  });

  it('falls back to returning the template when the target type is unknown', () => {
    const definition = {
      id: 'quest:custom_target',
      template: 'Handle {target}',
    };
    const unknownContext = { type: 'custom', placeholder: 'target' };

    const result = formatter.format(definition, unknownContext, entityManager, {
      logger,
      safeEventDispatcher: dispatcher,
    });

    expect(result).toEqual({ ok: true, value: 'Handle {target}' });
    expect(
      logger.warnLogs.some(({ message }) =>
        message.includes('Unknown targetContext type: custom')
      )
    ).toBe(true);
  });
});
