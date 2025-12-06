# THRMELCHASPE-003: Create Threadscar Melissa Character Definition

**Priority**: High  
**Estimated Effort**: Medium (1 hour)  
**Dependencies**: THRMELCHASPE-002 (Recipe Creation) ✅ COMPLETED

**Status**: ✅ COMPLETED
**Actual Dependencies Met**: Recipe exists at `data/mods/fantasy/recipes/threadscar_melissa.recipe.json`, anatomy part exists at `data/mods/anatomy/entities/definitions/human_female_torso_muscular_scarred.entity.json`

---

## Objective

Create the complete character definition file for "Threadscar" Melissa, including all narrative components (profile, personality, motivations, etc.), speech patterns, notes, and system components.

---

## Files to Touch

### New Files

- `data/mods/fantasy/entities/definitions/threadscar_melissa.character.json`

### Modified Files

None (Note: Recipe file already exists from THRMELCHASPE-002, no modifications needed)

---

## Out of Scope

**Must NOT change:**

- Anatomy recipe file (already created in THRMELCHASPE-002)
- Anatomy part entities
- Schema files
- Component definitions
- Mod manifest files
- Any existing character files
- Instance files (optional, separate concern)

**Must NOT create:**

- Portrait image (separate ticket THRMELCHASPE-005)
- Test files (separate ticket THRMELCHASPE-004)
- Instance file (optional, not required for definition)

---

## Implementation Details

### File Structure

Create file: `data/mods/fantasy/entities/definitions/threadscar_melissa.character.json`

**Complete JSON structure** (see specification document section "Character Definition Components"):

The file must include these component groups:

#### 1. Core Identity Components (6 components)

- `core:name` - Character name with nickname
- `core:portrait` - Portrait image reference
- `core:apparent_age` - Age range (35-50)
- `core:actor` - Actor marker component
- `core:player_type` - Player type (human)
- `core:perception_log` - Perception logging system

#### 2. Narrative Components (11 components)

- `core:profile` - First-person summary (from spec)
- `core:personality` - Personality description (from spec)
- `core:strengths` - Character strengths (from spec)
- `core:weaknesses` - Character weaknesses (from spec)
- `core:likes` - Things character likes (from spec)
- `core:dislikes` - Things character dislikes (from spec)
- `core:fears` - Character fears (from spec)
- `core:goals` - Character goals array (4 goals from spec)
- `core:secrets` - Character secrets (from spec)
- `core:internal_tensions` - Internal conflicts (from spec)
- `core:motivations` - Core motivations (from spec)
- `core:dilemmas` - Central dilemmas (from spec)

#### 3. Behavioral Components (1 component)

- `core:speech_patterns` - Speech pattern array (15 patterns from spec)

#### 4. Physical Components (1 component)

- `anatomy:body` - Reference to recipe: `fantasy:threadscar_melissa_recipe`

#### 5. Memory Components (1 component)

- `core:notes` - 10 character notes (from spec)

**Total Components**: 20 components

### Critical Requirements

1. **Entity ID Format**: `fantasy:threadscar_melissa`
2. **Schema Reference**: `schema://living-narrative-engine/entity-definition.schema.json`
3. **Recipe Reference**: Must reference `fantasy:threadscar_melissa_recipe` (created in THRMELCHASPE-002)
4. **Text Accuracy**: All narrative text MUST match specification exactly (copy from spec)
5. **Component Schemas**: All components must use existing, valid schemas

### Portrait Path

```json
{
  "core:portrait": {
    "imagePath": "portraits/threadscar_melissa.png",
    "altText": "\"Threadscar\" Melissa - Battle-hardened mercenary veteran."
  }
}
```

**Note**: Portrait image will be created in THRMELCHASPE-005, but path reference is included here.

### Apparent Age

```json
{
  "core:apparent_age": {
    "minAge": 35,
    "maxAge": 50
  }
}
```

### Goals Array

