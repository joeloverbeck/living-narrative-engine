import { describe, it, expect } from '@jest/globals';

import { createStrictProxy } from '../../common/strictObjectProxy.js';

describe('createStrictProxy', () => {
  it('returns existing properties and respects allowedUndefined list', () => {
    const target = { name: 'Ada', undefinedProp: undefined };
    const proxy = createStrictProxy(target, 'Scientist', ['optional']);

    expect(proxy.name).toBe('Ada');
    expect(proxy.undefinedProp).toBeUndefined();
    expect(proxy.optional).toBeUndefined();
  });

  it('allows access to constructor, prototype, __proto__, and symbol-like properties', () => {
    const sym = Symbol('token');
    const target = {
      constructor: function Constructor() {},
      prototype: { marker: true },
      toJSON: () => 'json',
      asymmetricMatch: () => true,
      nodeType: 1,
      $$typeof: 123,
      '@@identifier': 99,
    };
    Object.setPrototypeOf(target, { protoMarker: 'yes' });
    target[sym] = 'symbolic';

    const proxy = createStrictProxy(target, 'Special');

    expect(proxy.constructor).toBe(target.constructor);
    expect(proxy.prototype).toBe(target.prototype);
    expect(proxy.__proto__).toBe(Object.getPrototypeOf(target));
    expect(proxy[sym]).toBe('symbolic');
    expect(proxy.toJSON()).toBe('json');
    expect(proxy.asymmetricMatch()).toBe(true);
    expect(proxy.$$typeof).toBe(123);
    expect(proxy.nodeType).toBe(1);
    expect(proxy['@@identifier']).toBe(99);
  });

  it('throws descriptive error with closest property suggestion', () => {
    const target = { displayName: 'Evelyn', description: 'Agent' };
    const proxy = createStrictProxy(target, 'AgentProfile');

    expect(() => proxy.displayname).toThrow(
      "❌ Property 'displayname' does not exist on AgentProfile.\nAvailable properties: [displayName, description]\nDid you mean: displayName"
    );
  });

  it('provides N/A when there are no available properties to suggest', () => {
    const proxy = createStrictProxy({}, 'EmptyObject');

    expect(() => proxy.missing).toThrow(
      "❌ Property 'missing' does not exist on EmptyObject.\nAvailable properties: []\nDid you mean: N/A"
    );
  });

  it('uses default object name when none is provided', () => {
    const proxy = createStrictProxy({ present: 1 });

    let capturedError;
    try {
      // Trigger the proxy error while relying on the default object name
      // to appear in the message.

      proxy.absent;
    } catch (error) {
      capturedError = error;
    }

    expect(capturedError).toBeInstanceOf(Error);
    expect(capturedError.message).toContain(
      "❌ Property 'absent' does not exist on Object."
    );
    expect(capturedError.message).toContain('Available properties: [present]');
    expect(capturedError.message).toContain('Did you mean: present');
  });

  it('reports when no close match exists even if properties are present', () => {
    const target = { primary: 1, secondary: 2 };
    const proxy = createStrictProxy(target, 'TargetMap');

    expect(() => proxy.completelyDifferent).toThrow(
      "❌ Property 'completelyDifferent' does not exist on TargetMap.\nAvailable properties: [primary, secondary]\nDid you mean: N/A (no close matches)"
    );
  });
});
