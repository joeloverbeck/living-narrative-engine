import { describe, it, beforeEach, expect } from '@jest/globals';
import MathHandler from '../../../../src/logic/operationHandlers/mathHandler.js';
import EventBus from '../../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../../src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import { GameDataRepository } from '../../../../src/data/gameDataRepository.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/systemEventIds.js';

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

const noopSchemaValidator = {
  isSchemaLoaded: () => true,
  validate: () => ({ isValid: true, errors: [] }),
};

const flushAsync = () => new Promise((resolve) => setImmediate(resolve));

describe('MathHandler integration coverage', () => {
  let logger;
  let eventBus;
  let safeEventDispatcher;
  let handler;
  let receivedEvents;

  const createExecutionContext = (contextOverrides = {}) => ({
    evaluationContext: {
      context: {
        ...contextOverrides,
      },
    },
    logger,
  });

  beforeEach(() => {
    logger = new TestLogger();
    eventBus = new EventBus({ logger });
    const registry = new InMemoryDataRegistry({ logger });
    const gameDataRepository = new GameDataRepository(registry, logger);

    const validatedEventDispatcher = new ValidatedEventDispatcher({
      eventBus,
      gameDataRepository,
      schemaValidator: noopSchemaValidator,
      logger,
    });

    safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher,
      logger,
    });

    receivedEvents = [];
    eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, (event) => {
      receivedEvents.push(event);
    });

    handler = new MathHandler({
      logger,
      safeEventDispatcher,
    });
  });

  it('evaluates nested expressions and writes results using real dependencies', async () => {
    const executionContext = createExecutionContext({
      values: {
        a: 10,
        b: 6,
        c: 1,
        d: 12,
      },
    });

    handler.execute(
      {
        result_variable: 'mathResult',
        expression: {
          operator: 'multiply',
          operands: [
            {
              operator: 'add',
              operands: [
                { var: 'context.values.a' },
                {
                  operator: 'subtract',
                  operands: [
                    { var: 'context.values.b' },
                    { var: 'context.values.c' },
                  ],
                },
              ],
            },
            {
              operator: 'divide',
              operands: [{ var: 'context.values.d' }, 3],
            },
          ],
        },
      },
      executionContext
    );

    expect(executionContext.evaluationContext.context.mathResult).toBe(60);
    expect(logger.warnMessages).toHaveLength(0);
    expect(receivedEvents).toHaveLength(0);

    handler.execute(
      {
        result_variable: 'modResult',
        expression: { operator: 'modulo', operands: [7, 3] },
      },
      executionContext
    );

    expect(executionContext.evaluationContext.context.modResult).toBe(1);
  });

  it('handles division/modulo by zero and unknown operators gracefully', async () => {
    const executionContext = createExecutionContext();

    handler.execute(
      {
        result_variable: 'divZero',
        expression: { operator: 'divide', operands: [8, 0] },
      },
      executionContext
    );

    handler.execute(
      {
        result_variable: 'modZero',
        expression: { operator: 'modulo', operands: [9, 0] },
      },
      executionContext
    );

    handler.execute(
      {
        result_variable: 'unknownOp',
        expression: { operator: 'power', operands: [2, 3] },
      },
      executionContext
    );

    handler.execute(
      {
        result_variable: 'invalidOperand',
        expression: { operator: 'add', operands: ['not-number', 4] },
      },
      executionContext
    );

    expect(executionContext.evaluationContext.context.divZero).toBeNull();
    expect(executionContext.evaluationContext.context.modZero).toBeNull();
    expect(executionContext.evaluationContext.context.unknownOp).toBeNull();
    expect(
      executionContext.evaluationContext.context.invalidOperand
    ).toBeNull();
    const warningMessages = logger.warnMessages.map(({ message }) => message);
    expect(warningMessages).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Division by zero'),
        expect.stringContaining('Modulo by zero'),
        expect.stringContaining("Unknown operator 'power'"),
        expect.stringContaining('operands must resolve to numbers'),
        expect.stringContaining(
          'expression did not resolve to a numeric result'
        ),
      ])
    );
  });

  it('dispatches system errors when operand resolution throws and ensures context writes are skipped', async () => {
    const executionContext = createExecutionContext({
      trouble: {
        get value() {
          throw new Error('resolver failure');
        },
      },
    });

    handler.execute(
      {
        result_variable: 'errorCase',
        expression: {
          operator: 'add',
          operands: [{ var: 'context.trouble.value' }, 1],
        },
      },
      executionContext
    );

    await flushAsync();

    expect(receivedEvents.length).toBeGreaterThanOrEqual(1);
    const errorEvent = receivedEvents.find((event) =>
      event.payload.message.includes('MATH: Error resolving variable operand')
    );
    expect(errorEvent).toBeDefined();
    expect(executionContext.evaluationContext.context.errorCase).toBeNull();
  });

  it('validates parameters and missing evaluation contexts using real dispatcher', async () => {
    const executionContext = createExecutionContext();

    handler.execute(null, executionContext);
    handler.execute(
      {
        result_variable: '  ',
        expression: { operator: 'add', operands: [1, 1] },
      },
      executionContext
    );
    handler.execute(
      { result_variable: 'noExpr', expression: null },
      executionContext
    );

    handler.execute(
      {
        result_variable: 'missingCtx',
        expression: { operator: 'add', operands: [1, 2] },
      },
      { logger }
    );

    await flushAsync();

    expect(logger.warnMessages.map(({ message }) => message)).toEqual(
      expect.arrayContaining([
        'MATH: params missing or invalid.',
        'MATH: "result_variable" must be a non-empty string.',
        'MATH: "expression" must be an object.',
      ])
    );
    expect(
      receivedEvents.some((event) => event.type === SYSTEM_ERROR_OCCURRED_ID)
    ).toBe(true);
  });
});
