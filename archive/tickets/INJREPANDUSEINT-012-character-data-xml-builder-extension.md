# INJREPANDUSEINT-012: CharacterDataXmlBuilder Extension

## Description

Add physical_condition XML section to character data for LLM context.

## File List

| File                                                   | Action                                      |
| ------------------------------------------------------ | ------------------------------------------- |
| `src/prompting/characterDataXmlBuilder.js`             | MODIFY - add #buildPhysicalConditionSection |
| `tests/unit/prompting/characterDataXmlBuilder.test.js` | MODIFY - add physical condition tests       |
| `tests/common/prompting/characterDataFixtures.js`      | MODIFY - add health state fixtures          |

## Out of Scope

- ActorDataExtractor changes (INJREPANDUSEINT-011)
- Service implementations
- UI components

## Acceptance Criteria

### Tests That Must Pass

- All existing `characterDataXmlBuilder.test.js` tests continue to pass
- New physical condition tests pass
- `npm run test:unit` passes
- `npx eslint src/prompting/characterDataXmlBuilder.js` passes

### Invariants

- `#buildPhysicalConditionSection(healthState)` method per spec section 8.3:
  - Takes `ActorHealthStateDTO` or `null` as input
  - Returns empty string when `healthState` is `null` (healthy characters)
  - Returns XML section for injured characters
- Section placed in `#buildCurrentStateSection()` first for prominence
- XML structure includes:
  ```xml
  <physical_condition>
    <overall_status>{status} ({percent}%)</overall_status>
    <injuries>
      <injury part="{partName}" state="{state}">{effects}</injury>
      ...
    </injuries>
    <active_effects>{comma-separated effects}</active_effects>
    <critical_warning>{warning if dying or critical}</critical_warning>
    <first_person_experience>{narrative}</first_person_experience>
  </physical_condition>
  ```
- Uses `#getOverallStatusText()` mapping from spec section 8.3:
  - healthy → "You feel fine"
  - scratched → "You have minor scratches"
  - wounded → "You are wounded"
  - injured → "You are seriously injured"
  - critical → "You are critically injured"
  - dying → "You are dying"
  - dead → "You are dead"
- Critical warning included when:
  - `isDying === true`: "You are dying! {turnsUntilDeath} turns until death."
  - `overallStatus === 'critical'`: "You are critically injured and may die soon."

## Dependencies

- INJREPANDUSEINT-011 (ActorDataExtractor LLM Extension)

## Reference

See `specs/injury-reporting-and-user-interface.md` section 8.3 for XML structure specification.

## Outcome

**Status**: COMPLETED

**Implementation Summary**:

1. Added `#buildPhysicalConditionSection(healthState)` method to CharacterDataXmlBuilder (lines 601-673)
2. Added `#getOverallStatusText(status)` helper method with spec-compliant status mappings (lines 681-692)
3. Modified `#buildCurrentStateSection(data)` to call physical condition builder first for prominence (lines 478-482)
4. Added 6 new health state fixtures to `characterDataFixtures.js`:
   - `CHARACTER_WITH_INJURIES` - injured status with multiple body parts
   - `CHARACTER_DYING` - dying status with turns countdown
   - `CHARACTER_CRITICAL` - critical but not dying
   - `CHARACTER_HEALTHY` - null healthState (healthy)
   - `CHARACTER_WITH_EFFECTS_ONLY` - empty injuries but has active effects
   - `CHARACTER_WITH_SPECIAL_CHARS_INJURY` - XML escaping test case
5. Added comprehensive test suite with 22 new test cases covering:
   - Healthy characters (null healthState)
   - Injured characters with full XML structure
   - Physical condition ordering in current_state section
   - Critical warnings for dying and critical status
   - Status text mapping verification
   - Edge cases (empty injuries, missing narrative, empty effects)
   - XML escaping for special characters
   - Integration with current_state section

**Tests Modified/Added**:
| Test File | Changes | Rationale |
|-----------|---------|-----------|
| `tests/unit/prompting/characterDataXmlBuilder.test.js` | Added "Physical Condition Section" describe block with 22 tests | Cover all ticket invariants and edge cases |
| `tests/common/prompting/characterDataFixtures.js` | Added 6 health state fixtures | Provide reusable test data for health-related scenarios |

**Verification**:

- All 109 tests pass in `characterDataXmlBuilder.test.js`
- ESLint passes with only pre-existing warnings (JSDoc description style)
- No breaking changes to public API
