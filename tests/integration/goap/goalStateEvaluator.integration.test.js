import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import GoalStateEvaluator from '../../../src/goap/goals/goalStateEvaluator.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { createEntityManagerAdapter } from '../../common/entities/entityManagerTestFactory.js';

function createTestLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe('GoalStateEvaluator integration', () => {
  let logger;
  let entityManager;
  let jsonLogicEvaluator;
  let evaluator;

  beforeEach(() => {
    logger = createTestLogger();
    entityManager = createEntityManagerAdapter({
      logger,
      initialEntities: [],
    });
    jsonLogicEvaluator = new JsonLogicEvaluationService({
      logger,
    });
    evaluator = new GoalStateEvaluator({
      logger,
      jsonLogicEvaluator,
      entityManager,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('evaluates goal state using real JSON logic and entity data', async () => {
    const actorId = 'actor:hero';
    await entityManager.addComponent(actorId, 'core:actor', { name: 'Hero' });
    await entityManager.addComponent(actorId, 'core:hunger', { value: 0 });

    const goalState = {
      '==': [{ var: 'actor.components.core:hunger.value' }, 0],
    };

    const result = evaluator.evaluate(goalState, actorId, {
      worldTick: 42,
    });

    expect(result).toBe(true);
  });

  it('returns false and logs an error when entity retrieval fails', async () => {
    const actorId = 'actor:missing';
    await entityManager.addComponent(actorId, 'core:actor', { name: 'Ghost' });

    entityManager.getEntityInstance = () => {
      throw new Error('entity repository unavailable');
    };

    const goalState = {
      '==': [{ var: 'actor.components.core:actor.name' }, 'Ghost'],
    };

    const result = evaluator.evaluate(goalState, actorId, {});

    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to evaluate goal state',
      expect.any(Error)
    );
  });

  it('returns Infinity and logs an error when distance calculation fails unexpectedly', () => {
    const goalState = { '==': [1, 1] };

    jest.spyOn(evaluator, 'evaluate').mockImplementation(() => {
      throw new Error('evaluation pipeline failure');
    });

    const result = evaluator.calculateDistance(goalState, 'actor:hero', {});

    expect(result).toBe(Infinity);
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to calculate distance',
      expect.any(Error)
    );
  });
});
