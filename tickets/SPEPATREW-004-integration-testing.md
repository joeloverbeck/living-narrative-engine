# SPEPATREW-004: Add Integration Tests for Speech Patterns System

## Objective
Create comprehensive integration tests that verify the complete workflow from entity loading through prompt formatting for both legacy and new speech pattern formats.

## Priority
**High** - Validates end-to-end behavior and backward compatibility

## Estimated Effort
0.5 days

## Dependencies
- **SPEPATREW-001** must be completed (schema updated)
- **SPEPATREW-002** must be completed (format detection)
- **SPEPATREW-003** must be completed (rendering methods)

## Files to Touch
- `tests/integration/prompting/speechPatternsIntegration.test.js` (create new file)
- `tests/common/testBed.js` (may need helper methods, optional)

## Implementation Details

### Test File Structure
Create comprehensive integration test file covering:

1. **End-to-End Formatting Tests**
   - Load character with structured patterns
   - Format for prompt generation
   - Verify XML structure
   - Verify usage guidance

2. **Backward Compatibility Tests**
   - Load character with legacy string patterns
   - Verify formatting works
   - Compare output structure

3. **Mixed Format Tests**
   - Load character with both formats
   - Verify combined output
   - Check ordering (structured first, then legacy)

4. **Real Character Tests**
   - Load actual Vespera character
   - Format speech patterns
   - Verify output is non-empty
   - Check for expected elements

5. **Schema Validation Tests**
   - Validate structured patterns against schema
   - Reject invalid patterns
   - Verify error messages

### Test Data Setup
Create test fixtures for:
- Mock entities with structured patterns
- Mock entities with legacy patterns
- Mock entities with mixed patterns
- Invalid pattern structures for error cases

## Out of Scope
- **DO NOT** modify production code in `src/`
- **DO NOT** create new entity definition files
- **DO NOT** modify existing character files
- **DO NOT** add UI tests (that's for generator, not this ticket)
- **DO NOT** test LLM integration (mock LLM responses if needed)
- **DO NOT** modify schema files
- **DO NOT** test generator functionality (separate ticket)

## Acceptance Criteria

### Tests That Must Pass

#### End-to-End Tests (5 tests)
1. Structured patterns load and format correctly
2. Legacy patterns load and format correctly
3. Mixed patterns load and format correctly
4. Empty patterns return empty string
5. Missing component returns empty string

#### Backward Compatibility Tests (3 tests)
6. Vespera character loads successfully
7. Vespera patterns format to non-empty string
8. Output contains expected XML tags and usage guidance

#### Schema Validation Tests (4 tests)
9. Valid structured pattern validates
10. Missing `type` field rejected
11. Missing `examples` field rejected
12. Empty `examples` array rejected

#### Format Verification Tests (5 tests)
13. Structured output contains `<speech_patterns>` tags
14. Structured output contains pattern type in bold
15. Legacy output contains bullet points
16. Mixed output contains both sections
17. Usage guidance present in all formats

#### Integration Flow Tests (3 tests)
18. Complete workflow: create entity → get component → format → validate output
19. Multiple characters in sequence don't interfere
20. Format detection works correctly in integration context

### Invariants
- No modifications to production code
- All tests are isolated (no shared state)
- Each test cleans up after itself
- Tests run independently and in any order
- No external dependencies (mock LLM if needed)
- No file system writes except for logs
- Existing integration tests still pass

## Validation Commands
```bash
# Run integration tests only
npm run test:integration -- tests/integration/prompting/speechPatternsIntegration.test.js

# Run all integration tests
npm run test:integration

# Run full test suite
npm run test:ci

# Type check
npm run typecheck

# Lint
npx eslint tests/integration/prompting/speechPatternsIntegration.test.js
```

## Definition of Done
- [ ] Integration test file created
- [ ] All 20 test cases implemented and pass
- [ ] Tests cover structured, legacy, and mixed formats
- [ ] Real character (Vespera) tested successfully
- [ ] Schema validation integrated
- [ ] All existing integration tests still pass
- [ ] Test coverage report shows ≥80% coverage for integration scenarios
- [ ] All validation commands pass
- [ ] Code review completed
