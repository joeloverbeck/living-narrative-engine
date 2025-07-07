import { describe, it, expect } from '@jest/globals';
import {
  getComponent,
  setComponent,
  resolveEntity,
} from '../../../src/entities/entityAccessService.js';

class MockEntity {
  constructor(data = {}) {
    this._data = data;
  }
  getComponentData(id) {
    return this._data[id];
  }
  addComponent(id, data) {
    this._data[id] = data;
  }
}

class MockManager {
  constructor(map = new Map()) {
    this._map = map;
  }
  getEntityInstance(id) {
    return this._map.get(id) || null;
  }
  getComponentData(entityId, componentId) {
    const ent = this._map.get(entityId);
    return ent ? ent.getComponentData(componentId) : undefined;
  }
}

describe('resolveEntity', () => {
  it('returns instance when given entity', () => {
    const ent = new MockEntity();
    expect(resolveEntity(ent, null)).toBe(ent);
  });

  it('resolves entity by id using manager', () => {
    const ent = new MockEntity();
    const mgr = new MockManager(new Map([['e1', ent]]));
    expect(resolveEntity('e1', mgr)).toBe(ent);
  });

  it('returns null for missing id', () => {
    const mgr = new MockManager();
    expect(resolveEntity('x', mgr)).toBeNull();
  });
});

describe('getComponent', () => {
  it('reads component from entity instance', () => {
    const ent = new MockEntity({ foo: { a: 1 } });
    expect(getComponent(ent, 'foo')).toEqual({ a: 1 });
  });

  it('reads component via manager', () => {
    const ent = new MockEntity({ foo: 2 });
    const mgr = new MockManager(new Map([['e1', ent]]));
    expect(getComponent('e1', 'foo', { entityManager: mgr })).toBe(2);
  });

  it('returns null for invalid component', () => {
    const ent = new MockEntity();
    expect(getComponent(ent, '')).toBeNull();
  });
});

describe('setComponent', () => {
  it('writes component to entity instance', () => {
    const ent = new MockEntity();
    expect(setComponent(ent, 'foo', 5)).toBe(true);
    expect(ent.getComponentData('foo')).toBe(5);
  });

  it('writes component via manager', () => {
    const ent = new MockEntity();
    const mgr = new MockManager(new Map([['e1', ent]]));
    expect(setComponent('e1', 'bar', 3, { entityManager: mgr })).toBe(true);
    expect(ent.getComponentData('bar')).toBe(3);
  });

  it('returns false when entity missing', () => {
    const mgr = new MockManager();
    expect(setComponent('missing', 'x', 1, { entityManager: mgr })).toBe(false);
  });
});
