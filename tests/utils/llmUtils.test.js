// tests/utils/llmUtils.test.js
// --- FILE START ---

import {cleanLLMJsonOutput, CONVERSATIONAL_PREFIXES} from '../../src/utils/llmUtils.js';
import {describe, expect, test} from "@jest/globals"; // Adjust path as needed

describe('cleanLLMJsonOutput', () => {
    // Acceptance Criterion 1: Non-string input handling
    describe('Non-String Input Handling', () => {
        test('should return null for null input', () => {
            expect(cleanLLMJsonOutput(null)).toBeNull();
        });

        test('should return undefined for undefined input', () => {
            expect(cleanLLMJsonOutput(undefined)).toBeUndefined();
        });

        test('should return numbers as is', () => {
            expect(cleanLLMJsonOutput(123)).toBe(123);
            expect(cleanLLMJsonOutput(0)).toBe(0);
            expect(cleanLLMJsonOutput(-45.67)).toBe(-45.67);
        });

        test('should return booleans as is', () => {
            expect(cleanLLMJsonOutput(true)).toBe(true);
            expect(cleanLLMJsonOutput(false)).toBe(false);
        });

        test('should return objects as is (by reference)', () => {
            const obj = {key: 'value'};
            expect(cleanLLMJsonOutput(obj)).toBe(obj);
        });

        test('should return arrays as is (by reference)', () => {
            const arr = [1, 2, 3];
            expect(cleanLLMJsonOutput(arr)).toBe(arr);
        });
    });

    // Acceptance Criterion 2: Conversational prefix removal
    describe('Conversational Prefix Removal', () => {
        const prefixes = [
            "here is the json:",
            "here's the json:",
            "sure, here is the json:",
            "certainly, here is the json object:",
            "okay, here's the json:",
            "here is your json:",
            "here is the json output:",
            "the json response is:"
        ];
        const jsonData = '{"key": "value"}';

        prefixes.forEach(prefix => {
            test(`should remove prefix: "${prefix}"`, () => {
                expect(cleanLLMJsonOutput(`${prefix}${jsonData}`)).toBe(jsonData);
            });

            test(`should remove prefix (case-insensitive): "${prefix.toUpperCase()}"`, () => {
                expect(cleanLLMJsonOutput(`${prefix.toUpperCase()}${jsonData}`)).toBe(jsonData);
            });

            test(`should remove prefix with trailing whitespace: "${prefix}   ${jsonData}"`, () => {
                expect(cleanLLMJsonOutput(`${prefix}   ${jsonData}`)).toBe(jsonData);
            });

            test(`should remove prefix and trim result: "${prefix}   ${jsonData}  "`, () => {
                expect(cleanLLMJsonOutput(`${prefix}   ${jsonData}  `)).toBe(jsonData);
            });

            test(`should remove prefix when it's the only content: "${prefix}"`, () => {
                expect(cleanLLMJsonOutput(prefix)).toBe("");
            });

            test(`should remove prefix with only whitespace after: "${prefix}   "`, () => {
                expect(cleanLLMJsonOutput(`${prefix}   `)).toBe("");
            });
        });

        test('should only remove one prefix if multiple could match (not typical with current list)', () => {
            // This test is more conceptual with the current prefix list as none are substrings of others at the start.
            // If a prefix "here is the json:" and "here is the json: and more" existed,
            // only the longer one matching first (if ordered that way) or the first one in the list would be removed.
            // With current implementation, it's the first one from CONVERSATIONAL_PREFIXES that matches.
            const input = `here is the json: ${jsonData}`; // Assuming "here is the json:" is in the list
            expect(cleanLLMJsonOutput(input)).toBe(jsonData);
        });

        test('should not remove prefix if not at the beginning', () => {
            const input = `Some text before here is the json: ${jsonData}`;
            expect(cleanLLMJsonOutput(input)).toBe(input); // Trimmed, but prefix stays
        });

        test('should not remove prefix if it is part of the JSON content itself', () => {
            const content = '{"message": "here is the json: not a prefix"}';
            expect(cleanLLMJsonOutput(content)).toBe(content);
        });
    });

    // Acceptance Criterion 3: Markdown wrapper removal
    describe('Markdown Wrapper Removal', () => {
        const jsonData = '{"key": "value"}';
        const jsonDataWithNewlines = '{\n  "key": "value"\n}';

        // Cases for ```json ... ```
        test('should remove ```json wrapper', () => {
            expect(cleanLLMJsonOutput(`\`\`\`json${jsonData}\`\`\``)).toBe(jsonData);
        });
        test('should remove ```json wrapper with newline after opening', () => {
            expect(cleanLLMJsonOutput(`\`\`\`json\n${jsonDataWithNewlines}\`\`\``)).toBe(jsonDataWithNewlines);
        });
        test('should remove ```json wrapper with newline before closing', () => {
            expect(cleanLLMJsonOutput(`\`\`\`json${jsonDataWithNewlines}\n\`\`\``)).toBe(jsonDataWithNewlines);
        });
        test('should remove ```json wrapper with newlines and spaces', () => {
            expect(cleanLLMJsonOutput(`\`\`\`json \n ${jsonDataWithNewlines} \n \`\`\``)).toBe(jsonDataWithNewlines);
        });
        test('should remove ```json wrapper with only whitespace content', () => {
            expect(cleanLLMJsonOutput('```json\n   \n```')).toBe('');
        });
        test('should remove ```json wrapper with empty content (no newline)', () => {
            expect(cleanLLMJsonOutput('```json```')).toBe('');
        });
        test('should remove ```json wrapper with empty content (with newline)', () => {
            expect(cleanLLMJsonOutput('```json\n```')).toBe('');
        });

        // Cases for ```markdown ... ```
        test('should remove ```markdown wrapper', () => {
            expect(cleanLLMJsonOutput(`\`\`\`markdown${jsonData}\`\`\``)).toBe(jsonData);
        });
        test('should remove ```markdown wrapper with newlines', () => {
            expect(cleanLLMJsonOutput(`\`\`\`markdown\n${jsonDataWithNewlines}\n\`\`\``)).toBe(jsonDataWithNewlines);
        });
        test('should remove ```markdown wrapper with only whitespace content', () => {
            expect(cleanLLMJsonOutput('```markdown  ```')).toBe('');
        });

        // Cases for ``` ... ``` (generic wrapper)
        test('should remove ``` generic wrapper', () => {
            expect(cleanLLMJsonOutput(`\`\`\`${jsonData}\`\`\``)).toBe(jsonData);
        });
        test('should remove ``` generic wrapper with newlines', () => {
            expect(cleanLLMJsonOutput(`\`\`\`\n${jsonDataWithNewlines}\n\`\`\``)).toBe(jsonDataWithNewlines);
        });
        test('should remove ``` generic wrapper with only whitespace content', () => {
            expect(cleanLLMJsonOutput('```\n   \n```')).toBe('');
        });
        test('should remove ``` generic wrapper with empty content', () => {
            expect(cleanLLMJsonOutput('``` ```')).toBe(''); // Content is " " -> ""
            expect(cleanLLMJsonOutput('``````')).toBe('');
        });

        test('should not remove wrapper if not at start/end or malformed', () => {
            const input1 = `Some text before \`\`\`json${jsonData}\`\`\``;
            expect(cleanLLMJsonOutput(input1)).toBe(input1);
            const input2 = `\`\`\`json${jsonData}\`\`\` and some text after`;
            expect(cleanLLMJsonOutput(input2)).toBe(input2);
            const input3 = `\`\`\`json${jsonData}`; // Missing closing backticks
            expect(cleanLLMJsonOutput(input3)).toBe(input3);
        });
    });

    // Acceptance Criterion 4: Trimming
    describe('Trimming', () => {
        const jsonData = '{"key": "value"}';
        test('should trim leading whitespace', () => {
            expect(cleanLLMJsonOutput(`   ${jsonData}`)).toBe(jsonData);
        });
        test('should trim trailing whitespace', () => {
            expect(cleanLLMJsonOutput(`${jsonData}   `)).toBe(jsonData);
        });
        test('should trim both leading and trailing whitespace', () => {
            expect(cleanLLMJsonOutput(`  ${jsonData}  `)).toBe(jsonData);
        });
        test('should trim newlines and tabs', () => {
            expect(cleanLLMJsonOutput(`\n\t  ${jsonData}\t\n  `)).toBe(jsonData);
        });
    });

    // Acceptance Criterion 5: Handles valid JSON without prefixes/wrappers
    describe('Handling Clean JSON', () => {
        const jsonData = '{"key": "value"}';
        test('should return clean JSON as is (after potential trim)', () => {
            expect(cleanLLMJsonOutput(jsonData)).toBe(jsonData);
        });
        test('should return clean JSON with surrounding whitespace, trimmed', () => {
            expect(cleanLLMJsonOutput(`  ${jsonData}  `)).toBe(jsonData);
        });
        test('should handle JSON with internal spacing correctly', () => {
            const internalSpaceJson = '{ "key" : "value" }';
            expect(cleanLLMJsonOutput(internalSpaceJson)).toBe(internalSpaceJson);
            expect(cleanLLMJsonOutput(`  ${internalSpaceJson}  `)).toBe(internalSpaceJson);
        });
    });

    // Acceptance Criterion 6: Handles empty/whitespace strings with prefixes/wrappers
    describe('Handling Empty or Whitespace Strings', () => {
        test('should return an empty string for an empty input string', () => {
            expect(cleanLLMJsonOutput('')).toBe('');
        });
        test('should return an empty string for a whitespace-only input string', () => {
            expect(cleanLLMJsonOutput('   \n\t  ')).toBe('');
        });

        test('should return empty string if prefix is followed by only whitespace', () => {
            expect(cleanLLMJsonOutput('here is the json:   ')).toBe('');
        });
        test('should return empty string if wrapper contains only whitespace', () => {
            expect(cleanLLMJsonOutput('```json\n    \n```')).toBe('');
            expect(cleanLLMJsonOutput('```\n \t \n```')).toBe('');
        });
        test('should return empty string if prefix and wrapper contain only whitespace', () => {
            expect(cleanLLMJsonOutput('here is the json: ```json\n   \n```')).toBe('');
        });
        test('should return empty string for prefix followed by empty wrapper', () => {
            expect(cleanLLMJsonOutput("here's the json:```json```")).toBe('');
        });
        test('should return empty string for prefix followed by empty generic wrapper', () => {
            expect(cleanLLMJsonOutput("here's the json:``````")).toBe('');
        });
    });

// Acceptance Criterion 8: Strings with prefixes/wrappers at unexpected positions
    describe('Prefixes/Wrappers at Unexpected Positions', () => {
        const jsonData = '{"key": "value"}';
        test('should not remove prefix if not at the start', () => {
            const input = `Hello ${CONVERSATIONAL_PREFIXES[0]} ${jsonData}`;
            expect(cleanLLMJsonOutput(input)).toBe(input.trim());
        });

        test('should not remove wrapper if not encompassing the whole (remaining) string after potential prefix removal', () => {
            const input1 = `\`\`\`json${jsonData}\`\`\` Some trailing text.`;
            expect(cleanLLMJsonOutput(input1)).toBe(input1.trim());

            const input2 = `Leading text \`\`\`json${jsonData}\`\`\``;
            expect(cleanLLMJsonOutput(input2)).toBe(input2.trim());

            const input3 = `${CONVERSATIONAL_PREFIXES[0]} TextBeforeWrapper \`\`\`json${jsonData}\`\`\``;
            const expected3 = `TextBeforeWrapper \`\`\`json${jsonData}\`\`\``;
            expect(cleanLLMJsonOutput(input3)).toBe(expected3.trim());
        });
    });

// Specific edge cases
    describe('Specific Edge Cases', () => {
        test('string with only ```', () => {
            expect(cleanLLMJsonOutput('```')).toBe('```'); // Not a complete wrapper
        });
        test('string with only ```json', () => {
            expect(cleanLLMJsonOutput('```json')).toBe('```json');
        });
        test('string with content looking like incomplete wrapper', () => {
            expect(cleanLLMJsonOutput('```json text')).toBe('```json text');
        });
        test('string with json content that contains triple backticks internally', () => {
            const content = '{"code": "```js console.log(\\"hello\\") ```"}';
            expect(cleanLLMJsonOutput(content)).toBe(content);

            const wrappedContent = `\`\`\`json\n${content}\n\`\`\``;
            expect(cleanLLMJsonOutput(wrappedContent)).toBe(content);

            const prefixWrappedContent = `${CONVERSATIONAL_PREFIXES[0]}${wrappedContent}`;
            expect(cleanLLMJsonOutput(prefixWrappedContent)).toBe(content);
        });
        test('string that is just a prefix and spaces', () => {
            expect(cleanLLMJsonOutput("here is the json:            ")).toBe("");
        });
        test('string that is just a wrapper and spaces', () => {
            expect(cleanLLMJsonOutput("   ```json\n{\"key\":\"value\"}\n```   ")).toBe("{\"key\":\"value\"}");
        });
    });
});

// --- FILE END ---