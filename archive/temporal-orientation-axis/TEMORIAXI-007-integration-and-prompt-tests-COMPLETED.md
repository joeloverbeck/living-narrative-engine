# TEMORIAXI-007: Integration Tests and Prompt Instruction Tests

## Status: ✅ COMPLETED (2026-01-24)

## Summary

Create integration tests for the temporal_orientation axis and create new prompt instruction unit tests following the existing pattern in `moodUpdateInstructions.affiliationAxis.test.js`.

## Priority: High | Effort: Medium

## Rationale

Integration tests verify the axis works across the full stack. Prompt instruction tests ensure the LLM will receive correct guidance about the new axis.

## Assumptions Corrected (2026-01-24)

After reassessment, the following assumptions in the original ticket were found to be incorrect:

1. **Axis Count**: The system already has 11 mood axes (not 10). The `temporal_orientation` axis has already been added to:
   - `src/constants/moodAffectConstants.js` - MOOD_AXES array has 11 elements
   - `data/mods/core/components/mood.component.json` - defines all 11 axes
   - `data/prompts/corePromptText.json` - includes temporal_orientation instructions

2. **Existing Tests Requiring Updates**: Several existing tests still expect 10 axes and need updating:
   - `tests/unit/prompting/moodUpdateInstructions.affiliationAxis.test.js` - expects "10 mood axes"
   - `tests/integration/expression-diagnostics/uncertaintyAxis.integration.test.js` - expects 10 axes
   - `tests/integration/schemas/llmOutputValidation.integration.test.js` - fixture missing temporal_orientation
   - `tests/integration/ai/moodPersistencePromptReflection.integration.test.js` - fixtures missing temporal_orientation

3. **Gate Validation Pattern**: The `emotionPrototypes.lookup.test.js` gate validation regex does NOT include `temporal_orientation` - needs update.

## Files to Touch (Updated)

| File | Change Type |
|------|-------------|
| `tests/unit/prompting/moodUpdateInstructions.temporalOrientationAxis.test.js` | **Create** - New test file for prompt instruction verification |
| `tests/unit/prompting/moodUpdateInstructions.affiliationAxis.test.js` | **Modify** - Update expected axis count from 10 to 11, add temporal_orientation to expected axes list |
| `tests/integration/expression-diagnostics/temporalOrientationAxis.integration.test.js` | **Create** - New integration test file |
| `tests/integration/expression-diagnostics/uncertaintyAxis.integration.test.js` | **Modify** - Update expected axis count from 10 to 11 |
| `tests/integration/schemas/llmOutputValidation.integration.test.js` | **Modify** - Add temporal_orientation to test fixtures |
| `tests/integration/ai/moodPersistencePromptReflection.integration.test.js` | **Modify** - Add temporal_orientation to all mood fixtures |
| `tests/unit/mods/core/lookups/emotionPrototypes.lookup.test.js` | **Modify** - Add temporal_orientation to gate validation regex |

## Out of Scope

- **DO NOT** modify any source files - those are TEMORIAXI-001 through TEMORIAXI-005
- **DO NOT** create e2e tests (manual verification is specified in the spec)
- **DO NOT** modify emotion prototype data values - that's out of scope per spec Section 7

## Implementation Details

### 1. Create: tests/unit/prompting/moodUpdateInstructions.temporalOrientationAxis.test.js

New test file following the existing pattern from `moodUpdateInstructions.affiliationAxis.test.js`.

### 2. Modify: tests/unit/prompting/moodUpdateInstructions.affiliationAxis.test.js

- Update test "should mention 10 mood axes" → "should mention 11 mood axes"
- Update expected axes list to include `temporal_orientation`
- Update mood component test to expect 11 required axes

### 3. Create: tests/integration/expression-diagnostics/temporalOrientationAxis.integration.test.js

New integration test following the pattern from `uncertaintyAxis.integration.test.js`.

### 4. Modify: tests/integration/expression-diagnostics/uncertaintyAxis.integration.test.js

- Update MOOD_AXES length expectation from 10 to 11
- Update axis count expectations throughout

### 5. Modify: tests/integration/schemas/llmOutputValidation.integration.test.js

- Add `temporal_orientation: 0` to the `baseMoodUpdate` fixture

### 6. Modify: tests/integration/ai/moodPersistencePromptReflection.integration.test.js

- Add `temporal_orientation` to `INITIAL_MOOD`, `MOOD_UPDATE_HIGH_JOY`, and other mood fixtures

