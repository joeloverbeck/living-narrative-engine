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
  isSchemaLoaded: () => true,
  validate: () => ({ isValid: true }),
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

  test('non-array input logs error and leaves entity untouched', () => {
    processor._mergeNotesIntoEntity('foo', actor, logger);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(actor.components[NOTES_COMPONENT_ID]).toBeUndefined();
  });

  test('creates component when missing and adds unique, valid notes', () => {
    const notes = [
      { text: 'First Note', timestamp: '2025-06-05T12:00:00.000Z' },
      { text: 'Second Note', timestamp: '2025-06-05T13:00:00.000Z' },
    ];

    processor._mergeNotesIntoEntity(notes, actor, logger);

    const comp = actor.components[NOTES_COMPONENT_ID];
    expect(comp).toBeDefined();
    expect(comp.notes).toHaveLength(2);
    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(entityManager.addComponent).toHaveBeenCalledTimes(1); // component creation
  });

  test('skips duplicates after normalisation', () => {
    actor.components[NOTES_COMPONENT_ID] = {
      notes: [{ text: 'Buy milk!', timestamp: '2025-06-05T10:00:00.000Z' }],
    };
    const dup = [
      { text: '  buy   MILK ', timestamp: '2025-06-05T11:00:00.000Z' },
    ];

    processor._mergeNotesIntoEntity(dup, actor, logger);

    expect(actor.components[NOTES_COMPONENT_ID].notes).toHaveLength(1);
    expect(logger.info).not.toHaveBeenCalled();
  });

  test('invalid notes are rejected with error log', () => {
    const bad = [
      { text: '', timestamp: '2025-06-05T10:00:00.000Z' }, // empty text
      { text: 'OK', timestamp: 'not-a-date' }, // bad ts
      { foo: 'bar' }, // completely wrong
    ];

    processor._mergeNotesIntoEntity(bad, actor, logger);

    expect(logger.error).toHaveBeenCalledTimes(3);
    // component should have been created but remain empty
    const comp = actor.components[NOTES_COMPONENT_ID];
    expect(comp).toBeDefined();
    expect(Array.isArray(comp.notes)).toBe(true);
    expect(comp.notes).toHaveLength(0);
    expect(entityManager.addComponent).toHaveBeenCalledTimes(1);
  });
});
