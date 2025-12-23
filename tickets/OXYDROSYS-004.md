# OXYDROSYS-004: Create unconscious_anoxia component

## Description

Define the `breathing:unconscious_anoxia` component for unconsciousness specifically from oxygen deprivation.

## Files to Create

- `data/mods/breathing/components/unconscious_anoxia.component.json`

## Files to Modify

- `data/mods/breathing/mod-manifest.json` - Add component to `content.components` array

## Out of Scope

- Rules that apply/remove this component
- Brain damage mechanics
- Rescue/recovery mechanics

## Acceptance Criteria

1. **Schema valid**: Component passes JSON Schema validation
2. **Properties defined**: `turnsUnconscious`, `brainDamageStarted` (boolean)
3. **Activity metadata**: Higher priority (95) than hypoxic
4. **Template**: `"{actor} has lost consciousness from lack of oxygen"`

## Tests That Must Pass

- `npm run validate` - Schema validation

## Invariants

- Component ID: `breathing:unconscious_anoxia`
- Priority (95) higher than hypoxic (80) to ensure correct activity description order
