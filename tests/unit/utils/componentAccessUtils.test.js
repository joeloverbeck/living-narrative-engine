import { describe, it, expect, jest } from '@jest/globals';
import {
  getComponentFromEntity,
  getComponentFromManager,
  resolveEntityInstance,
  readComponent,
  writeComponent,
} from '../../../src/utils/componentAccessUtils.js';
import {
  fetchComponent,
  applyComponent,
} from '../../../src/entities/utils/componentHelpers.js';
import { createMockLogger } from '../testUtils.js';

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

describe('getComponentFromEntity', () => {
  it('returns component data when present', () => {
    const ent = new MockEntity({ foo: { a: 1 } });
    expect(getComponentFromEntity(ent, 'foo')).toEqual({ a: 1 });
  });

  it('returns null when component missing', () => {
    const ent = new MockEntity();
    expect(getComponentFromEntity(ent, 'foo')).toBeNull();
  });

  it('logs debug for invalid entity', () => {
    const logger = createMockLogger();
    expect(getComponentFromEntity(null, 'foo', logger)).toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(
      '[componentAccessUtils] getComponentFromEntity: invalid entity or componentId.'
    );
  });

  it('logs debug when getComponentData throws', () => {
    const logger = createMockLogger();
    const ent = {
      getComponentData() {
        throw new Error('boom');
      },
    };
    expect(getComponentFromEntity(ent, 'foo', logger)).toBeNull();
    expect(logger.debug).toHaveBeenCalled();
  });

  it('returns null for invalid entity', () => {
    expect(getComponentFromEntity(null, 'foo')).toBeNull();
    expect(getComponentFromEntity({}, 'foo')).toBeNull();
  });

  it('returns null for invalid componentId', () => {
    const ent = new MockEntity({ foo: { a: 1 } });
    expect(getComponentFromEntity(ent, '')).toBeNull();
    // @ts-ignore - purposely pass non-string
    expect(getComponentFromEntity(ent, null)).toBeNull();
  });

  it('returns null when getComponentData throws', () => {
    const ent = {
      getComponentData() {
        throw new Error('boom');
      },
    };
    expect(getComponentFromEntity(ent, 'foo')).toBeNull();
  });
});

class MockManager {
  constructor(data = new Map()) {
    this._data = data;
  }

  getComponentData(entityId, componentId) {
    const comps = this._data.get(entityId);
    return comps ? comps[componentId] : undefined;
  }

  getEntityInstance(id) {
    return this._data.has(id) ? { id } : null;
  }
}

describe('getComponentFromManager', () => {
  it('returns component data when present', () => {
    const map = new Map([['e1', { foo: { a: 1 } }]]);
    const mgr = new MockManager(map);
    expect(getComponentFromManager('e1', 'foo', mgr)).toEqual({ a: 1 });
  });

  it('returns null when component missing', () => {
    const mgr = new MockManager();
    expect(getComponentFromManager('e1', 'foo', mgr)).toBeNull();
  });

  it('returns null for invalid parameters', () => {
    const mgr = new MockManager();
    expect(getComponentFromManager('', 'foo', mgr)).toBeNull();
    expect(getComponentFromManager('e1', '', mgr)).toBeNull();
    expect(getComponentFromManager('e1', 'foo', null)).toBeNull();
  });

  it('logs debug for invalid parameters', () => {
    const logger = createMockLogger();
    const mgr = new MockManager();
    expect(getComponentFromManager('', 'foo', mgr, logger)).toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(
      '[componentAccessUtils] getComponentFromManager: invalid entityId or componentId.'
    );
  });

  it('returns null and logs debug for invalid manager', () => {
    const logger = createMockLogger();
    const mgr = {
      getComponentData() {
        return {};
      },
    };
    expect(getComponentFromManager('e1', 'foo', mgr, logger)).toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(
      '[componentAccessUtils] getComponentFromManager: invalid entityManager provided.'
    );
  });

  it('returns null when getComponentData throws', () => {
    const mgr = {
      getComponentData() {
        throw new Error('boom');
      },
    };
    const logger = createMockLogger();
    expect(getComponentFromManager('e1', 'foo', mgr, logger)).toBeNull();
    expect(logger.debug).toHaveBeenCalled();
  });
});

describe('resolveEntityInstance', () => {
  it('resolves entity from id with valid manager', () => {
    const ent = new MockEntity();
    const mgr = {
      getEntityInstance: jest.fn().mockReturnValue(ent),
      getComponentData: jest.fn(),
    };
    expect(resolveEntityInstance('e1', mgr)).toBe(ent);
    expect(mgr.getEntityInstance).toHaveBeenCalledWith('e1');
  });

  it('returns same entity when passed instance directly', () => {
    const ent = new MockEntity();
    expect(resolveEntityInstance(ent, null)).toBe(ent);
  });

  it('returns null for invalid id or manager', () => {
    const entMgrInvalid = { getEntityInstance: jest.fn() }; // missing getComponentData
    expect(resolveEntityInstance('e1', entMgrInvalid)).toBeNull();

    const mgr = {
      getEntityInstance: jest.fn().mockReturnValue(null),
      getComponentData: jest.fn(),
    };
    expect(resolveEntityInstance('missing', mgr)).toBeNull();
  });

  it('logs debug for invalid value', () => {
    const logger = createMockLogger();
    expect(resolveEntityInstance(123, null, logger)).toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(
      '[componentAccessUtils] resolveEntityInstance: provided value is not a valid entity.'
    );
  });
});

describe('readComponent and writeComponent', () => {
  it('reads via getComponentData when available', () => {
    const ent = { getComponentData: jest.fn().mockReturnValue({ a: 1 }) };
    expect(readComponent(ent, 'foo')).toEqual({ a: 1 });
  });

  it('reads from components bag when no getter', () => {
    const ent = { components: { bar: 2 } };
    expect(readComponent(ent, 'bar')).toBe(2);
  });

  it('writes via addComponent when available', () => {
    const ent = { addComponent: jest.fn(), components: {} };
    const data = { x: 3 };
    expect(writeComponent(ent, 'foo', data)).toBe(true);
    expect(ent.addComponent).toHaveBeenCalledWith('foo', data);
  });

  it('writes to components bag when no addComponent', () => {
    const ent = { components: {} };
    expect(writeComponent(ent, 'bar', 5)).toBe(true);
    expect(ent.components.bar).toBe(5);
  });

  it('returns false for invalid entity', () => {
    expect(writeComponent(null, 'x', {})).toBe(false);
  });
});

describe('fetchComponent and applyComponent', () => {
  it('delegates fetch to readComponent', () => {
    const ent = { getComponentData: jest.fn().mockReturnValue({ a: 1 }) };
    expect(fetchComponent(ent, 'foo')).toEqual({ a: 1 });
  });

  it('delegates apply to writeComponent', () => {
    const ent = { addComponent: jest.fn(), components: {} };
    const data = { x: 2 };
    expect(applyComponent(ent, 'foo', data)).toBe(true);
    expect(ent.addComponent).toHaveBeenCalledWith('foo', data);
  });
});
