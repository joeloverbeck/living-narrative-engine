# Anatomy Mod Splitting Recommendations

**Date**: 2026-01-03
**Scope**: Architecture analysis for splitting the `anatomy` mod into thematically-coherent sub-mods
**Focus**: Entity-based content mod restructuring (distinct from action-based mod splitting)

---

## Executive Summary

The `anatomy` mod is the **second largest mod** in the Living Narrative Engine with **207 files** and **32 dependent mods**. Analysis reveals that while the mod contains diverse content types, the current structure has clear natural boundaries for splitting.

### Key Findings

| Metric | Value |
|--------|-------|
| Total Files | 207 |
| Entity Definitions | 143 (69% of mod) |
| Dependent Mods | 32 |
| Components | 25 |
| Events | 25 |

### Primary Recommendation

**Split into 4 thematic sub-mods:**

1. **anatomy-core** (45 files) - Infrastructure: components, events, conditions, libraries
2. **anatomy-humanoid-base** (60 files) - Core human body parts: torsos, limbs, organs
3. **anatomy-humanoid-features** (50 files) - Appearance: faces, eyes, hair, skin variations
4. **anatomy-humanoid-intimate** (30 files) - Anatomy: breasts, genitalia, secondary sexual characteristics

*Note: `anatomy-creatures` already exists as a separate mod (193 files) - this split pattern is proven.*

---

## Current State Analysis

### File Distribution

```
data/mods/anatomy/
├── entities/definitions/    143 files (69%)  ← Primary bloat area
├── events/                   25 files (12%)
├── components/               25 files (12%)
├── recipes/                   3 files
├── blueprints/                3 files
├── conditions/                3 files
├── libraries/                 1 file
├── parts/                     1 file
├── anatomy-formatting/        1 file
├── status-effects/            1 file
└── mod-manifest.json          1 file
                             ─────────
                              207 files total
```

### Entity Definition Breakdown (143 files)

| Category | Count | Content |
|----------|-------|---------|
| **Torso** | 9 | Male/female/futa, build variations (thin, muscular, hulking) |
| **Breasts** | 11 | Cup sizes A-H, modifiers (soft, firm, stretch-marked) |
| **Genitalia** | 14 | Vaginas (5), penises (4), testicles (2), asshole, pubic hair |
| **Legs** | 14 | Athletic, soft, muscular, slim, thick, weathered |
| **Arms** | 14 | Athletic, soft, muscular, scarred, hulking |
| **Head/Face** | 20+ | Plain, beautiful, hideous, bearded, stubbled |
| **Eyes** | 11 | Colors (blue, brown, green, amber, red), shapes |
| **Hair** | 17 | Color × length × style combinations |
| **Other** | 18+ | Hands, feet, ears, nose, mouth, internal organs |

### Component Categories (25 components)

| Type | Components | Description |
|------|------------|-------------|
| **Core Structure** | `part`, `body`, `blueprintSlot`, `sockets`, `joint` | Fundamental anatomy infrastructure |
| **Health/Damage** | `part_health`, `damage_propagation`, `bleeding`, `burning`, `poisoned`, `fractured` | Physical state tracking |
| **Capability** | `provides_sight`, `provides_hearing`, `provides_smell`, `provides_thinking`, `can_grab` | What anatomy enables |
| **State** | `dead`, `dying`, `stunned`, `dismembered`, `embedded` | Condition markers |
| **Physical** | `has_rigid_structure`, `vital_organ`, `visibility_rules` | Structural properties |

---

## Dependency Analysis

### Mods That Depend on Anatomy (32 total)

**Tier 1 - Heavy Integration:**
- `clothing` - Maps to body slots, visibility rules
- `grabbing`, `grabbing-states` - Uses `can_grab`, `requires_grabbing`
- `weapons` - References grabbing components
- `anatomy-creatures` - Extends anatomy for non-humans

**Tier 2 - Moderate Integration:**
- `movement`, `physical-control` - Movement constraints
- `striking`, `creature-attacks` - Damage targets
- `first-aid` - Healing anatomy
- `drinking`, `breathing` - Physiological systems

**Tier 3 - Light Integration:**
- `seduction`, `personal-space` - Social/proximity
- `distress`, `companionship` - Emotional states
- `containers`, `item-handling`, `item-transfer`, `item-placement`
- `exercise`, `patrol`, `fantasy`, `dredgers`

**Private Mods (6):**
- `p_erotica`, `p_erotica_duchess`, `p_erotica_gymnast`, `p_erotica_irun`, `p_erotica_kern`, `p_erotica_swiss`

### Critical Integration Points

| Resource | Used By | Risk Level |
|----------|---------|------------|
| `anatomy:requires_grabbing` | weapons rules | 🔴 CRITICAL |
| `anatomy:can_grab` | grabbing mechanics | 🔴 CRITICAL |
| Blueprints/Recipes | character creation, dredgers | 🟡 HIGH |
| Events (24) | multiple mods | 🟡 HIGH |
| Conditions (3) | action validation | 🟡 HIGH |
| Entity definitions | direct references rare | 🟢 LOW |

---

## Comparison: Mod Ecosystem Granularity

