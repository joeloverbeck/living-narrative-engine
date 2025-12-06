import { describe, expect, it } from '@jest/globals';
import { NotesPersistenceListener } from '../../../src/ai/notesPersistenceListener.js';
import { persistNotes } from '../../../src/ai/notesPersistenceHook.js';
import NotesService, {
  normalizeNoteText,
} from '../../../src/ai/notesService.js';
import ComponentAccessService from '../../../src/entities/componentAccessService.js';
import { NOTES_COMPONENT_ID } from '../../../src/constants/componentIds.js';
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

class CapturingDispatcher {
  constructor() {
    this.events = [];
  }

  dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
  }
}

describe('NotesService integration through persistence workflows', () => {
  it('surfaces a descriptive error when persistence encounters a malformed notes component', () => {
    const logger = new TestLogger();
    const dispatcher = new CapturingDispatcher();
    const notesService = new NotesService();
    const componentAccess = new ComponentAccessService();

    const actor = {
      id: 'actor-corrupted-component',
      components: {
        [NOTES_COMPONENT_ID]: { corrupted: true },
      },
    };

    const action = {
      notes: [
        {
          text: 'Anchor this memory',
          subject: 'Archivist',
          subjectType: SUBJECT_TYPES.ENTITY,
        },
      ],
    };

    expect(() =>
      persistNotes(
        action,
        actor,
        logger,
        dispatcher,
        notesService,
        new Date('2025-03-01T10:00:00.000Z'),
        componentAccess
      )
    ).toThrow(
      'notesComp must be an object conforming to the core:notes schema with a `notes` array.'
    );

    expect(actor.components[NOTES_COMPONENT_ID]).toEqual({ corrupted: true });
    expect(logger.debugMessages).toHaveLength(0);
    expect(dispatcher.events).toHaveLength(0);
  });

  it('deduplicates, defaults metadata, and persists notes through the listener pipeline', () => {
    const logger = new TestLogger();
    const dispatcher = new CapturingDispatcher();
    const componentAccess = new ComponentAccessService();
    const notesService = new NotesService();

    const existingTimestamp = '2024-12-24T18:00:00.000Z';
    const actor = {
      id: 'actor-listener',
      components: {
        [NOTES_COMPONENT_ID]: {
          notes: [
            {
              text: 'Existing Insight',
              subject: 'Lorekeeper',
              subjectType: SUBJECT_TYPES.ENTITY,
              timestamp: existingTimestamp,
            },
            // Corrupted entry from an older build that should be ignored during normalization
            'dangling-string-note',
          ],
        },
      },
    };

    const entityManager = {
      getEntityInstance(requestedId) {
        return requestedId === actor.id ? actor : null;
      },
    };

    const listener = new NotesPersistenceListener({
      logger,
      entityManager,
      dispatcher,
      notesService,
      componentAccessService: componentAccess,
      now: () => new Date('2025-05-05T10:00:00.000Z'),
    });

    const event = {
      type: 'ACTION_DECIDED_ID',
      payload: {
        actorId: actor.id,
        extractedData: {
          notes: [
            // Duplicate in pristine format that should be skipped
            {
              text: 'Existing Insight',
              subject: 'Lorekeeper',
              subjectType: SUBJECT_TYPES.ENTITY,
            },
            // Duplicate after normalization (case, punctuation, whitespace differences)
            {
              text: '  existing insight!!  ',
              subject: 'Lorekeeper',
              subjectType: SUBJECT_TYPES.ENTITY,
            },
            // Valid entry that requires default subject type and timestamp
            {
              text: '  Fresh Perspective  ',
              subject: 'Archivist',
            },
            // Valid entry that preserves explicit metadata
            {
              text: 'Time Anchored',
              subject: 'Chronomancer',
              subjectType: SUBJECT_TYPES.KNOWLEDGE,
              timestamp: '2025-01-02T09:00:00.000Z',
              context: 'Temporal anomaly investigation',
            },
            // Whitespace-only text should be rejected before reaching NotesService
            { text: '   ', subject: 'Whitespace Artifact' },
            // Completely invalid structure
            'raw-string-note',
          ],
        },
      },
    };

    listener.handleEvent(event);

    const storedComponent = actor.components[NOTES_COMPONENT_ID];
    expect(Array.isArray(storedComponent.notes)).toBe(true);
    expect(storedComponent.notes).toHaveLength(4);

    const [existingNote, legacyStringEntry, defaultedNote, preservedNote] =
      storedComponent.notes;

    expect(existingNote).toMatchObject({
      text: 'Existing Insight',
      subject: 'Lorekeeper',
      subjectType: SUBJECT_TYPES.ENTITY,
      timestamp: existingTimestamp,
    });

    expect(legacyStringEntry).toBe('dangling-string-note');

    expect(defaultedNote).toMatchObject({
      text: 'Fresh Perspective',
      subject: 'Archivist',
      subjectType: DEFAULT_SUBJECT_TYPE,
      timestamp: '2025-05-05T10:00:00.000Z',
    });

    expect(preservedNote).toMatchObject({
      text: 'Time Anchored',
      subject: 'Chronomancer',
      subjectType: SUBJECT_TYPES.KNOWLEDGE,
      timestamp: '2025-01-02T09:00:00.000Z',
      context: 'Temporal anomaly investigation',
    });

    const eventMessages = dispatcher.events.map(
      ({ payload }) => payload.message
    );
    expect(eventMessages).toEqual(
      expect.arrayContaining([
        'NotesPersistenceHook: Invalid note skipped',
        'NotesPersistenceHook: Invalid note skipped',
      ])
    );

    const normalizationKey = normalizeNoteText({
      subject: 'Lorekeeper',
      subjectType: SUBJECT_TYPES.ENTITY,
      text: 'Existing Insight',
    });
    expect(normalizationKey).toBe(
      normalizeNoteText({
        subject: 'Lorekeeper',
        subjectType: SUBJECT_TYPES.ENTITY,
        text: 'existing insight!!',
      })
    );
    expect(normalizeNoteText(null)).toBe('');
    expect(normalizeNoteText({})).toBe('');
    expect(normalizeNoteText({ text: 'Solitary note without subject' })).toBe(
      'solitary note without subject'
    );
  });

  it('skips whitespace-only structured notes when merging components directly with ComponentAccessService', () => {
    const notesService = new NotesService();
    const componentAccess = new ComponentAccessService();
    const actor = {
      id: 'actor-direct-merge',
      components: {
        [NOTES_COMPONENT_ID]: { notes: [] },
      },
    };

    expect(() => notesService.addNotes(null, [])).toThrow(TypeError);

    const component = componentAccess.fetchComponent(actor, NOTES_COMPONENT_ID);

    const now = new Date('2025-07-04T20:15:00.000Z');

    const earlyResult = notesService.addNotes(component, null, now);
    expect(earlyResult).toEqual({
      wasModified: false,
      component,
      addedNotes: [],
    });

    const { wasModified, addedNotes } = notesService.addNotes(
      component,
      [
        { text: '   ', subject: 'Blank After Trim' },
        'raw-string-entry',
        null,
        { text: 'Calibrated instruments', subject: 'Engineer' },
      ],
      now
    );

    expect(wasModified).toBe(true);
    expect(addedNotes).toHaveLength(1);
    const [addedNote] = addedNotes;
    expect(addedNote).toEqual({
      text: 'Calibrated instruments',
      subject: 'Engineer',
      subjectType: DEFAULT_SUBJECT_TYPE,
      context: undefined,
      timestamp: now.toISOString(),
    });

    componentAccess.applyComponent(actor, NOTES_COMPONENT_ID, component);
    expect(actor.components[NOTES_COMPONENT_ID].notes).toHaveLength(1);
    expect(actor.components[NOTES_COMPONENT_ID].notes[0]).toBe(addedNote);
  });
});
