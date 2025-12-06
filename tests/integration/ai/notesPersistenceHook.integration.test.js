import { persistNotes } from '../../../src/ai/notesPersistenceHook.js';
import NotesService from '../../../src/ai/notesService.js';
import { DEFAULT_SUBJECT_TYPE } from '../../../src/constants/subjectTypes.js';
import { NOTES_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createDispatcher = () => ({
  dispatch: jest.fn(),
});

const createComponentAccess = () => ({
  fetchComponent: jest.fn(),
  applyComponent: jest.fn(),
});

const createActor = (overrides = {}) => ({ id: 'actor-001', ...overrides });

describe('persistNotes integration coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns early when the action omits the notes field', () => {
    const logger = createLogger();
    const dispatcher = createDispatcher();
    const notesService = { addNotes: jest.fn() };
    const componentAccess = createComponentAccess();

    persistNotes(
      {},
      createActor(),
      logger,
      dispatcher,
      notesService,
      new Date(),
      componentAccess
    );

    expect(notesService.addNotes).not.toHaveBeenCalled();
    expect(componentAccess.fetchComponent).not.toHaveBeenCalled();
    expect(componentAccess.applyComponent).not.toHaveBeenCalled();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('dispatches a safe error when notes is not an array', () => {
    const logger = createLogger();
    const dispatcher = createDispatcher();
    const notesService = { addNotes: jest.fn() };
    const componentAccess = createComponentAccess();
    const actor = createActor();

    persistNotes(
      { notes: 'unexpected-value' },
      actor,
      logger,
      dispatcher,
      notesService,
      new Date('2024-01-01T00:00:00.000Z'),
      componentAccess
    );

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message:
          "NotesPersistenceHook: 'notes' field is not an array; skipping merge",
        details: { actorId: actor.id },
      })
    );
    expect(notesService.addNotes).not.toHaveBeenCalled();
    expect(componentAccess.fetchComponent).not.toHaveBeenCalled();
    expect(componentAccess.applyComponent).not.toHaveBeenCalled();
  });

  it('does nothing when the notes array is empty', () => {
    const logger = createLogger();
    const dispatcher = createDispatcher();
    const notesService = { addNotes: jest.fn() };
    const componentAccess = createComponentAccess();

    persistNotes(
      { notes: [] },
      createActor(),
      logger,
      dispatcher,
      notesService,
      new Date(),
      componentAccess
    );

    expect(notesService.addNotes).not.toHaveBeenCalled();
    expect(componentAccess.fetchComponent).not.toHaveBeenCalled();
    expect(componentAccess.applyComponent).not.toHaveBeenCalled();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('persists structured notes and assigns default subject types when missing', () => {
    const logger = createLogger();
    const dispatcher = createDispatcher();
    const componentAccess = createComponentAccess();
    componentAccess.fetchComponent.mockReturnValue(undefined);

    const notesService = new NotesService();
    const actor = createActor({ id: 'actor-with-notes' });
    const now = new Date('2024-05-01T10:00:00.000Z');

    const firstNote = {
      text: 'Remember the secret entrance',
      subject: 'Hidden Door',
    };
    const secondNote = {
      text: 'Visit the market',
      subject: 'Marketplace',
      subjectType: 'entity',
      context: 'northern district',
    };

    persistNotes(
      { notes: [firstNote, secondNote] },
      actor,
      logger,
      dispatcher,
      notesService,
      now,
      componentAccess
    );

    expect(componentAccess.fetchComponent).toHaveBeenCalledWith(
      actor,
      NOTES_COMPONENT_ID
    );
    expect(componentAccess.applyComponent).toHaveBeenCalledTimes(1);
    const [, , updatedComponent] = componentAccess.applyComponent.mock.calls[0];
    expect(updatedComponent.notes).toHaveLength(2);
    expect(updatedComponent.notes[0]).toMatchObject({
      text: firstNote.text,
      subject: firstNote.subject,
      subjectType: DEFAULT_SUBJECT_TYPE,
      timestamp: now.toISOString(),
    });
    expect(updatedComponent.notes[1]).toMatchObject({
      text: secondNote.text,
      subject: secondNote.subject,
      subjectType: secondNote.subjectType,
      context: secondNote.context,
    });

    const debugMessages = logger.debug.mock.calls.map(([message]) => message);
    expect(debugMessages).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          `NotesPersistenceHook: Auto-assigned default subjectType "${DEFAULT_SUBJECT_TYPE}" to note`
        ),
        `Added note: "${firstNote.text}" at ${now.toISOString()}`,
        `Added note: "${secondNote.text}" at ${now.toISOString()}`,
      ])
    );
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('falls back to the default subject type when provided subjectType is invalid', () => {
    const logger = createLogger();
    const dispatcher = createDispatcher();
    const componentAccess = createComponentAccess();
    componentAccess.fetchComponent.mockReturnValue({ notes: [] });

    const notesService = new NotesService();
    const actor = createActor();
    const now = new Date('2024-06-01T12:00:00.000Z');

    persistNotes(
      {
        notes: [
          {
            text: 'Artifact glows faintly',
            subject: 'Ancient Artifact',
            subjectType: 'INVALID_TYPE',
          },
        ],
      },
      actor,
      logger,
      dispatcher,
      notesService,
      now,
      componentAccess
    );

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'NotesPersistenceHook: Invalid subjectType, using default',
        details: expect.objectContaining({
          invalidSubjectType: 'INVALID_TYPE',
          subject: 'Ancient Artifact',
          defaultAssigned: DEFAULT_SUBJECT_TYPE,
        }),
      })
    );

    const updatedComponent = componentAccess.applyComponent.mock.calls[0][2];
    expect(updatedComponent.notes[0]).toMatchObject({
      subjectType: DEFAULT_SUBJECT_TYPE,
      text: 'Artifact glows faintly',
    });
  });

  it('reports detailed reasons when skipping invalid notes and does not persist anything', () => {
    const logger = createLogger();
    const dispatcher = createDispatcher();
    const notesService = { addNotes: jest.fn() };
    const componentAccess = createComponentAccess();
    const actor = createActor({ id: 'actor-invalid' });

    persistNotes(
      {
        notes: [
          { text: '   ', subject: 'Quest Hook' },
          { text: 'Valid text', subject: '' },
          'unsupported entry',
        ],
      },
      actor,
      logger,
      dispatcher,
      notesService,
      new Date('2024-07-04T08:00:00.000Z'),
      componentAccess
    );

    expect(notesService.addNotes).not.toHaveBeenCalled();
    expect(componentAccess.fetchComponent).not.toHaveBeenCalled();
    expect(componentAccess.applyComponent).not.toHaveBeenCalled();

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(3);
    expect(dispatcher.dispatch).toHaveBeenNthCalledWith(
      1,
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'NotesPersistenceHook: Invalid note skipped',
        details: expect.objectContaining({
          note: expect.objectContaining({ text: '   ', subject: 'Quest Hook' }),
          reason: 'Missing or blank text field',
        }),
      })
    );
    expect(dispatcher.dispatch).toHaveBeenNthCalledWith(
      2,
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'NotesPersistenceHook: Invalid note skipped',
        details: expect.objectContaining({
          note: expect.objectContaining({ text: 'Valid text', subject: '' }),
          reason: 'Missing or blank subject field',
        }),
      })
    );
    expect(dispatcher.dispatch).toHaveBeenNthCalledWith(
      3,
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'NotesPersistenceHook: Invalid note skipped',
        details: { note: 'unsupported entry' },
      })
    );
  });

  it('does not apply component changes when the notes service reports no modifications', () => {
    const logger = createLogger();
    const componentAccess = createComponentAccess();
    const existingComponent = {
      notes: [
        {
          text: 'Existing',
          subject: 'Lore',
          subjectType: DEFAULT_SUBJECT_TYPE,
        },
      ],
    };
    componentAccess.fetchComponent.mockReturnValue(existingComponent);

    const addNotes = jest.fn(() => ({
      wasModified: false,
      component: existingComponent,
      addedNotes: [],
    }));
    const notesService = { addNotes };
    const now = new Date('2024-08-15T14:30:00.000Z');

    persistNotes(
      {
        notes: [
          {
            text: 'Existing',
            subject: 'Lore',
            subjectType: DEFAULT_SUBJECT_TYPE,
          },
        ],
      },
      createActor(),
      logger,
      null,
      notesService,
      now,
      componentAccess
    );

    expect(addNotes).toHaveBeenCalledWith(
      existingComponent,
      expect.any(Array),
      now
    );
    expect(componentAccess.applyComponent).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });
});
