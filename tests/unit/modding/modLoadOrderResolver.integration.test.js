import ModLoadOrderResolver from '../../../src/modding/modLoadOrderResolver.js';
import ModDependencyError from '../../../src/errors/modDependencyError.js';

describe('ModLoadOrderResolver integration', () => {
  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  it('can be instantiated and resolves simple order', () => {
    const resolver = new ModLoadOrderResolver(mockLogger);
    const manifests = new Map([
      ['a', { id: 'a', dependencies: [{ id: 'b', required: true }] }],
      ['b', { id: 'b' }],
    ]);
    const order = resolver.resolve(['a', 'b'], manifests);
    // b must come before a
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('a'));
  });

  it('throws on dependency cycle', () => {
    const resolver = new ModLoadOrderResolver(mockLogger);
    const manifests = new Map([
      ['a', { id: 'a', dependencies: [{ id: 'b', required: true }] }],
      ['b', { id: 'b', dependencies: [{ id: 'a', required: true }] }],
    ]);
    expect(() => resolver.resolve(['a', 'b'], manifests)).toThrow(ModDependencyError);
  });
}); 