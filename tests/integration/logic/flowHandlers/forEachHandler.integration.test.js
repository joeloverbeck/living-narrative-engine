import { beforeEach, describe, expect, test } from '@jest/globals';
import OperationRegistry from '../../../../src/logic/operationRegistry.js';
import OperationInterpreter from '../../../../src/logic/operationInterpreter.js';
import { executeActionSequence } from '../../../../src/logic/actionSequence.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';

/**
 *
 */
function createTestLogger() {
  const entries = [];
  const logger = {
    debug: (...args) => entries.push({ level: 'debug', args }),
    info: (...args) => entries.push({ level: 'info', args }),
    warn: (...args) => entries.push({ level: 'warn', args }),
    error: (...args) => entries.push({ level: 'error', args }),
  };
  return { logger, entries };
}

/**
 *
 * @param logger
 * @param contextOverrides
 */
function buildExecutionContext(logger, contextOverrides) {
  const evaluationContext = {
    event: { type: 'test:event', payload: null },
    actor: null,
    target: null,
    context: { ...contextOverrides },
  };
  return {
    evaluationContext,
    executionContext: {
      evaluationContext,
      entityManager: { getEntity: () => null },
      validatedEventDispatcher: { dispatch: () => {} },
      logger,
    },
  };
}

const createNestedAction = () => ({
  type: 'CAPTURE_ITEM',
  parameters: { listKey: 'processed' },
});

