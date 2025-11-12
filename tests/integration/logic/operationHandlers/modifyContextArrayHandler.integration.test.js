import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';

import EventBus from '../../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../../src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import GameDataRepository from '../../../../src/data/gameDataRepository.js';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import ModifyContextArrayHandler from '../../../../src/logic/operationHandlers/modifyContextArrayHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/systemEventIds.js';
import {
  advancedArrayModify,
  applyArrayModification,
} from '../../../../src/utils/arrayModifyUtils.js';
import ConsoleLogger, {
  LogLevel,
} from '../../../../src/logging/consoleLogger.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createIntegrationEnvironment = () => {
  const logger = createLogger();
  const eventBus = new EventBus({ logger });
  const dataRegistry = new InMemoryDataRegistry({ logger });

  // Ensure the system error event definition exists so the dispatcher accepts it.
  dataRegistry.store('events', SYSTEM_ERROR_OCCURRED_ID, {
    id: SYSTEM_ERROR_OCCURRED_ID,
    name: 'System Error Occurred',
  });

  const gameDataRepository = new GameDataRepository(dataRegistry, logger);
  const schemaValidator = new AjvSchemaValidator({ logger });

  const validatedEventDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository,
    schemaValidator,
    logger,
  });

  const safeEventDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher,
    logger,
  });

  return {
    logger,
    eventBus,
    dataRegistry,
    gameDataRepository,
    schemaValidator,
    validatedEventDispatcher,
    safeEventDispatcher,
  };
};

const createExecutionContext = (env, initialContext = {}) => ({
  logger: env.logger,
  evaluationContext: {
    actor: { id: 'actor-1' },
    target: { id: 'target-1' },
    context: { ...initialContext },
  },
  services: {
    safeEventDispatcher: env.safeEventDispatcher,
  },
  validatedEventDispatcher: env.validatedEventDispatcher,
});

