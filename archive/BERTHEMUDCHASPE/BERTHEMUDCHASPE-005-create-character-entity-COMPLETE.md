# BERTHEMUDCHASPE-005: Create Bertram Character Entity [COMPLETED]

## Status: ✅ COMPLETED

## Description

Create Bertram's character entity (definition and instance), including all personality components, notes, and system components. This is the main character assembly that ties together recipe, clothing, and profile.

## Prerequisites

- **MUST complete BERTHEMUDCHASPE-003** (recipe exists)
- **MUST complete BERTHEMUDCHASPE-004** (apron exists)

## Files Expected to Touch

- CREATE: `data/mods/fantasy/entities/definitions/bertram_the_muddy.character.json`
- CREATE: `data/mods/fantasy/entities/instances/bertram_the_muddy.character.json`
- MODIFY: `data/mods/fantasy/mod-manifest.json` (add character references)

## Explicit Out of Scope

- **NO recipe creation** (completed in BERTHEMUDCHASPE-003)
- **NO anatomy part creation** (completed in BERTHEMUDCHASPE-002)
- **NO clothing creation** (completed in BERTHEMUDCHASPE-004)
- **NO modification** of existing character entities
- **NO portrait creation** (external, out of scope)
- **NO world integration** (optional, separate task)

## Acceptance Criteria

### Required Components - Identity (5 components)

1. **core:name**: `{"value": "Bertram"}`
2. **core:apparent_age**: `{"value": "fifties"}`
3. **core:profile**: Full biographical description (see spec Section 5.1)
4. **anatomy:body**: `{"recipeId": "fantasy:bertram_the_muddy_recipe"}`
5. **core:notes**: 4 subjects (reciprocal services, Anna, leatherworking, Mudbrook)

### Required Components - Personality (7 components)

1. **core:personality**: 7 traits + description capturing radical sincerity
2. **core:speech_patterns**: 7 examples + notes on directness
3. **core:strengths**: 7 values (master craftsman, sincerity, emotional health, etc.)
4. **core:weaknesses**: 6 values (no romantic interest, permanent staining, etc.)
5. **core:likes**: 8 values (ale, sunsets, leather smell, etc.)
6. **core:dislikes**: 7 values (pretension, complexity, drama, etc.)
7. **core:fears**: Empty array with note "genuinely content"

### Required Components - Goals & Tensions (3 components)

1. **core:goals**:
   - Short-term: reciprocal services, saddle commission, maintain quality
   - Long-term: contentment, preserve craft, maintain health
2. **core:secrets**: Empty array with note "radically transparent"
3. **core:internal_tensions**: 1 resolved tension (physical needs → practical solution)

### Required Components - System (3 components)

1. **core:actor**: Empty object
2. **core:player_type**: `{"type": "npc"}`
3. **core:perception_log**: `{"entries": []}`

### Instance File Requirements

- Reference all 7 clothing items in equipped inventory:
  1. `clothing:graphite_wool_briefs` (groin/base)
  2. `clothing:shale_gray_nylon_field_pants` (legs/base)
  3. `clothing:charcoal_wool_tshirt` (torso_upper/base)
  4. `clothing:leather_work_apron` (torso_upper/outer)
  5. `clothing:dark_brown_leather_belt` (waist/base)
  6. `clothing:dark_gray_wool_boot_socks` (feet/base)
  7. `clothing:black_leather_duty_boots` (feet/outer)
- Set initial location (if applicable)
- Empty unequipped inventory

### Critical Character Essence to Preserve

1. **Radical Sincerity**: No secrets, no hidden depths, complete transparency
2. **Emotional Health**: Properly processed grief, no ongoing crisis
3. **Transactional Wisdom**: Practical problem-solving for all needs
4. **Professional Pride**: Master craftsman who respects his trade
5. **Simple Contentment**: Happy with ale, sunsets, pipe, leather, honest company
6. **Zero Performativity**: Just IS Bertram, no questioning or drama

### Specific Tests That Must Pass

