// src/tests/utils/entityUtils.test.js

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { getEntityDisplayName } from '../../utils/entityUtils.js';
// Assuming NAME_COMPONENT_ID is exported from a file like this,
// as per the import in the provided entityUtils.js.
import { NAME_COMPONENT_ID } from '../../types/components.js';

// Mock ILogger
const mockLogger = {
    debug: jest.fn(),
    warn: jest.fn(),
};

// Helper to create a mock entity
const createMockEntity = (entityId, entityNameProp, componentDataResult) => {
    return {
        id: entityId || 'test-entity-123',
        name: entityNameProp, // Can be string, null, undefined, empty, etc.
        getComponentData: jest.fn((componentId) => {
            if (componentId === NAME_COMPONENT_ID) {
                // componentDataResult can be an object like { text: 'value' }, or null/undefined
                return componentDataResult;
            }
            return undefined; // Default behavior for other components
        }),
    };
};

describe('EntityUtils - getEntityDisplayName', () => {
    beforeEach(() => {
        // Reset mocks before each test
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear();
    });

    describe('Handling null or undefined entity input', () => {
        test('should return undefined and log debug when entity is null', () => {
            const result = getEntityDisplayName(null, mockLogger);
            expect(result).toBeUndefined();
            expect(mockLogger.debug).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith("EntityUtils.getEntityDisplayName: Received null or undefined entity.");
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        test('should return undefined and log debug when entity is undefined', () => {
            const result = getEntityDisplayName(undefined, mockLogger);
            expect(result).toBeUndefined();
            expect(mockLogger.debug).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith("EntityUtils.getEntityDisplayName: Received null or undefined entity.");
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        test('should return undefined and not throw if logger is not provided, for null entity', () => {
            expect(() => getEntityDisplayName(null, undefined)).not.toThrow();
            const result = getEntityDisplayName(null, undefined);
            expect(result).toBeUndefined();
        });

        test('should return undefined and not throw if logger is not provided, for undefined entity', () => {
            expect(() => getEntityDisplayName(undefined, undefined)).not.toThrow();
            const result = getEntityDisplayName(undefined, undefined);
            expect(result).toBeUndefined();
        });
    });

    describe('Using core:name component', () => {
        test('should return name from core:name component if text is valid and non-empty', () => {
            const entity = createMockEntity('e1', 'Fallback Name', { text: 'Component Name' });
            const result = getEntityDisplayName(entity, mockLogger);
            expect(result).toBe('Component Name');
            expect(entity.getComponentData).toHaveBeenCalledWith(NAME_COMPONENT_ID);
            // No fallback debug log or warning should occur
            expect(mockLogger.debug).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        test('should not log anything (other than potential entry logs if they existed) if name found in component and logger is undefined', () => {
            const entity = createMockEntity('e1-no-log', 'Fallback Name', { text: 'Component Name No Log' });
            const result = getEntityDisplayName(entity, undefined); // No logger passed
            expect(result).toBe('Component Name No Log');
            expect(entity.getComponentData).toHaveBeenCalledWith(NAME_COMPONENT_ID);
            // Ensure no attempts to call logger methods
            expect(mockLogger.debug).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });
    });

    describe('Fallback logic when core:name component is invalid or has invalid/empty text', () => {
        const invalidTextTestCases = [
            { description: 'empty string', textValue: '', componentValueProvided: { text: '' } },
            { description: 'whitespace string', textValue: '   ', componentValueProvided: { text: '   ' } },
            { description: 'null text property', textValue: null, componentValueProvided: { text: null } },
            { description: 'non-string text property', textValue: 123, componentValueProvided: { text: 123 } },
            { description: 'component data is present but text property is missing', textValue: undefined, componentValueProvided: {} },
        ];

        invalidTextTestCases.forEach(({ description, componentValueProvided }) => {
            test(`should fallback to entity.name when core:name component.text is ${description} and entity.name is valid`, () => {
                const entity = createMockEntity('e-fallback', 'Valid Entity Prop Name', componentValueProvided);
                const result = getEntityDisplayName(entity, mockLogger);

                expect(result).toBe('Valid Entity Prop Name');
                expect(entity.getComponentData).toHaveBeenCalledWith(NAME_COMPONENT_ID);
                expect(mockLogger.debug).toHaveBeenCalledTimes(1);
                expect(mockLogger.debug).toHaveBeenCalledWith(`EntityUtils.getEntityDisplayName: Entity '${entity.id}' using fallback entity.name property ('${entity.name}') as '${NAME_COMPONENT_ID}' was not found or invalid.`);
                expect(mockLogger.warn).not.toHaveBeenCalled();
            });

            test(`should return undefined and log warn when core:name component.text is ${description} AND entity.name is invalid (e.g. empty)`, () => {
                const entityWithInvalidFallback = createMockEntity('e-no-fallback', '', componentValueProvided); // entity.name is empty
                const result = getEntityDisplayName(entityWithInvalidFallback, mockLogger);

                expect(result).toBeUndefined();
                expect(entityWithInvalidFallback.getComponentData).toHaveBeenCalledWith(NAME_COMPONENT_ID);
                expect(mockLogger.debug).not.toHaveBeenCalled(); // No successful fallback debug log
                expect(mockLogger.warn).toHaveBeenCalledTimes(1);
                expect(mockLogger.warn).toHaveBeenCalledWith(`EntityUtils.getEntityDisplayName: Entity '${entityWithInvalidFallback.id}' has no usable name from '${NAME_COMPONENT_ID}' or entity.name.`);
            });
        });

        test('should fallback to entity.name when core:name component data itself is null and entity.name is valid', () => {
            const entity = createMockEntity('e-comp-null', 'Entity Name From Null Comp', null); // componentDataResult is null
            const result = getEntityDisplayName(entity, mockLogger);
            expect(result).toBe('Entity Name From Null Comp');
            expect(entity.getComponentData).toHaveBeenCalledWith(NAME_COMPONENT_ID);
            expect(mockLogger.debug).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(`EntityUtils.getEntityDisplayName: Entity '${entity.id}' using fallback entity.name property ('${entity.name}') as '${NAME_COMPONENT_ID}' was not found or invalid.`);
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        test('should fallback to entity.name when core:name component data itself is undefined and entity.name is valid', () => {
            const entity = createMockEntity('e-comp-undef', 'Entity Name From Undef Comp', undefined); // componentDataResult is undefined
            const result = getEntityDisplayName(entity, mockLogger);
            expect(result).toBe('Entity Name From Undef Comp');
            expect(entity.getComponentData).toHaveBeenCalledWith(NAME_COMPONENT_ID);
            expect(mockLogger.debug).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(`EntityUtils.getEntityDisplayName: Entity '${entity.id}' using fallback entity.name property ('${entity.name}') as '${NAME_COMPONENT_ID}' was not found or invalid.`);
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });
    });

    describe('Fallback to entity.name when core:name component is missing (getComponentData returns undefined/null)', () => {
        test('should use entity.name if core:name component is not found and entity.name is valid', () => {
            const entity = createMockEntity('e-no-comp', 'Direct Entity Name Valid', undefined); // No component data returned
            const result = getEntityDisplayName(entity, mockLogger);
            expect(result).toBe('Direct Entity Name Valid');
            expect(entity.getComponentData).toHaveBeenCalledWith(NAME_COMPONENT_ID);
            expect(mockLogger.debug).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(`EntityUtils.getEntityDisplayName: Entity '${entity.id}' using fallback entity.name property ('${entity.name}') as '${NAME_COMPONENT_ID}' was not found or invalid.`);
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        test('should not log debug for fallback if logger is not provided and using entity.name', () => {
            const entity = createMockEntity('e-no-comp-no-log', 'Direct Name No Log', undefined);
            const result = getEntityDisplayName(entity, undefined); // No logger
            expect(result).toBe('Direct Name No Log');
            expect(mockLogger.debug).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });
    });

    describe('No usable name found (neither core:name nor entity.name are valid or present)', () => {
        const invalidEntityNameValues = [
            { description: 'empty string', value: '' },
            { description: 'whitespace string', value: '   ' },
            { description: 'null', value: null },
            { description: 'undefined', value: undefined },
            // The function checks `typeof entity.name === 'string'`, so a number is also invalid.
            { description: 'not a string (number)', value: 12345 },
        ];

        // Scenario: core:name component is effectively missing (returns null/undefined), and entity.name is invalid.
        invalidEntityNameValues.forEach(invalidName => {
            test(`should return undefined and log warn if core:name is missing and entity.name is ${invalidName.description}`, () => {
                const entity = createMockEntity('e-total-fallback-fail', invalidName.value, null); // core:name component data is null
                const result = getEntityDisplayName(entity, mockLogger);
                expect(result).toBeUndefined();
                expect(entity.getComponentData).toHaveBeenCalledWith(NAME_COMPONENT_ID);
                expect(mockLogger.debug).not.toHaveBeenCalled(); // No successful fallback
                expect(mockLogger.warn).toHaveBeenCalledTimes(1);
                expect(mockLogger.warn).toHaveBeenCalledWith(`EntityUtils.getEntityDisplayName: Entity '${entity.id}' has no usable name from '${NAME_COMPONENT_ID}' or entity.name.`);
            });
        });

        // Scenario: core:name component is present but its .text is invalid, AND entity.name is also invalid.
        test('should return undefined and log warn if core:name.text is empty and entity.name is also empty', () => {
            const entity = createMockEntity('e-both-empty', '', { text: '' });
            const result = getEntityDisplayName(entity, mockLogger);
            expect(result).toBeUndefined();
            expect(mockLogger.debug).not.toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith(`EntityUtils.getEntityDisplayName: Entity '${entity.id}' has no usable name from '${NAME_COMPONENT_ID}' or entity.name.`);
        });

        test('should return undefined and log warn if core:name.text is whitespace and entity.name is null', () => {
            const entity = createMockEntity('e-text-space-name-null', null, { text: '   ' });
            const result = getEntityDisplayName(entity, mockLogger);
            expect(result).toBeUndefined();
            expect(mockLogger.debug).not.toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith(`EntityUtils.getEntityDisplayName: Entity '${entity.id}' has no usable name from '${NAME_COMPONENT_ID}' or entity.name.`);
        });

        test('should return undefined and not throw if no usable name and logger is not provided', () => {
            const entity = createMockEntity('e-no-name-no-logger', null, { text: '   ' });
            const result = getEntityDisplayName(entity, undefined); // No logger
            expect(result).toBeUndefined();
            expect(mockLogger.warn).not.toHaveBeenCalled(); // Logger's warn should not have been called
        });
    });

    describe('Entity ID in log messages', () => {
        test('should include correct entity.id in debug log for successful fallback to entity.name', () => {
            const specificEntityId = 'debug-log-id-test-001';
            const entity = createMockEntity(specificEntityId, 'FallbackNameHere', null); // Triggers fallback
            getEntityDisplayName(entity, mockLogger);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `EntityUtils.getEntityDisplayName: Entity '${specificEntityId}' using fallback entity.name property ('FallbackNameHere') as '${NAME_COMPONENT_ID}' was not found or invalid.`
            );
        });

        test('should include correct entity.id in warn log for no usable name found', () => {
            const specificEntityId = 'warn-log-id-test-002';
            const entity = createMockEntity(specificEntityId, null, null); // No name component, no entity.name
            getEntityDisplayName(entity, mockLogger);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `EntityUtils.getEntityDisplayName: Entity '${specificEntityId}' has no usable name from '${NAME_COMPONENT_ID}' or entity.name.`
            );
        });
    });
});