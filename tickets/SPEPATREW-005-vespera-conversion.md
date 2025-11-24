# SPEPATREW-005: Convert Vespera Character to Structured Format

## Objective
Manually convert Vespera Nightwhisper's speech patterns from legacy string array (18 patterns) to structured object format (6 categories) with proper organization and context tags.

## Priority
**Medium** - Example implementation and validation

## Estimated Effort
0.25 days

## Dependencies
- **SPEPATREW-001** must be completed (schema supports new format)
- **SPEPATREW-003** must be completed (rendering works)
- **SPEPATREW-004** must be completed (tests verify it works)

## Files to Touch
- `data/mods/fantasy/entities/definitions/vespera_nightwhisper.character.json`

## Implementation Details

### Pattern Categories to Create (6 total)

1. **Feline Verbal Tics**
   - Contexts: `["casual", "manipulative", "vulnerable"]`
   - 4 examples with cat-related wordplay

2. **Narrativization Bleeding**
   - Contexts: `["casual", "storytelling", "evasive"]`
   - 4 examples of third-person narration

3. **Tonal Shifts**
   - Contexts: `["manipulation", "vulnerability", "power dynamics"]`
   - 4 examples with mood changes marked

4. **Violence Casualization**
   - Contexts: `["combat", "threats", "dark humor"]`
   - 4 examples of casual violent language

5. **Deflection & Exposure Patterns**
   - Contexts: `["vulnerability", "intimacy", "revealing moments"]`
   - 4 examples of emotional vulnerability

6. **Fragmented Memory & Possession**
   - Contexts: `["confusion", "identity crisis", "supernatural influence"]`
   - 4 examples of ghost possession references

### Conversion Process
1. Read current 18 string patterns
2. Organize into 6 thematic groups
3. Extract examples from string format
4. Add appropriate context tags
5. Format as structured objects
6. Maintain total example count (~20-24 examples)

### Quality Guidelines
- Each category should feel distinct
- Contexts should accurately reflect usage
- Examples should be authentic to character voice
- No loss of pattern richness or nuance
- Preserve all unique speech characteristics

## Out of Scope
- **DO NOT** modify other character files
- **DO NOT** create additional categories beyond 6
- **DO NOT** change character personality or background
- **DO NOT** add examples not based on original patterns
- **DO NOT** modify other components in the entity file
- **DO NOT** change entity ID or core properties
- **DO NOT** update character metadata beyond patterns

## Acceptance Criteria

### Tests That Must Pass
1. Character file validates against schema
2. `npm run validate` passes for all mods
3. Entity loads successfully in integration tests
4. Formatted output contains 6 pattern groups
5. All 6 groups have `type` and `examples` fields
6. All groups have `contexts` arrays with values
7. Total examples count is 20-24
8. No duplicate examples across groups
9. All existing Vespera tests continue to pass
10. Integration test loads Vespera successfully

### Manual Verification
11. Load game and interact with Vespera
12. Verify LLM uses patterns naturally
13. Check that all pattern types appear in dialogue
14. Confirm no mechanical cycling through patterns
15. Assess dialogue quality improvement (subjective)

### Invariants
- Entity ID remains `fantasy:vespera_nightwhisper`
- All other components unchanged
- File remains valid JSON
- Pattern categories clearly distinct
- Context tags are lowercase and consistent
- Examples maintain authentic character voice
- No typos or grammar errors in examples
- Total token count roughly equivalent to original

## Validation Commands
```bash
# Validate schema compliance
npm run validate

# Run mod-specific validation
npm run validate:mod:fantasy

# Load character in test
npm run test:integration -- --testNamePattern="Vespera"

# Full test suite
npm run test:ci

# Type check
npm run typecheck
```

## Definition of Done
- [ ] Vespera's patterns converted to 6 structured categories
- [ ] All categories have type, contexts, and examples
- [ ] 20-24 total examples across all categories
- [ ] File validates against schema
- [ ] Character loads successfully
- [ ] All tests pass
- [ ] Manual gameplay testing completed
- [ ] Dialogue quality assessed as acceptable
- [ ] All validation commands pass
- [ ] Code review completed
- [ ] Documented pattern organization rationale
