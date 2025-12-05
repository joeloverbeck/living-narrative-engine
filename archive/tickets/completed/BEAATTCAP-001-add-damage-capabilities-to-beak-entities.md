# BEAATTCAP-001: Add damage_capabilities Component to Beak Entities

## Status: COMPLETED

## Summary

Add the `damage-types:damage_capabilities` component to all three existing beak entity definitions, enabling them to function as natural weapons with piercing damage.

## Motivation

Beaks currently exist as body parts but cannot be used as weapons because they lack damage capability data. This ticket adds the necessary component to enable beak-based attacks.

## Files to Touch

| File | Change Type |
|------|-------------|
| `data/mods/anatomy/entities/definitions/beak.entity.json` | Modify - add component |
| `data/mods/anatomy/entities/definitions/chicken_beak.entity.json` | Modify - add component |
| `data/mods/anatomy/entities/definitions/tortoise_beak.entity.json` | Modify - add component |

## Out of Scope

- **DO NOT** modify any other entity files
- **DO NOT** change existing component data (e.g., health values, weights)
- **DO NOT** add new beak entity types
- **DO NOT** modify schema files
- **DO NOT** change the `anatomy:part` subType values
- **DO NOT** add any new files

## Implementation Details

### 1. Kraken Beak (`beak.entity.json`)

Add after the existing components:

```json
"damage-types:damage_capabilities": {
  "entries": [
    {
      "name": "piercing",
      "amount": 15,
      "penetration": 0.5,
      "bleed": {
        "enabled": true,
        "severity": "minor",
        "baseDurationTurns": 2
      }
    }
  ]
}
```

**Rationale**: Large kraken beak - significant piercing damage comparable to a rapier (which has 18 piercing). Penetration is 0.5 (moderate internal damage weighting). Minor bleed effect due to sharp beak.

### 2. Chicken Beak (`chicken_beak.entity.json`)

Add the component:

```json
"damage-types:damage_capabilities": {
  "entries": [
    {
      "name": "piercing",
      "amount": 2,
      "penetration": 0.1
    }
  ]
}
```

**Rationale**: Small beak - minimal damage, mostly annoyance. Low penetration (0.1). No bleed effect (too small to cause bleeding).

### 3. Tortoise Beak (`tortoise_beak.entity.json`)

Add the component:

```json
"damage-types:damage_capabilities": {
  "entries": [
    {
      "name": "piercing",
      "amount": 6,
      "penetration": 0.2,
      "fracture": {
        "enabled": true,
        "thresholdFraction": 0.9
      }
    }
  ]
}
```

**Rationale**: Hard, crushing beak - moderate piercing with fracture capability due to crushing force. Low penetration (0.2). Fracture enabled with high threshold (0.9) - requires significant prior damage to break bones.

## Acceptance Criteria

### Tests That Must Pass

1. **Schema Validation**: All three modified entity files must pass JSON schema validation
   ```bash
   npm run validate:mod:anatomy
   ```

2. **Unit Test**: Verify damage_capabilities component is present on beak entities
   - Create: `tests/unit/mods/anatomy/entities/beakDamageCapabilities.test.js`
   - Test: Each beak entity has `damage-types:damage_capabilities` component
   - Test: Each entry has required fields: `name`, `amount`
   - Test: Damage values are within expected ranges (amount > 0, penetration 0-1)
   - Test: Effect objects (`bleed`, `fracture`) have correct structure when present

### Invariants That Must Remain True

1. **Existing Component Integrity**: All existing components in beak entities remain unchanged:
   - `anatomy:part` with original subType
   - `anatomy:part_health` with original health values
   - `core:name` with original text
   - `core:weight` with original weight
   - All descriptor components unchanged

2. **Schema Compliance**: Added component matches `damage-types:damage_capabilities` schema structure

3. **No Breaking Changes**: Any existing references to beak entities continue to work

## Verification Commands

```bash
# Validate anatomy mod schemas
npm run validate:mod:anatomy

# Run full mod validation
npm run validate

# Run unit tests for anatomy entities
npm run test:unit -- --testPathPattern="anatomy" --silent
```

## Dependencies

- None (this is a standalone data change)

## Blocked By

- None

## Blocks

- BEAATTCAP-003 (scope needs beaks with damage_capabilities)
- BEAATTCAP-004 (action needs beaks with damage_capabilities)

## Outcome

### Schema Format Corrections Made

The original ticket assumptions used an **incorrect schema format** for `damage-capability-entry.schema.json`:

| Field | Original (Wrong) | Corrected |
|-------|------------------|-----------|
| `penetration` | Integer (e.g., 10) | 0-1 fraction (e.g., 0.5) |
| `bleed` | Number (e.g., 0.3) | Object `{ enabled: true, severity: "minor", ... }` |
| `dismember` | Number (e.g., 0) | Object or omitted |
| `fracture` | Number (e.g., 0.1) | Object `{ enabled: true, thresholdFraction: 0.9 }` |

### Changes Applied vs Originally Planned

| Beak | Original Plan | Actual Implementation |
|------|---------------|----------------------|
| Kraken | `penetration: 10, bleed: 0.3` | `penetration: 0.5, bleed: { enabled: true, severity: "minor", baseDurationTurns: 2 }` |
| Chicken | `penetration: 1, bleed: 0.1` | `penetration: 0.1` (no bleed - too small) |
| Tortoise | `penetration: 4, fracture: 0.1` | `penetration: 0.2, fracture: { enabled: true, thresholdFraction: 0.9 }` |

### Files Modified

1. `data/mods/anatomy/entities/definitions/beak.entity.json` - Added damage_capabilities
2. `data/mods/anatomy/entities/definitions/chicken_beak.entity.json` - Added damage_capabilities
3. `data/mods/anatomy/entities/definitions/tortoise_beak.entity.json` - Added damage_capabilities

### Tests Created

- `tests/unit/mods/anatomy/entities/beakDamageCapabilities.test.js` (28 tests)
  - Schema validation for each beak
  - Component presence verification
  - Value bounds checking (penetration 0-1, amount > 0)
  - Effect object structure validation
  - Existing component integrity preservation

### Test Results

- All 28 unit tests pass
- Schema validation passes for all modified entities
- No lint errors