### Current Patterns

| Pattern | Example | Files | Description |
|---------|---------|-------|-------------|
| **Feature + State** | `kissing` + `kissing-states` | 40 + 15 | Actions separate from state components |
| **Single Feature** | `music`, `ballet` | 30-50 | Self-contained feature mods |
| **Content Collection** | `fantasy`, `dredgers` | 200+ | Scenario-specific content |
| **System Extension** | `anatomy-creatures` | 193 | Extends base system |

### Precedent: anatomy-creatures Split

The `anatomy-creatures` mod already demonstrates successful splitting:

```
anatomy (207 files)
  ↓ (depends on)
anatomy-creatures (193 files)
  ├── Creature-specific entities (154)
  ├── Creature blueprints (16)
  ├── Creature recipes (10)
  └── Structure templates (7)
```

**Key Lesson**: Extension mods depend on core, add domain-specific content.

---

## Splitting Options

### Option A: Minimal Split (2 mods)

```
anatomy-core/           (64 files)
├── components/         25 files
├── events/             25 files
├── conditions/          3 files
├── blueprints/          3 files
├── recipes/             3 files
├── libraries/           1 file
├── parts/               1 file
├── anatomy-formatting/  1 file
├── status-effects/      1 file
└── mod-manifest.json    1 file

anatomy-humanoid/       (143 files)
└── entities/definitions/ 143 files
```

**Pros**: Simple, clear separation, maintains backward compatibility
**Cons**: `anatomy-humanoid` is still large (143 files)

### Option B: Thematic Split (4 mods) ⭐ RECOMMENDED

```
anatomy-core/               (45 files)
├── components/             25 files
├── events/                 25 files  → MOVE TO anatomy-events?
├── conditions/              3 files
├── libraries/               1 file
├── parts/                   1 file
└── mod-manifest.json        1 file

anatomy-humanoid-base/      (60 files)
├── blueprints/              3 files
├── recipes/                 3 files
├── status-effects/          1 file
├── anatomy-formatting/      1 file
└── entities/definitions/   ~52 files
    ├── torsos (9)
    ├── arms (14)
    ├── legs (14)
    ├── hands, feet (6)
    └── internal organs (9)

anatomy-humanoid-features/  (50 files)
└── entities/definitions/
    ├── head/face (20)
    ├── eyes (11)
    ├── hair (17)
    └── ears, nose, mouth (2)

anatomy-humanoid-intimate/  (30 files)
└── entities/definitions/
    ├── breasts (11)
    ├── genitalia (14)
    └── related (5)
```

**Pros**:
- Clear thematic boundaries
- Enables selective loading (e.g., SFW mode could skip intimate mod)
- Each sub-mod has focused responsibility
- Matches the detail level of other mods

**Cons**:
- More complex dependency management
- 4 manifests to maintain

### Option C: Functional Split (3 mods)

```
anatomy-core/           (70 files)
├── All infrastructure
└── Core body parts (torsos, limbs, organs)

anatomy-appearance/     (50 files)
└── Visual features (face, eyes, hair)

anatomy-sexual/         (25 files)
└── Intimate anatomy (breasts, genitalia)
```

**Pros**: Simpler than Option B, still addresses content filtering needs
**Cons**: Arbitrary boundary between "core" and "appearance"

### Option D: Keep As-Is

**Pros**: No migration effort, no breaking changes
**Cons**:
- 207 files in single mod
- No granular loading control
- Harder to navigate/maintain

---

## Recommended Approach: Option B (Thematic Split)

### Rationale

1. **Content Filtering**: Enables SFW/NSFW content control by mod activation
2. **Cognitive Load**: 45-60 files per mod is manageable (vs 207)
3. **Reusability**: Base anatomy could be shared across different settings
4. **Precedent**: Follows established `anatomy-creatures` pattern
5. **Dependency Chain**: Clean hierarchy: core → base → features/intimate

### Proposed Dependency Graph

```
anatomy-core
    ↑
anatomy-humanoid-base
    ↑         ↑
    |    anatomy-humanoid-intimate
    |
anatomy-humanoid-features

(anatomy-creatures depends on anatomy-core, independent of humanoid)
```

### Migration Strategy

#### Phase 1: Create anatomy-core (Low Risk)
1. Create new mod directory structure
2. Copy infrastructure files (components, events, conditions, libraries, parts)
3. Update anatomy mod-manifest to depend on anatomy-core
4. Test: All 32 dependent mods should work unchanged

#### Phase 2: Create anatomy-humanoid-base (Medium Risk)
1. Move torso, limb, and organ entities
2. Move blueprints, recipes, formatting
3. Update anatomy manifest
4. Test: Character creation still works

#### Phase 3: Create anatomy-humanoid-features (Low Risk)
1. Move face, eye, hair entities
2. Add dependency on anatomy-humanoid-base
3. Test: Character appearance generation works

#### Phase 4: Create anatomy-humanoid-intimate (Medium Risk)
1. Move breast, genital entities
2. Add dependency on anatomy-humanoid-base
3. Test: Full anatomy generation works
4. Test: Content filtering (disable mod, verify fallback)

