# Gymnastics Mod Specification

## Overview

**Mod ID**: `gymnastics`
**Version Target**: `1.0.0`
**Working Title**: Gymnastics Fundamentals
**Summary**: Introduces core floor gymnastics maneuvers focused on rolls and cartwheels for trained gymnasts.
**Primary Author**: _TBD_
**Minimum Game Version**: `>=0.0.1`

### Purpose

The gymnastics mod expands the character action roster with acrobatic movements that showcase agility, coordination, and spatial awareness. It mirrors the ballet mod's pattern-driven structure—self-targeted maneuvers gated by a specialty component and forbidden while hugging—to ensure consistent player expectations. These actions form the foundation for future balance beam, vault, and tumbling expansions.

### Dependencies

- `positioning` (^1.0.0) — supplies the `positioning:hugging` component referenced in forbidden component checks.
- `core` (^1.0.0) — provides core rule macros, logging helpers, and the action attempt event stream consumed by all gymnastics rules.

Future optional dependencies (not required for initial delivery):
- `anatomy` — only necessary if later maneuvers need anatomical targeting or detailed limb data.

## Visual Identity

**Assigned Color Scheme**: Journey Cobalt (Section 9.1 of `wcag-compliant-color-combinations.spec.md`)

```json
{
  "backgroundColor": "#1a237e",
  "textColor": "#e8eaf6",
  "hoverBackgroundColor": "#283593",
  "hoverTextColor": "#ffffff"
}
```

- **Contrast Ratios**: Normal 13.5:1 🌟 AAA, Hover 10.5:1 🌟 AAA
- **Theme Fit**: Conveys disciplined strength and controlled momentum, aligning with the deep indigo palette already associated with precise movement mods (e.g., ballet) while remaining distinguishable.
- **Usage Note**: This scheme is now tagged as actively used by the Gymnastics mod in the WCAG specification; other mods should avoid reusing it unless establishing intentional visual linkage.

## Component Definition

### `is_gymnast.component.json`

Marker component signaling the actor has the training required to execute gymnastics maneuvers.

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "gymnastics:is_gymnast",
  "description": "Marker component indicating the entity is a trained gymnast capable of performing tumbling fundamentals",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

- **Storage**: Located at `data/mods/gymnastics/components/is_gymnast.component.json`.
- **Usage**: Required by every gymnastics action via the `required_components.actor` array.

## Action Definitions

Gymnastics actions follow the same structural pattern used by ballet actions to ensure predictability:

- **Targets**: `"none"` (self-directed maneuvers without explicit external targets)
- **Required Components**: `{ "actor": ["gymnastics:is_gymnast"] }`
- **Forbidden Components**: `{ "actor": ["positioning:hugging"] }`
- **Prerequisites**: `[]`
- **Template Format**: `"do [specific gymnastics action]"` — lower-case imperative verb phrase matching the action filename and ID suffix.
- **Visual**: Journey Cobalt scheme (see above) for both normal and hover states.

### 1. Do a Forward Roll (Tuck Roll)

- **Action File**: `data/mods/gymnastics/actions/do_forward_roll.action.json`
- **Action ID**: `gymnastics:do_forward_roll`
- **Name**: `"Do Forward Roll"`
- **Description**: `"Tuck tightly and roll forward along the spine for a smooth transition"`
- **Template**: `"do forward roll"`
- **Rule File**: `data/mods/gymnastics/rules/handle_do_forward_roll.rule.json`
- **Condition File**: `data/mods/gymnastics/conditions/event-is-action-do-forward-roll.condition.json`
- **Rule Messages**:
  - **Perceptible**: `"{actor} tucks tightly and rolls forward with controlled momentum"`
  - **Successful**: `"{actor} completes a fluid forward roll, returning to a ready stance"`

### 2. Do a Backward Roll

- **Action File**: `data/mods/gymnastics/actions/do_backward_roll.action.json`
- **Action ID**: `gymnastics:do_backward_roll`
- **Name**: `"Do Backward Roll"`
- **Description**: `"Roll backward through a tucked inversion to recover facing forward"`
- **Template**: `"do backward roll"`
- **Rule File**: `data/mods/gymnastics/rules/handle_do_backward_roll.rule.json`
- **Condition File**: `data/mods/gymnastics/conditions/event-is-action-do-backward-roll.condition.json`
- **Rule Messages**:
  - **Perceptible**: `"{actor} presses through the hands and inverts into a tight backward roll"`
  - **Successful**: `"{actor} unfolds from the backward roll, landing centered and alert"`

### 3. Do a Cartwheel

