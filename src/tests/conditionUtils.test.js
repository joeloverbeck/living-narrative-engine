// src/tests/conditionUtils.test.js

import {describe, it, expect, jest} from '@jest/globals';
import {
    getNumberParam,
    getStringParam,
    getBooleanParam,
    getValueParam,
    getNestedProperty
} from '../utils/conditionUtils.js'; // Adjust path as needed

// --- Mock Data Access for getNestedProperty ---
const mockDataAccess = {
    getComponentClassByKey: jest.fn((key) => {
        // Simple mock: return a dummy class constructor if key matches known components
        if (key === 'Health') return class MockHealthComponent {
        };
        if (key === 'Position') return class MockPositionComponent {
        };
        return null;
    }),
    // getComponentForEntity is implicitly used by entity.getComponent in the mock below
};

// --- Mock Entity/Components for getNestedProperty ---
class MockBaseComponent {
    constructor(entity = null) {
        this._entity = entity;
    }

    setEntity(entity) {
        this._entity = entity;
    }
}

class MockHealthComponent extends MockBaseComponent {
    constructor(current = 10, max = 10) {
        super();
        this.current = current;
        this.max = max;
        this.status = {nested: 'value'};
    }
}

class MockPositionComponent extends MockBaseComponent {
    constructor(locationId = 'loc-A', x = 0, y = 0) {
        super();
        this.locationId = locationId;
        this.coords = {x, y};
    }
}

class MockEntity {
    constructor(id) {
        this.id = id;
        this.components = new Map();
        this.directProp = 'entityDirect';
    }

    addComponent(componentInstance, ComponentClass) {
        this.components.set(ComponentClass, componentInstance);
        // Simulate setting entity reference if component needs it
        if (typeof componentInstance.setEntity === 'function') componentInstance.setEntity(this);
    }

    getComponent(ComponentClass) {
        return this.components.get(ComponentClass);
    }

    // hasComponent not needed for getNestedProperty tests directly
}

// --- Test Suite ---

