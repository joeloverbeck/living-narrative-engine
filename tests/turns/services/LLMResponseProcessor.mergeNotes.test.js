// tests/turns/services/LLMResponseProcessor.mergeNotes.test.js

import { beforeEach, describe, expect, jest, test } from '@jest/globals';
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
    const notes = [
      { text: 'First Note', timestamp: '2025-06-05T12:00:00.000Z' },
      { text: 'Second Note', timestamp: '2025-06-05T13:00:00.000Z' },
    ];

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
    const dup = [
      { text: '  buy   MILK ', timestamp: '2025-06-05T11:00:00.000Z' },
    ];

    processor._mergeNotesIntoEntity(dup, actor, logger);

    const comp = actor.components[NOTES_COMPONENT_ID];
    expect(comp.notes).toHaveLength(1);
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(entityManager.addComponent).not.toHaveBeenCalled();
  });

  test('incoming duplicates (Alpha vs alpha) only adds one', () => {
    const incoming = [
      { text: 'Alpha', timestamp: '2025-06-01T00:00:00.000Z' },
      { text: 'alpha', timestamp: '2025-06-02T00:00:00.000Z' },
    ];

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
    const mixed = [
      { text: '', timestamp: '2025-06-05T10:00:00.000Z' }, // invalid: empty text
      { text: 'Valid Note', timestamp: '2025-06-05T12:00:00.000Z' }, // valid
      { text: 'Also Valid', timestamp: 'invalid-date' }, // invalid: bad timestamp
      { foo: 'bar' }, // invalid: missing fields
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
});
