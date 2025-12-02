# INJREPANDUSEINT-012: CharacterDataXmlBuilder Extension

## Description

Add physical_condition XML section to character data for LLM context.

## File List

| File | Action |
|------|--------|
| `src/prompting/characterDataXmlBuilder.js` | MODIFY - add #buildPhysicalConditionSection |
| `tests/unit/prompting/characterDataXmlBuilder.test.js` | MODIFY - add physical condition tests |

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