### 7. Modify: tests/unit/mods/core/lookups/emotionPrototypes.lookup.test.js

- Add `temporal_orientation` to the `gatePattern` regex

## Acceptance Criteria

### Tests That Must Pass
- `npm run test:unit -- tests/unit/prompting/moodUpdateInstructions.temporalOrientationAxis.test.js` passes
- `npm run test:unit -- tests/unit/prompting/moodUpdateInstructions.affiliationAxis.test.js` passes
- `npm run test:integration -- tests/integration/expression-diagnostics/temporalOrientationAxis.integration.test.js` passes
- `npm run test:integration -- tests/integration/expression-diagnostics/uncertaintyAxis.integration.test.js` passes
- `npm run test:integration -- tests/integration/schemas/llmOutputValidation.integration.test.js` passes
- `npm run test:integration -- tests/integration/ai/moodPersistencePromptReflection.integration.test.js` passes
- `npm run test:unit -- tests/unit/mods/core/lookups/emotionPrototypes.lookup.test.js` passes

### Invariants That Must Remain True
- All existing tests continue to pass
- New prompt instruction tests follow the pattern of affiliationAxis tests
- Integration tests verify cross-system functionality
- No tests are skipped or disabled

## Dependencies

- **TEMORIAXI-001** through **TEMORIAXI-005** must be completed first (source code changes) - ✅ Already done
- **TEMORIAXI-006** should be completed (unit tests) - ✅ Already done

## Notes

- The prompt instruction tests mirror the existing affiliationAxis pattern
- Integration tests focus on verifying the axis works end-to-end
- Existing integration tests need fixture updates for the new axis count
- No e2e tests are created - manual verification is specified in spec Section 7

## Outcome

### Files Created
| File | Description |
|------|-------------|
| `tests/unit/prompting/moodUpdateInstructions.temporalOrientationAxis.test.js` | New test file verifying prompt instructions for temporal_orientation axis (10 tests) |
| `tests/integration/expression-diagnostics/temporalOrientationAxis.integration.test.js` | New integration test verifying temporal_orientation across Monte Carlo pipeline (17 tests) |

### Files Modified
| File | Changes |
|------|---------|
| `tests/unit/prompting/moodUpdateInstructions.affiliationAxis.test.js` | Updated axis count from 10 to 11, added temporal_orientation to expected axes regex and array |
| `tests/integration/expression-diagnostics/uncertaintyAxis.integration.test.js` | Updated MOOD_AXES length expectation from 10 to 11, updated end-to-end pipeline test |
| `tests/integration/schemas/llmOutputValidation.integration.test.js` | Added `temporal_orientation: 0` to baseMoodUpdate fixture |
| `tests/integration/ai/moodPersistencePromptReflection.integration.test.js` | Added temporal_orientation to INITIAL_MOOD, MOOD_UPDATE_HIGH_JOY, negativeMoodUpdate, and integerMoodUpdate fixtures; updated comments from "10 axes" to "11 axes" |
| `tests/unit/mods/core/lookups/emotionPrototypes.lookup.test.js` | Added temporal_orientation to gate validation regex pattern |

### Test Results
All acceptance criteria tests pass:
- ✅ `moodUpdateInstructions.temporalOrientationAxis.test.js` - 10 tests passing
- ✅ `moodUpdateInstructions.affiliationAxis.test.js` - All tests passing
- ✅ `temporalOrientationAxis.integration.test.js` - 17 tests passing
- ✅ `uncertaintyAxis.integration.test.js` - 11 tests passing
- ✅ `llmOutputValidation.integration.test.js` - 15 tests passing
- ✅ `moodPersistencePromptReflection.integration.test.js` - 13 tests passing
- ✅ `emotionPrototypes.lookup.test.js` - 1072 tests passing

### Summary
The temporal_orientation axis test coverage is now complete. All integration tests and prompt instruction tests verify that:
1. MOOD_AXES constant includes temporal_orientation as the 7th axis (index 6)
2. The axis is correctly positioned after future_expectancy
3. State generation produces valid temporal_orientation values in range [-100, 100]
4. Normalization correctly maps to [-1, 1] range
5. Sampling distributions produce varied values
6. Dynamic sampling maintains temporal coherence
7. LLM prompt instructions include proper temporal_orientation semantics
8. Mood component schema defines 11 axes total
9. Gate validation patterns accept temporal_orientation in prototype gates
