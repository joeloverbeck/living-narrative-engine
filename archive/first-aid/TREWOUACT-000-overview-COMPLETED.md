# TREWOUACT: Treat Wounded Part Action Implementation

## Overview
This ticket series implements the `treat_wounded_part` action for the first-aid mod, allowing actors with medicine skill to treat wounds on other actors.

## Reference Document
- `specs/treat-wound-action.md`

## Ticket Sequence

| Ticket | Title | Status | Dependencies |
|--------|-------|--------|--------------|
| TREWOUACT-001 | Create Scope File | ✅ Completed | None |
| TREWOUACT-002 | Create Condition File | ✅ Completed | None |
| TREWOUACT-003 | Create Action File | ✅ Completed | TREWOUACT-001 |
| TREWOUACT-004 | Create Rule File | ✅ Completed | TREWOUACT-002 |
| TREWOUACT-005 | Action Discovery Test | ✅ Completed | TREWOUACT-001, TREWOUACT-003 |
| TREWOUACT-006 | Rule Execution Test | Pending | TREWOUACT-002, TREWOUACT-004 |

## Execution Order

### Phase 1: Foundation Files (can run in parallel)
1. TREWOUACT-001 (scope) - no dependencies
2. TREWOUACT-002 (condition) - no dependencies

### Phase 2: Core Implementation (after Phase 1)
3. TREWOUACT-003 (action) - requires TREWOUACT-001
4. TREWOUACT-004 (rule) - requires TREWOUACT-002

### Phase 3: Testing (after Phase 2)
5. TREWOUACT-005 (action discovery test) - requires TREWOUACT-001, TREWOUACT-003
6. TREWOUACT-006 (rule execution test) - requires TREWOUACT-002, TREWOUACT-004

## Key Design Decisions

### Covered Wounds Are Targetable
Unlike `disinfect_wounded_part` and `rinse_wounded_part`, this action ALLOWS targeting covered wounds. The penalty for treating covered wounds is handled via a -20 modifier in the chance calculation, not by excluding them from the scope.

**Rationale**: This allows LLM characters to be informed about wounds under clothing and attempt treatment with reduced success chance.

### Chance-Based Outcomes
- **CRITICAL_SUCCESS**: +20 HP heal
- **SUCCESS**: +10 HP heal
- **FAILURE**: No effect
- **FUMBLE**: 10 piercing damage

### Modifiers (5 total)
| Modifier | Value | Condition |
|----------|-------|-----------|
| Wound covered | -20 | Wound has clothingSlotId and slot not exposed |
| Wound rinsed | +10 | Has `first-aid:rinsed` component |
| Wound not rinsed | -10 | Missing `first-aid:rinsed` component |
| Wound disinfected | +10 | Has `first-aid:disinfected` component |
| Wound not disinfected | -5 | Missing `first-aid:disinfected` component |

## Spec Corrections Applied

The spec document had several inconsistencies with the actual codebase patterns. The tickets document the corrections:

1. **`target` vs `targets`**: Spec used singular, codebase uses plural
2. **Rule schema fields**: Spec used `id`, `event`, `condition` string; codebase uses `rule_id`, `event_type`, `condition.condition_ref`
3. **IF operation structure**: Spec used `then`, codebase uses `then_actions`
4. **JSON Logic operators**: Spec used `===`, codebase uses `==`
5. **Outcome values**: Spec used `CRITICAL_FAILURE`, codebase uses `FUMBLE`

## Files Created

### Data Files (4 files)
- `data/mods/first-aid/scopes/treatable_target_body_parts.scope`
- `data/mods/first-aid/conditions/event-is-action-treat-wounded-part.condition.json`
- `data/mods/first-aid/actions/treat_wounded_part.action.json`
- `data/mods/first-aid/rules/handle_treat_wounded_part.rule.json`

### Test Files (2 files)
- `tests/integration/mods/first-aid/treat_wounded_part_action_discovery.test.js`
- `tests/integration/mods/first-aid/handle_treat_wounded_part_rule.test.js`

## Verification Commands

```bash
# Validate scope syntax
npm run scope:lint

# Validate all JSON files
npm run validate

# Run action discovery tests
npm run test:integration -- tests/integration/mods/first-aid/treat_wounded_part_action_discovery.test.js

# Run rule execution tests
npm run test:integration -- tests/integration/mods/first-aid/handle_treat_wounded_part_rule.test.js

# Run all first-aid tests
npm run test:integration -- tests/integration/mods/first-aid/

# Lint new files
npx eslint tests/integration/mods/first-aid/treat_wounded_part_action_discovery.test.js tests/integration/mods/first-aid/handle_treat_wounded_part_rule.test.js
```

## Dependencies

### Required Components (must exist)
- `skills:medicine_skill` - Actor skill component
- `first-aid:rinsed` - Wound preparation marker
- `first-aid:disinfected` - Wound preparation marker
- `anatomy:part_health` - Body part health tracking
- `anatomy:visibility_rules` - Clothing slot mapping
- `anatomy:vital_organ` - Vital organ marker (excluded from targeting)

### Required Operations (must exist)
- `MODIFY_PART_HEALTH` - For healing
- `APPLY_DAMAGE` - For fumble damage
- `REGENERATE_DESCRIPTION` - For updating entity descriptions

### Required JSON Logic Operators (must exist)
- `isBodyPartWounded` - Check if body part is wounded
- `isSlotExposed` - Check if clothing slot is exposed

## Risk Assessment

### Low Risk
- Scope file creation (following established patterns)
- Condition file creation (minimal logic)

### Medium Risk
- Action file (complex chanceBased configuration)
- Rule file (four outcome branches)
- Tests (scope mocking complexity)

### Mitigation
- All patterns copied from existing working implementations
- Explicit verification steps in each ticket
- Schema validation catches structural errors early
