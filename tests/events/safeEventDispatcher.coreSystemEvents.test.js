/**
 * @file tests/events/safeEventDispatcher.coreSystemEvents.test.js
 * @description
 * Verifies that SafeEventDispatcher can dispatch (and refuse to dispatch)
 * the “core:system_warning_occurred” and “core:system_error_occurred” events
 * using real ValidatedEventDispatcher + AjvSchemaValidator + EventBus, but with
 * lightweight in-memory stubs for GameDataRepository and ILogger.
 *
 * Test Scenarios
 * ──────────────
 * 1. Valid payloads → dispatchSafely resolves true and listener receives event.
 * 2. Invalid payloads → dispatchSafely resolves false and listener is not called.
 * 3. Separate coverage for both the warning and error variants.
 */

/**
 * @jest-environment node
 *
 * Runs in a pure Node environment so we can use fs/path and dynamic import().
 */

const fs = require('fs');
const path = require('path');

/* ── Load the two event-definition JSON files directly via require() ───────── */
const warningEventDef = require(
    '../../data/mods/core/events/system_warning_occurred.event.json'
);
const errorEventDef = require(
    '../../data/mods/core/events/system_error_occurred.event.json'
);

/*  ── Pull the typical Jest helpers but **NOT** `jest` itself (it's already global) ── */
const {
    expect,
    it,
    describe,
    afterEach,
    beforeAll,   // eslint-disable-line import/no-extraneous-dependencies
} = require('@jest/globals');

/* ── Tiny in-memory logger stub (fulfils ILogger) ─────────────────────────── */
function createTestLogger() {
    const noop = () => {
    };
    return {
        info: jest.fn(noop),
        debug: jest.fn(noop),
        warn: jest.fn(noop),
        error: jest.fn(noop),
    };
}

/* ── Minimal GameDataRepository stub ──────────────────────────────────────── */
class StubGameDataRepository {
    constructor(defs) {
        this._defs = defs;
    }

    getEventDefinition(id) {
        return this._defs[id];
    }
}

/* ── Shared variables we’ll populate in beforeAll() ───────────────────────── */
let SafeEventDispatcher;        // class
let ValidatedEventDispatcher;   // class
let AjvSchemaValidator;         // class
let EventBus;                   // class

let dispatcher;                 // SafeEventDispatcher instance
let eventBus;                   // EventBus instance
let logger;                     // test logger
let listenerWarning;            // jest.fn()
let listenerError;              // jest.fn()

beforeAll(async () => {
    /* Dynamically import the ESM modules (works fine inside CommonJS) */
    ({SafeEventDispatcher} = await import('../../src/events/safeEventDispatcher.js'));
    ({default: EventBus} = await import('../../src/events/eventBus.js'));
    ({default: ValidatedEventDispatcher} = await import('../../src/events/validatedEventDispatcher.js'));
    ({default: AjvSchemaValidator} = await import('../../src/validation/ajvSchemaValidator.js'));

    logger = createTestLogger();
    eventBus = new EventBus();

    /* Ajv validator and schema preload */
    const schemaValidator = new AjvSchemaValidator(logger);
    await schemaValidator.addSchema(warningEventDef.payloadSchema, 'core:system_warning_occurred#payload');
    await schemaValidator.addSchema(errorEventDef.payloadSchema, 'core:system_error_occurred#payload');

    /* Stub repository knows the two definitions */
    const repo = new StubGameDataRepository({
        'core:system_warning_occurred': warningEventDef,
        'core:system_error_occurred': errorEventDef,
    });

    /* Wire up real ValidatedEventDispatcher + SafeEventDispatcher */
    const ved = new ValidatedEventDispatcher({
        eventBus,
        gameDataRepository: repo,
        schemaValidator,
        logger,
    });

    dispatcher = new SafeEventDispatcher({validatedEventDispatcher: ved, logger});

    /* Attach listeners so we can assert they fire (or not) */
    listenerWarning = jest.fn();
    listenerError = jest.fn();
    eventBus.subscribe('core:system_warning_occurred', listenerWarning);
    eventBus.subscribe('core:system_error_occurred', listenerError);
});

afterEach(() => jest.clearAllMocks());

/* ─────────────────────────  TESTS  ───────────────────────────────────────── */
describe('SafeEventDispatcher – core system events', () => {
    describe('core:system_warning_occurred', () => {
        it('dispatches with minimal valid payload', async () => {
            const payload = {message: 'Low disk space'};
            const ok = await dispatcher.dispatchSafely('core:system_warning_occurred', payload);
            expect(ok).toBe(true);
            expect(listenerWarning).toHaveBeenCalledTimes(1);
            expect(listenerWarning).toHaveBeenCalledWith({type: 'core:system_warning_occurred', payload});
        });

        it('dispatches with full valid details', async () => {
            const payload = {
                message: 'Low disk space',
                details: {
                    statusCode: 300,
                    url: 'https://example.com/health',
                    raw: 'diag',
                    timestamp: '2025-06-06T12:00:00Z',
                },
            };
            const ok = await dispatcher.dispatchSafely('core:system_warning_occurred', payload);
            expect(ok).toBe(true);
            expect(listenerWarning).toHaveBeenCalledTimes(1);
        });

        it('rejects payload missing message', async () => {
            const ok = await dispatcher.dispatchSafely('core:system_warning_occurred', {details: {statusCode: 300}});
            expect(ok).toBe(false);
            expect(listenerWarning).not.toHaveBeenCalled();
        });

        it('rejects payload with extra detail prop', async () => {
            const payload = {message: 'Low disk space', details: {statusCode: 300, unexpected: 'nope'}};
            const ok = await dispatcher.dispatchSafely('core:system_warning_occurred', payload);
            expect(ok).toBe(false);
            expect(listenerWarning).not.toHaveBeenCalled();
        });
    });

    describe('core:system_error_occurred', () => {
        it('dispatches with minimal valid payload', async () => {
            const payload = {message: 'Out of memory'};
            const ok = await dispatcher.dispatchSafely('core:system_error_occurred', payload);
            expect(ok).toBe(true);
            expect(listenerError).toHaveBeenCalledTimes(1);
            expect(listenerError).toHaveBeenCalledWith({type: 'core:system_error_occurred', payload});
        });

        it('dispatches with full valid details', async () => {
            const payload = {
                message: 'Out of memory',
                details: {
                    statusCode: 500,
                    url: 'https://example.com/status',
                    raw: 'dump',
                    stack: 'Error: at module.js:1:1',
                    timestamp: '2025-06-06T12:00:00Z',
                },
            };
            const ok = await dispatcher.dispatchSafely('core:system_error_occurred', payload);
            expect(ok).toBe(true);
            expect(listenerError).toHaveBeenCalledTimes(1);
        });

        it('rejects payload with wrong stack type', async () => {
            const payload = {message: 'Out of memory', details: {stack: 12345}};
            const ok = await dispatcher.dispatchSafely('core:system_error_occurred', payload);
            expect(ok).toBe(false);
            expect(listenerError).not.toHaveBeenCalled();
        });
    });
});