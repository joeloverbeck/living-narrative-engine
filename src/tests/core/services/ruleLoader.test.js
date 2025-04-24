// tests/core/services/ruleLoader.test.js

/* eslint-env jest */
import RuleLoader, {RuleLoaderError} from '../../../core/services/ruleLoader.js';
import EventBus from '../../../core/eventBus.js';
import {describe, expect, it, jest} from '@jest/globals';

// ---------------------------------------------------------------------
// helper factories
// ---------------------------------------------------------------------
const stubLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

const makeStubs = () => ({
    pathResolver: {resolveContentPath: jest.fn()},
    dataFetcher: {fetch: jest.fn()},
    schemaValidator: {
        addSchema: jest.fn(),
        isSchemaLoaded: jest.fn(),
        validate: jest.fn(),
        errors: [],
    },
    eventBus: {
        emit: jest.fn(),
        dispatch: jest.fn(),
        publish: jest.fn(),
        subscribe: jest.fn(),
        listenerCount: jest.fn().mockReturnValue(0),
    },
    logger: stubLogger(),
});

// ---------------------------------------------------------------------
// Constructor guard – unchanged behaviour
// ---------------------------------------------------------------------
describe('RuleLoader – constructor guards', () => {
    it('constructs when all dependencies are valid', () => {
        const s = makeStubs();
        expect(() =>
            new RuleLoader(
                s.pathResolver,
                s.dataFetcher,
                s.schemaValidator,
                s.eventBus,
                s.logger,
            )
        ).not.toThrow();
    });

    const cases = [
        ['pathResolver'],
        ['dataFetcher'],
        ['schemaValidator'],
        ['eventBus'],
        ['logger'],
    ];

    it.each(cases)('throws when %s is missing', (depName) => {
        const s = makeStubs();
        s[depName] = null;
        expect(() =>
            new RuleLoader(
                s.pathResolver,
                s.dataFetcher,
                s.schemaValidator,
                s.eventBus,
                s.logger,
            )
        ).toThrow(Error);
    });
});

// ---------------------------------------------------------------------
// Validation failure bubbles up
// ---------------------------------------------------------------------
describe('RuleLoader – schema validation', () => {
    it('throws RuleLoaderError when a fetched rule violates the schema', async () => {
        const s = makeStubs();

        // Fake directory listing (text/html with one link)
        const dirHtml = '<html><body><a href="invalid-rule.json">invalid-rule.json</a></body></html>';

        // Fake invalid rule (missing required "actions")
        const invalidRule = {event_type: 'demo:event'}; // actions omitted

        s.dataFetcher.fetch.mockImplementation(url => {
            if (url.endsWith('/')) {
                return Promise.resolve({
                    ok: true,
                    headers: {get: () => 'text/html'},
                    text: () => Promise.resolve(dirHtml),
                });
            }
            // the rule JSON
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(invalidRule),
            });
        });

        s.schemaValidator.validate.mockReturnValue({
            valid: false,
            errors: [{message: 'must have required property "actions"'}],
        });

        const loader = new RuleLoader(
            s.pathResolver,
            s.dataFetcher,
            s.schemaValidator,
            s.eventBus,
            s.logger,
        );

        await expect(loader.loadAll('./fake/'))
            .rejects.toBeInstanceOf(RuleLoaderError);

        expect(s.schemaValidator.validate).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------
// EventBus subscription & interpreter wiring
// ---------------------------------------------------------------------
describe('RuleLoader – EventBus integration', () => {
    it('dispatching an event runs interpreter once per rule', async () => {
        const htmlIndex =
            '<html><body>' +
            '<a href="r1.json">r1.json</a>' +
            '<a href="r2.json">r2.json</a>' +
            '</body></html>';

        const ruleA = {event_type: 'demo:event', rule_id: 'A', actions: []};
        const ruleB = {event_type: 'demo:event', rule_id: 'B', actions: []};

        // ----------------- stubs ---------------------------------------
        const dFetcher = {
            fetch: jest.fn((url) => {
                if (url.endsWith('/fake/')) {               // directory
                    return Promise.resolve({
                        ok: true,
                        headers: {get: () => 'text/html'},
                        text: () => Promise.resolve(htmlIndex),
                    });
                }
                if (url.endsWith('r1.json')) {
                    return Promise.resolve({ok: true, json: () => Promise.resolve(ruleA)});
                }
                return Promise.resolve({ok: true, json: () => Promise.resolve(ruleB)});
            }),
        };

        const schemaValidator = {
            addSchema: jest.fn(),
            isSchemaLoaded: jest.fn(),
            validate: jest.fn(() => ({valid: true})),
            errors: [],
        };
        const interpreter = {handle: jest.fn()};
        const bus = new EventBus();

        const loader = new RuleLoader(
            {resolveContentPath: () => ''},
            dFetcher,
            schemaValidator,
            bus,
            stubLogger(),
            interpreter,            // <- injection
        );

        await loader.loadAll('./fake/');

        // One listener only …
        expect(bus.listenerCount('demo:event')).toBe(1);

        // … but two rules → two calls
        await bus.dispatch('demo:event', {foo: 'bar'});
        expect(interpreter.handle).toHaveBeenCalledTimes(2);
    });
});