# Hit Probability Weight Balancing

## Scope and Objectives

- Populate realistic `hit_probability_weight` values for every `anatomy:part` entity in `data/mods/anatomy/entities/definitions/*.json` so untargeted hits favor large, exposed surfaces and rarely select tiny or internal parts.
- Align handler logic so `RESOLVE_HIT_LOCATION` and `APPLY_DAMAGE` share the same weighting rules and defaults, preventing null selections and accidental organ hits.
- Add guardrails (validation + tests) that prevent future parts from shipping without an explicit weight or with inappropriate weights.

## Current Findings

- Schema: `data/mods/anatomy/components/part.component.json` defines `hit_probability_weight` (number, min 0, default 1.0).
- Handler usage:
  - `src/logic/operationHandlers/resolveHitLocationHandler.js` only includes parts with an explicit numeric `hit_probability_weight > 0`; undefined weights are ignored, so with current data it returns no candidates.
  - `src/logic/operationHandlers/applyDamageHandler.js` defaults undefined weights to `1.0`, so every part returned by `BodyGraphService.getAllParts` (including internal organs) is equally likely unless weight is explicitly `0`.
  - BodyGraph traverses the full anatomy tree, so weighting is the only line of defense against hitting internals directly.
- Data audit: 213 entities (80 `subType` values) under `data/mods/anatomy/entities/definitions/` have no `hit_probability_weight` at all. Internal organs (heart/brain/spine) and ornamental parts (hair) are currently selectable targets via `APPLY_DAMAGE`.

## Requirements

- Data: add `hit_probability_weight` to every `anatomy:part` component in `data/mods/anatomy/entities/definitions/*.json`. Use `0` to mark parts that should never be chosen by random hits (internal organs, mounts), and positive weights for hittable surfaces scaled by exposed area.
- Logic: introduce a shared helper for resolving hit weights (schema default 1.0, respect explicit 0) and use it in both `resolveHitLocationHandler` and `applyDamageHandler`. Log and fail gracefully if no parts remain after filtering.
- Validation/Tests: add a data validation check that every anatomy part has a numeric `hit_probability_weight >= 0`; add a regression test assembling at least one real body (humanoid) to confirm `RESOLVE_HIT_LOCATION` returns a part and that weights skew selection toward torso/head; keep a unit test for the default=1.0 fallback to protect new content.

## Proposed Weight Plan (by subType)

Values are per-entity (each left/right instance gets the same weight). Apply size modifiers where names imply scale: `hulking|massive` +20%, `thick|muscular` +10%, `slim|petite|small` -10%. Ranges stay >= 0.

- Humanoid / catfolk / futa (shared): `torso` 45; `head` 18; `arm` 8; `hand` 3; `leg` 10; `foot` 3; `breast` 3; `ass_cheek` 4; `asshole` 1; `penis` 2; `vagina` 2; `testicle` 1; `tail` (cat) 3; `horse_tail` 4; `eye` 0.5; `ear` 0.5; `nose` 0.6; `mouth` 0.6; `hair` 0.25; `pubic_hair` 0.2; `teeth` 0; `heart` 0; `spine` 0; `brain` 0; generic `beak` 2; `equipment_mount` 0.
- Centaur additions: `centaur_upper_torso` 25 (humanoid chest); `centaur_torso` 40 (equine barrel); `centaur_head` 10; `centaur_leg_front` 12; `centaur_leg_rear` 12; `horse_tail` 4 (already above).
- Avian (chicken/rooster): `chicken_torso` 25; `chicken_head` 8; `chicken_beak` 1.5; `chicken_comb` 0.5; `chicken_wattle` 0.5; `chicken_wing` 6; `chicken_leg` 6; `chicken_foot` 3; `chicken_tail` 3; `chicken_spur` 1; `chicken_spine` 0; `chicken_heart` 0; `chicken_brain` 0.
- Dragon: `dragon_torso` 40; `dragon_head` 12; `dragon_wing` 10; `dragon_leg` 12; `dragon_tail` 10.
- Cephalopods (kraken/squid/octopus): `mantle` 40; `tentacle` base 6 (override per entity: `kraken_tentacle` 8, `squid_tentacle` 6, `octopus_tentacle` 6); `ink_reservoir` 0.
- Spider: `spider_cephalothorax` 30; `spider_abdomen` 30; `spider_leg` 5; `spider_pedipalp` 2; `spinneret` 2.
- Tortoise: `shell_carapace` 32; `shell_plastron` 26; `tortoise_torso` 6 (under shell); `tortoise_head` 8; `tortoise_beak` 1.5; `tortoise_eye` 0.5; `tortoise_leg` 7; `tortoise_arm` 7; `tortoise_hand` 3; `tortoise_foot` 3; `tortoise_tail` 3.
- Eldritch: `eldritch_core` 35; `eldritch_membrane_wing` 8; `eldritch_tentacle` 6; `eldritch_hand` 5; `eldritch_vestigial_arm` 3; `eldritch_lamprey_mouth` 4; `eldritch_mouth` 4; `eldritch_vocal_sac` 2; `eldritch_baleful_eye` 2; `eldritch_compound_eye_stalk` 3; `eldritch_surface_eye` 1; `eldritch_sensory_stalk` 2.

## Implementation Notes

- Apply weights at the entity-definition level (not schemas) to keep mod data canonical and avoid clobbering schema defaults.
- Normalize per-blueprint sanity: ensure major exposed areas (torso/head/primary limbs) retain ~80% of total weight; internals stay at 0 and rely on `damage_propagation`.
- After data population, rerun any hit-distribution tests to confirm torsos dominate, heads are second, and extremities/appendages are rare but reachable.