```json
{
  "core:goals": {
    "goals": [
      {
        "text": "Maintain combat capability for another decade minimum. Keep training, keep sharp, refuse obsolescence. I'm not done yet."
      },
      {
        "text": "Find one more good contract. Something that uses my full skill set, pays well, has clear parameters. One last solid piece of work before... whatever comes after."
      },
      {
        "text": "Train someone competent. Pass on what I know to someone who'll actually use it, survive with it. Not legacy exactly. Just... practical knowledge shouldn't die with me."
      },
      {
        "text": "Figure out what I'll do when I can't fight anymore. Need a plan. I don't have one. That's a tactical weakness I should address."
      }
    ]
  }
}
```

### Speech Patterns Array

15 patterns total (see specification for complete list). Example format:

```json
{
  "core:speech_patterns": {
    "patterns": [
      "(Extremely direct statements without social lubrication) 'You're asking the wrong question. Real question is: can you afford me.'",
      "(Tactical observations delivered as casual fact) 'Three exits. Two windows. Guard's competent but tired. We could leave cleanly if needed.'"
      // ... 13 more patterns
    ]
  }
}
```

### Notes Array

10 notes with proper structure:

```json
{
  "core:notes": {
    "notes": [
      {
        "text": "I got the nickname 'Threadscar' from a specific fight fifteen years ago...",
        "subject": "The 'Threadscar' incident",
        "subjectType": "event"
      }
      // ... 9 more notes
    ]
  }
}
```

Valid `subjectType` values (from existing usage):

- `event`
- `habit`
- `observation`
- `item`
- `skill`
- `philosophy`
- `goal`

---

## Acceptance Criteria

### Schema Validation

- [ ] File validates against `entity-definition.schema.json`
- [ ] Entity ID is `fantasy:threadscar_melissa`
- [ ] Schema reference uses `schema://` URI format
- [ ] All component references are valid

### Component Completeness

- [ ] All 20 required components present
- [ ] No components missing from specification
- [ ] No unexpected additional components
- [ ] All component data structures match their schemas

### Text Content Validation

- [ ] `core:profile` text matches specification exactly
- [ ] `core:personality` text matches specification exactly
- [ ] All 11 narrative components have correct text from spec
- [ ] `core:speech_patterns` has all 15 patterns from spec
- [ ] `core:notes` has all 10 notes from spec
- [ ] All text uses first-person perspective (character voice)

### Goals Validation

- [ ] `core:goals` has 4 goal objects
- [ ] Each goal has `text` field
- [ ] Goal texts match specification

### Notes Validation

- [ ] `core:notes` has 10 note objects
- [ ] Each note has `text`, `subject`, and `subjectType` fields
- [ ] All `subjectType` values are valid
- [ ] Note content matches specification

### Speech Patterns Validation

- [ ] `core:speech_patterns` has 15 pattern strings
- [ ] Each pattern includes context descriptor in parentheses
- [ ] Pattern examples match character voice

### Anatomy Reference Validation

- [ ] `anatomy:body` component references `fantasy:threadscar_melissa_recipe`
- [ ] Recipe ID format is correct (not full path)
- [x] Recipe exists (verified at `data/mods/fantasy/recipes/threadscar_melissa.recipe.json`)
- [x] Required anatomy part exists (verified at `data/mods/anatomy/entities/definitions/human_female_torso_muscular_scarred.entity.json`)
- **Note**: Recipe uses `c_cup_firm` breasts (not `b_cup_firm` as in spec) - this is acceptable variation

### System Components Validation

- [ ] `core:actor` component present (empty object)
- [ ] `core:player_type` has `type: "human"`
- [ ] `core:perception_log` has `maxEntries: 50` and empty `logEntries` array
- [ ] `core:apparent_age` has `minAge: 35` and `maxAge: 50`

### Validation Commands

```bash
# Schema validation
npm run validate

# Strict validation
npm run validate:strict

# Type checking
npm run typecheck

# Verify recipe reference exists
grep -r "fantasy:threadscar_melissa_recipe" data/mods/fantasy/recipes/
```

### Expected Results

