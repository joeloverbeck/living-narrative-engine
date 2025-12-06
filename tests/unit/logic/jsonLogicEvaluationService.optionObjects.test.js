import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { HasPartSubTypeContainingOperator } from '../../../src/logic/operators/hasPartSubTypeContainingOperator.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

describe('JsonLogicEvaluationService option literal handling', () => {
  let logger;
  let service;
  let operator;
  let entityManager;
  let bodyGraphService;

  beforeEach(() => {
    logger = createMockLogger();
    service = new JsonLogicEvaluationService({ logger });

    entityManager = {
      getComponentData: jest.fn(),
    };

    bodyGraphService = {
      buildAdjacencyCache: jest.fn(),
      getAllParts: jest.fn(),
      getCacheNode: jest.fn(),
    };

    operator = new HasPartSubTypeContainingOperator({
      entityManager,
      bodyGraphService,
      logger,
    });

    service.addOperation(
      'hasPartSubTypeContaining',
      function registerHasPartSubTypeContaining(
        entityPath,
        substring,
        options
      ) {
        return operator.evaluate([entityPath, substring, options], this);
      }
    );
  });

  it('evaluates hasPartSubTypeContaining with matchAtEnd option objects without validation errors', () => {
    entityManager.getComponentData.mockReturnValue({ root: 'root-1' });
    bodyGraphService.buildAdjacencyCache.mockReturnValue(undefined);
    bodyGraphService.getAllParts.mockReturnValue(['part_heart']);
    bodyGraphService.getCacheNode.mockReturnValue({
      entityId: 'part_heart',
      partType: 'heart',
      parentId: 'root-1',
      children: [],
    });

    const operatorSpy = jest.spyOn(operator, 'evaluate');

    const rule = {
      hasPartSubTypeContaining: ['actor', 'ear', { matchAtEnd: true }],
    };
    const context = { actor: { id: 'actor-1' } };

    const result = service.evaluate(rule, context);

    expect(result).toBe(false);
    expect(operatorSpy).toHaveBeenCalledWith(
      ['actor', 'ear', expect.objectContaining({ matchAtEnd: true })],
      expect.objectContaining({ actor: context.actor })
    );

    const errorMessages = logger.error.mock.calls.map((call) => call[0]);
    expect(
      errorMessages.some(
        (message) =>
          typeof message === 'string' &&
          message.includes(
            "JSON Logic validation error: Disallowed operation 'matchAtEnd'"
          )
      )
    ).toBe(false);
  });
});
