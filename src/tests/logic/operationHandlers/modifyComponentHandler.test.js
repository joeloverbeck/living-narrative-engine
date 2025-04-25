// src/logic/operationHandlers/modifyComponentHandler.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import ModifyComponentHandler from '../../../logic/operationHandlers/modifyComponentHandler.js'; // Adjust path

// --- JSDoc Imports ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */

// --- Mocks ---
const mockEntityManager = {
    // Mock addComponent to return true by default, and allow overriding for error tests
    addComponent: jest.fn(() => true),
    removeComponent: jest.fn(() => true),
    // updateComponent: jest.fn(() => true), // Mock if/when implemented
};

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

// --- Mock Execution Context ---
const mockActorId = 'actor-123';
const mockTargetId = 'target-456';
const mockSpecificId = 'entity-789';

/** @type {ExecutionContext} */
const baseMockContext = {
    event: { type: 'TEST_EVENT', payload: {} },
    actor: { id: mockActorId, /* other props */ },
    target: { id: mockTargetId, /* other props */ },
    logger: mockLogger,
    evaluationContext: {
        actor: { id: mockActorId, name: 'Mock Actor' },
        target: { id: mockTargetId, type: 'Enemy' },
        // other potential context vars
    },
    // services etc.
};

// Helper to create context variations
const getMockContext = (overrides = {}) => ({
    ...baseMockContext,
    ...overrides,
    // Deep merge evaluationContext if provided
    evaluationContext: {
        ...baseMockContext.evaluationContext,
        ...(overrides.evaluationContext || {}),
    },
});


