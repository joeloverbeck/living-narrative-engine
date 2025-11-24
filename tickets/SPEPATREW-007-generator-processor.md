# SPEPATREW-007: Update Speech Patterns Response Processor

## Objective
Modify `SpeechPatternsResponseProcessor` to validate and process both legacy string format and new structured object format responses from the LLM.

## Priority
**Medium** - Generator validation and processing

## Estimated Effort
1 day

## Dependencies
- **SPEPATREW-001** must be completed (schema supports new format)
- **SPEPATREW-006** must be completed (prompts request new format)

## Files to Touch
- `src/characterBuilder/services/SpeechPatternsResponseProcessor.js`
- `tests/unit/characterBuilder/services/SpeechPatternsResponseProcessor.test.js`

## Implementation Details

### Add Format Detection Method
```javascript
/**
 * Determines if response is legacy string format or structured object format
 * @private
 * @param {Array} parsed - Parsed JSON response
 * @returns {boolean} True if legacy format (array of strings)
 */
#isLegacyFormat(parsed) {
  return Array.isArray(parsed) &&
         parsed.length > 0 &&
         typeof parsed[0] === 'string';
}
```

### Add Structured Format Validation
```javascript
/**
 * Validates and normalizes structured object format
 * @private
 * @param {Array} parsed - Array of pattern objects
 * @returns {Array} Validated pattern objects
 * @throws {Error} If validation fails
 */
#validateStructuredFormat(parsed) {
  if (!Array.isArray(parsed)) {
    throw new Error('Response must be an array of pattern objects');
  }

  return parsed.map((pattern, index) => {
    // Validate pattern is object
    if (typeof pattern !== 'object' || pattern === null) {
      throw new Error(`Pattern ${index} must be an object`);
    }

    // Validate required type field
    if (!pattern.type || typeof pattern.type !== 'string') {
      throw new Error(`Pattern ${index} missing required 'type' field`);
    }

    // Validate required examples field
    if (!Array.isArray(pattern.examples) || pattern.examples.length === 0) {
      throw new Error(`Pattern ${index} missing required 'examples' array`);
    }

    // Validate optional contexts field
    if (pattern.contexts && !Array.isArray(pattern.contexts)) {
      throw new Error(`Pattern ${index} 'contexts' must be an array`);
    }

    // Normalize and return
    return {
      type: pattern.type.trim(),
      contexts: pattern.contexts || [],
      examples: pattern.examples.map(e => e.trim())
    };
  });
}
```

### Update Main Processing Method
Modify `#parseTextResponse(responseText)`:
```javascript
#parseTextResponse(responseText) {
  const parsed = this.#extractJSON(responseText);

  // Detect format
  if (this.#isLegacyFormat(parsed)) {
    return this.#validateLegacyFormat(parsed);
  }

  return this.#validateStructuredFormat(parsed);
}
```

### Keep Legacy Validation
Preserve existing `#validateLegacyFormat()` method for backward compatibility.

## Out of Scope
- **DO NOT** modify UI display logic (that's SPEPATREW-008)
- **DO NOT** change export functionality
- **DO NOT** modify LLM service integration
- **DO NOT** update prompt generation
- **DO NOT** change other processor services
- **DO NOT** modify HTML/CSS files
- **DO NOT** implement migration tools

## Acceptance Criteria

### Tests That Must Pass

#### Format Detection Tests (4 tests)
1. String array `["pattern1", "pattern2"]` detected as legacy
2. Object array `[{type: "X", examples: ["e"]}]` detected as structured
3. Empty array `[]` detected as legacy (default behavior)
4. `#isLegacyFormat()` returns boolean

#### Structured Format Validation Tests (15 tests)
5. Valid object with type and examples validates
6. Missing `type` field throws error
7. Empty `type` string throws error
8. Missing `examples` field throws error
9. Empty `examples` array throws error
10. `examples` not array throws error
11. Optional `contexts` field allowed
12. Missing `contexts` defaults to empty array
13. `contexts` not array throws error
14. Whitespace trimmed from `type`
15. Whitespace trimmed from `examples`
16. Multiple objects validate correctly
17. Error messages include pattern index
18. Error messages are descriptive
19. Non-object item throws error

#### Legacy Format Tests (3 tests)
20. Legacy validation still works
21. String array processes correctly
22. Mixed types in legacy throw error

#### Integration Tests (3 tests)
23. Process valid structured response end-to-end
24. Process valid legacy response end-to-end
25. Switch between formats based on detection

### Invariants
- Method signatures unchanged
- Throws errors (doesn't return invalid data)
- Error messages are clear and actionable
- No side effects during validation
- Input data not modified
- Always returns array (structured or legacy)
- Deterministic for same input
- No external dependencies

## Validation Commands
```bash
# Run specific test file
npm run test:unit -- tests/unit/characterBuilder/services/SpeechPatternsResponseProcessor.test.js

# Run with coverage
npm run test:unit -- tests/unit/characterBuilder/services/SpeechPatternsResponseProcessor.test.js --coverage

# Type check
npm run typecheck

# Lint
npx eslint src/characterBuilder/services/SpeechPatternsResponseProcessor.js

# Run all unit tests
npm run test:unit
```

## Definition of Done
- [ ] `#isLegacyFormat()` method implemented
- [ ] `#validateStructuredFormat()` method implemented
- [ ] `#parseTextResponse()` updated with format detection
- [ ] All 25 test cases pass
- [ ] Test coverage ≥90% for new methods
- [ ] Error messages are descriptive with pattern index
- [ ] Legacy format validation preserved
- [ ] All validation commands pass
- [ ] Code review completed
- [ ] Manual test: process both format types successfully
