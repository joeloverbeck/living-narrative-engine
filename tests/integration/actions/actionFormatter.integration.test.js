import { describe, it, expect, beforeEach } from '@jest/globals';

import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

class TestLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(message) {
    this.debugMessages.push(message);
  }

  info(message) {
    this.infoMessages.push(message);
  }

  warn(message) {
    this.warnMessages.push(message);
  }

  error(message) {
    this.errorMessages.push(message);
  }
}

class TestDispatcher {
  constructor() {
    this.events = [];
  }

  dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
  }
}

class SimpleEntityManager {
  constructor(entities = new Map()) {
    this.entities = new Map(entities);
  }

  getEntityInstance(id) {
    return this.entities.get(id);
  }

  getComponentData() {
    return null;
  }
}

describe('ActionCommandFormatter integration', () => {
  let formatter;
  let logger;
  let dispatcher;
  let entityManager;

  beforeEach(() => {
    formatter = new ActionCommandFormatter();
    logger = new TestLogger();
    dispatcher = new TestDispatcher();
    entityManager = new SimpleEntityManager();
  });

  it('formats commands for entity targets using provided display names and debug logging', () => {
    const friendlyEntity = { id: 'ally-01', displayName: 'Alicia' };
    entityManager.entities.set(friendlyEntity.id, friendlyEntity);

    const targetContext = ActionTargetContext.forEntity('ally-01');
    targetContext.placeholder = 'friend';

    const result = formatter.format(
      {
        id: 'social:greet_friend',
        template: 'Greet {friend} warmly.',
      },
      targetContext,
      entityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
        debug: true,
      },
      {
        displayNameFn: (entity) => entity.displayName,
      }
    );

    expect(result).toEqual({ ok: true, value: 'Greet Alicia warmly.' });
    expect(logger.debugMessages[0]).toContain('Formatting command for action');
    expect(logger.warnMessages).toHaveLength(0);
    expect(dispatcher.events).toHaveLength(0);
  });

  it('uses the default formatter dependencies when none are provided', () => {
    class NamedEntity {
      constructor(id, name) {
        this.id = id;
        this.nameComponent = { text: name };
      }

      getComponentData() {
        return this.nameComponent;
      }
    }

    const entity = new NamedEntity('ally-02', 'Serena');
    entityManager.entities.set(entity.id, entity);

    const result = formatter.format(
      {
        id: 'social:greet_target',
        template: 'Hello {target}',
      },
      ActionTargetContext.forEntity('ally-02'),
      entityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
      }
    );

    expect(result).toEqual({ ok: true, value: 'Hello Serena' });
  });

  it('falls back to the target id and warns when an entity cannot be found', () => {
    const targetContext = ActionTargetContext.forEntity('missing-entity');
    targetContext.placeholder = 'friend';

    const result = formatter.format(
      {
        id: 'social:greet_friend',
        template: 'Say hi to {friend}',
      },
      targetContext,
      entityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
      },
      {
        displayNameFn: (entity) => entity.displayName,
      }
    );

    expect(result).toEqual({ ok: true, value: 'Say hi to missing-entity' });
    expect(
      logger.warnMessages.some((msg) =>
        msg.includes('Could not find entity instance')
      )
    ).toBe(true);
  });

  it('warns about templates with no targets when using the none target domain', () => {
    const result = formatter.format(
      {
        id: 'system:wait',
        template: 'Wait patiently, {target}.',
      },
      ActionTargetContext.noTarget(),
      entityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
        debug: true,
      }
    );

    expect(result).toEqual({ ok: true, value: 'Wait patiently, {target}.' });
    expect(
      logger.warnMessages.some((msg) => msg.includes('target_domain'))
    ).toBe(true);
  });

  it('dispatches validation errors when required inputs are missing', () => {
    const result = formatter.format(
      {
        id: 'system:invalid',
        template: 'Do something',
      },
      null,
      entityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
      }
    );

    expect(result).toEqual({
      ok: false,
      error: 'formatActionCommand: Invalid or missing targetContext.',
    });
    expect(dispatcher.events).toHaveLength(1);
    expect(dispatcher.events[0].eventId).toBe(SYSTEM_ERROR_OCCURRED_ID);
    expect(dispatcher.events[0].payload.message).toBe(
      'formatActionCommand: Invalid or missing targetContext.'
    );
  });

  it('dispatches validation errors when the action definition is missing', () => {
    const result = formatter.format(
      null,
      ActionTargetContext.forEntity('any'),
      entityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
      }
    );

    expect(result).toEqual({
      ok: false,
      error:
        'formatActionCommand: Invalid or missing actionDefinition or template.',
    });
    expect(dispatcher.events).toHaveLength(1);
    expect(dispatcher.events[0].payload.message).toBe(
      'formatActionCommand: Invalid or missing actionDefinition or template.'
    );
  });

  it('reports invalid dependency wiring for entity managers and display name utilities', () => {
    const badEntityManager = {};
    const baseDefinition = {
      id: 'system:test',
      template: 'Ping {target}',
    };
    const context = ActionTargetContext.forEntity('any');

    const entityManagerResult = formatter.format(
      baseDefinition,
      context,
      badEntityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
      },
      {
        displayNameFn: (entity) => entity.displayName,
      }
    );

    expect(entityManagerResult).toEqual({
      ok: false,
      error: 'formatActionCommand: Invalid or missing entityManager.',
    });
    expect(dispatcher.events[0].payload.message).toBe(
      'formatActionCommand: Invalid or missing entityManager.'
    );

    dispatcher.events.length = 0;

    const displayNameResult = formatter.format(
      baseDefinition,
      context,
      entityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
      },
      {
        displayNameFn: null,
      }
    );

    expect(displayNameResult).toEqual({
      ok: false,
      error:
        'formatActionCommand: getEntityDisplayName utility function is not available.',
    });
    expect(dispatcher.events[0].payload.message).toBe(
      'formatActionCommand: getEntityDisplayName utility function is not available.'
    );
  });

  it('returns the template unchanged when encountering an unknown target type', () => {
    const customContext = { type: 'group' };

    const result = formatter.format(
      {
        id: 'team:cheer',
        template: 'Cheer loudly!',
      },
      customContext,
      entityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
      }
    );

    expect(result).toEqual({ ok: true, value: 'Cheer loudly!' });
    expect(
      logger.warnMessages.some((msg) =>
        msg.includes('Unknown targetContext type')
      )
    ).toBe(true);
  });

  it('propagates formatter specific failures without dispatching errors', () => {
    const failingFormatter = () => ({ ok: false, error: 'formatter failed' });
    const targetContext = ActionTargetContext.forEntity('any-target');

    const result = formatter.format(
      {
        id: 'system:test',
        template: 'Test {target}',
      },
      targetContext,
      entityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
      },
      {
        formatterMap: { entity: failingFormatter },
      }
    );

    expect(result).toEqual({ ok: false, error: 'formatter failed' });
    expect(dispatcher.events).toHaveLength(0);
  });

  it('normalizes raw string formatter output into a standard response object', () => {
    const stringFormatter = () => 'Direct substitution';
    const targetContext = ActionTargetContext.forEntity('entity-raw');

    const result = formatter.format(
      {
        id: 'system:test',
        template: 'Template',
      },
      targetContext,
      entityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
      },
      {
        formatterMap: { entity: stringFormatter },
      }
    );

    expect(result).toEqual({ ok: true, value: 'Direct substitution' });
  });

  it('dispatches pipeline errors when a formatter throws during substitution', () => {
    const explodingFormatter = () => {
      throw new Error('boom');
    };
    const targetContext = ActionTargetContext.forEntity('any-target');

    const result = formatter.format(
      {
        id: 'system:test',
        template: 'Test {target}',
      },
      targetContext,
      entityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
      },
      {
        formatterMap: { entity: explodingFormatter },
      }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe('placeholder substitution failed');
    expect(result.details).toBe('boom');
    expect(dispatcher.events).toHaveLength(1);
    const [event] = dispatcher.events;
    expect(event.eventId).toBe(SYSTEM_ERROR_OCCURRED_ID);
    expect(event.payload.message).toContain(
      'formatActionCommand: Error during placeholder substitution'
    );
    expect(event.payload.details.error).toBe('boom');
  });

  it('throws when called without a logger dependency', () => {
    const invokeWithoutLogger = () =>
      formatter.format(
        {
          id: 'system:test',
          template: 'Test {target}',
        },
        ActionTargetContext.forEntity('any'),
        entityManager
      );

    expect(invokeWithoutLogger).toThrow(
      'formatActionCommand: logger is required.'
    );
  });

  it('returns multi-target fallback information from the base formatter', () => {
    const multiResult = formatter.formatMultiTarget(
      { id: 'system:test', template: 'Test {target}' },
      [],
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      {}
    );

    expect(multiResult).toEqual({
      ok: false,
      error:
        'Multi-target formatting not supported by base ActionCommandFormatter. Use MultiTargetActionFormatter instead.',
    });
  });
});
