import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import ExpressionRegistry from '../../../src/expressions/expressionRegistry.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createDataRegistry = (expressions) => ({
  getAll: jest.fn().mockReturnValue(expressions),
});

describe('ExpressionRegistry', () => {
  let logger;

  beforeEach(() => {
    logger = createLogger();
  });

  it('logs info when building the cache', () => {
    const dataRegistry = createDataRegistry([
      { id: 'expr:one' },
      { id: 'expr:two' },
    ]);
    const registry = new ExpressionRegistry({ dataRegistry, logger });

    registry.getExpressionsByPriority();

    expect(logger.info).toHaveBeenCalledWith(
      'ExpressionRegistry: loaded 2 expressions'
    );
  });

  it('logs once for the initial cache build', () => {
    const dataRegistry = createDataRegistry([{ id: 'expr:one' }]);
    const registry = new ExpressionRegistry({ dataRegistry, logger });

    registry.getExpressionsByPriority();
    registry.getAllExpressions();

    expect(logger.info).toHaveBeenCalledTimes(1);
  });
});
