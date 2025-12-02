# Add Documentation to Recipe Schema

## Files to Touch
- `data/schemas/anatomy.recipe.schema.json`

## Out of Scope
- Changing the structure or types in the schema.
- Renaming the `properties` field.

## Acceptance Criteria

### Specific Tests
- **Manual Verification:**
    - Inspect `data/schemas/anatomy.recipe.schema.json`.
    - Verify `properties` field has a `description` property.
    - Verify the description explicitly states: "Filters entities by exact component property values. NOT for runtime overrides."
- **Schema Validation:**
    - Run `npm run lint:schema-patterns` (if applicable) or ensure valid JSON.

### Invariants
- Valid recipes must still pass schema validation (no breaking changes).