- **Action File**: `data/mods/gymnastics/actions/do_cartwheel.action.json`
- **Action ID**: `gymnastics:do_cartwheel`
- **Name**: `"Do Cartwheel"`
- **Description**: `"Swing laterally through a hand-supported inversion to land facing the opposite direction"`
- **Template**: `"do cartwheel"`
- **Rule File**: `data/mods/gymnastics/rules/handle_do_cartwheel.rule.json`
- **Condition File**: `data/mods/gymnastics/conditions/event-is-action-do-cartwheel.condition.json`
- **Rule Messages**:
  - **Perceptible**: `"{actor} launches sideways into a clean hand-to-hand cartwheel"`
  - **Successful**: `"{actor} sticks the cartwheel, finishing aligned and balanced"`

### Shared Rule Action Flow

Each gymnastics rule mirrors the ballet handling macros to remain consistent with existing content:

1. `GET_NAME` for the actor → `actorName`
2. Optional `QUERY_COMPONENT` pulls `core:position` into `actorPosition` for location logging (parity with ballet mod)
3. `SET_VARIABLE` for `logMessage` populated with the successful action message above
4. `SET_VARIABLE` for `perceptionType` using `"action_self_general"`
5. `SET_VARIABLE` for `locationId` using `{context.actorPosition.locationId}`
6. `SET_VARIABLE` for `targetId` set to `null`
7. Invoke `core:logSuccessAndEndTurn`

## File & Directory Layout

```
data/mods/gymnastics/
├── mod-manifest.json
├── components/
│   └── is_gymnast.component.json
├── actions/
│   ├── do_forward_roll.action.json
│   ├── do_backward_roll.action.json
│   └── do_cartwheel.action.json
├── rules/
│   ├── handle_do_forward_roll.rule.json
│   ├── handle_do_backward_roll.rule.json
│   └── handle_do_cartwheel.rule.json
└── conditions/
    ├── event-is-action-do-forward-roll.condition.json
    ├── event-is-action-do-backward-roll.condition.json
    └── event-is-action-do-cartwheel.condition.json
```

- **Naming**: Align filenames, IDs, and template strings exactly (kebab-case for condition IDs, snake_case for action IDs) to simplify validation tooling.
- **Manifest**: Mirror ballet's `mod-manifest.json` structure, updating metadata, versioning, and `visual` references where necessary.

## Testing Strategy

Comprehensive automated coverage is mandatory for this mod despite the straightforward logic:

1. **Action Discoverability Tests**
   - Add integration tests under `tests/integration/mods/gymnastics/`.
   - Validate that each action surfaces in the available action set when the actor has `gymnastics:is_gymnast` and is not hugging.
   - Confirm absence when the component is missing or when `positioning:hugging` is present.
2. **Rule Behavior Tests**
   - Reuse the mod testing scaffolding documented in `docs/testing/mod-testing-guide.md` (and related references in `docs/testing/`).
   - Assert the perceptible and successful log messages emitted by `core:logSuccessAndEndTurn` for each action.
   - Verify correct perception type (`action_self_general`) and that `targetId` resolves to `null`.

Coverage thresholds can be ignored per project guidance, but all new tests must pass before release.

## Implementation Notes

- **Localization**: Keep action names and templates in English for parity with existing content; future localization hooks can wrap the strings.
- **Extensibility**: Future tumbling or apparatus moves should reuse the same component and consider branching into difficulty tiers via prerequisites.
- **Validation**: Run `npm run validate` after adding the new content to confirm schema compliance and color contrast verification.
- **Compatibility**: Avoid introducing actor state changes that conflict with other movement mods until shared stamina/position systems are formalized.

## Reference Alignment with Ballet Mod

- **Pattern Consistency**: The gymnastics mod intentionally mirrors the ballet mod's component gating, forbidden hugging constraint, and rule macro sequence to keep player experience consistent across movement-focused mods.
- **Narrative Voice**: Log messages stay concise and descriptive, focusing on the performer rather than spectators, matching the tone set in ballet rules like `handle_do_bourree_couru_on_pointe`.
- **Color Differentiation**: Journey Cobalt provides contrast from Ballet's Indigo Professional while keeping within the disciplined movement aesthetic family.

## Next Steps

1. Implement the component, actions, conditions, and rules per the file layout above.
2. Update `docs/mods/mod-color-schemes.md` to reflect Journey Cobalt's new assignment (already captured alongside this spec update).
3. Build the gymnastics-specific integration tests covering discoverability and rule output.
4. Validate contrast compliance and run `npm run validate` before submission.
