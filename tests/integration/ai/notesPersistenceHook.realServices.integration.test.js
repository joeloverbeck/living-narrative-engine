import { persistNotes } from '../../../src/ai/notesPersistenceHook.js';
import NotesService from '../../../src/ai/notesService.js';
import ComponentAccessService from '../../../src/entities/componentAccessService.js';
import { NOTES_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { DEFAULT_SUBJECT_TYPE, SUBJECT_TYPES } from '../../../src/constants/subjectTypes.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

describe('notesPersistenceHook with real services', () => {
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

  class CapturingDispatcher {
    constructor() {
      this.events = [];
    }

    dispatch(eventId, payload) {
      this.events.push({ eventId, payload });
    }
  }

  const createActor = (id = 'actor-integration', components = {}) => ({
    id,
    components,
  });

  const createServices = () => ({
    logger: new TestLogger(),
    dispatcher: new CapturingDispatcher(),
    notesService: new NotesService(),
    componentAccess: new ComponentAccessService(),
  });

  it('skips processing when the action does not expose a notes field', () => {
    const { logger, dispatcher, notesService, componentAccess } = createServices();
    const actor = createActor();

    persistNotes(
      { name: 'move-north' },
      actor,
      logger,
      dispatcher,
      notesService,
      new Date('2025-01-01T00:00:00.000Z'),
      componentAccess
    );

    expect(actor.components).toEqual({});
    expect(logger.debugMessages).toHaveLength(0);
    expect(dispatcher.events).toHaveLength(0);
  });

  it('dispatches a structured error when the notes field is not an array', () => {
    const { logger, dispatcher, notesService, componentAccess } = createServices();
    const actor = createActor('actor-non-array');

    persistNotes(
      { notes: 'unexpected-value' },
      actor,
      logger,
      dispatcher,
      notesService,
      new Date('2025-01-02T12:00:00.000Z'),
      componentAccess
    );

    expect(actor.components).toEqual({});
    expect(dispatcher.events).toHaveLength(1);
    expect(dispatcher.events[0]).toEqual({
      eventId: SYSTEM_ERROR_OCCURRED_ID,
      payload: {
        message: "NotesPersistenceHook: 'notes' field is not an array; skipping merge",
        details: { actorId: actor.id },
      },
    });
    expect(logger.debugMessages).toHaveLength(0);
  });

  it('reports invalid entries without mutating components when every note is rejected', () => {
    const { logger, dispatcher, notesService, componentAccess } = createServices();
    const actor = createActor('actor-all-invalid');

    persistNotes(
      {
        notes: [
          { text: '   ', subject: 'Blank Text' },
          { text: 'Valid body', subject: '' },
          'unsupported-entry',
        ],
      },
      actor,
      logger,
      dispatcher,
      notesService,
      new Date('2025-01-03T08:30:00.000Z'),
      componentAccess
    );

    expect(actor.components).toEqual({});
    expect(dispatcher.events).toHaveLength(3);
    expect(dispatcher.events.map((event) => event.payload.message)).toEqual([
      'NotesPersistenceHook: Invalid note skipped',
      'NotesPersistenceHook: Invalid note skipped',
      'NotesPersistenceHook: Invalid note skipped',
    ]);
    expect(dispatcher.events[0].payload.details).toMatchObject({
      reason: 'Missing or blank text field',
    });
    expect(dispatcher.events[1].payload.details).toMatchObject({
      reason: 'Missing or blank subject field',
    });
    expect(dispatcher.events[2].payload.details).toEqual({ note: 'unsupported-entry' });
    expect(logger.debugMessages).toHaveLength(0);
  });

  it('persists valid notes, defaults subject types, and dispatches errors for invalid metadata', () => {
    const { logger, dispatcher, notesService, componentAccess } = createServices();
    const actor = createActor('actor-valid', {});
    const timestamp = new Date('2025-01-04T09:15:00.000Z');

    persistNotes(
      {
        notes: [
          { text: 'Remember the watchword', subject: 'Security' },
          { text: 'Scout the ridge', subject: 'Recon', subjectType: 'INVALID_TYPE' },
          { text: 'Maintain supply lines', subject: 'Logistics', subjectType: SUBJECT_TYPES.ENTITY },
          { text: '  ', subject: 'Whitespace' },
          'text-only-note',
        ],
      },
      actor,
      logger,
      dispatcher,
      notesService,
      timestamp,
      componentAccess
    );

    const storedComponent = actor.components[NOTES_COMPONENT_ID];
    expect(Array.isArray(storedComponent.notes)).toBe(true);
    expect(storedComponent.notes).toHaveLength(3);

    const [defaultedNote, correctedTypeNote, explicitTypeNote] = storedComponent.notes;
    expect(defaultedNote).toMatchObject({
      subject: 'Security',
      subjectType: DEFAULT_SUBJECT_TYPE,
      text: 'Remember the watchword',
      timestamp: timestamp.toISOString(),
    });
    expect(correctedTypeNote).toMatchObject({
      subject: 'Recon',
      subjectType: DEFAULT_SUBJECT_TYPE,
      text: 'Scout the ridge',
    });
    expect(explicitTypeNote).toMatchObject({
      subject: 'Logistics',
      subjectType: SUBJECT_TYPES.ENTITY,
      text: 'Maintain supply lines',
    });

    // Verify debug logs capture the default assignment and note additions
    const debugMessages = logger.debugMessages.map(({ message }) => message);
    expect(debugMessages).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Auto-assigned default subjectType'),
        `Added note: "Remember the watchword" at ${timestamp.toISOString()}`,
        `Added note: "Scout the ridge" at ${timestamp.toISOString()}`,
        `Added note: "Maintain supply lines" at ${timestamp.toISOString()}`,
      ])
    );

    // Dispatcher received errors for invalid metadata and invalid note structures
    const eventMessages = dispatcher.events.map((event) => event.payload.message);
    expect(eventMessages).toEqual(
      expect.arrayContaining([
        'NotesPersistenceHook: Invalid subjectType, using default',
        'NotesPersistenceHook: Invalid note skipped',
      ])
    );
    const invalidTypeEvent = dispatcher.events.find(
      (event) => event.payload.message === 'NotesPersistenceHook: Invalid subjectType, using default'
    );
    expect(invalidTypeEvent.payload.details).toMatchObject({
      invalidSubjectType: 'INVALID_TYPE',
      subject: 'Recon',
      defaultAssigned: DEFAULT_SUBJECT_TYPE,
    });
  });

  it('avoids applying component updates when the notes service reports no modifications', () => {
    const { logger, dispatcher, notesService, componentAccess } = createServices();
    const existingNote = {
      text: 'Archive the treaty',
      subject: 'Diplomacy',
      subjectType: DEFAULT_SUBJECT_TYPE,
      timestamp: '2024-12-31T23:59:59.000Z',
    };
    const actor = createActor('actor-no-modifications', {
      [NOTES_COMPONENT_ID]: { notes: [existingNote] },
    });
    const timestamp = new Date('2025-01-05T11:45:00.000Z');

    persistNotes(
      {
        notes: [
          { text: 'Archive the treaty', subject: 'Diplomacy' },
        ],
      },
      actor,
      logger,
      dispatcher,
      notesService,
      timestamp,
      componentAccess
    );

    expect(actor.components[NOTES_COMPONENT_ID].notes).toHaveLength(1);
    expect(logger.debugMessages.some(({ message }) => message.includes('Added note'))).toBe(false);
    expect(dispatcher.events).toHaveLength(0);
  });
});
