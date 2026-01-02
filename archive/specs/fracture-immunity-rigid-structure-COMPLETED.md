# Spec: Fracture Immunity System via Rigid Structure Component

## Problem Statement

Currently, the fracture system in the damage simulator applies fractures to **any** body part when damage exceeds the threshold (50% of max health by default). This leads to biologically incorrect scenarios where soft tissue parts like penises, buttocks, breasts, and internal organs can be fractured.

### Observed Issue
In `damage-simulator.html`, attacks that cause fractures can fracture anatomy parts that don't contain bones or rigid structures (e.g., genitals, soft tissue).

### Root Cause
The `FractureApplicator.apply()` method has no mechanism to check whether a body part is structurally capable of being fractured. It only checks:
1. Is fracture enabled in the damage config?
2. Does damage exceed the threshold fraction of max health?

### Missing Abstraction
There is no component that indicates whether a body part contains bones or other rigid internal structure that could fracture.

---

## Solution Overview

Add a new marker component `anatomy:has_rigid_structure` that indicates a body part CAN be fractured. The `FractureApplicator` will check for this component before applying fractures.

**Design Principle**: Use a *positive marker* (presence = can fracture) rather than a negative marker (presence = cannot fracture). This is safer because:
- Parts without the marker default to "cannot fracture" (safe fallback)
- Easier to audit which parts CAN fracture than which cannot
- More explicit about structural properties

---

## Component Design

### Component ID
`anatomy:has_rigid_structure`

### Component Schema
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:has_rigid_structure",
  "description": "Marks a body part as containing rigid internal structure (bones, cartilage, carapace, etc.) that can be fractured under sufficient trauma.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "structureType": {
        "type": "string",
        "enum": ["bone", "cartilage", "chitin", "carapace", "exoskeleton", "shell"],
        "description": "The type of rigid structure. Used for narrative purposes.",
        "default": "bone"
      }
    },
    "additionalProperties": false
  }
}
```

### Rationale
- **Generic naming**: Covers bones, cartilage, chitin, carapace, exoskeletons - future-proof for diverse creatures
- **Optional structureType**: Enables narrative differentiation ("the bone fractures" vs "the chitinous segment cracks")
- **Empty object is valid**: `{}` defaults to bone structure (most common case)

---

## Code Changes

### 1. FractureApplicator Modifications

**File**: `src/anatomy/applicators/fractureApplicator.js`

#### Add Constant
```javascript
const HAS_RIGID_STRUCTURE_COMPONENT_ID = 'anatomy:has_rigid_structure';
```

#### Add Method
```javascript
/**
 * Check if a part has rigid structure (bones, carapace, etc.) that can fracture.
 * @param {string} partId - The part entity ID to check
 * @returns {boolean} True if the part has the anatomy:has_rigid_structure component
 */
