// src/tests/commandParser.test.js

import {describe, it, expect, beforeEach} from '@jest/globals';
import CommandParser from '../../commandParser.js'; // Adjust path if necessary

describe('CommandParser', () => {
    let parser;

    beforeEach(() => {
        parser = new CommandParser();
    });

    it('should parse "use iron key on north door" into core:action_use and targets', () => {
        const input = "use iron key on north door";
        const expected = {
            actionId: 'core:action_use',
            targets: ['iron', 'key', 'on', 'north', 'door'],
            originalInput: input,
            error: null,
        };
        expect(parser.parse(input)).toEqual(expected);
    });

    it('should parse "use key > north" into core:action_use and targets', () => {
        const input = "use key > north";
        const expected = {
            actionId: 'core:action_use',
            targets: ['key', '>', 'north'],
            originalInput: input,
            error: null,
        };
        expect(parser.parse(input)).toEqual(expected);
    });

    it('should parse "Use Potion" (mixed case) into core:action_use and target', () => {
        const input = "Use Potion";
        const expected = {
            actionId: 'core:action_use',
            targets: ['potion'], // Note: targets are lowercased by split logic in parser
            originalInput: input,
            error: null,
        };
        // Adjust expectation based on whether parser keeps original case for targets or lowercases them
        const result = parser.parse(input);
        // The current parser implementation lowercases everything *before* splitting targets
        expect(result.actionId).toBe(expected.actionId);
        expect(result.targets).toEqual(['potion']); // Parser currently lowercases targets
        expect(result.originalInput).toBe(expected.originalInput);
        expect(result.error).toBe(expected.error);
    });

    it('should parse "use potion" into core:action_use and target', () => {
        const input = "use potion";
        const expected = {
            actionId: 'core:action_use',
            targets: ['potion'],
            originalInput: input,
            error: null,
        };
        expect(parser.parse(input)).toEqual(expected);
    });

    it('should parse "use" into core:action_use and empty targets', () => {
        const input = "use";
        const expected = {
            actionId: 'core:action_use',
            targets: [],
            originalInput: input,
            error: null,
        };
        expect(parser.parse(input)).toEqual(expected);
    });

    it('should handle leading/trailing spaces: "  use item  "', () => {
        const input = "  use item  ";
        const expected = {
            actionId: 'core:action_use',
            targets: ['item'],
            originalInput: input,
            error: null,
        };
        expect(parser.parse(input)).toEqual(expected);
    });

    it('should handle multiple spaces between words: "use   the   key"', () => {
        const input = "use   the   key";
        const expected = {
            actionId: 'core:action_use',
            targets: ['the', 'key'],
            originalInput: input,
            error: null,
        };
        expect(parser.parse(input)).toEqual(expected);
    });

    it('should parse empty input string', () => {
        const input = "";
        const expected = {
            actionId: null,
            targets: [],
            originalInput: input,
            error: null,
        };
        expect(parser.parse(input)).toEqual(expected);
    });

    it('should parse input with only spaces', () => {
        const input = "   ";
        const expected = {
            actionId: null,
            targets: [],
            originalInput: input,
            error: null,
        };
        expect(parser.parse(input)).toEqual(expected);
    });

    // Test another action to ensure 'use' isn't hardcoded
    it('should parse "go north"', () => {
        const input = "go north";
        const expected = {
            actionId: 'core:action_move',
            targets: ['north'],
            originalInput: input,
            error: null,
        };
        expect(parser.parse(input)).toEqual(expected);
    });
});