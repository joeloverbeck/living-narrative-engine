/**
 * @file Integration tests for ActionCommandFormatter with real collaborating modules.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ActionCommandFormatter, {
  formatActionCommand,
} from '../../../src/actions/actionFormatter.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { targetFormatterMap } from '../../../src/actions/formatters/targetFormatters.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';
import { EntityManagerTestBed } from '../../common/entities/entityManagerTestBed.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';

/**
 * Simple logger implementation that captures structured log entries for assertions.
 */
class TestLogger {
  constructor() {
    this.logs = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
  }

  debug(message, details) {
    this.logs.debug.push({ message, details });
  }

  info(message, details) {
    this.logs.info.push({ message, details });
  }

  warn(message, details) {
    this.logs.warn.push({ message, details });
  }

  error(message, details) {
    this.logs.error.push({ message, details });
  }
}

/**
 * Minimal validated event dispatcher that records dispatched events.
 */
class SimpleValidatedDispatcher {
  constructor() {
    this.events = [];
    this.listeners = new Map();
  }

  async dispatch(eventName, payload) {
    this.events.push({ eventName, payload });
    const listeners = this.listeners.get(eventName);
    if (listeners) {
      for (const listener of listeners) {
        await listener({ type: eventName, payload });
      }
    }
    return true;
  }

  subscribe(eventName, listener) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(listener);
    return () => this.unsubscribe(eventName, listener);
  }

  unsubscribe(eventName, listener) {
    const listeners = this.listeners.get(eventName);
    if (!listeners) {
      return false;
    }
    const removed = listeners.delete(listener);
    if (listeners.size === 0) {
      this.listeners.delete(eventName);
    }
    return removed;
  }

  setBatchMode() {
    return true;
  }
}

/**
 * Creates reusable entity definitions for the integration scenarios.
 */
function createEntityDefinitions() {
  const actorDefinition = new EntityDefinition('integration:actor', {
    description: 'Integration actor',
    components: {
      'core:name': { text: 'Integration Actor' },
    },
  });

  const artifactDefinition = new EntityDefinition('integration:artifact', {
    description: 'Integration artifact',
    components: {
      'core:name': { text: 'Ancient Statue' },
    },
  });

  return { actorDefinition, artifactDefinition };
}