describe('ModifyContextArrayHandler integration', () => {
  let env;
  let handler;
  let executionContext;
  let systemErrorEvents;
  let unsubscribeSystemErrors;

  beforeEach(() => {
    env = createIntegrationEnvironment();
    handler = new ModifyContextArrayHandler({
      logger: env.logger,
      safeEventDispatcher: env.safeEventDispatcher,
    });
    executionContext = createExecutionContext(env);
    systemErrorEvents = [];
    unsubscribeSystemErrors = env.safeEventDispatcher.subscribe(
      SYSTEM_ERROR_OCCURRED_ID,
      (event) => {
        systemErrorEvents.push(event);
      }
    );
  });

  afterEach(() => {
    unsubscribeSystemErrors?.();
    jest.clearAllMocks();
  });

  const flushAsync = async () => {
    await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));
  };

  test('constructor validates dependencies', () => {
    expect(
      () =>
        new ModifyContextArrayHandler({
          logger: null,
          safeEventDispatcher: env.safeEventDispatcher,
        })
    ).toThrow("Dependency 'ILogger' with a 'warn' method is required.");

    expect(
      () =>
        new ModifyContextArrayHandler({
          logger: env.logger,
          safeEventDispatcher: {},
        })
    ).toThrow("Dependency 'ISafeEventDispatcher' with dispatch method is required.");
  });

  test('push mode initialises missing context arrays and stores result variable', () => {
    handler.execute(
      {
        variable_path: 'story.notes',
        mode: 'push',
        value: 'first entry',
        result_variable: 'last_operation',
      },
      executionContext
    );

    expect(executionContext.evaluationContext.context.story.notes).toEqual([
      'first entry',
    ]);
    expect(executionContext.evaluationContext.context.last_operation).toEqual([
      'first entry',
    ]);
    expect(env.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("MODIFY_CONTEXT_ARRAY: Performing 'push' on context variable 'story.notes'. Value: \"first entry\"."),
    );
  });

  test('push_unique prevents duplicates for object payloads', () => {
    executionContext.evaluationContext.context = {
      story: { notes: [{ id: 1, text: 'hello' }] },
    };

    handler.execute(
      {
        variable_path: 'story.notes',
        mode: 'push_unique',
        value: { id: 1, text: 'hello' },
        result_variable: 'last_operation',
      },
      executionContext
    );

    expect(executionContext.evaluationContext.context.story.notes).toEqual([
      { id: 1, text: 'hello' },
    ]);
    expect(
      executionContext.evaluationContext.context.last_operation
    ).toEqual([{ id: 1, text: 'hello' }]);
  });

  test('pop mode removes the final element and stores popped value', () => {
    executionContext.evaluationContext.context = {
      inventory: { items: ['sword', 'shield'] },
    };

    handler.execute(
      {
        variable_path: 'inventory.items',
        mode: 'pop',
        result_variable: 'last_removed',
      },
      executionContext
    );

    expect(executionContext.evaluationContext.context.inventory.items).toEqual([
      'sword',
    ]);
    expect(
      executionContext.evaluationContext.context.last_removed
    ).toBe('shield');
  });

  test('remove_by_value handles object comparison', () => {
    executionContext.evaluationContext.context = {
      scene: {
        participants: [
          { id: 'a', role: 'lead' },
          { id: 'b', role: 'support' },
        ],
      },
    };

    handler.execute(
      {
        variable_path: 'scene.participants',
        mode: 'remove_by_value',
        value: { id: 'a', role: 'lead' },
        result_variable: 'updated_participants',
      },
      executionContext
    );

    expect(
      executionContext.evaluationContext.context.scene.participants
    ).toEqual([{ id: 'b', role: 'support' }]);
    expect(
      executionContext.evaluationContext.context.updated_participants
    ).toEqual([{ id: 'b', role: 'support' }]);
  });

  test('invalid params trigger warning through assertParamsObject', () => {
    handler.execute(null, executionContext);

    expect(env.logger.warn).toHaveBeenCalledWith(
      'MODIFY_CONTEXT_ARRAY: params missing or invalid.',
      { params: null }
    );
  });

  test('missing required parameters logs a warning and aborts execution', () => {
    handler.execute({ mode: 'push' }, executionContext);

    expect(env.logger.warn).toHaveBeenCalledWith(
      'MODIFY_CONTEXT_ARRAY: Missing required parameters (variable_path, or mode).'
    );
  });

  test('unknown modification mode is rejected with diagnostic log', () => {
    handler.execute(
      {
        variable_path: 'story.notes',
        mode: 'shift',
        value: 'ignored',
      },
      executionContext
    );

    expect(env.logger.warn).toHaveBeenCalledWith(
      "MODIFY_CONTEXT_ARRAY: Unknown mode 'shift'."
    );
    expect(executionContext.evaluationContext.context.story).toBeUndefined();
  });

  test('missing value for push logs warning and leaves context unchanged', () => {
    executionContext.evaluationContext.context = {
      story: { notes: ['existing'] },
    };

    handler.execute(
      {
        variable_path: 'story.notes',
        mode: 'push',
      },
      executionContext
    );

    expect(env.logger.warn).toHaveBeenCalledWith(
      "'push' mode requires a 'value' parameter."
    );
    expect(executionContext.evaluationContext.context.story.notes).toEqual([
      'existing',
    ]);
  });

  test('non-array context value logs warning and aborts modification', () => {
    executionContext.evaluationContext.context = {
      scene: { participants: 'not an array' },
    };

    handler.execute(
      {
        variable_path: 'scene.participants',
        mode: 'remove_by_value',
        value: 'any',
      },
      executionContext
    );

    expect(env.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "MODIFY_CONTEXT_ARRAY: Context variable path 'scene.participants' does not resolve to an array"
      )
    );
  });

  test('non-initializable modes warn when context path is missing', () => {
    handler.execute(
      {
        variable_path: 'scene.participants',
        mode: 'remove_by_value',
        value: 'ghost',
      },
      executionContext
    );

    expect(env.logger.warn).toHaveBeenCalledWith(
      "MODIFY_CONTEXT_ARRAY: Context variable path 'scene.participants' does not exist, and mode 'remove_by_value' does not support initialization from undefined."
    );
  });

  test('skips result storage when result variable is omitted', () => {
    executionContext.evaluationContext.context = {
      story: { notes: [] },
    };

    handler.execute(
      {
        variable_path: 'story.notes',
        mode: 'push',
        value: 'entry',
      },
      executionContext
    );

    expect(
      executionContext.evaluationContext.context.story.notes
    ).toEqual(['entry']);
    expect(
      executionContext.evaluationContext.context
    ).not.toHaveProperty('last_operation');
  });

  test('missing evaluation context dispatches system error event', async () => {
    executionContext.evaluationContext.context = null;

    handler.execute(
      {
        variable_path: 'story.notes',
        mode: 'push',
        value: 'orphan',
      },
      executionContext
    );

    await flushAsync();

    expect(systemErrorEvents).toHaveLength(1);
    expect(systemErrorEvents[0]).toEqual({
      type: SYSTEM_ERROR_OCCURRED_ID,
      payload: expect.objectContaining({ message: expect.any(String) }),
    });
  });

  test('invalid result variable name triggers safe dispatch error', async () => {
    executionContext.evaluationContext.context = {
      inventory: { items: ['rope'] },
    };
    const dispatchSpy = jest.spyOn(env.safeEventDispatcher, 'dispatch');

    handler.execute(
      {
        variable_path: 'inventory.items',
        mode: 'push',
        value: 'torch',
        result_variable: '   ',
      },
      executionContext
    );

    await flushAsync();

    expect(dispatchSpy).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('Invalid variableName'),
      })
    );
    expect(systemErrorEvents.length).toBeGreaterThanOrEqual(1);
    expect(
      systemErrorEvents.some((event) =>
        event.payload?.message?.includes('Invalid variableName')
      )
    ).toBe(true);
  });

  test('circular values fall back to placeholder logging without throwing', () => {
    executionContext.evaluationContext.context = {
      story: { notes: [] },
    };
    const circular = {};
    circular.self = circular;

    handler.execute(
      {
        variable_path: 'story.notes',
        mode: 'push',
        value: circular,
        result_variable: 'last_operation',
      },
      executionContext
    );

    expect(env.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Value: [unable to stringify].')
    );
    expect(
      executionContext.evaluationContext.context.story.notes[0]
    ).toBe(circular);
    expect(
      executionContext.evaluationContext.context.last_operation[0]
    ).toBe(circular);
  });

  test('push_unique honors deep equality for complex nested structures and avoids duplicates', () => {
    const primitiveEntry = 'existing text';
    const nestedArrayEntry = ['alpha'];
    const minimalObject = {
      id: 'alpha',
      meta: { score: 42 },
      tags: ['rogue'],
    };
    const mismatchedKeys = {
      id: 'alpha',
      meta: { score: 42, history: [] },
      tags: ['rogue'],
      createdAt: new Date('2023-12-31T00:00:00.000Z'),
      other: 'mismatch',
    };

    const createNarrativeEntry = (score = 42) => {
      const createdAt = new Date('2024-01-01T00:00:00.000Z');
      const entry = {
        id: 'alpha',
        meta: {
          score,
          history: [
            { stage: 'intro', flags: ['start'] },
            { stage: 'conflict', flags: ['middle'] },
          ],
        },
        tags: ['rogue', { nested: { label: 'A' } }],
        createdAt,
      };
      entry.self = entry;
      entry.meta.owner = entry;
      entry.meta.history[1].flags.push({ twist: true });
      entry.meta.history[1].loop = entry.meta.history;
      return entry;
    };

    const variantScore = createNarrativeEntry(99);
    const duplicate = createNarrativeEntry();
    const candidate = createNarrativeEntry();

    class CustomNote {
      constructor(payload) {
        Object.assign(this, payload);
      }
    }

    const customPrototypeEntry = new CustomNote({
      id: 'alpha',
      meta: { score: 42 },
      tags: ['rogue'],
    });
    customPrototypeEntry.createdAt = new Date('2024-01-02T00:00:00.000Z');
    customPrototypeEntry.self = customPrototypeEntry;

    executionContext.evaluationContext.context = {
      story: {
        notes: [
          primitiveEntry,
          nestedArrayEntry,
          minimalObject,
          mismatchedKeys,
          variantScore,
          customPrototypeEntry,
          duplicate,
        ],
      },
    };

    handler.execute(
      {
        variable_path: 'story.notes',
        mode: 'push_unique',
        value: candidate,
        result_variable: 'last_operation',
      },
      executionContext
    );

    const updatedNotes =
      executionContext.evaluationContext.context.story.notes;

    expect(updatedNotes).toHaveLength(7);
    expect(updatedNotes[0]).toBe(primitiveEntry);
    expect(updatedNotes[1]).toEqual(nestedArrayEntry);
    expect(updatedNotes[1]).not.toBe(nestedArrayEntry);
    expect(updatedNotes[2]).toMatchObject({
      id: 'alpha',
      meta: { score: 42 },
    });
    expect(updatedNotes[3]).toHaveProperty('other', 'mismatch');
    expect(updatedNotes[4].meta.score).toBe(99);
    expect(updatedNotes[6]).toEqual(duplicate);
    expect(updatedNotes[6]).not.toBe(duplicate);

    expect(
      executionContext.evaluationContext.context.last_operation
    ).toBe(updatedNotes);
    expect(env.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Value: [unable to stringify].')
    );
    expect(systemErrorEvents).toHaveLength(0);
  });

  test('remove_by_value leverages deep equality to remove complex payloads', () => {
    const createMember = (id, xp) => {
      const createdAt = new Date('2024-02-01T15:30:00.000Z');
      const member = {
        id,
        traits: {
          stats: { xp },
          badges: ['veteran', { detail: 'scout' }],
        },
        createdAt,
      };
      member.self = member;
      member.traits.owner = member;
      member.traits.stats.milestones = [
        { stage: 'intro', notes: ['start'] },
        { stage: 'climax', notes: ['peak'] },
      ];
      member.traits.stats.milestones[1].loop =
        member.traits.stats.milestones;
      return member;
    };

    const memberToRemove = createMember('member-2', 15);
    const memberCloneForRemoval = createMember('member-2', 15);
    const memberMismatch = createMember('member-2', 20);
    const supportingMember = createMember('member-3', 30);

    executionContext.evaluationContext.context = {
      roster: {
        members: [memberToRemove, supportingMember],
      },
    };

    handler.execute(
      {
        variable_path: 'roster.members',
        mode: 'remove_by_value',
        value: memberMismatch,
        result_variable: 'removal_result',
      },
      executionContext
    );

    let members =
      executionContext.evaluationContext.context.roster.members;

    expect(members).toHaveLength(2);
    expect(members[0]).toEqual(memberToRemove);
    expect(
      executionContext.evaluationContext.context.removal_result
    ).toEqual(members);
    expect(systemErrorEvents).toHaveLength(0);

    handler.execute(
      {
        variable_path: 'roster.members',
        mode: 'remove_by_value',
        value: memberCloneForRemoval,
        result_variable: 'removal_result',
      },
      executionContext
    );

    members =
      executionContext.evaluationContext.context.roster.members;

    expect(members).toHaveLength(1);
    expect(members[0]).toEqual(supportingMember);
    expect(
      executionContext.evaluationContext.context.removal_result
    ).toEqual(members);
    expect(systemErrorEvents).toHaveLength(0);
  });

  test('falls back to handler logger when execution context lacks a logger', () => {
    const contextWithoutLogger = createExecutionContext(env);
    delete contextWithoutLogger.logger;

    handler.execute(
      {
        variable_path: 'story.notes',
        mode: 'push_unique',
        value: 'fallback',
      },
      contextWithoutLogger
    );

    expect(env.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("MODIFY_CONTEXT_ARRAY: Performing 'push_unique' on context variable 'story.notes'.")
    );
  });
});