- Both definition and instance files validate against character schema
- Entity ID is `fantasy:bertram_the_muddy`
- All component types are valid registered components
- Recipe reference resolves: `fantasy:bertram_the_muddy_recipe`
- All clothing references resolve to existing entities
- All note subject references are valid (especially `fantasy:notice_reciprocal_services`)
- `npm run validate` passes for fantasy mod

### Invariants That Must Remain True

- **NO modification** of existing character entities
- **NO modification** of recipe or clothing files
- All personality traits align with "radical sincerity" theme
- Secrets and fears remain empty (character design choice)
- Speech patterns demonstrate directness and practical metaphors
- Notes reference valid entity IDs

## Implementation Notes

### Contrast to Vespera

Bertram is designed as opposite to complex characters:

- Where Vespera has layers → Bertram is transparent
- Where Vespera performs identity → Bertram just IS
- Where Vespera has secrets → Bertram has none
- This contrast makes both characters more interesting

### Speech Pattern Guidelines

- Use practical leatherwork metaphors naturally
- Discuss dead wife, sexual needs with same matter-of-fact tone
- Ask sincere questions when confused
- Zero ego, zero performance
- Clear, direct, literal communication

### Component Size Warning

This is a LARGE file with 18 components. Keep definition and instance separate for clarity.

## Reference

- See `specs/bertram-the-muddy-character-spec.md` Section 5 for all component specifications
- Reference `vespera_nightwhisper.character.json` for character structure
- Reference `threadscar_melissa.character.json` for practical personality example

---

## Outcome

### What Was Changed

**Files Created:**

1. `data/mods/fantasy/entities/definitions/bertram_the_muddy.character.json`
   - All 18 required components implemented
   - Identity components (5): name, apparent_age, profile, anatomy:body, notes
   - Personality components (7): personality, speech_patterns, strengths, weaknesses, likes, dislikes, fears
   - Goals & Tensions (3): goals, secrets, internal_tensions
   - System components (3): actor, player_type, perception_log

2. `data/mods/fantasy/entities/instances/bertram_the_muddy.character.json`
   - Instance references definition
   - Located in Mudbrook-on-the-Bend
   - All 7 clothing items equipped (briefs, pants, shirt, apron, belt, socks, boots)
   - Empty unequipped inventory with capacity settings

3. `tests/integration/fantasy/bertramCharacterValidation.test.js`
   - 20 comprehensive validation tests
   - Tests verify all 18 components exist
   - Tests verify character essence preservation (radical sincerity, emotional health, etc.)
   - Tests verify instance configuration (clothing, location, inventory)

**Files Modified:**

1. `data/mods/fantasy/mod-manifest.json`
   - Added `bertram_the_muddy.character.json` to definitions array
   - Added `bertram_the_muddy.character.json` to instances array

### What Was NOT Changed (As Planned)

✅ No recipe modification (already existed)
✅ No anatomy part creation (already existed)
✅ No clothing creation (already existed)
✅ No modification of existing character entities
✅ No portrait creation (out of scope)
✅ No world integration (optional)

### Validation Results

✅ All tests pass (20/20)
✅ `npm run validate` passes with no new violations
✅ Character entity ID: `fantasy:bertram_the_muddy`
✅ Recipe reference resolves: `fantasy:bertram_the_muddy_recipe`
✅ All clothing references resolve correctly
✅ All note references valid (including `fantasy:notice_reciprocal_services`)

### Character Essence Preserved

✅ **Radical Sincerity**: Empty secrets, empty fears, transparent personality
✅ **Emotional Health**: Processed grief properly, no ongoing crisis
✅ **Transactional Wisdom**: Fair exchange approach to all needs
✅ **Professional Pride**: Master craftsman with 30+ years experience
✅ **Simple Contentment**: Happy with ale, sunsets, leather, honest company
✅ **Zero Performativity**: Just IS Bertram, no questioning or drama

### Differences from Original Plan

**Minor Adjustments:**

- Component structure uses `text` field instead of `value` for most components (matching Vespera pattern)
- Notes structure uses `text` field instead of `content` (matching existing patterns)
- Instance uses `clothing:equipped_inventory` component (standard pattern)
- Added comprehensive integration tests (20 tests total)

**All changes align with existing codebase patterns and preserve character essence exactly as specified.**
