import { describe, it, expect, jest } from '@jest/globals';
import { StructureResolver } from '../../../src/utils/structureResolver.js';

const resolvePath = (obj, path) =>
  path.split('.').reduce((o, p) => (o ? o[p] : undefined), obj);

/**
 * Helper to create a mock logger used in tests.
 *
 * @returns {{warn: jest.Mock, debug: jest.Mock}} Mock logger
 */
function createLogger() {
  return { warn: jest.fn(), debug: jest.fn() };
}

describe('StructureResolver', () => {
  it('replaces placeholders within strings and logs debug output when missing', () => {
    const logger = createLogger();
    const resolver = new StructureResolver(resolvePath, logger);
    const result1 = resolver.resolve('hello {user.name}', {
      user: { name: 'Bob' },
    });
    expect(result1).toBe('hello Bob');
    expect(logger.warn).not.toHaveBeenCalled();

    logger.warn.mockClear();
    logger.debug.mockClear();

    resolver.resolve('hello {user.age}', { user: { name: 'Bob' } });
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(logger.debug.mock.calls[0][0]).toContain('user.age');
  });

  it('supports optional placeholders without warnings', () => {
    const logger = createLogger();
    const resolver = new StructureResolver(resolvePath, logger);
    const result = resolver.resolve('hi {user.missing?}', { user: {} });
    expect(result).toBe('hi ');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('handles arrays, objects, fallback context and skip keys', () => {
    const logger = createLogger();
    const resolver = new StructureResolver(resolvePath, logger);
    const input = {
      name: '{user.name}',
      details: { age: '{user.age}' },
      list: ['{fallback}', '{user.name}'],
    };
    const context = { user: { name: 'Alice' } };
    const fallback = { fallback: 'x', user: { age: 42 } };
    const result = resolver.resolveStructure(input, context, fallback, [
      'details',
    ]);
    expect(result).toEqual({
      name: 'Alice',
      details: { age: '{user.age}' },
      list: ['x', 'Alice'],
    });
  });

  it('logs debug output for embedded replacements', () => {
    const logger = createLogger();
    const resolver = new StructureResolver(resolvePath, logger);
    const str = 'name {user.name} age {user.age}';
    const result = resolver.resolveStructure(str, {
      user: { name: 'Tom', age: 5 },
    });
    expect(result).toBe('name Tom age 5');
    // ensure debug called for each placeholder
    expect(logger.debug).toHaveBeenCalledTimes(2);
  });
});
