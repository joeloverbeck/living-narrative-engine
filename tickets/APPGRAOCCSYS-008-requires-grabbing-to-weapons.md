# APPGRAOCCSYS-008: Add anatomy:requires_grabbing Component to Weapon Entities

**Originating Document**: `brainstorming/appendage-grabbing-occupation-system.md`

## Summary

Add the `anatomy:requires_grabbing` component to weapon entity definitions to specify how many grabbing appendages are required to wield each weapon. This enables the action prerequisite system to validate that actors have enough free hands before presenting weapon-related actions.

## Dependencies

- APPGRAOCCSYS-002 (anatomy:requires_grabbing component schema must exist)

## Files to Modify

| File | Change |
|------|--------|
| `data/mods/fantasy/entities/definitions/vespera_rapier.entity.json` | Add `anatomy:requires_grabbing` with `handsRequired: 1` |
| `data/mods/fantasy/entities/definitions/vespera_main_gauche.entity.json` | Add `anatomy:requires_grabbing` with `handsRequired: 1` |
| `data/mods/fantasy/entities/definitions/threadscar_melissa_longsword.entity.json` | Add `anatomy:requires_grabbing` with `handsRequired: 2` |

## Out of Scope

- DO NOT create the component schema (handled in APPGRAOCCSYS-002)
- DO NOT modify body part entity files (handled in APPGRAOCCSYS-007)
- DO NOT create operation handlers (handled in APPGRAOCCSYS-004/005)
- DO NOT create operators (handled in APPGRAOCCSYS-006)
- DO NOT create conditions (handled in APPGRAOCCSYS-009)
- DO NOT modify any action files (handled in APPGRAOCCSYS-010)
- DO NOT create new weapon entities (this ticket only updates existing)

## Implementation Details

### Example: vespera_rapier.entity.json (After)

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "fantasy:vespera_rapier",
  "description": "Vespera Nightwhisper's elegant duelist's rapier with musical motifs and jingling silver charms",
  "components": {
    "core:name": {
      "text": "Vespera's theatrical rapier"
    },
    "core:description": {
      "text": "A slim duelist's rapier of exceptional elegance and theatrical flair. The swept-hilt guard is decorated with tiny silver charms that jingle softly with every movement, creating a subtle musical accompaniment to the blade's dance. The polished steel blade bears faint etchings of musical staff lines running its length, a testament to its owner's dual nature as both composer and duelist. The weapon feels perfectly balanced, designed for precise thrusts and graceful parries rather than brutal slashing—a blade for a performer of deadly artistry."
    },
    "items:item": {},
    "items:portable": {},
    "items:aimable": {},
    "weapons:weapon": {},
    "items:weight": {
      "weight": 1.2
    },
    "descriptors:color_basic": {
      "color": "gray"
    },
    "descriptors:texture": {
      "texture": "smooth"
    },
    "core:material": {
      "material": "steel",
      "properties": ["rigid"]
    },
    "anatomy:requires_grabbing": {
      "handsRequired": 1
    }
  }
}
```

### Example: threadscar_melissa_longsword.entity.json (After)

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "fantasy:threadscar_melissa_longsword",
  "description": "Melissa's battle-scarred longsword, a veteran's weapon showing decades of use and meticulous maintenance",
  "components": {
    "core:name": {
      "text": "battle-scarred longsword"
    },
    "core:description": {
      "text": "A longsword that has survived forty-two years of professional violence through discipline and maintenance. The blade bears countless nicks and pit marks from decades of sharpening and use, the steel showing its age honestly. The edge is razor-sharp—not through replacement, but through systematic, methodical care. The leather-wrapped grip is dark with sweat and oil, molded to specific hand positions from years of the same holds. The crossguard is slightly bent, possibly from that incident fifteen years ago. No decorations. No engravings. No aesthetic pretense. This is a tool, maintained with the same rigid discipline that has kept its owner alive for four decades. The weight distribution is practical rather than elegant—designed for real combat, not performance. In a veteran's hands, this worn blade is more dangerous than a dozen pristine showpieces."
    },
    "items:item": {},
    "items:portable": {},
    "items:aimable": {},
    "weapons:weapon": {},
    "items:weight": {
      "weight": 1.8
    },
    "descriptors:color_basic": {
      "color": "gray"
    },
    "descriptors:texture": {
      "texture": "rough"
    },
    "core:material": {
      "material": "steel",
      "properties": ["rigid"]
    },
    "anatomy:requires_grabbing": {
      "handsRequired": 2
    }
  }
}
```

### Hands Required Values

| Weapon | handsRequired | minGripStrength | Rationale |
|--------|---------------|-----------------|-----------|
| Rapier | 1 | - | One-handed fencing weapon |
| Main-gauche | 1 | - | Parrying dagger, off-hand weapon |
| Longsword | 2 | - | Two-handed weapon for full control |

## Acceptance Criteria

### Tests That Must Pass

1. **Validation Tests**:
   - [ ] All modified entity files pass JSON schema validation
   - [ ] `npm run validate:mod:fantasy` passes
   - [ ] All entities have valid `anatomy:requires_grabbing` component data

2. **Integration Tests**:
   - [ ] `npm run test:ci` passes
   - [ ] Modified entities can be loaded by entity loader
   - [ ] Entity manager can retrieve `anatomy:requires_grabbing` component data

3. **Existing Tests**: `npm run test:unit` should pass

### Invariants That Must Remain True

1. Existing component data in entity files is preserved
2. Entity IDs and descriptions remain unchanged
3. JSON schema references are preserved
4. All other existing components retain their values
5. Alphabetical property ordering in JSON files is maintained (if applicable)

## Verification Commands

```bash
# Validate fantasy mod
npm run validate:mod:fantasy

# Run CI tests
npm run test:ci

# Validate all schemas
npm run validate

# Run weapon-related tests (if any)
npm run test:unit -- --testPathPattern="weapons"
```

## Future Considerations

- Future weapon entities should also include `anatomy:requires_grabbing`
- Consider creating a guide for modders explaining hand requirements
- Shields may require `handsRequired: 1` when added
- Two-weapon fighting would require `handsRequired: 1` for each weapon (validated separately)
