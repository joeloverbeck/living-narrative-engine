import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ShortTermMemoryService from '../../../src/ai/shortTermMemoryService.js';
import EventBus from '../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';

class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(...args) {
    this.debugLogs.push(args);
  }

  info(...args) {
    this.infoLogs.push(args);
  }

  warn(...args) {
    this.warnLogs.push(args);
  }

  error(...args) {
    this.errorLogs.push(args);
  }
}

class InMemorySchemaValidator {
  constructor(initialSchemas) {
    this.schemas = new Map(Object.entries(initialSchemas));
    this.validationCalls = [];
  }

  isSchemaLoaded(schemaId) {
    return this.schemas.has(schemaId);
  }

  validate(schemaId, payload) {
    this.validationCalls.push({ schemaId, payload });
    const schema = this.schemas.get(schemaId);
    if (!schema) {
      return {
        isValid: false,
        errors: [{ instancePath: '', message: `Schema ${schemaId} not found` }],
      };
    }

    const errors = [];
    for (const requiredField of schema.requiredFields) {
      if (
        payload[requiredField] === undefined ||
        payload[requiredField] === null ||
        payload[requiredField] === ''
      ) {
        errors.push({
          instancePath: `/${requiredField}`,
          message: `${requiredField} is required`,
        });
      }
    }

    return { isValid: errors.length === 0, errors };
  }
}

class InMemoryGameDataRepository {
  constructor(eventDefinitions) {
    this.eventDefinitions = new Map(eventDefinitions);
  }

  getEventDefinition(eventName) {
    return this.eventDefinitions.get(eventName) || null;
  }
}

const ThoughtAddedSchemaId = 'ThoughtAdded#payload';

const waitForDispatch = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

describe('ShortTermMemoryService with real event infrastructure', () => {
  let logger;
  let schemaValidator;
  let gameDataRepository;
  let eventBus;
  let validatedDispatcher;
  let safeEventDispatcher;
  let service;
  /** @type {Array<{ type: string, payload: any }>} */
  let receivedEvents;
  let unsubscribe;

  beforeEach(() => {
    logger = new RecordingLogger();
    schemaValidator = new InMemorySchemaValidator({
      [ThoughtAddedSchemaId]: {
        requiredFields: ['entityId', 'text', 'timestamp'],
      },
    });
    gameDataRepository = new InMemoryGameDataRepository([
      [
        'ThoughtAdded',
        {
          id: 'ThoughtAdded',
          payloadSchema: { $id: ThoughtAddedSchemaId },
        },
      ],
    ]);

    eventBus = new EventBus({ logger });
    validatedDispatcher = new ValidatedEventDispatcher({
      eventBus,
      gameDataRepository,
      schemaValidator,
      logger,
    });
    safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: validatedDispatcher,
      logger,
    });

    service = new ShortTermMemoryService({
      eventDispatcher: safeEventDispatcher,
      defaultMaxEntries: 2,
    });
    receivedEvents = [];
    unsubscribe = safeEventDispatcher.subscribe('ThoughtAdded', (event) => {
      receivedEvents.push(event);
    });
  });

  afterEach(() => {
    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }
  });

  it('emits validated ThoughtAdded events and enforces default capacity', async () => {
    const mem = {
      thoughts: [],
      maxEntries: 0,
      entityId: 'npc-77',
    };

    const additions = [
      { text: 'First idea', at: new Date('2024-01-01T10:00:00.000Z') },
      { text: 'Second idea', at: new Date('2024-01-01T11:00:00.000Z') },
      { text: 'Third idea', at: new Date('2024-01-01T12:00:00.000Z') },
    ];

    for (const { text, at } of additions) {
      const result = service.addThought(mem, text, at);
      expect(result.wasAdded).toBe(true);
      service.emitThoughtAdded(
        mem.entityId,
        result.entry.text,
        result.entry.timestamp
      );
      await waitForDispatch();
    }

    expect(mem.thoughts).toHaveLength(2);
    expect(mem.thoughts.map((entry) => entry.text)).toEqual([
      'Second idea',
      'Third idea',
    ]);

    expect(receivedEvents).toHaveLength(3);
    expect(receivedEvents[0]).toEqual({
      type: 'ThoughtAdded',
      payload: {
        entityId: 'npc-77',
        text: 'First idea',
        timestamp: '2024-01-01T10:00:00.000Z',
      },
    });
    expect(receivedEvents[2]).toEqual({
      type: 'ThoughtAdded',
      payload: {
        entityId: 'npc-77',
        text: 'Third idea',
        timestamp: '2024-01-01T12:00:00.000Z',
      },
    });

    const duplicateResult = service.addThought(
      mem,
      '  third idea  ',
      new Date('2024-01-01T13:00:00.000Z')
    );
    expect(duplicateResult.wasAdded).toBe(false);
    await waitForDispatch();
    expect(receivedEvents).toHaveLength(3);
    expect(mem.thoughts).toHaveLength(2);

    expect(schemaValidator.validationCalls).toHaveLength(3);
    expect(schemaValidator.validationCalls[0]).toEqual({
      schemaId: ThoughtAddedSchemaId,
      payload: {
        entityId: 'npc-77',
        text: 'First idea',
        timestamp: '2024-01-01T10:00:00.000Z',
      },
    });
  });

  it('blocks events when schema validation fails and logs the validation attempt', async () => {
    schemaValidator.schemas.set(ThoughtAddedSchemaId, {
      requiredFields: ['entityId', 'text', 'timestamp', 'mood'],
    });

    const mem = {
      thoughts: [],
      maxEntries: 1,
      entityId: 'npc-31',
    };

    const result = service.addThought(
      mem,
      'Needs richer payload',
      new Date('2024-02-02T10:15:00.000Z')
    );
    expect(result.wasAdded).toBe(true);

    service.emitThoughtAdded(
      mem.entityId,
      result.entry.text,
      result.entry.timestamp
    );
    await waitForDispatch();

    expect(receivedEvents).toHaveLength(0);
    expect(schemaValidator.validationCalls).toHaveLength(1);
    expect(schemaValidator.validationCalls[0].payload).toEqual({
      entityId: 'npc-31',
      text: 'Needs richer payload',
      timestamp: '2024-02-02T10:15:00.000Z',
    });

    expect(logger.errorLogs.length).toBeGreaterThan(0);
    const lastError = logger.errorLogs[logger.errorLogs.length - 1][0];
    expect(String(lastError)).toContain('VED: Payload validation FAILED');
  });

  it('rejects invalid memory objects before interacting with the event system', () => {
    expect(() => service.addThought(null, 'not allowed')).toThrow(
      'mem must be an object conforming to core:short_term_memory schema'
    );
    expect(receivedEvents).toHaveLength(0);
    expect(schemaValidator.validationCalls).toHaveLength(0);
  });
});
