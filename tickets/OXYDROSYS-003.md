# OXYDROSYS-003: Create hypoxic status component

## Description

Define the `breathing:hypoxic` component representing oxygen deprivation status with escalating severity.

## Files to Create

- `data/mods/breathing/components/hypoxic.component.json`

## Files to Modify

- `data/mods/breathing/mod-manifest.json` - Add component to `content.components` array

## Out of Scope

- Rules that apply/remove this component
- HypoxiaTickSystem that processes this component
- Integration with action penalties

## Acceptance Criteria

1. **Schema valid**: Component passes JSON Schema validation
2. **Properties defined**: `severity` (enum: mild/moderate/severe), `turnsInState`, `actionPenalty`
3. **Activity metadata**: Includes `shouldDescribeInActivity`, `template`, `priority`
4. **Default template**: `"{actor} is struggling to breathe"`

## Tests That Must Pass

- `npm run validate` - Schema validation
- Unit test: Component schema is valid

## Invariants

- Component ID: `breathing:hypoxic`
- Follows activity metadata pattern from existing components (e.g., `liquids-states:submerged`)
