import { describe, it, expect } from '@jest/globals';
import { getComponent } from '../../src/utils/componentAccessUtils.js';

class MockEntity {
  constructor(data = {}) {
    this._data = data;
  }

  getComponentData(id) {
    if (id in this._data) {
      return this._data[id];
    }
    return undefined;
  }
}

describe('getComponent', () => {
  it('returns component data when present', () => {
    const ent = new MockEntity({ foo: { a: 1 } });
    expect(getComponent(ent, 'foo')).toEqual({ a: 1 });
  });

  it('returns null when component missing', () => {
    const ent = new MockEntity();
    expect(getComponent(ent, 'foo')).toBeNull();
  });

  it('returns null for invalid entity', () => {
    expect(getComponent(null, 'foo')).toBeNull();
    expect(getComponent({}, 'foo')).toBeNull();
  });

  it('returns null for invalid componentId', () => {
    const ent = new MockEntity({ foo: { a: 1 } });
    expect(getComponent(ent, '')).toBeNull();
    // @ts-ignore - purposely pass non-string
    expect(getComponent(ent, null)).toBeNull();
  });

  it('returns null when getComponentData throws', () => {
    const ent = {
      getComponentData() {
        throw new Error('boom');
      },
    };
    expect(getComponent(ent, 'foo')).toBeNull();
  });
});