describe('handleForEach integration', () => {
  let logger;
  let logEntries;
  let operationRegistry;
  let operationInterpreter;
  let jsonLogic;

  beforeEach(() => {
    const testLogger = createTestLogger();
    logger = testLogger.logger;
    logEntries = testLogger.entries;

    operationRegistry = new OperationRegistry({ logger });
    operationInterpreter = new OperationInterpreter({
      logger,
      operationRegistry,
    });
    jsonLogic = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: { getConditionDefinition: () => null },
    });

    operationRegistry.register('CAPTURE_ITEM', ({ listKey }, ctx) => {
      const target = ctx.evaluationContext.context[listKey];
      target.push(ctx.evaluationContext.context.currentItem);
    });

    operationRegistry.register(
      'ACCUMULATE_QUANTITY',
      async ({ totalKey }, ctx) => {
        await Promise.resolve();
        ctx.evaluationContext.context[totalKey] +=
          ctx.evaluationContext.context.currentItem.quantity;
      }
    );
  });

  test('processes each item with the real interpreter and restores the loop variable', async () => {
    const items = [
      { id: 'apple', quantity: 2 },
      { id: 'bread', quantity: 3 },
      { id: 'cheese', quantity: 5 },
    ];
    const { evaluationContext, executionContext } = buildExecutionContext(
      logger,
      {
        items,
        processed: [],
        totalQuantity: 1,
        currentItem: 'preserve-me',
      }
    );

    await executeActionSequence(
      [
        {
          type: 'FOR_EACH',
          parameters: {
            collection: 'context.items',
            item_variable: 'currentItem',
            actions: [
              createNestedAction(),
              { type: 'ACCUMULATE_QUANTITY', parameters: { totalKey: 'totalQuantity' } },
            ],
          },
        },
      ],
      {
        ...executionContext,
        scopeLabel: 'CartProcessing',
        jsonLogic,
      },
      logger,
      operationInterpreter
    );

    expect(evaluationContext.context.processed).toEqual(items);
    expect(evaluationContext.context.totalQuantity).toBe(1 + 2 + 3 + 5);
    expect(evaluationContext.context.currentItem).toBe('preserve-me');
  });

  test('removes the loop variable when no prior value existed', async () => {
    const items = [
      { id: 'lily', quantity: 4 },
      { id: 'orchid', quantity: 6 },
    ];
    const { evaluationContext, executionContext } = buildExecutionContext(
      logger,
      {
        items,
        processed: [],
        totalQuantity: 0,
      }
    );

    await executeActionSequence(
      [
        {
          type: 'FOR_EACH',
          parameters: {
            collection: 'context.items',
            item_variable: 'currentItem',
            actions: [
              createNestedAction(),
              { type: 'ACCUMULATE_QUANTITY', parameters: { totalKey: 'totalQuantity' } },
            ],
          },
        },
      ],
      {
        ...executionContext,
        scopeLabel: 'CartProcessing',
        jsonLogic,
      },
      logger,
      operationInterpreter
    );

    expect(evaluationContext.context.processed).toEqual(items);
    expect(evaluationContext.context.totalQuantity).toBe(4 + 6);
    expect('currentItem' in evaluationContext.context).toBe(false);
  });

  test.each([
    {
      name: 'missing collection path',
      parameters: () => ({
        collection: '   ',
        item_variable: 'currentItem',
        actions: [createNestedAction()],
      }),
    },
    {
      name: 'missing item variable',
      parameters: () => ({
        collection: 'context.items',
        item_variable: '   ',
        actions: [createNestedAction()],
      }),
    },
    {
      name: 'actions not array',
      parameters: () => ({
        collection: 'context.items',
        item_variable: 'currentItem',
        actions: { type: 'CAPTURE_ITEM' },
      }),
    },
    {
      name: 'actions empty array',
      parameters: () => ({
        collection: 'context.items',
        item_variable: 'currentItem',
        actions: [],
      }),
    },
  ])('warns and skips when parameters invalid (%s)', async ({ parameters }) => {
    const { evaluationContext, executionContext } = buildExecutionContext(logger, {
      items: [{ id: 'alpha', quantity: 1 }],
      processed: [],
      totalQuantity: 0,
      currentItem: 'original',
    });

    await executeActionSequence(
      [
        {
          type: 'FOR_EACH',
          parameters: parameters(),
        },
      ],
      {
        ...executionContext,
        scopeLabel: 'InvalidLoop',
        jsonLogic,
      },
      logger,
      operationInterpreter
    );

    expect(evaluationContext.context.processed).toEqual([]);
    expect(evaluationContext.context.currentItem).toBe('original');
    expect(
      logEntries.some(
        (entry) =>
          entry.level === 'warn' &&
          entry.args[0] === 'InvalidLoop FOR_EACH#1: invalid parameters.'
      )
    ).toBe(true);
  });

  test('throws TypeError when collection parameter is not a string', async () => {
    const { executionContext } = buildExecutionContext(logger, {
      items: [{ id: 'alpha', quantity: 1 }],
      processed: [],
      totalQuantity: 0,
      currentItem: 'original',
    });

    await expect(
      executeActionSequence(
        [
          {
            type: 'FOR_EACH',
            parameters: undefined, // Missing parameters object means collection is undefined
          },
        ],
        {
          ...executionContext,
          scopeLabel: 'InvalidLoop',
          jsonLogic,
        },
        logger,
        operationInterpreter
      )
    ).rejects.toThrow(TypeError);
  });

  test('warns when the collection path does not resolve to an array', async () => {
    const { evaluationContext, executionContext } = buildExecutionContext(logger, {
      items: { apple: { quantity: 4 } },
      processed: [],
      totalQuantity: 10,
      currentItem: 'still-here',
    });

    await executeActionSequence(
      [
        {
          type: 'FOR_EACH',
          parameters: {
            collection: 'context.items',
            item_variable: 'currentItem',
            actions: [createNestedAction()],
          },
        },
      ],
      {
        ...executionContext,
        scopeLabel: 'CartProcessing',
        jsonLogic,
      },
      logger,
      operationInterpreter
    );

    expect(evaluationContext.context.processed).toEqual([]);
    expect(evaluationContext.context.totalQuantity).toBe(10);
    expect(evaluationContext.context.currentItem).toBe('still-here');
    expect(
      logEntries.some(
        (entry) =>
          entry.level === 'warn' &&
          entry.args[0] ===
            "CartProcessing FOR_EACH#1: 'context.items' did not resolve to an array."
      )
    ).toBe(true);
  });
});
