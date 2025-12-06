# WIECOM-000: Wielding Component Implementation - Overview

## Summary

Implement the `positioning:wielding` component to track items being actively wielded by actors in a combat-ready or threatening stance. This enables activity descriptions, action gating, and proper state tracking.

## Source Specification

`specs/wielding-component.md`

## Problem Statement

When the `wield_threateningly` action executes:

1. No component tracks that the actor is wielding an item
2. No activity description is generated (e.g., "{actor} is wielding a sword")
3. No mechanism exists to gate other actions based on wielding state
4. The rule does not call `REGENERATE_DESCRIPTION`

## Ticket Breakdown

| Ticket     | Description                          | Dependencies                  |
| ---------- | ------------------------------------ | ----------------------------- |
| WIECOM-001 | Create wielding component definition | None                          |
| WIECOM-002 | Update positioning mod manifest      | WIECOM-001                    |
| WIECOM-003 | Modify wield_threateningly rule      | WIECOM-001                    |
| WIECOM-004 | Activity system array support        | None                          |
| WIECOM-005 | Activity NLG multi-target support    | WIECOM-004                    |
| WIECOM-006 | Component schema unit tests          | WIECOM-001                    |
| WIECOM-007 | Integration tests                    | WIECOM-001 through WIECOM-005 |

## Dependency Graph

```
WIECOM-001 (component) ─┬─> WIECOM-002 (manifest)
                        ├─> WIECOM-003 (rule)
                        └─> WIECOM-006 (schema tests)

WIECOM-004 (activity collection) ─> WIECOM-005 (activity NLG)

All ─> WIECOM-007 (integration tests)
```

## Global Out of Scope

The following are explicitly out of scope for all WIECOM tickets:

1. **Stop Wielding Action**: New action to remove items from `wielded_item_ids`
2. **Appendage Mapping**: Track which hand holds which item
3. **Wielding Styles**: One-handed, two-handed, dual-wield classifications
4. **Combat Integration**: Wielded weapons affecting combat calculations
5. **Action Gating Implementation**: Using `positioning:wielding` as forbidden_component (documented for future but not implemented)

## Success Criteria

All tickets completed when:

- [ ] `positioning:wielding` component exists and validates correctly
- [ ] `wield_threateningly` action adds the component with correct data
- [ ] Activity descriptions include wielding state (single and multi-item)
- [ ] All schema validation tests pass
- [ ] All integration tests pass
- [ ] `npm run validate` passes
- [ ] `npm run test:unit` passes
- [ ] `npm run test:integration` passes

## Reference Files

Study before implementation:

- `data/mods/positioning/components/hugging.component.json` - Activity metadata pattern
- `data/mods/positioning/components/kneeling_before.component.json` - Priority pattern
- `data/mods/weapons/rules/handle_wield_threateningly.rule.json` - Current rule
- `src/anatomy/services/activityMetadataCollectionSystem.js` - Current collection
- `src/anatomy/services/activityNLGSystem.js` - Current NLG
