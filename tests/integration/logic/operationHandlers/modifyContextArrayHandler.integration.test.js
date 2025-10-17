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
