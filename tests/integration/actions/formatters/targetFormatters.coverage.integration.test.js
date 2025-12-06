import { describe, it, expect } from '@jest/globals';

import ActionCommandFormatter from '../../../../src/actions/actionFormatter.js';
import { ActionTargetContext } from '../../../../src/models/actionTargetContext.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';

class RecordingLogger {
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

class RecordingDispatcher {
  constructor() {
    this.events = [];
  }

  dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
  }
}

describe('target formatters integration coverage', () => {
  const baseAction = {
    id: 'mission:greet',
    template: 'Salute {target}',
  };

  const createFormatterEnv = (entities = []) => {
    return {
      formatter: new ActionCommandFormatter(),
      entityManager: new SimpleEntityManager(entities),
      logger: new RecordingLogger(),
      dispatcher: new RecordingDispatcher(),
    };
  };

  it('returns a formatted error when the target context omits entityId', () => {
    const { formatter, entityManager, logger, dispatcher } =
      createFormatterEnv();

    const result = formatter.format(
      baseAction,
      /** @type {any} */ ({ type: 'entity' }),
      entityManager,
      { logger, safeEventDispatcher: dispatcher }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe(
      'formatActionCommand: Target context type is \'entity\' but entityId is missing for action mission:greet. Template: "Salute {target}"'
    );
    expect(logger.warnMessages).toEqual([
      'formatActionCommand: Target context type is \'entity\' but entityId is missing for action mission:greet. Template: "Salute {target}"',
    ]);
    expect(dispatcher.events).toHaveLength(0);
  });

  it('emits debug details when resolving an entity while debug mode is enabled', () => {
    const { formatter, entityManager, logger, dispatcher } = createFormatterEnv(
      [
        {
          id: 'npc-007',
          components: {
            'core:name': { text: 'Agent Specter' },
          },
        },
      ]
    );

    const result = formatter.format(
      baseAction,
      ActionTargetContext.forEntity('npc-007'),
      entityManager,
      { logger, safeEventDispatcher: dispatcher, debug: true }
    );

    expect(result).toEqual({ ok: true, value: 'Salute Agent Specter' });
    expect(logger.debugMessages).toContain(
      ' -> Found entity npc-007, display name: "Agent Specter"'
    );
    expect(logger.warnMessages).toHaveLength(0);
  });

  it('falls back to the entity identifier and warns when lookup fails', () => {
    const { formatter, entityManager, logger, dispatcher } =
      createFormatterEnv();

    const result = formatter.format(
      baseAction,
      ActionTargetContext.forEntity('missing-target'),
      entityManager,
      { logger, safeEventDispatcher: dispatcher, debug: true }
    );

    expect(result).toEqual({ ok: true, value: 'Salute missing-target' });
    expect(logger.warnMessages).toEqual([
      'formatActionCommand: Could not find entity instance for ID missing-target (action: mission:greet). Using ID as fallback name.',
    ]);
    expect(logger.debugMessages).toEqual([
      'Formatting command for action: mission:greet, template: "Salute {target}", targetType: entity',
      ' <- Final formatted command: "Salute missing-target"',
    ]);
  });

  it('replaces custom placeholders using the formatter map', () => {
    const { formatter, entityManager, logger, dispatcher } = createFormatterEnv(
      [
        {
          id: 'npc-042',
          components: {
            'core:name': { text: 'Agent Nebula' },
          },
        },
      ]
    );

    const result = formatter.format(
      { ...baseAction, template: 'Signal {companion}' },
      /** @type {any} */ ({
        type: 'entity',
        entityId: 'npc-042',
        placeholder: 'companion',
      }),
      entityManager,
      { logger, safeEventDispatcher: dispatcher }
    );

    expect(result).toEqual({ ok: true, value: 'Signal Agent Nebula' });
    expect(logger.warnMessages).toHaveLength(0);
    expect(logger.debugMessages).toHaveLength(0);
  });

  it('logs diagnostic details for none-target actions that still contain placeholders', () => {
    const { formatter, entityManager, logger, dispatcher } =
      createFormatterEnv();

    const result = formatter.format(
      { ...baseAction, id: 'mission:reflect', template: 'Reflect on {target}' },
      ActionTargetContext.noTarget(),
      entityManager,
      { logger, safeEventDispatcher: dispatcher, debug: true }
    );

    expect(result).toEqual({ ok: true, value: 'Reflect on {target}' });
    expect(logger.debugMessages).toContain(
      ' -> No target type, using template as is.'
    );
    expect(logger.warnMessages).toEqual([
      'formatActionCommand: Action mission:reflect has target_domain \'none\' but template "Reflect on {target}" contains placeholders.',
    ]);
  });

  it('returns the template without logging when no placeholder is present for none targets', () => {
    const { formatter, entityManager, logger, dispatcher } =
      createFormatterEnv();

    const result = formatter.format(
      { ...baseAction, id: 'mission:idle', template: 'Meditate quietly.' },
      ActionTargetContext.noTarget(),
      entityManager,
      { logger, safeEventDispatcher: dispatcher }
    );

    expect(result).toEqual({ ok: true, value: 'Meditate quietly.' });
    expect(logger.debugMessages).toHaveLength(0);
    expect(logger.warnMessages).toHaveLength(0);
  });
});
