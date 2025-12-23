# OXYDROSYS-002: Create respiratory_organ component

## Description

Define the `breathing:respiratory_organ` component that marks anatomy parts as respiratory organs capable of storing oxygen.

## Files to Create

- `data/mods/breathing/components/respiratory_organ.component.json`

## Files to Modify

- `data/mods/breathing/mod-manifest.json` - Add component to `content.components` array

## Out of Scope

- Entity definitions using this component
- Rules that read/write this component
- JavaScript handlers

## Acceptance Criteria

1. **Schema valid**: Component passes JSON Schema validation
2. **Properties defined**: `respirationType`, `oxygenCapacity`, `currentOxygen`, `depletionRate`, `restorationRate`, `environmentCompatibility`
3. **Enums correct**: `respirationType` enum includes `pulmonary`, `cutaneous`, `branchial`, `tracheal`, `unusual`
4. **Environment enum**: `environmentCompatibility` items are `air`, `water`, `any`

## Tests That Must Pass

- `npm run validate` - Schema validation
- Unit test: Component schema is valid against component.schema.json

## Invariants

- Component ID follows namespacing: `breathing:respiratory_organ`
- No modifications to existing anatomy components
