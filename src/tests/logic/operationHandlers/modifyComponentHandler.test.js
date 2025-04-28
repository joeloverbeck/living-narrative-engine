// src/tests/logic/operationHandlers/modifyComponentHandler.test.js

/**
 * @jest-environment node
 */
import {describe, expect, test, jest, beforeEach} from '@jest/globals';
import ModifyComponentHandler from '../../../logic/operationHandlers/modifyComponentHandler.js'; // adjust path if tests folder differs

// --- Type-hints (for editors only) ------------------------------------------
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../logic/defs.js').ExecutionContext} ExecutionContext */

// -----------------------------------------------------------------------------
//  Mock services
// -----------------------------------------------------------------------------
const mockEntityManager = {
    // addComponent: jest.fn(), // No longer used by ModifyComponentHandler
    getComponentData: jest.fn(),
    // updateComponentData: jest.fn(), // Add if your EM requires explicit updates after mutation
};

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

// -----------------------------------------------------------------------------
//  Helper – ExecutionContext factory
// -----------------------------------------------------------------------------
const actorId = 'actor-1';
const targetId = 'target-2';

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

// -----------------------------------------------------------------------------
//  Test-suite
// -----------------------------------------------------------------------------
describe('ModifyComponentHandler', () => {
    /** @type {ModifyComponentHandler} */
    let handler;

    beforeEach(() => {
        jest.clearAllMocks();
        // mockEntityManager.addComponent.mockReturnValue(true); // No longer needed
        // Ensure getComponentData is mocked before each test if needed by default
        mockEntityManager.getComponentData.mockImplementation((/*entityId, componentType*/) => {
            // Return a default mock value or undefined if needed
            // e.g., return {}; or return undefined;
            // Or clear specific mocks if set within tests:
            // mockEntityManager.getComponentData.mockClear(); // Or .mockReset();
        });
        handler = new ModifyComponentHandler({entityManager: mockEntityManager, logger: mockLogger});
    });

    // ---------------------------------------------------------------------------
    //  Constructor validation
    // ---------------------------------------------------------------------------
    test('throws without valid dependencies', () => {
        expect(() => new ModifyComponentHandler({logger: mockLogger})).toThrow(/EntityManager/);
        // Updated check: Now only requires getComponentData
        expect(() => new ModifyComponentHandler({entityManager: {}, logger: mockLogger})).toThrow(/getComponentData/);
        expect(() => new ModifyComponentHandler({entityManager: mockEntityManager})).toThrow(/ILogger/);
    });

    // ---------------------------------------------------------------------------
    //  DELETED: Whole-component replacement tests (Moved to AddComponentHandler tests)
    // ---------------------------------------------------------------------------
    // test('set whole component passes through to EntityManager.addComponent', () => { ... });
    // test('set whole component with non-object value warns and skips', () => { ... });

    // ---------------------------------------------------------------------------
    //  Validation: Field is now required
    // ---------------------------------------------------------------------------
    test('inc mode without field warns and skips', () => {
        const params = {entity_ref: 'actor', component_type: 'ns:c', mode: 'inc', value: 1}; // No 'field'
        handler.execute(params, buildCtx());
        expect(mockEntityManager.getComponentData).not.toHaveBeenCalled(); // Shouldn't get this far
        // Check the NEW expected warning
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('field" parameter (non-empty string) is required'));
    });

    test('set mode without field warns and skips', () => {
        const params = {entity_ref: 'actor', component_type: 'ns:c', mode: 'set', value: {a:1}}; // No 'field'
        handler.execute(params, buildCtx());
        expect(mockEntityManager.getComponentData).not.toHaveBeenCalled(); // Shouldn't get this far
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('field" parameter (non-empty string) is required'));
    });


    // ---------------------------------------------------------------------------
    //  Field-level SET – path creation
    // ---------------------------------------------------------------------------
    test('set nested field creates path and assigns value', () => {
        const compObj = {}; // EM returns reference to this
        mockEntityManager.getComponentData.mockReturnValue(compObj);
        const params = {
            entity_ref: 'actor',
            component_type: 'game:stats',
            field: 'resources.mana.current', // Field is present
            mode: 'set',
            value: 5,
        };
        handler.execute(params, buildCtx());
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(actorId, 'game:stats');
        expect(compObj.resources.mana.current).toBe(5);
        expect(mockLogger.warn).not.toHaveBeenCalled(); // Should succeed silently
    });

    // ---------------------------------------------------------------------------
    //  Field-level INC – happy path
    // ---------------------------------------------------------------------------
    test('inc numeric leaf works and leaves component mutated in-place', () => {
        const compObj = {stats: {hp: 10}};
        mockEntityManager.getComponentData.mockReturnValue(compObj);
        const params = {
            entity_ref: 'actor',
            component_type: 'core:stats',
            field: 'stats.hp', // Field is present
            mode: 'inc',
            value: 15,
        };
        handler.execute(params, buildCtx());
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(actorId, 'core:stats');
        expect(compObj.stats.hp).toBe(25);
        expect(mockLogger.warn).not.toHaveBeenCalled(); // Should succeed silently
    });

    test('inc with non-numeric leaf logs warn and does not mutate', () => {
        const compObj = {foo: {bar: 'not-num'}};
        mockEntityManager.getComponentData.mockReturnValue(compObj);
        handler.execute({
            entity_ref: 'actor',
            component_type: 'c:t',
            field: 'foo.bar', // Field is present
            mode: 'inc',
            value: 2
        }, buildCtx());
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(actorId, 'c:t');
        expect(compObj.foo.bar).toBe('not-num'); // Check no mutation
        // Check the NEW expected warning
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not increment field at path "foo.bar". Ensure the target field exists and is a number.'));
    });

    test('inc along missing chain logs warn', () => {
        const compObj = {a: {}}; // 'b' is missing
        mockEntityManager.getComponentData.mockReturnValue(compObj);
        handler.execute({
            entity_ref: 'actor',
            component_type: 'x:y',
            field: 'a.b.c', // Field is present, but path invalid
            mode: 'inc',
            value: 1
        }, buildCtx());
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(actorId, 'x:y');
        expect(compObj.a.b).toBeUndefined(); // Check no mutation / path creation
        // Check the NEW expected warning
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not increment field at path "a.b.c". Ensure the target field exists and is a number.'));
    });

    // ---------------------------------------------------------------------------
    //  Entity reference resolution paths (Now tested in context of field modification)
    // ---------------------------------------------------------------------------
    // DELETED: test('resolves "actor" / "target" / direct id', () => { ... });
    // -> This was testing addComponent calls, moved to AddComponentHandler tests.
    // -> We still need to ensure entity resolution works for getComponentData calls.

    test('resolves "actor", "target", direct id for getComponentData', () => {
        mockEntityManager.getComponentData.mockReturnValue({}); // Need component data to exist for modification

        // Actor
        handler.execute({entity_ref: 'actor', component_type: 'c:t', field: 'f', mode: 'set', value: 1}, buildCtx());
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(actorId, 'c:t');

        // Target
        handler.execute({entity_ref: 'target', component_type: 't:id', field: 'f', mode: 'set', value: 1}, buildCtx());
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(targetId, 't:id');

        // Direct ID
        handler.execute({entity_ref: {entityId: 'specific'}, component_type: 'x:y', field: 'f', mode: 'set', value: 1}, buildCtx());
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith('specific', 'x:y');
    });


    test('fails to resolve bad entity_ref and logs (with field present)', () => {
        // MODIFIED: Added a 'field' parameter so the handler proceeds to entity resolution
        handler.execute({
            entity_ref: '  ', // Invalid entity ref
            component_type: 'c',
            field: 'some_field', // Field is now present
            mode: 'set',
            value: {}
        }, buildCtx());
        // Now we expect the entity resolution warning, not the missing field warning
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('could not resolve entity id'), expect.anything());
        expect(mockEntityManager.getComponentData).not.toHaveBeenCalled(); // Should fail before getting component
    });

    // ---------------------------------------------------------------------------
    //  Validation: inc requires numeric value
    // ---------------------------------------------------------------------------
    test('inc non-number value is rejected', () => {
        // This test is still valid as it checks the 'value' type specifically for 'inc' mode
        handler.execute({
            entity_ref: 'actor',
            component_type: 'c',
            field: 'x', // Field is present
            mode: 'inc',
            value: 'nope' // Invalid value for inc
        }, buildCtx());
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('inc mode requires a numeric value'));
        expect(mockEntityManager.getComponentData).not.toHaveBeenCalled(); // Should fail before getting component
    });

    // ---------------------------------------------------------------------------
    // Validation: Component existence and type checks
    // ---------------------------------------------------------------------------
    test('warns if component does not exist on entity', () => {
        mockEntityManager.getComponentData.mockReturnValue(undefined); // Simulate component not found
        handler.execute({
            entity_ref: 'actor',
            component_type: 'non:existent',
            field: 'some.field',
            mode: 'set',
            value: 123
        }, buildCtx());
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(actorId, 'non:existent');
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Component "non:existent" not found on entity "actor-1"'));
    });

    test('warns if retrieved component data is not an object', () => {
        mockEntityManager.getComponentData.mockReturnValue('not-an-object'); // Simulate invalid component data type
        handler.execute({
            entity_ref: 'actor',
            component_type: 'bad:data',
            field: 'some.field',
            mode: 'set',
            value: 123
        }, buildCtx());
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(actorId, 'bad:data');
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Component "bad:data" on entity "actor-1" is not an object'));
    });


    // ---------------------------------------------------------------------------
    //  Context logger precedence
    // ---------------------------------------------------------------------------
    test('uses logger from execution context when provided', () => {
        const ctxLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
        const ctx = buildCtx({logger: ctxLogger});
        // Use a case that triggers a warning within ModifyComponentHandler's scope
        handler.execute({entity_ref: 'actor', component_type: 'c', field: 'f', mode: 'inc', value: 'bad'}, ctx);
        expect(ctxLogger.warn).toHaveBeenCalledWith(expect.stringContaining('inc mode requires a numeric value'));
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });
});