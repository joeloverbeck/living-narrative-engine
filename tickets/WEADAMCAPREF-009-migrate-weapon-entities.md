# WEADAMCAPREF-009: Migrate weapon entities to damage_capabilities

## Summary

Add the `damage-types:damage_capabilities` component to all existing weapon entities with appropriate damage configurations. The old `damage-types:can_cut` component is kept temporarily for backward compatibility (removed in WEADAMCAPREF-011).

## Dependencies

- WEADAMCAPREF-001 (schema must exist for validation)
- WEADAMCAPREF-002 (component must exist for usage)

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| `data/mods/fantasy/entities/definitions/vespera_rapier.entity.json` | UPDATE | Add damage_capabilities |
| `data/mods/fantasy/entities/definitions/vespera_main_gauche.entity.json` | UPDATE | Add damage_capabilities |
| `data/mods/fantasy/entities/definitions/rill_practice_stick.entity.json` | UPDATE | Add damage_capabilities |
| `data/mods/fantasy/entities/definitions/threadscar_melissa_longsword.entity.json` | UPDATE | Add damage_capabilities |

## Out of Scope

- Removing `can_cut` component (WEADAMCAPREF-011)
- Service changes
- Rule changes
- Creating new weapon entities
- Balancing damage values (use spec-defined values)

## Implementation Details

### Vespera Rapier

```json
{
  "damage-types:damage_capabilities": {
    "entries": [
      {
        "name": "slashing",
        "amount": 3,
        "penetration": 0.3,
        "bleed": {
          "enabled": true,
          "severity": "moderate",
          "baseDurationTurns": 3
        },
        "dismember": {
          "enabled": true,
          "thresholdFraction": 0.8
        }
      }
    ]
  }
}
```

### Vespera Main-Gauche

```json
{
  "damage-types:damage_capabilities": {
    "entries": [
      {
        "name": "piercing",
        "amount": 2,
        "penetration": 0.8,
        "bleed": {
          "enabled": true,
          "severity": "minor",
          "baseDurationTurns": 2
        }
      }
    ]
  }
}
```

### Rill Practice Stick

```json
{
  "damage-types:damage_capabilities": {
    "entries": [
      {
        "name": "blunt",
        "amount": 1
      }
    ]
  }
}
```

**Note**: Practice stick has NO effects enabled (no bleed, no fracture, no dismember).

### Threadscar Melissa Longsword

```json
{
  "damage-types:damage_capabilities": {
    "entries": [
      {
        "name": "slashing",
        "amount": 4,
        "penetration": 0.3,
        "bleed": {
          "enabled": true,
          "severity": "moderate",
          "baseDurationTurns": 3
        },
        "dismember": {
          "enabled": true,
          "thresholdFraction": 0.7
        }
      }
    ]
  }
}
```

### Damage Configuration Summary

| Weapon | Type | Amount | Penetration | Bleed | Dismember |
|--------|------|--------|-------------|-------|-----------|
| Vespera Rapier | slashing | 3 | 0.3 | moderate (3 turns) | 0.8 |
| Vespera Main-Gauche | piercing | 2 | 0.8 | minor (2 turns) | - |
| Rill Practice Stick | blunt | 1 | - | - | - |
| Threadscar Melissa Longsword | slashing | 4 | 0.3 | moderate (3 turns) | 0.7 |

## Acceptance Criteria

### Tests That Must Pass

1. `npm run validate` - All mod validation passes
2. `npm run validate:mod:fantasy` - Specific mod validation (if exists)

### Integration Tests

```javascript
describe('Weapon damage capability migration', () => {
  it('should discover swing_at_target for weapons with slashing', async () => {
    // Rapier and Longsword should have swing_at_target available
  });

  it('should NOT discover swing_at_target for practice stick', async () => {
    // Practice stick has blunt, not slashing
    // swing_at_target requires slashing capability
  });
});
```

### Manual Verification

- Load game with migrated weapons
- Verify weapon tooltips/info shows damage capabilities (if UI exists)
- Verify combat actions work with new damage data

### Invariants That Must Remain True

1. Each weapon entity keeps `damage-types:can_cut` component (until WEADAMCAPREF-011)
2. Each weapon entity keeps `weapons:weapon` component
3. Entity IDs remain unchanged
4. Other components on entities remain unchanged
5. Entity files remain valid JSON
6. All damage values match spec-defined values (no custom balancing)

## Estimated Size

- 4 entity files (~10-15 lines added each)
