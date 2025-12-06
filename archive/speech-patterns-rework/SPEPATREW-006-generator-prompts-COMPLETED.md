# SPEPATREW-006: Update Speech Patterns Generator Prompts

## Status

**COMPLETED** - 2025-01-24

## Objective

Update the prompt templates and response schema in the speech patterns generator to match the component schema structure: pattern groups with `type`, `contexts[]`, and `examples[]` instead of individual patterns with `pattern`, `example`, and `circumstances`.

## Priority

**Medium** - Generator enhancement

## Estimated Effort

0.5 days

## Dependencies

- **SPEPATREW-001** must be completed (schema supports new format)

## Implementation Summary

### Changes Made

#### 1. Response Schema (SPEECH_PATTERNS_RESPONSE_SCHEMA)

**Changed field structure:**

- ✅ `pattern` → `type` (category name)
- ✅ `example` (singular string) → `examples` (array of 2-5 strings)
- ✅ `circumstances` (optional string) → `contexts` (optional array of strings)
- ✅ Added minItems: 3, maxItems: 8 for speechPatterns array
- ✅ Added minItems: 2, maxItems: 5 for examples array
- ✅ Updated required fields to ['type', 'examples']

#### 2. Prompt Template Updates

**Modified `createSpeechPatternsPrompt()`:**

- ✅ Task definition: "4-8 speech pattern groups" instead of "~20 individual patterns"
- ✅ Instructions: Clarified category-based organization
- ✅ Constraints: Updated to reflect group structure with 2-5 examples each
- ✅ Examples section: Real JSON examples with type/contexts/examples structure
- ✅ Response format: Updated to show correct field names

#### 3. Validation Function Updates

**Modified `validateSpeechPatternsGenerationResponse()`:**

- ✅ Checks for `type` field (not `pattern`)
- ✅ Validates `contexts` is array (if present) with string items
- ✅ Validates `examples` is array with 2-5 items
- ✅ Validates each context string (minLength: 1)
- ✅ Validates each example string (minLength: 3)
- ✅ Provides detailed error messages for array validation

#### 4. Version Update

- ✅ Updated PROMPT_VERSION_INFO to 3.0.0
- ✅ Added version 2.0.0 to previousVersions
- ✅ Updated currentChanges to reflect new structure

### Test Updates

**Updated all 19 existing tests:**

- ✅ Version info test (3.0.0 with correct change log)
- ✅ Schema structure test (type/contexts/examples)
- ✅ Prompt generation tests (new structure in output)
- ✅ Validation success test (new field names)
- ✅ Validation failure tests (updated error messages)

**Added 5 new tests:**

- ✅ Validates contexts array contains strings
- ✅ Validates contexts strings are not empty
- ✅ Validates examples array contains strings
- ✅ Validates examples are at least 3 characters
- ✅ Validates examples array has at most 5 items

**Total: 24 tests, all passing**

## Files Modified

- ✅ `src/characterBuilder/prompts/speechPatternsPrompts.js` (schema, prompt, validation)
- ✅ `tests/unit/characterBuilder/prompts/speechPatternsPrompts.test.js` (19 updated + 5 new)

## Validation Results

### Test Execution

```bash
npm run test:unit -- tests/unit/characterBuilder/prompts/speechPatternsPrompts.test.js
```

**Result:** ✅ All 24 tests pass

### Linting

```bash
npx eslint src/characterBuilder/prompts/speechPatternsPrompts.js tests/unit/characterBuilder/prompts/speechPatternsPrompts.test.js
```

**Result:** ✅ No errors

### Type Checking

```bash
npm run typecheck
```

**Result:** ✅ No errors in modified files

## Acceptance Criteria - All Met ✅

### Schema Updates (5/5)

1. ✅ Uses `type` field instead of `pattern`
2. ✅ Uses `contexts` array instead of `circumstances` string
3. ✅ Uses `examples` array instead of `example` string
4. ✅ Requires `type` and `examples`, with `contexts` optional
5. ✅ Specifies `examples` minItems: 2, maxItems: 5

### Prompt Updates (5/5)

6. ✅ Response format shows new structure
7. ✅ Instructions mention 4-8 pattern groups
8. ✅ Instructions specify 2-5 examples per group
9. ✅ Instructions mention 15-25 total examples
10. ✅ Examples section demonstrates new format

### Validation Updates (5/5)

11. ✅ Checks for `type` field (not `pattern`)
12. ✅ Checks `contexts` is array (if present)
13. ✅ Checks `examples` is array with minItems: 2
14. ✅ Validates each context string
15. ✅ Validates each example string (minLength: 3)

### Tests (5/5)

16. ✅ All existing tests updated to new field names
17. ✅ Tests verify type/contexts[]/examples[] structure
18. ✅ Tests cover contexts array validation
19. ✅ Tests cover examples array validation
20. ✅ All 24 tests pass

### Code Quality (4/4)

21. ✅ Function signatures unchanged (backward compatible)
22. ✅ Clear error messages for new validation rules
23. ✅ Consistent with speech_patterns.component.json schema
24. ✅ No external dependencies added

## Outcome

Successfully updated the speech patterns generator prompts to match the component schema structure. The implementation:

1. **Aligns with Data Schema**: Now matches `speech_patterns.component.json` exactly
2. **Improves Organization**: Groups patterns by category instead of flat list
3. **Enhances Validation**: Comprehensive array validation with detailed error messages
4. **Maintains Quality**: All tests pass, no regressions
5. **Preserves API**: Function signatures unchanged for backward compatibility

The LLM will now generate structured pattern groups like:

```json
{
  "type": "Deadpan Dark Humor",
  "contexts": ["Moments of tension", "When threatened"],
  "examples": ["ex1", "ex2", "ex3"]
}
```

Instead of the old flat structure:

```json
{
  "pattern": "description",
  "example": "single example",
  "circumstances": "single context"
}
```

This better supports the component's data structure and provides clearer organization of speech patterns by thematic categories.
