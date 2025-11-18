import { describe, it, beforeEach, expect } from '@jest/globals';
import ActionSequenceService from '../../../src/logic/actionSequenceService.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';

/**
 *
 */
function createTestLogger() {
  const entries = { debug: [], info: [], warn: [], error: [] };
  return {
    entries,
    debug: (...args) => entries.debug.push(args),
    info: (...args) => entries.info.push(args),
    warn: (...args) => entries.warn.push(args),
    error: (...args) => entries.error.push(args),
  };
}

/**
 *
 * @param registry
 */
function registerDefaultOperations(registry) {
  registry.register('STORE_LOG', async (params, executionContext) => {
    const log = executionContext.evaluationContext.context.executionLog;
    log.push(params.label);
    return { success: true };
  });

  registry.register('APPLY_INCREMENT', async (params, executionContext) => {
    const store = executionContext.evaluationContext.context;
    const amount = Number(params.amount ?? 0);
    store.total += amount;
    return { success: true };
  });

  registry.register('FAIL_OPERATION', async () => {
    throw new Error('Deliberate failure');
  });
}

/**
 *
 * @param root0
 * @param root0.items
 * @param root0.shouldProcess
 */
function createEnvironment({ items = [1, 2, 3], shouldProcess = true } = {}) {
  const baseLogger = createTestLogger();

  const registry = new OperationRegistry({ logger: baseLogger });
  registerDefaultOperations(registry);

  const interpreter = new OperationInterpreter({
    logger: baseLogger,
    operationRegistry: registry,
  });

  const jsonLogicService = new JsonLogicEvaluationService({
    logger: baseLogger,
    gameDataRepository: { getConditionDefinition: () => null },
  });

  const service = new ActionSequenceService({
    logger: baseLogger,
    operationInterpreter: interpreter,
  });

  const evaluationContext = {
    context: {
      shouldProcess,
      items: [...items],
      total: 0,
      executionLog: [],
      flagSource: 'alpha',
    },
  };

  const baseContext = {
    jsonLogic: jsonLogicService,
    evaluationContext,
  };

  return {
    service,
    baseLogger,
    evaluationContext,
    baseContext,
  };
}

describe('ActionSequenceService integration with real modules', () => {
  let env;

  beforeEach(() => {
    env = createEnvironment();
  });

  it('executes nested control flow and json-logic driven operations end-to-end', async () => {
    const { service, baseContext, evaluationContext, baseLogger } = env;

    const sequence = {
      actions: [
        {
          type: 'STORE_LOG',
          parameters: { label: 'start-{context.flagSource}' },
        },
        {
          type: 'IF',
          parameters: {
            condition: { var: 'context.shouldProcess' },
            then_actions: [
              { type: 'STORE_LOG', parameters: { label: 'then-branch' } },
              {
                type: 'FOR_EACH',
                parameters: {
                  collection: 'context.items',
                  item_variable: 'currentItem',
                  actions: [
                    {
                      type: 'APPLY_INCREMENT',
                      parameters: { amount: { var: 'context.currentItem' } },
                    },
                    {
                      type: 'STORE_LOG',
                      parameters: {
                        label: { cat: ['loop-', { var: 'context.currentItem' }] },
                      },
                    },
                  ],
                },
              },
            ],
            else_actions: [{ type: 'STORE_LOG', parameters: { label: 'else-branch' } }],
          },
        },
        { type: 'STORE_LOG', parameters: { label: 'end' } },
      ],
    };

    await service.execute(sequence, baseContext);

    expect(evaluationContext.context.total).toBe(6);
    expect(evaluationContext.context.executionLog).toEqual([
      'start-alpha',
      'then-branch',
      'loop-1',
      'loop-2',
      'loop-3',
      'end',
    ]);

    const debugMessages = baseLogger.entries.debug.map((entry) => entry[0]);
    expect(
      debugMessages.some((message) =>
        message.includes('ActionSequenceService: Executing sequence with 3 actions')
      )
    ).toBe(true);
    expect(
      debugMessages.some((message) =>
        message.includes('[ActionSequence] Starting sequence: ActionSequenceService (3 actions)')
      )
    ).toBe(true);
  });

  it('logs failures from executeActionSequence when operations throw', async () => {
    const { service, baseContext, evaluationContext, baseLogger } = env;

    const failingSequence = {
      actions: [
        { type: 'STORE_LOG', parameters: { label: 'before-failure' } },
        { type: 'FAIL_OPERATION', parameters: {} },
      ],
    };

    await expect(service.execute(failingSequence, baseContext)).rejects.toThrow(
      'Deliberate failure'
    );

    expect(evaluationContext.context.executionLog).toEqual(['before-failure']);
    const lastErrorEntry = baseLogger.entries.error.at(-1);
    expect(lastErrorEntry?.[0]).toContain('ActionSequenceService: Sequence execution failed');
    expect(lastErrorEntry?.[1]).toBeInstanceOf(Error);
  });

  it('validates sequence structure and execution context', async () => {
    const { service, baseContext } = env;

    await expect(
      service.execute({ notActions: [] }, baseContext)
    ).rejects.toThrow('ActionSequenceService.execute: sequence must have an actions array');

    await expect(
      service.execute({ actions: [] }, null)
    ).rejects.toThrow('ActionSequenceService.execute: context is required');
  });
});