- [ ] `npm run validate` passes without errors
- [ ] No schema validation failures
- [ ] File is valid JSON (no syntax errors)
- [ ] Recipe reference resolves correctly

### Invariants That Must Remain True

- [ ] No recipe files are modified
- [ ] No anatomy parts are modified
- [ ] No schema files are changed
- [ ] Entity uses `fantasy:` namespace (not `anatomy:` or `core:`)
- [ ] All existing character files remain unchanged
- [ ] No component schemas are altered

---

## Testing

**Note**: Full integration testing in THRMELCHASPE-004

Manual verification for this ticket:

1. All 20 components present
2. Text content matches specification
3. Recipe reference is valid
4. JSON structure is correct
5. Component schemas validate

---

## Pre-Implementation Checklist

Before starting implementation:

- [ ] THRMELCHASPE-002 is complete (recipe exists)
- [ ] Review specification document for all text content
- [ ] Verify all component schemas exist
- [ ] Review existing character file (vespera_nightwhisper.character.json) for structure reference

---

## Definition of Done

- [x] Character definition file created
- [x] All 20 components present with correct structure
- [x] All narrative text matches specification exactly
- [x] `npm run validate` passes
- [x] Recipe reference is valid
- [x] Entity ID uses `fantasy:` namespace
- [x] File committed to version control
- [x] No other files modified

---

## Outcome

**Completed**: 2025-11-22

### What Was Actually Changed vs Originally Planned

**As Planned**:

- Created `data/mods/fantasy/entities/definitions/threadscar_melissa.character.json` with all 20 required components
- All narrative text copied from specification document (first-person voice maintained)
- Recipe reference (`fantasy:threadscar_melissa_recipe`) correctly implemented
- Entity ID uses `fantasy:` namespace as required
- All speech patterns (15), goals (4), and notes (10) included
- Validation passes without errors

**Discovered During Implementation**:

- THRMELCHASPE-002 was already completed - recipe and anatomy part already existed
- Recipe uses `c_cup_firm` breasts instead of `b_cup_firm` from spec (acceptable variation)
- No code changes were needed - only created the character definition file
- Total implementation time was ~30 minutes (much less than estimated 2-3 hours)

**Files Created**:

1. `data/mods/fantasy/entities/definitions/threadscar_melissa.character.json` (150 lines, 17KB)

**Files Modified**:

- None (as planned)

**Validation Results**:

- ✅ Schema validation passes
- ✅ All component references valid
- ✅ Recipe reference resolves correctly
- ✅ No typecheck errors introduced

**Character Components Summary**:

- Core Identity: 6 components (name, portrait, age, actor, player_type, perception_log)
- Narrative: 11 components (profile through dilemmas)
- Behavioral: 1 component (speech_patterns with 15 patterns)
- Physical: 1 component (anatomy:body referencing recipe)
- Memory: 1 component (notes with 10 entries)
- **Total**: 20 components as specified

**Quality Metrics**:

- Character voice consistency: 100% first-person perspective maintained
- Text accuracy: All narrative content matches specification
- Component completeness: All required components present
- Schema compliance: Full validation pass

---

## Implementation Tips

1. **Copy text from specification**: Don't retype narrative content, copy directly from spec to avoid errors
2. **Validate JSON frequently**: Use an editor with JSON validation or run `npm run validate` during implementation
3. **Component order**: While not strictly required, follow logical grouping (identity → narrative → behavioral → physical → memory)
4. **Portrait path**: Include even though image doesn't exist yet - it's just a reference
5. **First-person voice**: All narrative components use Melissa's first-person voice

---

## Implementation Notes

- Character definition complete and ready for integration testing (THRMELCHASPE-004)
- Portrait image placeholder path included, actual image creation in THRMELCHASPE-005
- Character maintains consistent first-person voice throughout all narrative components
- Melissa provides strong contrast to Vespera: pragmatic vs performative, disciplined vs chaotic
- All dependencies (recipe, anatomy part) were already in place
- No instance file created (optional, not required for character definition)
