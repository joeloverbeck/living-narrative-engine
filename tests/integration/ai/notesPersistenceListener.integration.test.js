import { describe, it, beforeEach, expect } from '@jest/globals';
import { NotesPersistenceListener } from '../../../src/ai/notesPersistenceListener.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';
import { NOTES_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import ComponentAccessService from '../../../src/entities/componentAccessService.js';
import {
  DEFAULT_SUBJECT_TYPE,
  SUBJECT_TYPES,
} from '../../../src/constants/subjectTypes.js';

class TestLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(message, context) {
    this.debugMessages.push({ message, context });
  }

  info(message, context) {
    this.infoMessages.push({ message, context });
  }

  warn(message, context) {
    this.warnMessages.push({ message, context });
  }

  error(message, context) {
    this.errorMessages.push({ message, context });
  }
}

class TestValidatedEventDispatcher {
  constructor() {
    this.events = [];
    this.listeners = new Map();
  }

  dispatch(eventName, payload) {
    this.events.push({ eventName, payload });
    const listeners = this.listeners.get(eventName);
    if (listeners) {
      for (const listener of listeners) {
        listener(payload);
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
      return;
    }
    listeners.delete(listener);
    if (listeners.size === 0) {
      this.listeners.delete(eventName);
    }
  }
}

/**
 *
 * @param existingNotes
 */
function createEntity(existingNotes = []) {
  return {
    id: 'actor-1',
    components: {
      [NOTES_COMPONENT_ID]: { notes: existingNotes },
    },
    addComponent(componentId, data) {
      this.components[componentId] = data;
    },
    getComponentData(componentId) {
      return this.components[componentId];
    },
  };
}

describe('NotesPersistenceListener integration', () => {
  let logger;
  let validatedDispatcher;
  let dispatcher;
  let componentAccessService;
  let fixedNow;
  let entityManager;
  let actorEntity;

  beforeEach(() => {
    logger = new TestLogger();
    validatedDispatcher = new TestValidatedEventDispatcher();
    dispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: validatedDispatcher,
      logger,
    });
    componentAccessService = new ComponentAccessService();
    fixedNow = new Date('2024-01-01T10:00:00.000Z');
    actorEntity = createEntity([
      {
        text: 'Remember me',
        subject: 'Alice',
        subjectType: SUBJECT_TYPES.ENTITY,
        context: 'initial memory',
        timestamp: '2023-12-24T20:15:00.000Z',
      },
    ]);
    entityManager = {
      getEntityInstance: () => actorEntity,
    };
  });

  /**
   *
   * @param overrides
   */
  function createListener(overrides = {}) {
    return new NotesPersistenceListener({
      logger,
      entityManager,
      dispatcher,
      now: () => fixedNow,
      componentAccessService,
      ...overrides,
    });
  }

  it('ignores events without payload or notes data', () => {
    const listener = createListener();

    listener.handleEvent(null);
    listener.handleEvent({});
    listener.handleEvent({
      payload: {
        actorId: actorEntity.id,
        extractedData: {},
      },
    });

    const notesComponent = actorEntity.components[NOTES_COMPONENT_ID];
    expect(notesComponent.notes).toHaveLength(1);
    expect(validatedDispatcher.events).toHaveLength(0);
    expect(logger.warnMessages).toHaveLength(0);
  });

  it('merges structured notes and dispatches errors for invalid entries', () => {
    const listener = createListener();

    const event = {
      payload: {
        actorId: actorEntity.id,
        extractedData: {
          notes: [
            {
              text: '  Remember me!  ',
              subject: 'Alice',
              subjectType: SUBJECT_TYPES.ENTITY,
            },
            {
              text: 'Sworn to protect the village',
              subject: 'Guard Captain',
              subjectType: SUBJECT_TYPES.STATE,
              context: 'oath',
            },
            {
              text: 'Secret weakness revealed',
              subject: 'Rival',
            },
            {
              text: 'Mystery contact located',
              subject: 'The Broker',
              subjectType: 'mystery-type',
            },
            {
              text: '   ',
              subject: 'Blank entry',
            },
          ],
        },
      },
    };

    listener.handleEvent(event);

    const updatedComponent = actorEntity.components[NOTES_COMPONENT_ID];
    expect(updatedComponent.notes).toHaveLength(4);

    const [, oathNote, defaultedNote, correctedNote] = updatedComponent.notes;

    expect(oathNote).toMatchObject({
      text: 'Sworn to protect the village',
      subject: 'Guard Captain',
      subjectType: SUBJECT_TYPES.STATE,
      context: 'oath',
      timestamp: fixedNow.toISOString(),
    });

    expect(defaultedNote).toMatchObject({
      text: 'Secret weakness revealed',
      subject: 'Rival',
      subjectType: DEFAULT_SUBJECT_TYPE,
      timestamp: fixedNow.toISOString(),
    });

    expect(correctedNote).toMatchObject({
      text: 'Mystery contact located',
      subject: 'The Broker',
      subjectType: DEFAULT_SUBJECT_TYPE,
      timestamp: fixedNow.toISOString(),
    });

    const errorEvents = validatedDispatcher.events.filter(
      (evt) => evt.eventName === SYSTEM_ERROR_OCCURRED_ID
    );

    expect(errorEvents).toHaveLength(2);
    const errorMessages = errorEvents.map((evt) => evt.payload.message);
    expect(errorMessages).toEqual(
      expect.arrayContaining([
        'NotesPersistenceHook: Invalid note skipped',
        'NotesPersistenceHook: Invalid subjectType, using default',
      ])
    );

    const debugMessages = logger.debugMessages.map((entry) => entry.message);
    expect(debugMessages.some((msg) => msg.includes('event received'))).toBe(
      true
    );
    expect(
      debugMessages.some((msg) =>
        msg.includes('Auto-assigned default subjectType "other"')
      )
    ).toBe(true);
    const addedNoteLogs = debugMessages.filter((msg) =>
      msg.startsWith('Added note:')
    );
    expect(addedNoteLogs).toHaveLength(3);
  });

  it('warns when the actor entity is missing', () => {
    entityManager = {
      getEntityInstance: () => null,
    };
    const listener = createListener({ entityManager });

    listener.handleEvent({
      payload: {
        actorId: 'ghost-actor',
        extractedData: {
          notes: [
            {
              text: 'Echoes in the hall',
              subject: 'Haunted Wing',
            },
          ],
        },
      },
    });

    expect(logger.warnMessages).toEqual([
      {
        message:
          'NotesPersistenceListener: entity not found for actor ghost-actor',
        context: undefined,
      },
    ]);
    expect(validatedDispatcher.events).toHaveLength(0);
  });
});
