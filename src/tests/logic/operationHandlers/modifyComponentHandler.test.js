// src/tests/logic/operationHandlers/modifyComponentHandler.test.js

/**
 * @jest-environment node
 */
import {describe, expect, test, jest, beforeEach} from '@jest/globals';
import ModifyComponentHandler from '../../../logic/operationHandlers/modifyComponentHandler.js';

// --- Type-hints (for editors only) ------------------------------------------
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../entities/entityManager.js').default} EntityManager */ // Assuming default export
/** @typedef {import('../../../logic/defs.js').ExecutionContext} ExecutionContext */

// -----------------------------------------------------------------------------
//  Mock services
// -----------------------------------------------------------------------------
const mockEntityManager = {
    getComponentData: jest.fn(),
    addComponent: jest.fn(), // Crucial for the new logic
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
        // Default mock for addComponent to simulate success
        mockEntityManager.addComponent.mockReturnValue(true);
        // Clear any specific mock implementations for getComponentData from previous tests
        mockEntityManager.getComponentData.mockReset();
        handler = new ModifyComponentHandler({entityManager: mockEntityManager, logger: mockLogger});
    });

    // ---------------------------------------------------------------------------
    //  Constructor validation ( √ - these should still pass )
    // ---------------------------------------------------------------------------
    test('throws without valid dependencies', () => {
        expect(() => new ModifyComponentHandler({logger: mockLogger})).toThrow(/EntityManager/);
        expect(() => new ModifyComponentHandler({
            entityManager: {addComponent: jest.fn() /* missing getComponentData */},
            logger: mockLogger
        })).toThrow(/getComponentData/);
        expect(() => new ModifyComponentHandler({entityManager: mockEntityManager})).toThrow(/ILogger/);
    });

    // ---------------------------------------------------------------------------
    //  Validation: Field is now required ( √ - these should still pass )
    // ---------------------------------------------------------------------------
    test('inc mode without field warns and skips', () => {
        const params = {entity_ref: 'actor', component_type: 'ns:c', mode: 'inc', value: 1};
        handler.execute(params, buildCtx());
        expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled(); // Should not call addComponent
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('field" parameter (non-empty string) is required'));
    });

    test('set mode without field warns and skips', () => {
        const params = {entity_ref: 'actor', component_type: 'ns:c', mode: 'set', value: {a: 1}};
        handler.execute(params, buildCtx());
        expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled(); // Should not call addComponent
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('field" parameter (non-empty string) is required'));
    });


    // ---------------------------------------------------------------------------
    //  Field-level SET – path creation
    // ---------------------------------------------------------------------------
    test('set nested field creates path and assigns value', () => {
        const initialCompObj = {}; // What getComponentData returns
        mockEntityManager.getComponentData.mockReturnValue(initialCompObj);

        const params = {
            entity_ref: 'actor',
            component_type: 'game:stats',
            field: 'resources.mana.current',
            mode: 'set',
            value: 5,
        };
        handler.execute(params, buildCtx());

        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(actorId, 'game:stats');
        // Assert that addComponent was called with the modified data
        const expectedModifiedData = {
            resources: {
                mana: {
                    current: 5,
                },
            },
        };
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(actorId, 'game:stats', expectedModifiedData);
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // ---------------------------------------------------------------------------
    //  Field-level INC – happy path
    // ---------------------------------------------------------------------------
    test('inc numeric leaf works and passes modified data to addComponent', () => {
        const initialCompObj = {stats: {hp: 10}};
        mockEntityManager.getComponentData.mockReturnValue(initialCompObj);

        const params = {
            entity_ref: 'actor',
            component_type: 'core:stats',
            field: 'stats.hp',
            mode: 'inc',
            value: 15,
        };
        handler.execute(params, buildCtx());

        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(actorId, 'core:stats');
        const expectedModifiedData = {stats: {hp: 25}};
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(actorId, 'core:stats', expectedModifiedData);
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test('inc with non-numeric leaf logs correct warning and does not call addComponent', () => {
        const initialCompObj = {foo: {bar: 'not-num'}};
        mockEntityManager.getComponentData.mockReturnValue(initialCompObj);

        handler.execute({
            entity_ref: 'actor',
            component_type: 'c:t',
            field: 'foo.bar',
            mode: 'inc',
            value: 2
        }, buildCtx());

        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(actorId, 'c:t');
        // addComponent should NOT be called because local mutation failed
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
        // Check the new warning message
        expect(mockLogger.warn).toHaveBeenCalledWith(`MODIFY_COMPONENT: Local mutation (mode "inc") failed for field "foo.bar" on component "c:t" for entity "${actorId}". Check path or if 'inc' target is a number.`);
    });

    test('inc along missing chain logs correct warning and does not call addComponent', () => {
        const initialCompObj = {a: {}}; // 'b' is missing
        mockEntityManager.getComponentData.mockReturnValue(initialCompObj);

        handler.execute({
            entity_ref: 'actor',
            component_type: 'x:y',
            field: 'a.b.c',
            mode: 'inc',
            value: 1
        }, buildCtx());

        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(actorId, 'x:y');
        // addComponent should NOT be called
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
        // Check the new warning message
        expect(mockLogger.warn).toHaveBeenCalledWith(`MODIFY_COMPONENT: Local mutation (mode "inc") failed for field "a.b.c" on component "x:y" for entity "${actorId}". Check path or if 'inc' target is a number.`);
    });

    // ---------------------------------------------------------------------------
    //  Entity reference resolution paths ( √ - this should largely remain the same,
    //  just ensuring getComponentData is called, and addComponent for successful cases)
    // ---------------------------------------------------------------------------
    test('resolves "actor", "target", direct id for getComponentData and addComponent', () => {
        const initialData = {f: 0};
        mockEntityManager.getComponentData.mockReturnValue(initialData);
        const expectedModifiedData = {f: 1};

        // Actor
        handler.execute({entity_ref: 'actor', component_type: 'c:t', field: 'f', mode: 'set', value: 1}, buildCtx());
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(actorId, 'c:t');
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(actorId, 'c:t', expectedModifiedData);

        // Target
        handler.execute({entity_ref: 'target', component_type: 't:id', field: 'f', mode: 'set', value: 1}, buildCtx());
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(targetId, 't:id');
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(targetId, 't:id', expectedModifiedData);

        // Direct ID
        handler.execute({
            entity_ref: {entityId: 'specific'},
            component_type: 'x:y',
            field: 'f',
            mode: 'set',
            value: 1
        }, buildCtx());
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith('specific', 'x:y');
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith('specific', 'x:y', expectedModifiedData);
    });

    test('fails to resolve bad entity_ref and logs (with field present)', () => {
        handler.execute({
            entity_ref: '  ',
            component_type: 'c',
            field: 'some_field',
            mode: 'set',
            value: {}
        }, buildCtx());
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('could not resolve entity id'), expect.anything());
        expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    // ---------------------------------------------------------------------------
    //  Validation: inc requires numeric value ( √ - should still pass )
    // ---------------------------------------------------------------------------
    test('inc non-number value is rejected', () => {
        handler.execute({
            entity_ref: 'actor',
            component_type: 'c',
            field: 'x',
            mode: 'inc',
            value: 'nope'
        }, buildCtx());
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('inc mode requires a numeric value'));
        expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    // ---------------------------------------------------------------------------
    // Validation: Component existence and type checks ( √ - should still pass,
    // and addComponent should not be called if these fail )
    // ---------------------------------------------------------------------------
    test('warns if component does not exist on entity', () => {
        mockEntityManager.getComponentData.mockReturnValue(undefined);
        handler.execute({
            entity_ref: 'actor',
            component_type: 'non:existent',
            field: 'some.field',
            mode: 'set',
            value: 123
        }, buildCtx());
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(actorId, 'non:existent');
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Component "non:existent" not found on entity "actor-1"'));
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    test('warns if retrieved component data is not an object', () => {
        mockEntityManager.getComponentData.mockReturnValue('not-an-object');
        handler.execute({
            entity_ref: 'actor',
            component_type: 'bad:data',
            field: 'some.field',
            mode: 'set',
            value: 123
        }, buildCtx());
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(actorId, 'bad:data');
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Component "bad:data" on entity "actor-1" is not an object'));
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    // ---------------------------------------------------------------------------
    //  Context logger precedence ( √ - should still pass )
    // ---------------------------------------------------------------------------
    test('uses logger from execution context when provided', () => {
        const ctxLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
        const ctx = buildCtx({logger: ctxLogger});
        handler.execute({entity_ref: 'actor', component_type: 'c', field: 'f', mode: 'inc', value: 'bad'}, ctx);
        expect(ctxLogger.warn).toHaveBeenCalledWith(expect.stringContaining('inc mode requires a numeric value'));
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // New test: Check addComponent failure logging
    test('logs warning if entityManager.addComponent returns false', () => {
        const initialCompObj = {stats: {hp: 10}};
        mockEntityManager.getComponentData.mockReturnValue(initialCompObj);
        mockEntityManager.addComponent.mockReturnValue(false); // Simulate addComponent failure

        const params = {
            entity_ref: 'actor',
            component_type: 'core:stats',
            field: 'stats.hp',
            mode: 'inc',
            value: 15,
        };
        handler.execute(params, buildCtx());

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(actorId, 'core:stats', {stats: {hp: 25}});
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('EntityManager.addComponent reported an unexpected failure'));
    });

    test('logs error if entityManager.addComponent throws', () => {
        const initialCompObj = {stats: {hp: 10}};
        mockEntityManager.getComponentData.mockReturnValue(initialCompObj);
        const testError = new Error("Validation failed in EM");
        mockEntityManager.addComponent.mockImplementation(() => {
            throw testError;
        });

        const params = {
            entity_ref: 'actor',
            component_type: 'core:stats',
            field: 'stats.hp',
            mode: 'inc',
            value: 15,
        };
        handler.execute(params, buildCtx());

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(actorId, 'core:stats', {stats: {hp: 25}});
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error during EntityManager.addComponent'),
            expect.objectContaining({error: testError})
        );
    });
});