describe('arrayModifyUtils integration with ConsoleLogger', () => {
  let logger;

  beforeEach(() => {
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    logger = new ConsoleLogger(LogLevel.DEBUG);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('advancedArrayModify logs an error when provided array input is invalid', () => {
    const errorSpy = jest.spyOn(logger, 'error');
    const outcome = advancedArrayModify('push', 'not-an-array', { id: 'x' }, logger);

    expect(outcome).toEqual({
      nextArray: 'not-an-array',
      result: undefined,
      modified: false,
    });
    expect(errorSpy).toHaveBeenCalledWith(
      'advancedArrayModify: provided value is not an array'
    );
  });

  test('applyArrayModification and advancedArrayModify fall back on unknown modes', () => {
    const errorSpy = jest.spyOn(logger, 'error');
    const base = ['alpha'];

    const modified = applyArrayModification('mystery-mode', base, 'beta', logger);
    expect(modified).toBe(base);
    expect(errorSpy).toHaveBeenCalledWith('Unknown mode: mystery-mode');

    errorSpy.mockClear();
    const advancedResult = advancedArrayModify('obscure-mode', base, 'beta', logger);
    expect(advancedResult).toEqual({
      nextArray: base,
      result: undefined,
      modified: false,
    });
    expect(errorSpy).toHaveBeenCalledWith('Unknown mode: obscure-mode');
  });
});
