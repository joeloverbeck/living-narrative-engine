# Female-Perspective Vaginal Penetration Action Spec

## Overview

Design a new `sex` mod action/rule pair that mirrors `sex:insert_penis_into_vagina` but frames the interaction from the woman being penetrated. The acting actor is the one with the vagina, and she prompts a partner with an uncovered penis to penetrate her.【F:data/mods/sex/actions/insert_penis_into_vagina.action.json†L1-L32】 The state components `sex-core:fucking_vaginally` and `sex-core:being_fucked_vaginally` already model the ongoing penetration relationship and should continue to gate repeat discoverability and rule effects.【F:data/mods/sex-core/components/fucking_vaginally.component.json†L1-L15】【F:data/mods/sex-core/components/being_fucked_vaginally.component.json†L1-L15】 The new combo should complement, not replace, the existing male-perspective initiation.

## Targeting & Components

- **Targets**
  - Add a primary target scope equivalent to `sex:actors_with_uncovered_vagina_facing_each_other_or_target_facing_away`, but require the target to be either directly in front of or behind the actor and to expose a penis rather than a vagina. This ensures anatomical compatibility while keeping the directional constraints that support penetration choreography.
- **Required components (actor)**
  - Only `positioning:closeness` (reuse the existing closeness requirement for penetration range).【F:data/mods/sex/actions/insert_penis_into_vagina.action.json†L16-L17】
- **Forbidden components (actor)**
  - Forbid `sex-core:being_fucked_vaginally` to prevent conflicting penetration states.
  - Forbid `positioning:sitting_on` because the actor is inviting penetration while standing or similarly positioned; a seated straddle would invert the roles established in the male-led action.【F:data/mods/sex/actions/insert_penis_into_vagina.action.json†L18-L21】
- **Forbidden components (primary)**
  - None beyond what the new scope enforces; the directional filter and penis requirement already define the correct partner posture.

## Prerequisites & Template

- Prerequisites must assert the acting actor possesses a vagina and that the vagina is uncovered before she can request penetration.
- Action template string: `insert {primary}'s penis into your vagina` (exact match).

## Rule Behavior

Create a corresponding rule that listens for this new action. Use the shared perceptible and success message: `{actor} introduces {primary}'s penis into her vagina, that stretches to accomodate the girth.` This keeps continuity with the penetrative tone used by the existing rule while highlighting the receptive perspective.

The rule must:

1. Emit the above text for both the perceptible event and the success response.
2. Apply `sex-core:being_fucked_vaginally` to the acting actor (with `actorId` referencing the primary partner) and `sex-core:fucking_vaginally` to the primary partner (with `targetId` referencing the acting actor), aligning with the established paired-state convention.【F:data/mods/sex-core/components/fucking_vaginally.component.json†L5-L13】【F:data/mods/sex-core/components/being_fucked_vaginally.component.json†L5-L13】
3. Publish the perceptible event using the standard `action_target_general` perception type so other actors can react, matching the logging structure from the existing penetration rule.

## Testing Requirements

Produce comprehensive integration coverage using the Mod Testing Guide patterns.【F:docs/testing/mod-testing-guide.md†L1-L119】

1. **Action discoverability suite** – Verify scope behavior (front/behind positioning and uncovered penis), required closeness, the forbidden component checks, prerequisite enforcement for uncovered vaginas, and the action template. Include negative cases for covered anatomy, incorrect positioning, or forbidden states. Use existing tests in `tests/integration/mods/sex/` as structural references.【F:tests/integration/mods/sex/fondle_breasts_over_clothes_action_discovery.test.js†L1-L79】
2. **Rule behavior suite** – Execute the new action end to end, asserting the shared message, application of both penetration components, turn termination, and absence of extraneous events. Follow the approach used by penetration-focused suites in the same directory.【F:tests/integration/mods/sex/fondle_penis_action.test.js†L1-L119】

All new integration suites must pass locally. Document any new scope helpers or fixtures introduced as part of the tests.
