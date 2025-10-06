import { describe, it, expect, beforeEach } from '@jest/globals';

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

describe('target formatters real-entity integration', () => {
  /** @type {ActionCommandFormatter} */
  let formatter;
  /** @type {SimpleEntityManager} */
  let entityManager;
  /** @type {RecordingLogger} */
  let logger;
  /** @type {RecordingDispatcher} */
  let dispatcher;

  beforeEach(() => {
    formatter = new ActionCommandFormatter();
    entityManager = new SimpleEntityManager([
      {
        id: 'npc-007',
        components: {
          'core:name': { text: 'Agent Specter' },
        },
      },
    ]);
    logger = new RecordingLogger();
    dispatcher = new RecordingDispatcher();
  });

  it('formats entity commands without debug logging when debug flag is disabled', () => {
    const result = formatter.format(
      {
        id: 'mission:greet',
        template: 'Salute {target}',
      },
      ActionTargetContext.forEntity('npc-007'),
      entityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
        debug: false,
      }
    );

    expect(result).toEqual({ ok: true, value: 'Salute Agent Specter' });
    expect(logger.debugMessages).toHaveLength(0);
    expect(logger.warnMessages).toHaveLength(0);
    expect(dispatcher.events).toHaveLength(0);
  });
});
