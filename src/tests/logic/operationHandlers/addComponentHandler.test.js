// src/tests/logic/operationHandlers/addComponentHandler.test.js

/**
 * @jest-environment node
 */
import {describe, expect, test, jest, beforeEach} from '@jest/globals';
import AddComponentHandler from '../../../logic/operationHandlers/addComponentHandler.js'; // Adjust path if needed

// --- Type-hints (for editors only) ------------------------------------------
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../logic/defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../../logic/operationHandlers/addComponentHandler.js').AddComponentOperationParams} AddComponentOperationParams */

// --- Mock services ---------------------------------------------------------
const mockEntityManager = {
    addComponent: jest.fn(),
};

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

// --- Helper – ExecutionContext factory -------------------------------------
const actorId = 'actor-id-123';
const targetId = 'target-id-456';

/** @returns {ExecutionContext} */
function buildCtx(overrides = {}) {
    const base = {
        logger: mockLogger,
        evaluationContext: {
            actor: {id: actorId},
            target: {id: targetId},
            context: {},
        },
    };
    return {
        ...base,
        ...overrides,
        evaluationContext: {
            ...base.evaluationContext,
            ...(overrides.evaluationContext || {}),
            context: {
                ...(base.evaluationContext.context),
                ...(overrides.evaluationContext?.context || {}),
            },
        },
    };
}

// --- Test-suite ------------------------------------------------------------
describe('AddComponentHandler', () => {
    /** @type {AddComponentHandler} */
    let handler;

    beforeEach(() => {
        jest.clearAllMocks();
        handler = new AddComponentHandler({entityManager: mockEntityManager, logger: mockLogger});
    });

    // --- Constructor validation ----------------------------------------------
    test('throws without valid dependencies', () => {
        expect(() => new AddComponentHandler({logger: mockLogger})).toThrow(/EntityManager/);
        expect(() => new AddComponentHandler({entityManager: {}, logger: mockLogger})).toThrow(/addComponent method/);
        expect(() => new AddComponentHandler({entityManager: mockEntityManager})).toThrow(/ILogger/);
    });

    // --- Happy Path - Basic Add/Replace ------------------------------------
    test('adds component by calling EntityManager.addComponent with correct args', () => {
        const params = {entity_ref: 'actor', component_type: 'core:stats', value: {hp: 10, mp: 5}};
        const ctx = buildCtx();
        handler.execute(params, ctx);
        expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(actorId, 'core:stats', {hp: 10, mp: 5});
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Successfully added/replaced component'));
    });

    test('adds component with an empty object value', () => {
        const params = {entity_ref: 'target', component_type: 'custom:marker', value: {}};
        const ctx = buildCtx();
        handler.execute(params, ctx);
        expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(targetId, 'custom:marker', {});
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // --- Parameter Validation ----------------------------------------------
    test('warns and skips if params are missing or invalid', () => {
        handler.execute(null, buildCtx());
        expect(mockLogger.warn).toHaveBeenCalledWith('ADD_COMPONENT: params missing or invalid.', {params: null});
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
        mockLogger.warn.mockClear();
        handler.execute(undefined, buildCtx());
        expect(mockLogger.warn).toHaveBeenCalledWith('ADD_COMPONENT: params missing or invalid.', {params: undefined});
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
        mockLogger.warn.mockClear();
        handler.execute("invalid", buildCtx());
        expect(mockLogger.warn).toHaveBeenCalledWith('ADD_COMPONENT: params missing or invalid.', {params: "invalid"});
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    // --- UPDATED TEST for missing/falsy entity_ref ---
    test.each([
        ['missing property', {component_type: 'c:t', value: {}}],
        ['null', {component_type: 'c:t', value: {}, entity_ref: null}],
        ['undefined', {component_type: 'c:t', value: {}, entity_ref: undefined}]
    ])('warns and skips if entity_ref is %s', (desc, params) => {
        handler.execute(params, buildCtx());
        expect(mockLogger.warn).toHaveBeenCalledWith('ADD_COMPONENT: "entity_ref" parameter is required.');
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });
    // --- End of Updated Test ---

    test.each([[null], [undefined], [''], ['  '], [123]])
    ('warns and skips if component_type is invalid (%p)', (invalidType) => {
        const params = {entity_ref: 'actor', component_type: invalidType, value: {}};
        handler.execute(params, buildCtx());
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "component_type"'));
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    test.each([
        ['non-object value (number)', 7],
        ['non-object value (string)', 'hello'],
        ['null value', null],
        ['undefined value', undefined],
    ])('warns and skips if value is %s', (desc, invalidValue) => {
        const params = {entity_ref: 'actor', component_type: 'ns:comp', value: invalidValue};
        handler.execute(params, buildCtx());
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "value" parameter (must be a non-null object)'));
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    // --- Entity Reference Resolution (Happy Paths) -------------------------
    test('resolves "actor" entity reference', () => {
        const params = {entity_ref: 'actor', component_type: 'c:t', value: {}};
        handler.execute(params, buildCtx());
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(actorId, 'c:t', {});
    });

    test('resolves "target" entity reference', () => {
        const params = {entity_ref: 'target', component_type: 'c:t', value: {}};
        handler.execute(params, buildCtx());
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(targetId, 'c:t', {});
    });

    test('resolves direct string entity ID reference', () => {
        const specificId = 'entity-directly-by-id-789';
        const params = {entity_ref: specificId, component_type: 'c:t', value: {}};
        handler.execute(params, buildCtx());
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(specificId, 'c:t', {});
    });

    test('resolves object entity reference {entityId: "..."}', () => {
        const specificId = 'entity-via-object-ref';
        const params = {entity_ref: {entityId: specificId}, component_type: 'c:t', value: {}};
        handler.execute(params, buildCtx());
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(specificId, 'c:t', {});
    });

    // --- UPDATED TEST for RESOLUTION Failures ---
    test.each([
        // null and undefined removed - caught by the '!entity_ref' check earlier
        ['empty string', ' '],
        ['object without entityId', {}],
        ['object with empty entityId', {entityId: '  '}],
        ['object with non-string entityId', {entityId: 123}],
    ])('warns and skips if entity_ref cannot be resolved (%s)', (desc, invalidRef) => {
        const params = {entity_ref: invalidRef, component_type: 'c:t', value: {}};
        handler.execute(params, buildCtx());
        // These cases should pass the initial '!entity_ref' check but fail in #resolveEntityId
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not resolve entity id'), {entity_ref: invalidRef});
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });
    // --- End of Updated Test ---


    // --- Error Handling during addComponent Call ---------------------------
    test('logs error if EntityManager.addComponent throws', () => {
        const error = new Error("Entity manager failed!");
        mockEntityManager.addComponent.mockImplementation(() => { throw error; });
        const params = {entity_ref: 'actor', component_type: 'c:t', value: {}};
        handler.execute(params, buildCtx());
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(actorId, 'c:t', {});
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Failed to add component "c:t" to entity "actor-id-123". Error: Entity manager failed!'),
            {error: error}
        );
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // --- Context logger precedence -----------------------------------------
    test('uses logger from execution context when provided', () => {
        const ctxLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
        const ctx = buildCtx({logger: ctxLogger});
        const params = {entity_ref: 'actor', component_type: '', value: {}}; // Trigger validation warning
        handler.execute(params, ctx);
        expect(ctxLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "component_type"'));
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });
});