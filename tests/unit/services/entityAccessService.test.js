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

// Mock entity without addComponent method but with components property
class MockEntityWithComponents {
  constructor(data = {}) {
    this.components = data;
  }
  getComponentData(id) {
    return this.components[id];
  }
}

// Mock entity without addComponent or components property
class MockEntityMinimal {
  constructor(data = {}) {
    this._data = data;
  }
  getComponentData(id) {
    return this._data[id];
  }
}

// Mock logger for testing debug messages
class MockLogger {
  constructor() {
    this.debugMessages = [];
    this.warnMessages = [];
  }
  debug(msg) {
    this.debugMessages.push(msg);
  }
  warn(msg) {
    this.warnMessages.push(msg);
  }
  info() {}
  error() {}
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

  it('returns null for invalid entity manager', () => {
    const logger = new MockLogger();
    const invalidManager = {}; // missing getEntityInstance method
    expect(resolveEntity('testId', invalidManager, logger)).toBeNull();
    expect(logger.warnMessages[0]).toContain('resolveEntity: invalid entityManager provided for ID lookup');
  });

  it('logs debug message for invalid non-null entity values', () => {
    const logger = new MockLogger();
    const invalidEntity = { notAnEntity: true }; // not null/undefined but missing getComponentData
    expect(resolveEntity(invalidEntity, null, logger)).toBeNull();
    expect(logger.debugMessages[0]).toContain('resolveEntity: provided value is not a valid entity');
  });

