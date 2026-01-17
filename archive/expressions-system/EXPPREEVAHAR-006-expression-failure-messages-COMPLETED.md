# EXPPREEVAHAR-006: Add failure_message to Expression Definitions

## Summary

Populate `failure_message` for every expression definition to improve diagnostics when prerequisites fail at runtime.

## Background

Only some expressions currently include a `failure_message`. Consistent messages help designers understand why an expression did not trigger.

## File List (Expected to Touch)

### Existing Files
- `data/mods/emotions-*/expressions/*.expression.json` (47 files currently missing `failure_message`)

Note: Expressions are organized in multiple emotion-themed mods (emotions-absorption, emotions-affection-care, emotions-anger-fury-rage, etc.), not a single `emotions` mod.

## Out of Scope (MUST NOT Change)

- Expression prerequisite logic or thresholds
- Runtime evaluation behavior in `src/expressions/`
- Validation pipeline changes

## Implementation Details

- Add or fill `failure_message` fields across the expression pack.
- Keep messages short, actionable, and consistent in style.
- Do not alter ids, tags, priorities, or prerequisite structures.

## Acceptance Criteria

### Tests That Must Pass

1. `npm run validate:expressions`

### Invariants That Must Remain True

1. Expression ids, tags, priorities, and prerequisites remain unchanged.
2. Message additions are the only diffs in the expression JSON files.
3. No new non-ASCII characters are introduced into JSON content.

---

## Status: COMPLETED

## Outcome

### What was actually changed
- Added `failure_message` fields to 47 expression JSON files across 30 emotion mods
- Each prerequisite object now has a `failure_message` that describes the conditions required for that prerequisite to pass
- Messages describe emotion conditions, mood axes, affect traits, and state change detection requirements

### Verification
- `npm run validate:expressions` passes with 0 violations
- All expression unit and integration tests pass
- Expression content structure unchanged (only `failure_message` field additions)

### Files Modified (47 total)
- `data/mods/emotions-absorption/expressions/entranced_stillness.expression.json`
- `data/mods/emotions-absorption/expressions/flow_absorption.expression.json`
- `data/mods/emotions-affection-care/expressions/compassionate_concern.expression.json`
- `data/mods/emotions-affection-care/expressions/warm_affection.expression.json`
- `data/mods/emotions-affiliation/expressions/attachment_swell.expression.json`
- `data/mods/emotions-anger-fury-rage/expressions/cold_fury.expression.json`
- `data/mods/emotions-anger-fury-rage/expressions/suppressed_rage.expression.json`
- `data/mods/emotions-anger-irritation/expressions/frustration_spiral.expression.json`
- `data/mods/emotions-anger-principled-protective/expressions/hurt_anger.expression.json`
- `data/mods/emotions-anger-principled-protective/expressions/protective_anger.expression.json`
- `data/mods/emotions-anger-principled-protective/expressions/righteous_indignation.expression.json`
- `data/mods/emotions-assertiveness-boundaries/expressions/confident_composure.expression.json`
- `data/mods/emotions-calm/expressions/quiet_contentment.expression.json`
- `data/mods/emotions-competence-pride/expressions/earned_satisfaction_settle.expression.json`
- `data/mods/emotions-competence-pride/expressions/triumphant_release.expression.json`
- `data/mods/emotions-competence-pride/expressions/victory_afterglow_glow.expression.json`
- `data/mods/emotions-confusion/expressions/confused_frown.expression.json`
- `data/mods/emotions-curiosity-attention/expressions/curious_lean_in.expression.json`
- `data/mods/emotions-curiosity-attention/expressions/fascinated_lock_on.expression.json`
- `data/mods/emotions-curiosity-attention/expressions/interested_attention.expression.json`
- `data/mods/emotions-cynicism/expressions/cynical_detachment.expression.json`
- `data/mods/emotions-despair/expressions/deep_despair.expression.json`
- `data/mods/emotions-elevation/expressions/aesthetic_appreciation_soften.expression.json`
- `data/mods/emotions-elevation/expressions/awed_transfixion.expression.json`
- `data/mods/emotions-elevation/expressions/inspired_uplift.expression.json`
- `data/mods/emotions-excitement/expressions/enthusiastic_energy.expression.json`
- `data/mods/emotions-excitement/expressions/euphoric_excitement.expression.json`
- `data/mods/emotions-executive-control/expressions/determined_focus.expression.json`
- `data/mods/emotions-gratitude/expressions/tearful_gratitude.expression.json`
- `data/mods/emotions-guilt/expressions/lingering_guilt.expression.json`
- `data/mods/emotions-hatred/expressions/cold_loathing.expression.json`
- `data/mods/emotions-hatred/expressions/vengeful_focus.expression.json`
- `data/mods/emotions-hope/expressions/hopeful_glimmer.expression.json`
- `data/mods/emotions-hope/expressions/optimistic_lift.expression.json`
- `data/mods/emotions-humiliation/expressions/humiliation.expression.json`
- `data/mods/emotions-jealousy-possessiveness/expressions/flustered_jealousy.expression.json`
- `data/mods/emotions-joy-play/expressions/amused_chuckle.expression.json`
- `data/mods/emotions-joy-play/expressions/playful_mischief.expression.json`
- `data/mods/emotions-loneliness-connection/expressions/lonely_isolation.expression.json`
- `data/mods/emotions-sexual-approach/expressions/flirtatious_playfulness.expression.json`
- `data/mods/emotions-sexual-approach/expressions/seductive_confidence.expression.json`
- `data/mods/emotions-sexual-desire/expressions/sensual_enjoyment.expression.json`
- `data/mods/emotions-sexual-intimacy-style/expressions/passionate_longing.expression.json`
- `data/mods/emotions-shame/expressions/resigned_shame.expression.json`
- `data/mods/emotions-shame/expressions/shame_spike.expression.json`
- `data/mods/emotions-social-aversions/expressions/resentful_simmer.expression.json`
- `data/mods/emotions-vigilance/expressions/hypervigilant_scanning.expression.json`

### Deviation from Original Plan
- Original ticket assumed expressions lived in `data/mods/emotions/expressions/*.json`, but they are actually distributed across 30+ emotion-themed mods (`data/mods/emotions-*/expressions/*.expression.json`)
- Ticket file path assumption was corrected before implementation

