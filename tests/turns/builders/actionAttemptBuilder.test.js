// tests/builders/attemptActionBuilder.spec.js

import { mock } from 'jest-mock-extended';
import { describe, beforeEach, it, expect } from '@jest/globals';
import { AttemptActionBuilder } from '../../../src/turns/builders/actionAttemptBuilder.js';

describe('AttemptActionBuilder', () => {
  let logger;
  let childLogger;
  let builder;

  const actorId = 'actor1';
  const composite = {
    index: 1,
    actionId: 'testAction',
    params: { foo: 'bar', nested: { a: 1 } },
    description: 'A test action',
  };

  beforeEach(() => {
    // 1) Create mocks
    logger = mock();
    childLogger = mock();

    // 2) Wire up child logger and spy on info()
    logger.child.mockReturnValue(childLogger);
    childLogger.info = jest.fn();

    // 3) Instantiate builder under test
    builder = new AttemptActionBuilder(logger);
  });

  it('build() output matches snapshot for a sample composite', () => {
    const result = builder.build(actorId, composite);
    expect(result).toMatchSnapshot();
  });

  it('mutation attempt on returned payload does not affect original composite', () => {
    const result = builder.build(actorId, composite);

    // Mutate the returned params
    result.params.foo = 'changed';
    result.params.nested.a = 2;

    // Original composite.params should remain untouched
    expect(composite.params.foo).toBe('bar');
    expect(composite.params.nested.a).toBe(1);
  });

  it('logger mock receives the expected formatted message', () => {
    const result = builder.build(actorId, composite);

    // Logger.child must be called with the index
    expect(logger.child).toHaveBeenCalledWith({ idx: composite.index });

    // Construct expected log string
    const expectedMessage =
      `actor=${actorId} ` +
      `idx=${composite.index} ` +
      `actionId=${composite.actionId} ` +
      `params=${JSON.stringify(result.params)} ` +
      `description="${composite.description}"`;

    // Verify info() got exactly that
    expect(childLogger.info).toHaveBeenCalledWith(expectedMessage);
  });
});
