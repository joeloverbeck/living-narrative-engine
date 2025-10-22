# Ride Penis Greedily Action Spec

## Overview

Design a follow-up `sex-vaginal-penetration` mod action/rule pair where a female actor rides her partner's penis with greedy enthusiasm while already straddling the partner. Reuse the penetration-friendly target scope `sex:actors_with_uncovered_penis_facing_each_other_or_target_facing_away` so the action remains compatible with existing uncovered-penis encounters.【F:data/mods/sex-vaginal-penetration/actions/straddling_penis_milking.action.json†L6-L24】 Build on the current straddling penis milking implementation to keep anatomical requirements, state synchronization, and narrative beats aligned with our vaginal penetration systems.【F:data/mods/sex-vaginal-penetration/actions/straddling_penis_milking.action.json†L13-L39】【F:data/mods/sex-vaginal-penetration/rules/handle_straddling_penis_milking.rule.json†L9-L195】

## Action Requirements

- **Targets**
  - Primary: `sex:actors_with_uncovered_penis_facing_each_other_or_target_facing_away` with placeholder `primary` so either face-to-face or reverse cowgirl setups qualify.【F:data/mods/sex-vaginal-penetration/actions/straddling_penis_milking.action.json†L6-L11】
- **Required components (actor)**
  - Mirror the reference action by requiring `positioning:closeness`, `positioning:straddling_waist`, and `sex-core:being_fucked_vaginally` to guarantee active vaginal penetration positioning.【F:data/mods/sex-vaginal-penetration/actions/straddling_penis_milking.action.json†L13-L18】
- **Forbidden components**
  - Actor: extend the shared `positioning:sitting_on` exclusion to avoid conflicts with seated lap states.【F:data/mods/sex-vaginal-penetration/actions/straddling_penis_milking.action.json†L20-L22】
  - Primary: no additional forbiddens beyond the target scope.
- **Template**
  - Surface the copy `ride {primary}'s penis greedily`.
- **Prerequisites**
  - Require the actor to have an uncovered vagina, matching the reference prerequisite gates and failure messaging structure.【F:data/mods/sex-vaginal-penetration/actions/straddling_penis_milking.action.json†L25-L39】

## Rule Behavior

Implement a companion rule triggered by the new action that clones the existing straddling milking logic while updating the narration:

1. Query actor/primary names, position, and pre-existing penetration components exactly as in the current rule so re-entry paths avoid duplicate component churn.【F:data/mods/sex-vaginal-penetration/rules/handle_straddling_penis_milking.rule.json†L9-L157】
2. Maintain the mutual component contract by ensuring the actor carries `sex-core:being_fucked_vaginally` (actorId → primary) and the primary carries `sex-core:fucking_vaginally` (targetId → actor), refreshing them only when mismatched.【F:data/mods/sex-vaginal-penetration/rules/handle_straddling_penis_milking.rule.json†L33-L155】
3. Set both the perceptible event message and the success log to `{actor} rides {primary}'s penis greedily, wet slaps echoing as their groins meet.`, then reuse the standard `action_target_general` perception payload wiring before calling `core:logSuccessAndEndTurn`.【F:data/mods/sex-vaginal-penetration/rules/handle_straddling_penis_milking.rule.json†L158-L195】

## Testing Requirements

Deliver two comprehensive integration suites following the Mod Testing Guide conventions and the existing `tests/integration/mods/sex-vaginal-penetration/` patterns.【F:docs/testing/mod-testing-guide.md†L1-L98】【F:tests/integration/mods/sex-vaginal-penetration/ride_penis_greedily_action.test.js†L1-L165】

1. **Action discoverability** – Validate scope resolution for uncovered-penis partners in both facing configurations, enforcement of closeness + straddling requirements, the `positioning:sitting_on` exclusion, and vagina ownership/coverage prerequisites. Include template verification and negative cases for covered anatomy or missing posture components.
2. **Rule behavior** – Execute the action end-to-end to assert the shared perceptible/success message, mutual component updates, and idempotent reapplication safeguards. Confirm perception events emit once with the greedy narration payload and that turn-ending behavior mirrors the reference rule.

Document any helper expansions introduced for these suites so future vaginal penetration rides can reuse them.
