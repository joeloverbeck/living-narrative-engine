import { NotesPersistenceListener } from '../../../src/ai/notesPersistenceListener.js';
import { NOTES_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';
import { DEFAULT_SUBJECT_TYPE } from '../../../src/constants/subjectTypes.js';

class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(message, context) {
    this.debugLogs.push({ message, context });
  }

  info(message, context) {
    this.infoLogs.push({ message, context });
  }

  warn(message, context) {
    this.warnLogs.push({ message, context });
  }

  error(message, context) {
    this.errorLogs.push({ message, context });
  }
}

class RecordingDispatcher {
  constructor() {
    this.dispatchedEvents = [];
  }

  async dispatch(eventName, payload) {
    this.dispatchedEvents.push({ eventName, payload });
    return true;
  }
}

class InMemoryEntityManager {
  constructor() {
    this.entities = new Map();
  }

  add(entity) {
    this.entities.set(entity.id, entity);
  }

  getEntityInstance(id) {
    return this.entities.get(id) ?? null;
  }
}

const createEntity = (id, components = {}) => ({
  id,
  components: { ...components },
});

describe('NotesPersistenceListener integration', () => {
  let logger;
  let dispatcher;
  let entityManager;
  let now;
  let listener;

  beforeEach(() => {
    logger = new RecordingLogger();
    dispatcher = new RecordingDispatcher();
    entityManager = new InMemoryEntityManager();
    now = new Date('2025-04-01T12:00:00.000Z');

    listener = new NotesPersistenceListener({
      logger,
      entityManager,
      dispatcher,
      now: () => now,
    });
  });

  it('ignores events without payload data', () => {
    listener.handleEvent(undefined);
    listener.handleEvent({});

    expect(dispatcher.dispatchedEvents).toHaveLength(0);
    expect(logger.warnLogs).toHaveLength(0);
  });

  it('returns early when notes are missing or empty', () => {
    const actor = createEntity('actor-empty');
    entityManager.add(actor);

    listener.handleEvent({ payload: { actorId: actor.id, extractedData: {} } });
    listener.handleEvent({
      payload: { actorId: actor.id, extractedData: { notes: [] } },
    });

    expect(actor.components[NOTES_COMPONENT_ID]).toBeUndefined();
    expect(dispatcher.dispatchedEvents).toHaveLength(0);
  });

  it('logs a warning when the actor entity cannot be found', () => {
    listener.handleEvent({
      payload: {
        actorId: 'missing-actor',
        extractedData: { notes: [{ text: 'Hello', subject: 'Greeting' }] },
      },
    });

    expect(logger.warnLogs).toContainEqual({
      message: 'NotesPersistenceListener: entity not found for actor missing-actor',
      context: undefined,
    });
    expect(dispatcher.dispatchedEvents).toHaveLength(0);
  });

  it('persists structured notes into the actor component using real services', () => {
    const actor = createEntity('actor-with-notes');
    entityManager.add(actor);

    const note = { text: 'Locate the ancient key', subject: 'Quest' };

    listener.handleEvent({
      payload: {
        actorId: actor.id,
        extractedData: { notes: [note] },
      },
    });

    const notesComponent = actor.components[NOTES_COMPONENT_ID];
    expect(Array.isArray(notesComponent.notes)).toBe(true);
    expect(notesComponent.notes).toHaveLength(1);
    expect(notesComponent.notes[0]).toEqual({
      text: 'Locate the ancient key',
      subject: 'Quest',
      subjectType: DEFAULT_SUBJECT_TYPE,
      context: undefined,
      timestamp: now.toISOString(),
    });
    expect(dispatcher.dispatchedEvents).toHaveLength(0);
  });

  it('dispatches structured errors for invalid notes while keeping valid ones', () => {
    const actor = createEntity('actor-mixed', {
      [NOTES_COMPONENT_ID]: { notes: [] },
    });
    entityManager.add(actor);

    const validNote = {
      text: 'Review the alliance treaty',
      subject: 'Diplomacy',
    };
    const invalidSubjectTypeNote = {
      text: 'Inspect the ritual circle',
      subject: 'Arcana',
      subjectType: 'mystery',
    };
    const missingTextNote = { subject: 'Incomplete' };

    listener.handleEvent({
      payload: {
        actorId: actor.id,
        extractedData: {
          notes: [validNote, invalidSubjectTypeNote, missingTextNote],
        },
      },
    });

    const notesComponent = actor.components[NOTES_COMPONENT_ID];
    expect(notesComponent.notes).toHaveLength(2);

    const storedSubjects = notesComponent.notes.map((n) => n.subject);
    expect(storedSubjects).toEqual(['Diplomacy', 'Arcana']);

    const storedSubjectTypes = notesComponent.notes.map((n) => n.subjectType);
    expect(storedSubjectTypes).toEqual([
      DEFAULT_SUBJECT_TYPE,
      DEFAULT_SUBJECT_TYPE,
    ]);

    const dispatchedMessages = dispatcher.dispatchedEvents.map(
      (event) => event.payload.message
    );
    expect(dispatchedMessages).toEqual([
      'NotesPersistenceHook: Invalid subjectType, using default',
      'NotesPersistenceHook: Invalid note skipped',
    ]);

    dispatcher.dispatchedEvents.forEach((event) => {
      expect(event.eventName).toBe(SYSTEM_ERROR_OCCURRED_ID);
    });
  });
});
