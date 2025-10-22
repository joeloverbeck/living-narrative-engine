# Straddling Penis Milking Action Spec

## Overview

Design a new `sex-vaginal-penetration` mod action/rule pair where a female actor straddles a partner and sensually milks the partner's penis during ongoing sex. Reuse the existing penetration action's primary target scope `sex:actors_with_uncovered_penis_facing_each_other_or_target_facing_away` so the partner already has an exposed penis aligned for vaginal intimacy.【F:data/mods/sex-vaginal-penetration/actions/insert_primary_penis_into_your_vagina.action.json†L6-L20】 Build on the penetration state components to model the mutual penetration relationship once the action succeeds.【F:data/mods/sex-core/components/fucking_vaginally.component.json†L1-L17】【F:data/mods/sex-core/components/being_fucked_vaginally.component.json†L1-L17】

## Action Design

- **Targets**
  - Primary target scope: `sex:actors_with_uncovered_penis_facing_each_other_or_target_facing_away` with the placeholder `primary`. This keeps anatomical compatibility while allowing face-to-face or reverse straddling setups.
- **Required components (actor)**
  - Require `positioning:closeness` and `positioning:straddling_waist` to reflect an intimate mount; straddling keeps her centered over the partner's pelvis while closeness preserves penetration range.【F:data/mods/sex-vaginal-penetration/actions/insert_primary_penis_into_your_vagina.action.json†L13-L20】
- **Forbidden components (actor)**
  - Forbid `positioning:sitting_on` to avoid conflicts with seated lap actions and to emphasize an active milking rhythm.【F:data/mods/sex-vaginal-penetration/actions/insert_primary_penis_into_your_vagina.action.json†L16-L18】
- **Forbidden components (primary)**
  - None beyond what the shared target scope enforces.
- **Template**
  - Use the exact template string `milk {primary}'s penis slowly` to surface the sensual cadence in UI listings.
- **Prerequisites**
  - Assert the actor has a vagina and that it is uncovered before the action can execute, mirroring the precedent set by the existing penetration invitation.【F:data/mods/sex-vaginal-penetration/actions/insert_primary_penis_into_your_vagina.action.json†L21-L35】

## Rule Implementation

Create a companion rule triggered by the new action.

1. Emit the same descriptive copy for both the perceptible event and the successful action message: `{actor} rocks {primary}'s penis slowly with her vagina, feeling each inch and vein of the penis.`
2. Apply `sex-core:being_fucked_vaginally` to the actor with the `actorId` of the primary target, and `sex-core:fucking_vaginally` to the primary with the `targetId` of the actor, preserving the paired-state bookkeeping for vaginal penetration.【F:data/mods/sex-core/components/fucking_vaginally.component.json†L1-L17】【F:data/mods/sex-core/components/being_fucked_vaginally.component.json†L1-L17】
3. Ensure the rule respects existing penetration cooldown/stacking norms by checking for these components before reapplying them, preventing redundant state churn.

## Testing Requirements

Deliver two comprehensive integration suites following the Mod Testing Guide methodologies and the patterns already established in `tests/integration/mods/sex-penile-manual/` suites.【F:docs/testing/mod-testing-guide.md†L1-L12】【F:tests/integration/mods/sex-penile-manual/fondle_penis_action.test.js†L1-L120】

1. **Action discoverability** – Validate primary scope filtering (exposed penis, relative facing), enforced closeness + straddling requirements, the `positioning:sitting_on` exclusion, vagina ownership/coverage prerequisites, and exact template rendering. Include negative coverage for covered anatomy, missing straddling, and conflicting seating states.
2. **Rule behavior** – Execute the action end-to-end, asserting the shared perceptible/success message, mutual component applications, and absence of double-application when the components are already present. Confirm downstream perception hooks fire once with the expected payload.

Document any new builders or fixtures introduced for these suites so other sensual penetration actions can reuse them.