describe('ActionCommandFormatter - Real Dependencies Integration', () => {
  let formatter;
  let testBed;
  let entityManager;
  let logger;
  let validatedDispatcher;
  let safeEventDispatcher;

  beforeEach(async () => {
    formatter = new ActionCommandFormatter();
    testBed = new EntityManagerTestBed();
    entityManager = testBed.entityManager;

    const { actorDefinition, artifactDefinition } = createEntityDefinitions();
    testBed.setupDefinitions(actorDefinition, artifactDefinition);

    await entityManager.createEntityInstance('integration:actor', {
      instanceId: 'actor-1',
    });
    await entityManager.createEntityInstance('integration:artifact', {
      instanceId: 'target-1',
    });

    logger = new TestLogger();
    validatedDispatcher = new SimpleValidatedDispatcher();
    safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: validatedDispatcher,
      logger,
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  it('formats entity targets using default collaborators', () => {
    const actionDefinition = {
      id: 'explore:inspect',
      name: 'Inspect',
      template: 'inspect {target}',
      description: 'Look closely at something interesting.',
    };

    const context = ActionTargetContext.forEntity('target-1');

    const result = formatter.format(actionDefinition, context, entityManager, {
      logger,
      safeEventDispatcher,
      debug: true,
    });

    expect(result).toEqual({ ok: true, value: 'inspect Ancient Statue' });
    expect(validatedDispatcher.events).toHaveLength(0);
    expect(
      logger.logs.debug.some((entry) =>
        entry.message?.includes(
          'Final formatted command: "inspect Ancient Statue"'
        )
      )
    ).toBe(true);
  });

  it('supports custom placeholders and string formatter results', () => {
    const actionDefinition = {
      id: 'explore:focus',
      template: 'focus on {focus}',
    };

    const context = {
      type: 'entity',
      entityId: 'target-1',
      placeholder: 'focus',
    };

    const result = formatActionCommand(
      actionDefinition,
      context,
      entityManager,
      {
        logger,
        safeEventDispatcher,
      },
      {
        formatterMap: {
          ...targetFormatterMap,
          entity(command, targetCtx, deps) {
            const base = targetFormatterMap.entity(command, targetCtx, deps);
            if (!base.ok) {
              return base;
            }
            return base.value.toUpperCase();
          },
        },
      }
    );

    expect(result).toEqual({ ok: true, value: 'FOCUS ON ANCIENT STATUE' });
    expect(validatedDispatcher.events).toHaveLength(0);
  });

  it('warns and preserves templates for unknown target types', () => {
    const actionDefinition = {
      id: 'ritual:chant',
      template: 'chant for {target}',
    };

    const result = formatActionCommand(
      actionDefinition,
      { type: 'mystery', entityId: 'target-1' },
      entityManager,
      {
        logger,
        safeEventDispatcher,
      }
    );

    expect(result).toEqual({ ok: true, value: 'chant for {target}' });
    expect(
      logger.logs.warn.some((entry) =>
        entry.message?.includes('Unknown targetContext type: mystery')
      )
    ).toBe(true);
  });

  it('formats none targets and emits warnings when placeholders remain', () => {
    const actionDefinition = {
      id: 'core:wait',
      template: 'wait for {target}',
    };

    const result = formatActionCommand(
      actionDefinition,
      ActionTargetContext.noTarget(),
      entityManager,
      {
        logger,
        safeEventDispatcher,
        debug: true,
      }
    );

    expect(result).toEqual({ ok: true, value: 'wait for {target}' });
    expect(
      logger.logs.warn.some((entry) =>
        entry.message?.includes(
          'target_domain \'none\' but template "wait for {target}" contains placeholders.'
        )
      )
    ).toBe(true);
  });

  it('returns formatter errors without dispatching system events', () => {
    const actionDefinition = {
      id: 'explore:inspect',
      template: 'inspect {target}',
    };

    const failingMap = {
      ...targetFormatterMap,
      entity() {
        return { ok: false, error: 'formatter rejected the context' };
      },
    };

    const result = formatActionCommand(
      actionDefinition,
      ActionTargetContext.forEntity('target-1'),
      entityManager,
      {
        logger,
        safeEventDispatcher,
      },
      {
        formatterMap: failingMap,
      }
    );

    expect(result).toEqual({
      ok: false,
      error: 'formatter rejected the context',
    });
    expect(validatedDispatcher.events).toHaveLength(0);
  });

  it('dispatches system errors when formatter execution throws', () => {
    const actionDefinition = {
      id: 'explore:inspect',
      template: 'inspect {target}',
    };

    const explodingMap = {
      ...targetFormatterMap,
      entity() {
        throw new Error('substitution blew up');
      },
    };

    const result = formatActionCommand(
      actionDefinition,
      ActionTargetContext.forEntity('target-1'),
      entityManager,
      {
        logger,
        safeEventDispatcher,
      },
      {
        formatterMap: explodingMap,
      }
    );

    expect(result).toEqual({
      ok: false,
      error: 'placeholder substitution failed',
      details: 'substitution blew up',
    });
    expect(validatedDispatcher.events).toHaveLength(1);
    expect(validatedDispatcher.events[0]).toMatchObject({
      eventName: SYSTEM_ERROR_OCCURRED_ID,
    });
  });

  it('throws when logger is omitted from options even if dispatcher is provided', () => {
    const actionDefinition = {
      id: 'core:wait',
      template: 'wait',
    };

    expect(() =>
      formatActionCommand(
        actionDefinition,
        ActionTargetContext.noTarget(),
        entityManager,
        {
          safeEventDispatcher,
        }
      )
    ).toThrow('formatActionCommand: logger is required.');
  });

  it('requires logger when using ActionCommandFormatter default options', () => {
    const actionDefinition = {
      id: 'core:wave',
      template: 'wave',
    };

    expect(() =>
      formatter.format(
        actionDefinition,
        ActionTargetContext.noTarget(),
        entityManager
      )
    ).toThrow('formatActionCommand: logger is required.');
  });

  it('applies default options when omitted and still enforces logger validation', () => {
    const actionDefinition = {
      id: 'core:rest',
      template: 'rest',
    };

    expect(() =>
      formatActionCommand(
        actionDefinition,
        ActionTargetContext.noTarget(),
        entityManager
      )
    ).toThrow('formatActionCommand: logger is required.');
  });

  describe('input validation scenarios', () => {
    it('dispatches validation error when action definition is invalid', () => {
      const result = formatActionCommand(
        { id: 'broken:action' },
        ActionTargetContext.noTarget(),
        entityManager,
        {
          logger,
          safeEventDispatcher,
        }
      );

      expect(result).toEqual({
        ok: false,
        error:
          'formatActionCommand: Invalid or missing actionDefinition or template.',
      });
      expect(validatedDispatcher.events).toHaveLength(1);
      expect(validatedDispatcher.events[0].payload.message).toContain(
        'Invalid or missing actionDefinition or template'
      );
    });

    it('dispatches validation error when target context is missing', () => {
      const result = formatActionCommand(
        { id: 'core:wait', template: 'wait' },
        null,
        entityManager,
        {
          logger,
          safeEventDispatcher,
        }
      );

      expect(result).toEqual({
        ok: false,
        error: 'formatActionCommand: Invalid or missing targetContext.',
      });
      expect(validatedDispatcher.events).toHaveLength(1);
    });

    it('dispatches validation error when entity manager lacks required methods', () => {
      const result = formatActionCommand(
        { id: 'core:wait', template: 'wait' },
        ActionTargetContext.noTarget(),
        {},
        {
          logger,
          safeEventDispatcher,
        }
      );

      expect(result).toEqual({
        ok: false,
        error: 'formatActionCommand: Invalid or missing entityManager.',
      });
      expect(validatedDispatcher.events).toHaveLength(1);
    });

    it('dispatches validation error when display name helper is unavailable', () => {
      const result = formatActionCommand(
        { id: 'explore:inspect', template: 'inspect {target}' },
        ActionTargetContext.forEntity('target-1'),
        entityManager,
        {
          logger,
          safeEventDispatcher,
        },
        {
          displayNameFn: null,
        }
      );

      expect(result).toEqual({
        ok: false,
        error:
          'formatActionCommand: getEntityDisplayName utility function is not available.',
      });
      expect(validatedDispatcher.events).toHaveLength(1);
    });
  });

  it('throws when safe event dispatcher lacks a dispatch function', () => {
    const actionDefinition = {
      id: 'core:wait',
      template: 'wait',
    };

    expect(() =>
      formatActionCommand(
        actionDefinition,
        ActionTargetContext.noTarget(),
        entityManager,
        {
          logger,
          safeEventDispatcher: {},
        }
      )
    ).toThrow(
      "Invalid or missing method 'dispatch' on dependency 'safeEventDispatcher'."
    );
  });

  it('reports unsupported multi-target formatting via the default implementation', () => {
    const result = formatter.formatMultiTarget(
      { id: 'core:wave', template: 'wave' },
      [],
      entityManager,
      {
        logger,
        safeEventDispatcher,
      }
    );

    expect(result).toEqual({
      ok: false,
      error:
        'Multi-target formatting not supported by base ActionCommandFormatter. Use MultiTargetActionFormatter instead.',
    });
  });
});