// --- Test Suite ---
describe('ModifyComponentHandler', () => {
    /** @type {ModifyComponentHandler} */
    let handler;

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset mocks to default success behavior
        mockEntityManager.addComponent.mockImplementation(() => true);
        mockEntityManager.removeComponent.mockImplementation(() => true);
        handler = new ModifyComponentHandler({ entityManager: mockEntityManager, logger: mockLogger });
    });

    // --- Constructor Tests ---
    test('constructor should throw if EntityManager is missing or invalid', () => {
        expect(() => new ModifyComponentHandler({ logger: mockLogger })).toThrow(/EntityManager/);
        expect(() => new ModifyComponentHandler({ entityManager: {}, logger: mockLogger })).toThrow(/EntityManager/);
        expect(() => new ModifyComponentHandler({ entityManager: { addComponent: 'not-a-func' }, logger: mockLogger })).toThrow(/EntityManager/);
    });

    test('constructor should throw if ILogger is missing or invalid', () => {
        expect(() => new ModifyComponentHandler({ entityManager: mockEntityManager })).toThrow(/ILogger/);
        expect(() => new ModifyComponentHandler({ entityManager: mockEntityManager, logger: {} })).toThrow(/ILogger/);
        expect(() => new ModifyComponentHandler({ entityManager: mockEntityManager, logger: { error: 'not-a-func' } })).toThrow(/ILogger/);
    });

    test('constructor should initialize successfully with valid dependencies', () => {
        expect(() => new ModifyComponentHandler({ entityManager: mockEntityManager, logger: mockLogger })).not.toThrow();
    });

    // --- Entity Resolution Tests ---
    test('execute should correctly resolve entity_ref: "actor"', () => {
        const params = { entity_ref: 'actor', component_type: 'core:health', operation: 'update', data: { value: 10 } };
        const context = getMockContext();
        handler.execute(params, context);
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(mockActorId, 'core:health', { value: 10 });
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('execute should correctly resolve entity_ref: "target"', () => {
        const params = { entity_ref: 'target', component_type: 'game:status', operation: 'add', data: { effect: 'poison' } };
        const context = getMockContext();
        handler.execute(params, context);
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(mockTargetId, 'game:status', { effect: 'poison' });
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('execute should correctly resolve entity_ref: { entityId: "..." }', () => {
        const params = { entity_ref: { entityId: mockSpecificId }, component_type: 'core:position', operation: 'remove' };
        const context = getMockContext();
        handler.execute(params, context);
        expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(mockSpecificId, 'core:position');
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('execute should interpret non-keyword string entity_ref as direct ID', () => {
        const params = { entity_ref: mockSpecificId, component_type: 'core:tag', operation: 'add', data: {} };
        const context = getMockContext();
        handler.execute(params, context);
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(mockSpecificId, 'core:tag', {});
        expect(mockLogger.error).not.toHaveBeenCalled();
    });


    test('execute should log error and return if entity_ref: "actor" cannot be resolved', () => {
        const params = { entity_ref: 'actor', component_type: 'core:health', operation: 'update', data: { value: 10 } };
        const context = getMockContext({ evaluationContext: { actor: null } }); // Actor missing
        handler.execute(params, context);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Cannot resolve 'actor'"), expect.anything());
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
        expect(mockEntityManager.removeComponent).not.toHaveBeenCalled();
    });

    test('execute should log error and return if entity_ref: "target" cannot be resolved', () => {
        const params = { entity_ref: 'target', component_type: 'core:health', operation: 'update', data: { value: 10 } };
        const context = getMockContext({ evaluationContext: { target: { id: null } } }); // Target ID missing
        handler.execute(params, context);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Cannot resolve 'target'"), expect.anything());
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
        expect(mockEntityManager.removeComponent).not.toHaveBeenCalled();
    });

    test('execute should log error and return if entity_ref object is invalid', () => {
        const params = { entity_ref: { id: 'wrong_prop' }, component_type: 'core:health', operation: 'update', data: { value: 10 } };
        handler.execute(params, getMockContext());
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid entity_ref parameter'), expect.anything());
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
        expect(mockEntityManager.removeComponent).not.toHaveBeenCalled();
    });

    test('execute should log error and return if entity_ref string is empty', () => {
        const params = { entity_ref: '  ', component_type: 'core:health', operation: 'update', data: { value: 10 } };
        handler.execute(params, getMockContext());
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid empty string provided for entity_ref'), expect.anything());
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
        expect(mockEntityManager.removeComponent).not.toHaveBeenCalled();
    });

    // --- Parameter Validation Tests ---
    test('execute should log error and return if params is null or not object', () => {
        handler.execute(null, getMockContext());
        expect(mockLogger.error).toHaveBeenCalledWith('ModifyComponentHandler: Missing or invalid parameters object.', expect.anything());
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
        expect(mockEntityManager.removeComponent).not.toHaveBeenCalled();
        mockLogger.error.mockClear();

        handler.execute('invalid', getMockContext());
        expect(mockLogger.error).toHaveBeenCalledWith('ModifyComponentHandler: Missing or invalid parameters object.', expect.anything());
    });

    test('execute should log error and return if component_type is missing or invalid', () => {
        handler.execute({ entity_ref: 'actor', operation: 'add', data: {} }, getMockContext());
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('"component_type" parameter'), expect.anything());
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
        mockLogger.error.mockClear();

        handler.execute({ entity_ref: 'actor', component_type: '  ', operation: 'add', data: {} }, getMockContext());
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('"component_type" parameter'), expect.anything());
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    test('execute should log error and return if operation is missing or invalid', () => {
        handler.execute({ entity_ref: 'actor', component_type: 'core:test' }, getMockContext());
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('"operation" parameter'), expect.anything());
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
        mockLogger.error.mockClear();

        handler.execute({ entity_ref: 'actor', component_type: 'core:test', operation: 'delete', data: {} }, getMockContext()); // Invalid operation
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('"operation" parameter'), expect.anything());
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    test('execute should log error and return if data is missing for "add" operation', () => {
        const params = { entity_ref: 'actor', component_type: 'core:health', operation: 'add' }; // Missing data
        handler.execute(params, getMockContext());
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Missing or invalid "data" parameter'), expect.anything());
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    test('execute should log error and return if data is missing for "update" operation', () => {
        const params = { entity_ref: 'actor', component_type: 'core:health', operation: 'update' }; // Missing data
        handler.execute(params, getMockContext());
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Missing or invalid "data" parameter'), expect.anything());
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    test('execute should log error and return if data is not an object for "add"/"update"', () => {
        const params = { entity_ref: 'actor', component_type: 'core:health', operation: 'add', data: 'not-an-object' };
        handler.execute(params, getMockContext());
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Missing or invalid "data" parameter'), expect.anything());
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    test('execute should log warning but proceed if data is provided for "remove" operation', () => {
        const params = { entity_ref: 'actor', component_type: 'core:health', operation: 'remove', data: { value: 1 } };
        handler.execute(params, getMockContext());
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('"data" parameter provided for operation "remove"'), expect.anything());
        // Should still call removeComponent
        expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(mockActorId, 'core:health');
        expect(mockLogger.error).not.toHaveBeenCalled(); // Should not be an error
    });


    // --- EntityManager Call Tests ---
    test('execute should call entityManager.addComponent for "add" operation', () => {
        const params = { entity_ref: 'actor', component_type: 'ns:comp', operation: 'add', data: { key: 'val' } };
        handler.execute(params, getMockContext());
        expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(mockActorId, 'ns:comp', { key: 'val' });
        expect(mockEntityManager.removeComponent).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
        // --- FIX: Remove expect.anything() ---
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('EntityManager.addComponent succeeded'));
    });

    test('execute should call entityManager.addComponent for "update" operation', () => {
        // Assuming addComponent handles updates/overwrites for now
        const params = { entity_ref: 'target', component_type: 'ns:comp', operation: 'update', data: { key: 'newVal' } };
        handler.execute(params, getMockContext());
        expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(mockTargetId, 'ns:comp', { key: 'newVal' });
        expect(mockEntityManager.removeComponent).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
        // --- FIX: Remove expect.anything() ---
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("EntityManager.updateComponent (via addComponent) succeeded"));
    });

    test('execute should call entityManager.removeComponent for "remove" operation', () => {
        const params = { entity_ref: { entityId: mockSpecificId }, component_type: 'ns:comp', operation: 'remove' };
        handler.execute(params, getMockContext());
        expect(mockEntityManager.removeComponent).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(mockSpecificId, 'ns:comp');
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
        // --- FIX: Remove expect.anything() ---
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("EntityManager.removeComponent succeeded"));
    });

    // --- Error Handling Tests ---
    test('execute should catch and log errors from entityManager.addComponent', () => {
        const error = new Error('Entity not found in EM');
        mockEntityManager.addComponent.mockImplementationOnce(() => { throw error; });
        const params = { entity_ref: 'actor', component_type: 'ns:comp', operation: 'add', data: {} };
        handler.execute(params, getMockContext());

        expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error during EntityManager operation "add"'),
            expect.objectContaining({ error: error.message })
        );
        // Should not re-throw
    });

    test('execute should catch and log errors from entityManager.removeComponent', () => {
        // Note: Current EM removeComponent doesn't throw for not found, but might throw for other reasons
        const error = new Error('Internal EM error during remove');
        mockEntityManager.removeComponent.mockImplementationOnce(() => { throw error; });
        const params = { entity_ref: 'actor', component_type: 'ns:comp', operation: 'remove' };
        handler.execute(params, getMockContext());

        expect(mockEntityManager.removeComponent).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error during EntityManager operation "remove"'),
            expect.objectContaining({ error: error.message })
        );
    });

    test('execute should log warning if removeComponent returns false', () => {
        mockEntityManager.removeComponent.mockImplementationOnce(() => false); // Simulate component not found
        const params = { entity_ref: 'actor', component_type: 'ns:comp', operation: 'remove' };
        handler.execute(params, getMockContext());

        expect(mockEntityManager.removeComponent).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        // --- FIX: Remove expect.anything() ---
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining("EntityManager.removeComponent returned false")
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('execute uses logger from execution context if available', () => {
        const specificLogger = { ...mockLogger, error: jest.fn(), debug: jest.fn(), warn: jest.fn(), info: jest.fn() }; // Need to mock all methods used
        const context = getMockContext({ logger: specificLogger });
        // Trigger an error condition
        handler.execute({ entity_ref: 'actor' /* missing other params */ }, context);

        expect(specificLogger.error).toHaveBeenCalled(); // Should be called on the context's logger
        expect(mockLogger.error).not.toHaveBeenCalled(); // Should NOT be called on the handler's default logger
    });
});