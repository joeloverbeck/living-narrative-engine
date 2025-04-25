// src/tests/logic/operationHandlers/modifyComponentHandler.test.js

/**
 * @jest-environment node
 */
import {describe, expect, test, jest, beforeEach} from '@jest/globals';
import ModifyComponentHandler from '../../../logic/operationHandlers/modifyComponentHandler.js'; // adjust path if tests folder differs

// --- Type‑hints (for editors only) ------------------------------------------
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../logic/defs.js').ExecutionContext} ExecutionContext */

// -----------------------------------------------------------------------------
//  Mock services
// -----------------------------------------------------------------------------
const mockEntityManager = {
    addComponent: jest.fn(),
    getComponentData: jest.fn(),
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
const actorId = 'actor‑1';
const targetId = 'target‑2';

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
//  Test‑suite
// -----------------------------------------------------------------------------
describe('ModifyComponentHandler', () => {
    /** @type {ModifyComponentHandler} */
    let handler;

    beforeEach(() => {
        jest.clearAllMocks();
        mockEntityManager.addComponent.mockReturnValue(true);
        handler = new ModifyComponentHandler({entityManager: mockEntityManager, logger: mockLogger});
    });

    // ---------------------------------------------------------------------------
    //  Constructor validation
    // ---------------------------------------------------------------------------
    test('throws without valid dependencies', () => {
        expect(() => new ModifyComponentHandler({logger: mockLogger})).toThrow(/EntityManager/);
        expect(() => new ModifyComponentHandler({entityManager: {}, logger: mockLogger})).toThrow();
        expect(() => new ModifyComponentHandler({entityManager: mockEntityManager})).toThrow(/ILogger/);
    });

    // ---------------------------------------------------------------------------
    //  Whole‑component replacement (mode = set, no field)
    // ---------------------------------------------------------------------------
    test('set whole component passes through to EntityManager.addComponent', () => {
        const params = {entity_ref: 'actor', component_type: 'core:stats', mode: 'set', value: {hp: 10}};
        const ctx = buildCtx();
        handler.execute(params, ctx);
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(actorId, 'core:stats', {hp: 10});
    });

    test('set whole component with non‑object value warns and skips', () => {
        const params = {entity_ref: 'actor', component_type: 'ns:c', mode: 'set', value: 7};
        handler.execute(params, buildCtx());
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('object value'));
    });

    test('inc mode without field warns and skips', () => {
        const params = {entity_ref: 'actor', component_type: 'ns:c', mode: 'inc', value: 1};
        handler.execute(params, buildCtx());
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('invalid without field'));
    });

    // ---------------------------------------------------------------------------
    //  Field‑level SET – path creation
    // ---------------------------------------------------------------------------
    test('set nested field creates path and assigns value', () => {
        const compObj = {}; // EM returns reference to this
        mockEntityManager.getComponentData.mockReturnValue(compObj);
        const params = {
            entity_ref: 'actor',
            component_type: 'game:stats',
            field: 'resources.mana.current',
            mode: 'set',
            value: 5,
        };
        handler.execute(params, buildCtx());
        expect(compObj.resources.mana.current).toBe(5);
    });

    // ---------------------------------------------------------------------------
    //  Field‑level INC – happy path
    // ---------------------------------------------------------------------------
    test('inc numeric leaf works and leaves component mutated in‑place', () => {
        const compObj = {stats: {hp: 10}};
        mockEntityManager.getComponentData.mockReturnValue(compObj);
        const params = {
            entity_ref: 'actor',
            component_type: 'core:stats',
            field: 'stats.hp',
            mode: 'inc',
            value: 15,
        };
        handler.execute(params, buildCtx());
        expect(compObj.stats.hp).toBe(25);
    });

    test('inc with non‑numeric leaf logs warn and does not mutate', () => {
        const compObj = {foo: {bar: 'not‑num'}};
        mockEntityManager.getComponentData.mockReturnValue(compObj);
        handler.execute({
            entity_ref: 'actor',
            component_type: 'c:t',
            field: 'foo.bar',
            mode: 'inc',
            value: 2
        }, buildCtx());
        expect(compObj.foo.bar).toBe('not‑num');
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('inc failed'));
    });

    test('inc along missing chain logs warn', () => {
        const compObj = {a: {}};
        mockEntityManager.getComponentData.mockReturnValue(compObj);
        handler.execute({
            entity_ref: 'actor',
            component_type: 'x:y',
            field: 'a.b.c',
            mode: 'inc',
            value: 1
        }, buildCtx());
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('inc failed'));
    });

    // ---------------------------------------------------------------------------
    //  Entity reference resolution paths
    // ---------------------------------------------------------------------------
    test('resolves "actor" / "target" / direct id', () => {
        mockEntityManager.addComponent.mockClear();
        handler.execute({entity_ref: 'target', component_type: 't:id', mode: 'set', value: {}}, buildCtx());
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(targetId, 't:id', {});

        handler.execute({
            entity_ref: {entityId: 'specific'},
            component_type: 'x:y',
            mode: 'set',
            value: {}
        }, buildCtx());
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith('specific', 'x:y', {});
    });

    test('fails to resolve bad entity_ref and logs', () => {
        handler.execute({entity_ref: '  ', component_type: 'c', mode: 'set', value: {}}, buildCtx());
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('resolve entity id'), expect.anything());
    });

    // ---------------------------------------------------------------------------
    //  Validation: inc requires numeric value
    // ---------------------------------------------------------------------------
    test('inc non‑number value is rejected', () => {
        handler.execute({entity_ref: 'actor', component_type: 'c', field: 'x', mode: 'inc', value: 'nope'}, buildCtx());
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('numeric'));
    });

    // ---------------------------------------------------------------------------
    //  Context logger precedence
    // ---------------------------------------------------------------------------
    test('uses logger from execution context when provided', () => {
        const ctxLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
        const ctx = buildCtx({logger: ctxLogger});
        handler.execute({entity_ref: 'actor'}, ctx); // invalid params triggers warns
        expect(ctxLogger.warn).toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });
});
