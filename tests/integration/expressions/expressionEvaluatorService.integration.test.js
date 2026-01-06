/**
 * @file Integration tests for ExpressionEvaluatorService.
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import { registerExpressionServices } from '../../../src/dependencyInjection/registrations/expressionsRegistrations.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('ExpressionEvaluatorService - Integration', () => {
  let testBed;
  let container;
  let dataRegistry;
  let evaluator;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();

    container = testBed.container;
    registerExpressionServices(container);

    dataRegistry = container.resolve(tokens.IDataRegistry);
    evaluator = container.resolve(tokens.IExpressionEvaluatorService);
  });

  afterEach(async () => {
    if (testBed) {
      await testBed.cleanup();
    }
  });

  it('returns the highest-priority match from the registry ordering', () => {
    const lowPriority = {
      id: 'test:low-priority',
      priority: 1,
      prerequisites: [{ logic: { '==': [1, 1] } }],
    };
    const highPriority = {
      id: 'test:high-priority',
      priority: 10,
      prerequisites: [{ logic: { '==': [2, 2] } }],
    };

    dataRegistry.store('expressions', lowPriority.id, lowPriority);
    dataRegistry.store('expressions', highPriority.id, highPriority);

    const result = evaluator.evaluate({});
    expect(result).toEqual(highPriority);
  });

  it('treats missing condition references as non-matches without throwing', () => {
    const expression = {
      id: 'test:missing-condition',
      priority: 5,
      prerequisites: [{ logic: { condition_ref: 'cond:missing' } }],
    };

    dataRegistry.store('expressions', expression.id, expression);

    let result = null;
    expect(() => {
      result = evaluator.evaluate({});
    }).not.toThrow();
    expect(result).toBeNull();
  });
});