hasRigidStructure(partId) {
  try {
    return this.#entityManager.hasComponent(partId, HAS_RIGID_STRUCTURE_COMPONENT_ID);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    this.#logger.warn(
      `FractureApplicator: Error checking rigid structure for ${partId}: ${message}`
    );
    return false; // Safe default: cannot fracture if check fails
  }
}
```

#### Modify apply() Method
Add check after the enabled check but before threshold check:
```javascript
async apply({ entityId, partId, damageAmount, ... }) {
  // Check if fracture is enabled in config
  if (!damageEntryConfig?.enabled) {
    return { triggered: false, stunApplied: false };
  }

  // NEW: Check if part has rigid structure that can fracture
  if (!this.hasRigidStructure(partId)) {
    this.#logger.debug(
      `FractureApplicator: Part ${partId} lacks rigid structure, skipping fracture.`
    );
    return { triggered: false, stunApplied: false };
  }

  // ... rest unchanged
}
```

#### Export New Constant
```javascript
export { ..., HAS_RIGID_STRUCTURE_COMPONENT_ID };
```

---

## Entity Classification

### Parts WITH Rigid Structure (ADD component)

#### Human/Humanoid (~35 entity definitions)
| Part Category | Structure Type | Entity Pattern |
|---------------|----------------|----------------|
| Legs | bone | `human_leg*.entity.json` |
| Arms | bone | `humanoid_arm*.entity.json` |
| Hands | bone | `human_hand.entity.json`, `humanoid_hand*.entity.json` |
| Feet | bone | `human_foot.entity.json` |
| Head | bone | `humanoid_head*.entity.json` |
| Torso | bone | `human_*_torso*.entity.json`, `human_futa_torso*.entity.json` |
| Spine | bone | `human_spine.entity.json` |
| Nose | cartilage | `humanoid_nose*.entity.json` |
| Teeth | bone | `humanoid_teeth.entity.json` |

#### Creatures (~60 entity definitions)
| Part Category | Structure Type | Entity Pattern |
|---------------|----------------|----------------|
| Spider parts | chitin | `spider_*.entity.json` |
| Dragon bones | bone | `dragon_leg.entity.json`, `dragon_wing.entity.json`, etc. |
| Tortoise shell | shell | `tortoise_plastron.entity.json`, `tortoise_carapace.entity.json` |
| Bird parts | bone | `chicken_leg.entity.json`, `chicken_wing.entity.json`, etc. |
| Beak | bone | `*_beak.entity.json` |

### Parts WITHOUT Rigid Structure (NO changes)

| Category | Examples |
|----------|----------|
| Reproductive | penis, vagina, testicle, asshole, pubic_hair |
| Soft tissue | breast, ass_cheek, ear, mouth, tongue, lips |
| Internal organs | brain, heart, lung, liver, kidney |
| Eyes | All eye variants |
| Hair | All hair variants |
| Tentacles | squid_tentacle, eldritch_tentacle, kraken_tentacle |

---

## Testing Strategy

### Unit Tests
**File**: `tests/unit/anatomy/applicators/fractureApplicator.test.js`

Add test cases:
1. `hasRigidStructure()` returns true when component exists
2. `hasRigidStructure()` returns false when component missing
3. `hasRigidStructure()` handles errors gracefully (returns false)
4. `apply()` skips fracture when part lacks rigid structure
5. `apply()` proceeds with fracture when part has rigid structure
6. Verify check order: enabled → rigid structure → threshold

### Integration Tests
**New File**: `tests/integration/anatomy/fractureImmunity.integration.test.js`

Test scenarios:
1. Soft tissue parts (penis, breast, etc.) do NOT fracture
2. Skeletal parts (leg, arm, spine) DO fracture when threshold met
3. Creature parts with chitin/carapace DO fracture
4. Creature tentacles do NOT fracture

### E2E Tests
**New File**: `tests/e2e/anatomy/fractureRigidStructure.e2e.test.js`

Full damage application scenarios:
1. Swing weapon at leg (has bones) → can fracture
2. Swing weapon at breast (soft tissue) → cannot fracture
3. Swing weapon at spider leg (chitin) → can fracture

---

## Implementation Sequence

### Phase 1: Core Implementation
1. Create `data/mods/anatomy/components/has_rigid_structure.component.json`
2. Modify `src/anatomy/applicators/fractureApplicator.js`
3. Update existing unit tests to mock `hasComponent` returning `true`
4. Add new unit tests for immunity behavior

### Phase 2: Human Entity Updates (~35 files)
5. Add component to all leg variants
6. Add component to all arm variants
7. Add component to all hand/foot files
8. Add component to all torso variants
9. Add component to head, spine, nose, teeth

### Phase 3: Creature Entity Updates (~60 files)
10. Add component to all spider parts (structureType: "chitin")
11. Add component to all bird/dragon skeletal parts (structureType: "bone")
12. Add component to shell/carapace parts (structureType: "shell")
13. Verify tentacles and soft parts are unchanged

### Phase 4: Testing & Validation
14. Run unit tests
15. Create and run integration tests
16. Create and run E2E tests
17. Manual verification in damage simulator

---

## Critical Files

### Files to Create
- `data/mods/anatomy/components/has_rigid_structure.component.json`
- `tests/integration/anatomy/fractureImmunity.integration.test.js`
- `tests/e2e/anatomy/fractureRigidStructure.e2e.test.js`

### Files to Modify
- `src/anatomy/applicators/fractureApplicator.js`
- `tests/unit/anatomy/applicators/fractureApplicator.test.js`
- ~95 entity definition files in `data/mods/anatomy/entities/definitions/`
- ~60 entity definition files in `data/mods/anatomy-creatures/entities/definitions/`

### Reference Files (patterns to follow)
- `data/mods/anatomy/components/embedded.component.json` - simple marker component pattern
- `src/anatomy/applicators/dismembermentApplicator.js` - may have similar component check pattern

---

## Backwards Compatibility

**Behavior Change**: Parts that previously could fracture will no longer fracture until they receive the `anatomy:has_rigid_structure` component.

**Migration Strategy**: This is a breaking change for existing save games if entities were created without the component. However, since:
1. This is a pre-1.0 project in active development
2. The damage simulator is a testing tool, not saved gameplay
3. The default behavior (cannot fracture) is the safer option

...this is acceptable. New entities created from updated definitions will work correctly.

---

## Validation Commands

```bash
# After component creation
npm run validate

# After code changes
npm run typecheck
npx eslint src/anatomy/applicators/fractureApplicator.js

# After entity updates
npm run validate

# Full test suite
npm run test:unit
npm run test:integration
npm run test:e2e
```

---

## Success Criteria

1. Soft tissue parts (penis, vagina, breast, ass_cheek, etc.) NEVER fracture regardless of damage
2. Skeletal parts (leg, arm, spine, etc.) CAN fracture when damage exceeds threshold
3. Creature parts with chitin/carapace CAN fracture
4. Creature tentacles CANNOT fracture
5. All existing unit tests pass
6. New unit, integration, and E2E tests pass
7. No TypeScript/ESLint errors
8. Schema validation passes for all mod files