describe('Condition Utility Functions (conditionUtils.js)', () => {

    describe('get*Param functions', () => {
        const conditionData = {
            numValue: 10,
            stringValue: "hello",
            boolValue: true,
            nullValue: null,
            zeroValue: 0,
            falseValue: false,
            objValue: {a: 1},
            presentButWrongType: "not a number",
        };

        // --- getNumberParam ---
        describe('getNumberParam', () => {
            it('should return number value if present and correct type', () => {
                expect(getNumberParam(conditionData, 'numValue')).toBe(10);
                expect(getNumberParam(conditionData, 'zeroValue')).toBe(0);
            });
            it('should return default value if key is missing', () => {
                expect(getNumberParam(conditionData, 'missingKey', 99)).toBe(99);
                expect(getNumberParam(conditionData, 'missingKey')).toBeNull();
            });
            it('should return default value if value has wrong type', () => {
                expect(getNumberParam(conditionData, 'presentButWrongType', 99)).toBe(99);
                expect(getNumberParam(conditionData, 'presentButWrongType')).toBeNull();
            });
            it('should return default value if value is null', () => {
                expect(getNumberParam(conditionData, 'nullValue', 99)).toBe(99);
                expect(getNumberParam(conditionData, 'nullValue')).toBeNull();
            });
        });

        // --- getStringParam ---
        describe('getStringParam', () => {
            it('should return string value if present and correct type', () => {
                expect(getStringParam(conditionData, 'stringValue')).toBe("hello");
            });
            it('should return default value if key is missing', () => {
                expect(getStringParam(conditionData, 'missingKey', 'default')).toBe('default');
                expect(getStringParam(conditionData, 'missingKey')).toBeNull();
            });
            it('should return default value if value has wrong type', () => {
                expect(getStringParam(conditionData, 'numValue', 'default')).toBe('default');
                expect(getStringParam(conditionData, 'numValue')).toBeNull();
            });
            it('should return default value if value is null', () => {
                expect(getStringParam(conditionData, 'nullValue', 'default')).toBe('default');
                expect(getStringParam(conditionData, 'nullValue')).toBeNull();
            });
        });

        // --- getBooleanParam ---
        describe('getBooleanParam', () => {
            it('should return boolean value if present and correct type', () => {
                expect(getBooleanParam(conditionData, 'boolValue')).toBe(true);
                expect(getBooleanParam(conditionData, 'falseValue')).toBe(false);
            });
            it('should return default value if key is missing', () => {
                expect(getBooleanParam(conditionData, 'missingKey', true)).toBe(true);
                expect(getBooleanParam(conditionData, 'missingKey')).toBeNull();
            });
            it('should return default value if value has wrong type', () => {
                expect(getBooleanParam(conditionData, 'numValue', true)).toBe(true);
                expect(getBooleanParam(conditionData, 'numValue')).toBeNull();
            });
            it('should return default value if value is null', () => {
                expect(getBooleanParam(conditionData, 'nullValue', true)).toBe(true);
                expect(getBooleanParam(conditionData, 'nullValue')).toBeNull();
            });
        });

        // --- getValueParam ---
        describe('getValueParam', () => {
            it('should return value regardless of type if present', () => {
                expect(getValueParam(conditionData, 'numValue')).toBe(10);
                expect(getValueParam(conditionData, 'stringValue')).toBe("hello");
                expect(getValueParam(conditionData, 'boolValue')).toBe(true);
                expect(getValueParam(conditionData, 'zeroValue')).toBe(0);
                expect(getValueParam(conditionData, 'falseValue')).toBe(false);
                expect(getValueParam(conditionData, 'objValue')).toEqual({a: 1});
            });
            it('should return undefined if key is missing', () => {
                expect(getValueParam(conditionData, 'missingKey')).toBeUndefined();
            });
            it('should return null if value is explicitly null', () => {
                expect(getValueParam(conditionData, 'nullValue')).toBeNull();
            });
        });
    });

    describe('getNestedProperty', () => {
        let entity;
        let connection;

        beforeEach(() => {
            entity = new MockEntity('e1');
            entity.addComponent(new MockHealthComponent(5, 10), MockHealthComponent);
            entity.addComponent(new MockPositionComponent('loc-B', 1, 2), MockPositionComponent);

            connection = {
                connectionId: 'c1',
                direction: 'north',
                state: 'locked',
                details: {type: 'door', material: 'wood'}
            };
            // Clear mock calls for dataAccess between tests
            mockDataAccess.getComponentClassByKey.mockClear();
        });

        it('should retrieve direct properties from an entity', () => {
            expect(getNestedProperty(entity, 'id', mockDataAccess)).toBe('e1');
            expect(getNestedProperty(entity, 'directProp', mockDataAccess)).toBe('entityDirect');
        });

        it('should retrieve direct properties from a connection (simple object)', () => {
            expect(getNestedProperty(connection, 'connectionId', mockDataAccess)).toBe('c1');
            expect(getNestedProperty(connection, 'state', mockDataAccess)).toBe('locked');
            expect(getNestedProperty(connection, 'details.material', mockDataAccess)).toBe('wood');
        });

        it('should return undefined if component does not exist', () => {
            const entityNoHealth = new MockEntity('e2');
            expect(getNestedProperty(entityNoHealth, 'Health.current', mockDataAccess)).toBeUndefined();
        });

        it('should return undefined if component class key is not found by dataAccess', () => {
            mockDataAccess.getComponentClassByKey.mockReturnValueOnce(null); // Simulate not found
            expect(getNestedProperty(entity, 'UnknownComponent.value', mockDataAccess)).toBeUndefined();
            expect(mockDataAccess.getComponentClassByKey).toHaveBeenCalledWith('UnknownComponent');
        });

        it('should return undefined if property does not exist on component', () => {
            expect(getNestedProperty(entity, 'Health.nonExistentProp', mockDataAccess)).toBeUndefined();
        });

        it('should return undefined if property does not exist on simple object', () => {
            expect(getNestedProperty(connection, 'nonExistentProp', mockDataAccess)).toBeUndefined();
            expect(getNestedProperty(connection, 'details.nonExistent', mockDataAccess)).toBeUndefined();
        });

        it('should return undefined for invalid/empty property paths', () => {
            expect(getNestedProperty(entity, '', mockDataAccess)).toBeUndefined();
            expect(getNestedProperty(entity, null, mockDataAccess)).toBeUndefined();
            expect(getNestedProperty(entity, undefined, mockDataAccess)).toBeUndefined();
            expect(getNestedProperty(entity, 'Health..current', mockDataAccess)).toBeUndefined(); // Invalid path part
        });

        it('should return undefined for null or undefined input objects', () => {
            expect(getNestedProperty(null, 'id', mockDataAccess)).toBeUndefined();
            expect(getNestedProperty(undefined, 'state', mockDataAccess)).toBeUndefined();
        });

        it('should handle intermediate non-object access gracefully', () => {
            expect(getNestedProperty(connection, 'state.nonExistent', mockDataAccess)).toBeUndefined(); // 'state' is string
            expect(getNestedProperty(entity, 'Health.current.nonExistent', mockDataAccess)).toBeUndefined(); // 'current' is number
        });

        it('should work without dataAccess for non-entity objects or direct props', () => {
            expect(getNestedProperty(connection, 'state')).toBe('locked'); // No dataAccess needed
            expect(getNestedProperty(entity, 'directProp')).toBe('entityDirect'); // No dataAccess needed
            expect(getNestedProperty(entity, 'id')).toBe('e1'); // No dataAccess needed
        });

        it('should return undefined for component paths if dataAccess is missing', () => {
            expect(getNestedProperty(entity, 'Health.current')).toBeUndefined(); // dataAccess is required
        });
    });
});