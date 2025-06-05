// tests/turns/services/LLMResponseProcessor.mergeNotes.test.js

import {
  beforeEach,
  describe,
  expect,
  jest,
  test,
  afterEach,
} from '@jest/globals';
import { LLMResponseProcessor } from '../../../src/turns/services/LLMResponseProcessor.js';
import { NOTES_COMPONENT_ID } from '../../../src/constants/componentIds.js';

const makeLogger = () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
});

const makeEntityManagerDouble = (actorEntity) => ({
  addComponent: jest.fn((id, compId, data) => {
    if (id === actorEntity.id) actorEntity.components[compId] = data;
  }),
  getEntityInstance: jest.fn(() => actorEntity),
});

describe('_mergeNotesIntoEntity', () => {
  let actor;
  let logger;
  let entityManager;
  let processor;
  let originalToISOString;

  beforeEach(() => {
    actor = { id: 'actor-1', components: {} };
    logger = makeLogger();
    entityManager = makeEntityManagerDouble(actor);
    const schemaValidatorStub = {
      validate: jest.fn().mockReturnValue({ isValid: true }),
      isSchemaLoaded: jest.fn().mockReturnValue(true),
    };
    processor = new LLMResponseProcessor({
      schemaValidator: schemaValidatorStub,
      entityManager,
    });

    // Save the real toISOString so we can restore it in afterEach
    originalToISOString = Date.prototype.toISOString;
  });

  afterEach(() => {
    // Restore the original Date.prototype.toISOString
    Date.prototype.toISOString = originalToISOString;
    jest.restoreAllMocks();
  });

  test('missing notes (undefined) leaves entity untouched with no error logs', () => {
    // notesArray is undefined
    processor._mergeNotesIntoEntity(undefined, actor, logger);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    expect(actor.components[NOTES_COMPONENT_ID]).toBeUndefined();
    expect(entityManager.addComponent).not.toHaveBeenCalled();
  });

  test('notes = null logs error once and leaves entity untouched', () => {
    processor._mergeNotesIntoEntity(null, actor, logger);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(actor.components[NOTES_COMPONENT_ID]).toBeUndefined();
    expect(entityManager.addComponent).not.toHaveBeenCalled();
  });

  test('non-array input (string) logs error and leaves entity untouched', () => {
    processor._mergeNotesIntoEntity('foo', actor, logger);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(actor.components[NOTES_COMPONENT_ID]).toBeUndefined();
    expect(entityManager.addComponent).not.toHaveBeenCalled();
  });

  test('creates component when missing and adds unique, valid notes', () => {
    jest
      .spyOn(Date.prototype, 'toISOString')
      .mockReturnValueOnce('2025-06-05T12:00:00.000Z')
      .mockReturnValueOnce('2025-06-05T12:00:00.000Z')
      .mockReturnValueOnce('2025-06-05T13:00:00.000Z')
      .mockReturnValue('2025-06-05T13:00:00.000Z');

    const notes = ['First Note', 'Second Note'];

    processor._mergeNotesIntoEntity(notes, actor, logger);

    const comp = actor.components[NOTES_COMPONENT_ID];
    expect(comp).toBeDefined();
    expect(Array.isArray(comp.notes)).toBe(true);
    expect(comp.notes).toHaveLength(2);
    expect(comp.notes[0]).toEqual({
      text: 'First Note',
      timestamp: '2025-06-05T12:00:00.000Z',
    });
    expect(comp.notes[1]).toEqual({
      text: 'Second Note',
      timestamp: '2025-06-05T13:00:00.000Z',
    });
    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(entityManager.addComponent).toHaveBeenCalledTimes(1);
  });

  test('skips duplicates after normalization against existing notes', () => {
    actor.components[NOTES_COMPONENT_ID] = {
      notes: [{ text: 'Buy milk!', timestamp: '2025-06-05T10:00:00.000Z' }],
    };
    const dup = ['  buy   MILK '];

    processor._mergeNotesIntoEntity(dup, actor, logger);

    const comp = actor.components[NOTES_COMPONENT_ID];
    expect(comp.notes).toHaveLength(1);
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(entityManager.addComponent).not.toHaveBeenCalled();
  });

  test('incoming duplicates (Alpha vs alpha) only adds one', () => {
    jest
      .spyOn(Date.prototype, 'toISOString')
      .mockReturnValueOnce('2025-06-01T00:00:00.000Z')
      .mockReturnValueOnce('2025-06-02T00:00:00.000Z');

    const incoming = ['Alpha', 'alpha'];

    processor._mergeNotesIntoEntity(incoming, actor, logger);

    const comp = actor.components[NOTES_COMPONENT_ID];
    expect(comp).toBeDefined();
    expect(comp.notes).toHaveLength(1);
    expect(comp.notes[0]).toEqual({
      text: 'Alpha',
      timestamp: '2025-06-01T00:00:00.000Z',
    });
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
    expect(entityManager.addComponent).toHaveBeenCalledTimes(1);
  });

  test('mixed valid and invalid notes: logs error for invalid, adds only valid', () => {
    jest
      .spyOn(Date.prototype, 'toISOString')
      .mockReturnValue('2025-06-05T12:00:00.000Z');

    const mixed = [
      '', // invalid: empty string
      'Valid Note', // valid
      123, // invalid: not a string
      { foo: 'bar' }, // invalid: wrong type
    ];

    processor._mergeNotesIntoEntity(mixed, actor, logger);

    const comp = actor.components[NOTES_COMPONENT_ID];
    expect(comp).toBeDefined();
    expect(comp.notes).toHaveLength(1);
    expect(comp.notes[0]).toEqual({
      text: 'Valid Note',
      timestamp: '2025-06-05T12:00:00.000Z',
    });

    // Three invalid items should each produce one error log
    expect(logger.error).toHaveBeenCalledTimes(3);
    // One valid item should produce one info log
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(entityManager.addComponent).toHaveBeenCalledTimes(1);
  });

  test('logs exactly the required message when a valid note is added', () => {
    // Stub Date.prototype.toISOString() to return a fixed value
    jest
      .spyOn(Date.prototype, 'toISOString')
      .mockReturnValueOnce('2025-06-04T11:00:00Z')
      .mockReturnValueOnce('2025-06-04T12:00:00Z');

    // Prepare one valid note
    const singleNote = ['Example note text'];

    processor._mergeNotesIntoEntity(singleNote, actor, logger);

    // Now verify:
    // 1) Exactly one component creation
    expect(entityManager.addComponent).toHaveBeenCalledTimes(1);

    // 2) Exactly one info log, with the exact string
    const expectedMessage =
      '[2025-06-04T12:00:00Z] Added note: "Example note text" at 2025-06-04T11:00:00Z';
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(expectedMessage);

    // 3) No error logs
    expect(logger.error).not.toHaveBeenCalled();
  });
});
