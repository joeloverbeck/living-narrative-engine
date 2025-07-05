import { describe, it, expect, jest } from '@jest/globals';
import { StructureResolver } from '../../../src/utils/structureResolver.js';

const resolvePath = (obj, path) =>
  path.split('.').reduce((o, p) => (o ? o[p] : undefined), obj);

/**
 * Create a mock logger for the resolver tests.
 *
 * @returns {{warn: jest.Mock, debug: jest.Mock}} Mock logger
 */
function createLogger() {
  return { warn: jest.fn(), debug: jest.fn() };
}

describe('StructureResolver uncovered branches', () => {
  it('handles non-object sources without calling resolvePath', () => {
    const logger = createLogger();
    const resolve = jest.fn();
    const resolver = new StructureResolver(resolve, logger);

    const result = resolver._resolveFromSources({ key: 'foo' }, [null, 'bar']);

    expect(result).toBeUndefined();
    expect(resolve).not.toHaveBeenCalled();
  });

  it('returns property value when parent has key but value is undefined', () => {
    const logger = createLogger();
    const resolver = new StructureResolver(resolvePath, logger);
    const source = { parent: { child: undefined } };

    const result = resolver._resolveFromSources({ key: 'parent.child' }, [
      source,
    ]);

    expect(result).toBeUndefined();
  });

  it('skips inherited properties when resolving objects', () => {
    const logger = createLogger();
    const resolver = new StructureResolver(resolvePath, logger);
    const proto = { inherited: 'x' };
    const obj = Object.create(proto);
    obj.own = 'y';

    const spy = jest.spyOn(resolver, '_resolveObjectEntry');
    const { changed, value } = resolver._resolveObject(obj, [{}], new Set());

    expect(changed).toBe(false);
    expect(value).toBe(obj);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('uses skip keys when provided as a Set', () => {
    const logger = createLogger();
    const resolver = new StructureResolver(resolvePath, logger);
    const input = { a: '{foo}', b: '{bar}' };
    const context = { foo: 'x', bar: 'y' };
    const result = resolver.resolveStructure(
      input,
      context,
      {},
      new Set(['b'])
    );
    expect(result).toEqual({ a: 'x', b: '{bar}' });
  });

  it('defaults to an empty Set when skipKeys is not an array or Set', () => {
    const logger = createLogger();
    const resolver = new StructureResolver(resolvePath, logger);
    const input = { a: '{foo}' };
    const context = { foo: 'x' };
    const result = resolver.resolveStructure(input, context, {}, null);
    expect(result).toEqual({ a: 'x' });
  });
});
