// src/tests/core/services/runtimeEventTypeValidator.test.js

import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import RuntimeEventTypeValidator from '../../../core/services/runtimeEventTypeValidator.js'; // Adjust path as necessary

describe('RuntimeEventTypeValidator', () => {
    /** @type {RuntimeEventTypeValidator} */
    let validator;

    // Create a fresh validator instance before each test for isolation
    beforeEach(() => {
        validator = new RuntimeEventTypeValidator();
    });

    // Task 1: Test Initial State
    describe('Initial State', () => {
        it('should return false for any string before initialization', () => {
            expect(validator.isValidEventType('event:some_event')).toBe(false);
            expect(validator.isValidEventType('another:event')).toBe(false);
            expect(validator.isValidEventType('')).toBe(false); // Also handles empty string case initially
        });
    });

    // Task 2: Test `initialize` with `Set` Source
    describe('initialize with Set Source', () => {
        const sampleSet = new Set(['event:one', 'event:two']);

        it('should validate events present in the Set after initialization', () => {
            validator.initialize(sampleSet);
            expect(validator.isValidEventType('event:one')).toBe(true);
            expect(validator.isValidEventType('event:two')).toBe(true);
        });

        it('should not validate events not present in the Set after initialization', () => {
            validator.initialize(sampleSet);
            expect(validator.isValidEventType('event:three')).toBe(false);
            expect(validator.isValidEventType('event:on')).toBe(false); // Partial match check
            expect(validator.isValidEventType('event:One')).toBe(false); // Case-sensitive check
        });
    });

    // Task 3: Test `initialize` with `Array` Source
    describe('initialize with Array Source', () => {
        // Include duplicate to ensure Set conversion handles it
        const sampleArray = ['event:a', 'event:b', 'event:a'];

        it('should validate unique events present in the Array after initialization', () => {
            validator.initialize(sampleArray);
            expect(validator.isValidEventType('event:a')).toBe(true);
            expect(validator.isValidEventType('event:b')).toBe(true);
        });

        it('should not validate events not present in the Array after initialization', () => {
            validator.initialize(sampleArray);
            expect(validator.isValidEventType('event:c')).toBe(false);
            expect(validator.isValidEventType('event:A')).toBe(false); // Case-sensitive check
        });

        it('should handle an empty array source without errors, resulting in no valid types', () => {
            expect(() => validator.initialize([])).not.toThrow();
            expect(validator.isValidEventType('event:a')).toBe(false);
        });
    });

    // Task 4: Test `initialize` with `Object` Source (Simulating `eventTypes.js`)
    describe('initialize with Object Source', () => {
        const sampleObject = {
            TYPE_A: 'event:x',
            TYPE_B: 'event:y',
            IGNORED_PROP: 'no_colon', // Should be ignored (no colon)
            COUNT: 5,               // Should be ignored (not a string)
            DUPLICATE: 'event:x',   // Should be handled (added once)
            NULL_VAL: null,         // Should be ignored (not a string)
            UNDEFINED_VAL: undefined,// Should be ignored (not a string)
            EMPTY_STRING: '',       // Should be ignored (no colon)
            COLON_ONLY: ':',        // Should be added (contains colon)
        };

        it('should validate correct event strings from object values and ignore others', () => {
            validator.initialize(sampleObject);
            expect(validator.isValidEventType('event:x')).toBe(true);
            expect(validator.isValidEventType('event:y')).toBe(true);
            expect(validator.isValidEventType(':')).toBe(true); // Colon-only string is valid by current rule
        });

        it('should not validate values that were filtered out during object initialization', () => {
            validator.initialize(sampleObject);
            expect(validator.isValidEventType('no_colon')).toBe(false);
            expect(validator.isValidEventType('5')).toBe(false); // Check number wasn't stringified and added
            expect(validator.isValidEventType('null')).toBe(false);
            expect(validator.isValidEventType('undefined')).toBe(false);
            expect(validator.isValidEventType('')).toBe(false);
        });

        it('should handle an empty object source without errors, resulting in no valid types', () => {
            expect(() => validator.initialize({})).not.toThrow();
            expect(validator.isValidEventType('event:x')).toBe(false);
        });
    });

    // Task 5: Test `initialize` with Invalid Input Types
    describe('initialize with Invalid Input Types', () => {
        // Use it.each for multiple invalid inputs
        it.each([
            ['null', null],
            ['undefined', undefined],
            ['a number', 123],
            ['a string', 'invalid string'],
            ['a boolean', true],
        ])('should throw an error when initializing with %s', (desc, invalidInput) => {
            // Wrap the call in a function for toThrow assertion
            const action = () => validator.initialize(invalidInput);
            // Assert that an Error is thrown
            expect(action).toThrow(Error);
            // Optional: Assert specific error message content
            expect(action).toThrow(/Invalid eventTypesSource provided/i);
        });
    });

    // Task 6: Test Re-initialization Behavior
    describe('Re-initialization Behavior', () => {
        it('should clear previous types and use only the latest source', () => {
            const source1 = new Set(['event:initial', 'event:shared']);
            const source2 = ['event:new', 'event:shared']; // Use Array for variety

            // Initialize first time
            validator.initialize(source1);
            // Verify initial state
            expect(validator.isValidEventType('event:initial')).toBe(true);
            expect(validator.isValidEventType('event:shared')).toBe(true);
            expect(validator.isValidEventType('event:new')).toBe(false);

            // Re-initialize with the second source
            validator.initialize(source2);

            // Verify state after re-initialization
            expect(validator.isValidEventType('event:new')).toBe(true);     // New event is now valid
            expect(validator.isValidEventType('event:shared')).toBe(true);  // Shared event remains valid
            expect(validator.isValidEventType('event:initial')).toBe(false); // Event only in the first source is now invalid
        });
    });

    // Task 7: Test `isValidEventType` Input Edge Cases
    describe('isValidEventType Input Edge Cases', () => {
        // Initialize with some data so we are testing the input validation, not just the empty set state
        beforeEach(() => {
            validator.initialize(new Set(['event:valid']));
        });

        it.each([
            ['null', null],
            ['undefined', undefined],
            ['empty string', ''],
            ['whitespace string', '   '],
            ['a number (0)', 0],
            ['a number (123)', 123],
            ['an object', {}],
            ['an object with toString', {toString: () => 'event:valid'}], // Still not a string type
            ['a boolean (false)', false],
            ['a boolean (true)', true],
            // Add an array case for good measure, although typeof !== 'string' covers it
            ['an array', ['event:valid']],
        ])('should return false for non-string or empty/whitespace input: %s', (desc, edgeInput) => {
            expect(validator.isValidEventType(edgeInput)).toBe(false);
        });

        it('should return true for a valid event type after initialization', () => {
            // Sanity check that the method still works for valid input after edge case tests setup
            expect(validator.isValidEventType('event:valid')).toBe(true);
        });
    });
});