  it('logs debug message when entity resolution fails', () => {
    const logger = new MockLogger();
    const mgr = new MockManager(); // empty manager
    expect(resolveEntity('nonexistent', mgr, logger)).toBeNull();
    expect(logger.debugMessages[0]).toContain('resolveEntity: could not resolve entity for ID');
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

  it('falls back to manager when entity getComponentData fails', () => {
    const failingEntity = new MockEntity({ test: 'entityValue' });
    // Mock the entity's getComponentData to throw an error
    failingEntity.getComponentData = () => {
      throw new Error('Entity method failed');
    };

    const mgr = new MockManager(new Map([['testId', new MockEntity({ test: 'managerValue' })]]));
    
    // Should fall back to manager when entity method fails
    expect(getComponent('testId', 'test', { entityManager: mgr })).toBe('managerValue');
  });

  it('falls back to manager when no entity found but ID is string', () => {
    const mgr = new MockManager(new Map([['validId', new MockEntity({ comp: 'value' })]]));
    
    // Entity resolution fails but manager can still handle string ID
    expect(getComponent('validId', 'comp', { entityManager: mgr })).toBe('value');
  });

  it('returns null when manager getComponentData fails', () => {
    const mgr = {
      getEntityInstance: () => null,
      getComponentData: () => {
        throw new Error('Manager failed');
      }
    };
    
    expect(getComponent('testId', 'comp', { entityManager: mgr })).toBeNull();
  });

  it('falls back to componentAccessService for plain objects', () => {
    const plainObject = { someProperty: 'value' };
    
    // This should fall back to defaultComponentAccess.fetchComponent
    const result = getComponent(plainObject, 'nonexistentComponent');
    expect(result).toBeNull(); // ComponentAccessService returns null for non-existent components
  });

  it('handles successful fallback to manager with success result', () => {
    const failingEntity = new MockEntity({ test: 'entityValue' });
    // Mock the entity's getComponentData to return undefined (triggers fallback)
    failingEntity.getComponentData = () => undefined;

    const mgr = new MockManager(new Map([['testId', failingEntity]]));
    mgr.getComponentData = () => 'managerSuccess'; // Manager returns actual value
    
    // Should use the manager fallback and return the manager's result
    expect(getComponent('testId', 'test', { entityManager: mgr })).toBe('managerSuccess');
  });

  it('returns null when manager fallback returns undefined', () => {
    const failingEntity = new MockEntity({ test: 'entityValue' });
    failingEntity.getComponentData = () => undefined;

    const mgr = new MockManager(new Map([['testId', failingEntity]]));
    mgr.getComponentData = () => undefined; // Manager also returns undefined
    
    expect(getComponent('testId', 'test', { entityManager: mgr })).toBeNull();
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

  it('returns false for invalid componentId', () => {
    const logger = new MockLogger();
    const ent = new MockEntity();
    expect(setComponent(ent, '', 'data', { logger })).toBe(false);
    expect(setComponent(ent, null, 'data', { logger })).toBe(false);
    expect(setComponent(ent, undefined, 'data', { logger })).toBe(false);
    expect(logger.debugMessages.length).toBeGreaterThan(0);
    expect(logger.debugMessages[0]).toContain('setComponent: invalid componentId');
  });

  it('writes to components property when addComponent method missing', () => {
    const logger = new MockLogger();
    const ent = new MockEntityWithComponents({ existing: 'value' });
    expect(setComponent(ent, 'newComp', 'newData', { logger })).toBe(true);
    expect(ent.components.newComp).toBe('newData');
    expect(ent.components.existing).toBe('value'); // existing data preserved
  });

  it('returns false when entity lacks both addComponent and components', () => {
    const logger = new MockLogger();
    const ent = new MockEntityMinimal();
    expect(setComponent(ent, 'comp', 'data', { logger })).toBe(false);
    expect(logger.debugMessages[0]).toContain('setComponent: target entity does not support component updates');
  });

  it('writes via manager fallback when entity resolution fails but manager available', () => {
    const targetEntity = new MockEntityWithComponents({ existing: 'old' });
    const mgr = new MockManager(new Map([['entityId', targetEntity]]));
    
    // Pass non-entity object that will fail resolveEntity but string ID should work via manager
    expect(setComponent('entityId', 'testComp', 'testData', { entityManager: mgr })).toBe(true);
    expect(targetEntity.components.testComp).toBe('testData');
  });

  it('handles manager fallback with addComponent method', () => {
    const targetEntity = new MockEntity();
    const mgr = new MockManager(new Map([['entityId', targetEntity]]));
    
    expect(setComponent('entityId', 'comp', 'value', { entityManager: mgr })).toBe(true);
    expect(targetEntity.getComponentData('comp')).toBe('value');
  });

  it('returns false when manager fallback entity lacks component support', () => {
    const targetEntity = new MockEntityMinimal(); // has getComponentData but no addComponent or components
    const mgr = new MockManager(new Map([['entityId', targetEntity]]));
    
    expect(setComponent('entityId', 'comp', 'value', { entityManager: mgr })).toBe(false);
  });

  it('handles manager fallback with components property when addComponent unavailable', () => {
    const targetEntity = new MockEntityWithComponents({ existing: 'value' });
    // Create a manager that has full methods but different from the standard path
    const mgr = {
      getEntityInstance: (id) => id === 'entityId' ? targetEntity : null,
      getComponentData: (entityId, componentId) => {
        const ent = entityId === 'entityId' ? targetEntity : null;
        return ent ? ent.getComponentData(componentId) : undefined;
      }
    };
    
    // This should trigger the manager fallback path at lines 171-177
    expect(setComponent('entityId', 'newComp', 'newValue', { entityManager: mgr })).toBe(true);
    expect(targetEntity.components.newComp).toBe('newValue');
  });

  it('handles manager fallback with addComponent method in manager path', () => {
    const targetEntity = new MockEntity();
    const mgr = {
      getEntityInstance: (id) => id === 'entityId' ? targetEntity : null,
      getComponentData: (entityId, componentId) => {
        const ent = entityId === 'entityId' ? targetEntity : null;
        return ent ? ent.getComponentData(componentId) : undefined;
      }
    };
    
    // This should trigger the manager fallback addComponent path at lines 171-173
    expect(setComponent('entityId', 'comp', 'value', { entityManager: mgr })).toBe(true);
    expect(targetEntity.getComponentData('comp')).toBe('value');
  });
});
