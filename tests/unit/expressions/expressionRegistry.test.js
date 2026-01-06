import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import ExpressionRegistry from '../../../src/expressions/expressionRegistry.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const buildRegistry = (expressions) => {
  const dataRegistry = new InMemoryDataRegistry({ logger });
  for (const expression of expressions) {
    dataRegistry.store('expressions', expression.id, expression);
  }
  return new ExpressionRegistry({ dataRegistry, logger });
};

describe('ExpressionRegistry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should retrieve all expressions from data registry', () => {
    const registry = buildRegistry([
      { id: 'core:one', priority: 10 },
      { id: 'core:two', priority: 20 },
    ]);

    const all = registry.getAllExpressions();
    expect(all).toHaveLength(2);
    expect(all.map((expression) => expression.id).sort()).toEqual([
      'core:one',
      'core:two',
    ]);
  });

  test('should return null for non-existent expression ID', () => {
    const registry = buildRegistry([{ id: 'core:exists', priority: 10 }]);
    expect(registry.getExpression('core:missing')).toBeNull();
  });

  test('should return expression by valid ID', () => {
    const registry = buildRegistry([{ id: 'core:exists', priority: 10 }]);
    expect(registry.getExpression('core:exists')).toEqual(
      expect.objectContaining({ id: 'core:exists' })
    );
  });

  test('should return null for invalid expression IDs', () => {
    const registry = buildRegistry([{ id: 'core:exists', priority: 10 }]);

    expect(registry.getExpression('')).toBeNull();
    expect(registry.getExpression('   ')).toBeNull();
    expect(registry.getExpression(null)).toBeNull();
  });

  test('should return expressions filtered by tag', () => {
    const registry = buildRegistry([
      { id: 'core:angry', priority: 10, tags: ['anger', 'frustration'] },
      { id: 'core:sad', priority: 20, tags: ['sadness'] },
      { id: 'core:raging', priority: 30, tags: ['anger'] },
    ]);

    const anger = registry.getExpressionsByTag('anger');
    expect(anger.map((expression) => expression.id).sort()).toEqual([
      'core:angry',
      'core:raging',
    ]);
    expect(registry.getExpressionsByTag('missing')).toEqual([]);
  });

  test('should return empty array for invalid tags', () => {
    const registry = buildRegistry([
      { id: 'core:angry', priority: 10, tags: ['anger'] },
    ]);

    expect(registry.getExpressionsByTag('')).toEqual([]);
    expect(registry.getExpressionsByTag('   ')).toEqual([]);
    expect(registry.getExpressionsByTag(null)).toEqual([]);
  });

  test('should return expressions sorted by priority descending', () => {
    const registry = buildRegistry([
      { id: 'core:low', priority: 10 },
      { id: 'core:alpha', priority: 80 },
      { id: 'core:beta', priority: 80 },
    ]);

    expect(registry.getExpressionsByPriority().map((exp) => exp.id)).toEqual([
      'core:alpha',
      'core:beta',
      'core:low',
    ]);
  });

  test('should handle empty registry gracefully', () => {
    const dataRegistry = new InMemoryDataRegistry({ logger });
    const registry = new ExpressionRegistry({ dataRegistry, logger });

    expect(registry.getAllExpressions()).toEqual([]);
    expect(registry.getExpressionsByTag('anger')).toEqual([]);
    expect(registry.getExpressionsByPriority()).toEqual([]);
    expect(logger.warn).toHaveBeenCalled();
  });

  test('should build tag index correctly', () => {
    const registry = buildRegistry([
      { id: 'core:multi', priority: 10, tags: ['anger', 'fear'] },
    ]);

    expect(registry.getExpressionsByTag('anger')).toHaveLength(1);
    expect(registry.getExpressionsByTag('fear')).toHaveLength(1);
  });

  test('should validate dependencies in constructor', () => {
    const dataRegistry = new InMemoryDataRegistry({ logger });

    expect(() => new ExpressionRegistry({ dataRegistry, logger: null })).toThrow(
      'Missing required dependency: logger.'
    );
    expect(() => new ExpressionRegistry({ dataRegistry: null, logger })).toThrow(
      'Missing required dependency'
    );
  });

  test('should cache expressions after first access', () => {
    const dataRegistry = {
      getAll: jest.fn().mockReturnValue([
        { id: 'core:cached', priority: 10 },
      ]),
    };
    const registry = new ExpressionRegistry({ dataRegistry, logger });

    expect(registry.getAllExpressions()).toHaveLength(1);
    expect(registry.getExpressionsByPriority()).toHaveLength(1);
    expect(dataRegistry.getAll).toHaveBeenCalledTimes(1);
  });
});