#### Phase 5: Deprecate Original anatomy Mod
1. Create meta-mod that depends on all 4 new mods
2. Update all 32 dependent mods to use new dependencies
3. Verify no regressions

### Entity Classification for Split

#### anatomy-humanoid-base (52 entities)

**Torsos (9)**
- `female_torso.entity.json`, `male_torso.entity.json`, `futa_torso.entity.json`
- `*_thin.entity.json`, `*_muscular.entity.json`, `*_hulking.entity.json`

**Arms (14)**
- `arm_*.entity.json` variants (athletic, soft, muscular, weathered, etc.)

**Legs (14)**
- `leg_*.entity.json` variants

**Extremities (6)**
- `hand_*.entity.json`, `foot_*.entity.json`

**Internal Organs (9)**
- `brain.entity.json`, `heart.entity.json`, `lungs.entity.json`, etc.

#### anatomy-humanoid-features (48 entities)

**Head/Face (20)**
- `face_*.entity.json` (plain, beautiful, cute, attractive, hideous)
- `head_*.entity.json` variants

**Eyes (11)**
- `eye_*.entity.json` (blue, brown, green, amber, cobalt, gray, hazel, red)

**Hair (17)**
- `hair_*.entity.json` (color × length × style)

#### anatomy-humanoid-intimate (26 entities)

**Breasts (11)**
- `breast_*.entity.json` (cup sizes A-H, modifiers)

**Genitalia (15)**
- `vagina_*.entity.json` (5)
- `penis_*.entity.json` (4)
- `testicle_*.entity.json` (2)
- `asshole.entity.json`, `pubic_hair_*.entity.json`

---

## Implementation Checklist

### Pre-Migration
- [ ] Document all 32 dependent mods and their specific anatomy references
- [ ] Create test suite verifying current functionality
- [ ] Backup current anatomy mod

### Phase 1: anatomy-core
- [ ] Create `data/mods/anatomy-core/` directory
- [ ] Move components (25 files)
- [ ] Move events (25 files)
- [ ] Move conditions (3 files)
- [ ] Move libraries (1 file)
- [ ] Move parts (1 file)
- [ ] Create mod-manifest.json with correct metadata
- [ ] Update anatomy mod to depend on anatomy-core
- [ ] Run full test suite

### Phase 2: anatomy-humanoid-base
- [ ] Create `data/mods/anatomy-humanoid-base/` directory
- [ ] Move blueprints (3 files)
- [ ] Move recipes (3 files)
- [ ] Move anatomy-formatting (1 file)
- [ ] Move status-effects (1 file)
- [ ] Move base entity definitions (~52 files)
- [ ] Create mod-manifest.json with dependency on anatomy-core
- [ ] Test character creation workflow

### Phase 3: anatomy-humanoid-features
- [ ] Create `data/mods/anatomy-humanoid-features/` directory
- [ ] Move feature entity definitions (~48 files)
- [ ] Create mod-manifest.json
- [ ] Test appearance generation

### Phase 4: anatomy-humanoid-intimate
- [ ] Create `data/mods/anatomy-humanoid-intimate/` directory
- [ ] Move intimate entity definitions (~26 files)
- [ ] Create mod-manifest.json
- [ ] Test with mod enabled and disabled

### Phase 5: Migration & Cleanup
- [ ] Create meta-mod `anatomy-humanoid-all` that includes all sub-mods
- [ ] Update game.json to use new mod structure
- [ ] Update all 32 dependent mods' manifests
- [ ] Remove original anatomy mod (or convert to meta-mod)
- [ ] Update CLAUDE.md documentation
- [ ] Final regression testing

---

## Risk Mitigation

### Backward Compatibility

**Problem**: 32 mods reference `anatomy:*` component IDs
**Solution**: Keep all component IDs in `anatomy-core` namespace, OR use consistent `anatomy:` prefix across all sub-mods

### Blueprint References

**Problem**: Recipes reference blueprint IDs
**Solution**: Keep blueprints and recipes in same mod (anatomy-humanoid-base)

### Event Handling

**Problem**: Events must be discoverable by event bus
**Solution**: Events stay in anatomy-core (infrastructure layer)

### Test Coverage

**Existing Coverage**:
- `tests/unit/anatomy/` - Unit tests for anatomy system
- `tests/integration/anatomy/` - Integration tests
- `tests/performance/anatomy/` - Performance tests

**Additional Tests Needed**:
- Cross-mod entity resolution tests
- Content filtering verification tests
- Blueprint/recipe loading with split mods

---

## Conclusion

The anatomy mod's 207 files represent accumulated organic growth that would benefit from thematic restructuring. The recommended **4-mod split** (core, base, features, intimate) provides:

1. **Modularity**: Each sub-mod has focused responsibility
2. **Flexibility**: Content filtering by mod activation
3. **Maintainability**: Smaller, navigable codebases
4. **Extensibility**: Clear patterns for adding new anatomy types

The `anatomy-creatures` mod proves this split pattern works in the existing architecture. Migration can be phased to minimize risk, with the original mod serving as a meta-mod during transition.

---

*Report generated by architecture analysis workflow*
