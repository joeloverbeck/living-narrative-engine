import { describe, expect, test } from '@jest/globals';
import NotesService, { normalizeNoteText } from '../../../src/ai/notesService.js';
import { NotesPersistenceListener } from '../../../src/ai/notesPersistenceListener.js';
import { persistNotes } from '../../../src/ai/notesPersistenceHook.js';
import ComponentAccessService from '../../../src/entities/componentAccessService.js';
import { NOTES_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { DEFAULT_SUBJECT_TYPE, SUBJECT_TYPES } from '../../../src/constants/subjectTypes.js';

class TestLogger {
  constructor() {
    this.debugMessages = [];
    this.warnMessages = [];
  }

  debug(message, context) {
    this.debugMessages.push({ message, context });
  }

  warn(message, context) {
    this.warnMessages.push({ message, context });
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

describe('NotesService integration - multi-stage deduplication', () => {
  test('deduplicates across listener and hook pipelines while preserving metadata', () => {
    const initialTimestamp = '2024-01-01T00:00:00.000Z';
    const firstBatchTime = new Date('2025-09-09T09:09:09.000Z');
    const listenerTime = new Date('2025-09-10T10:10:10.000Z');
    const hookTime = new Date('2025-09-11T11:11:11.000Z');

    const logger = new TestLogger();
    const dispatcher = new CapturingDispatcher();
    const componentAccess = new ComponentAccessService();
    const notesService = new NotesService();

    const actor = {
      id: 'actor-multi-stage',
      components: {
        [NOTES_COMPONENT_ID]: {
          notes: [
            {
              text: 'Existing Insight',
              subject: 'Archivist',
              subjectType: SUBJECT_TYPES.CHARACTER,
              timestamp: initialTimestamp,
            },
            null,
          ],
        },
      },
    };

    const component = componentAccess.fetchComponent(actor, NOTES_COMPONENT_ID);

    const earlyResult = notesService.addNotes(component, undefined, firstBatchTime);
    expect(earlyResult).toEqual({ wasModified: false, component, addedNotes: [] });

    const { wasModified: firstBatchModified, addedNotes: firstBatchAdded } = notesService.addNotes(
      component,
      [
        { text: 'Existing Insight', subject: 'Archivist', subjectType: SUBJECT_TYPES.CHARACTER },
        { text: 'Twin discovery', subject: 'Companion' },
        { text: 'Twin discovery', subject: 'Companion' },
        { text: '  Fresh idea  ', subject: 'Archivist' },
        {
          text: 'Structured entry',
          subject: 'Chronomancer',
          subjectType: SUBJECT_TYPES.CONCEPT,
          context: 'Temporal anomaly',
          timestamp: '2025-08-08T08:00:00.000Z',
        },
        { text: '   ', subject: 'Whitespace only' },
        'legacy-string-note',
        undefined,
      ],
      firstBatchTime
    );

    expect(firstBatchModified).toBe(true);
    expect(firstBatchAdded).toHaveLength(3);

    const [twinNote, defaultedNote, preservedNote] = firstBatchAdded;

    expect(twinNote).toMatchObject({
      text: 'Twin discovery',
      subject: 'Companion',
      subjectType: DEFAULT_SUBJECT_TYPE,
      timestamp: firstBatchTime.toISOString(),
    });
    expect(defaultedNote).toMatchObject({
      text: 'Fresh idea',
      subject: 'Archivist',
      subjectType: DEFAULT_SUBJECT_TYPE,
      timestamp: firstBatchTime.toISOString(),
    });
    expect(preservedNote).toMatchObject({
      text: 'Structured entry',
      subject: 'Chronomancer',
      subjectType: SUBJECT_TYPES.CONCEPT,
      context: 'Temporal anomaly',
      timestamp: '2025-08-08T08:00:00.000Z',
    });

    componentAccess.applyComponent(actor, NOTES_COMPONENT_ID, component);

    const listener = new NotesPersistenceListener({
      logger,
      entityManager: {
        getEntityInstance(requestedId) {
          return requestedId === actor.id ? actor : null;
        },
      },
      dispatcher,
      notesService,
      componentAccessService: componentAccess,
      now: () => listenerTime,
    });

    const listenerEvent = {
      type: 'ACTION_DECIDED_ID',
      payload: {
        actorId: actor.id,
        extractedData: {
          notes: [
            { text: 'Twin discovery!!!', subject: 'Companion' },
            { text: 'Structured entry', subject: 'Chronomancer', subjectType: SUBJECT_TYPES.CONCEPT },
            { text: 'Scenario log', subject: 'Chronicler' },
            'string-entry',
            null,
          ],
        },
      },
    };

    listener.handleEvent(listenerEvent);

    const storedNotes = actor.components[NOTES_COMPONENT_ID].notes;
    expect(Array.isArray(storedNotes)).toBe(true);
    expect(storedNotes).toContain(null);

    const summaryBySubject = Object.fromEntries(
      storedNotes
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => [entry.subject, entry])
    );

    expect(summaryBySubject.Companion.timestamp).toBe(twinNote.timestamp);
    expect(summaryBySubject.Chronomancer.timestamp).toBe('2025-08-08T08:00:00.000Z');
    expect(summaryBySubject.Chronicler).toMatchObject({
      subjectType: DEFAULT_SUBJECT_TYPE,
      timestamp: listenerTime.toISOString(),
    });

    const eventMessages = dispatcher.events.map(({ payload }) => payload.message);
    expect(eventMessages).toEqual(
      expect.arrayContaining([
        'NotesPersistenceHook: Invalid note skipped',
        'NotesPersistenceHook: Invalid note skipped',
      ])
    );

    const action = {
      notes: [
        { text: 'Twin discovery', subject: 'Companion' },
        { text: 'Scenario log', subject: 'Chronicler' },
        { text: 'Outer rim insight', subject: 'Explorer', subjectType: SUBJECT_TYPES.EVENT },
        { text: '   ', subject: 'Blank from hook' },
        'hook-string',
      ],
    };

    persistNotes(action, actor, logger, dispatcher, notesService, hookTime, componentAccess);

    const finalNotes = actor.components[NOTES_COMPONENT_ID].notes.filter(
      (entry) => entry && typeof entry === 'object'
    );

    const explorerNote = finalNotes.find((entry) => entry.subject === 'Explorer');
    expect(explorerNote).toMatchObject({
      subjectType: SUBJECT_TYPES.EVENT,
      timestamp: hookTime.toISOString(),
    });

    expect(normalizeNoteText({ subject: 'Companion', text: 'Twin discovery' })).toBe(
      normalizeNoteText({ subject: 'Companion', text: 'Twin discovery!!!' })
    );
    expect(normalizeNoteText('legacy-string-note')).toBe('');
  });
});
