# ARMSYSANA-007: Update Documentation

**Phase**: Phase 3 - Documentation and Examples
**Priority**: High
**Risk Level**: None (Documentation only)
**Estimated Effort**: 60 minutes

## Context

With armor support fully implemented in the system (Phase 1 and Phase 2 complete), the documentation needs to be updated to reflect the new armor layer. This ensures developers and mod creators understand how to use armor in their content.

## Objective

Update all relevant documentation files to include information about the armor layer, its priority, and how to use it in mod development.

## Documentation Files to Update

### 1. Clothing Items Guide (Modding)

**File**: `docs/modding/clothing-items.md`

**Current State** (line 48-58): Lists equipment slots

**Updates Required**:

#### Section to Add: "Armor Layer"

Add a new section after the existing layer documentation:

```markdown
### Armor Layer

The armor layer is a special clothing layer for protective equipment. Armor has priority between outer garments and base clothing.

**Layer Priority Order**:
1. `outer` (100) - Cloaks, robes, long coats (highest visibility)
2. `armor` (150) - Cuirasses, chainmail, plate armor
3. `base` (200) - Regular clothing
4. `underwear` (300) - Undergarments
5. `accessories` (350) - Jewelry, belts, gloves

**When to Use Armor Layer**:
- Protective equipment (cuirasses, chainmail, plate armor)
- Combat gear (leather armor, bracers, greaves)
- Defensive items worn for protection rather than fashion

**Armor vs. Outer Layer**:
- Use `armor` for protective equipment
- Use `outer` for non-protective outerwear (cloaks, robes)
- Armor can be worn under or over other layers depending on coverage priority

**Example**:
\`\`\`json
{
  "clothing:wearable": {
    "layer": "armor",
    "equipmentSlots": {
      "primary": "torso_upper"
    }
  }
}
\`\`\`
```

#### Update Layer Enum Documentation

Find the section that lists valid layer values and add "armor":

```markdown
**Valid Layer Values**:
- `underwear` - Undergarments
- `base` - Regular clothing
- `outer` - Outerwear
- `accessories` - Accessories
- `armor` - Protective equipment (NEW)
```

### 2. Clothing Coverage System (Developer Guide)

**File**: `docs/developers/clothing-coverage-system.md`

**Current State** (line 26-42): Documents coverage priority scoring

**Updates Required**:

#### Update Coverage Priority Table

Replace the existing priority table with:

```markdown
### Coverage Priority Scoring

| Priority | Value | Description | Example Items |
|----------|-------|-------------|---------------|
| outer | 100 | Highest visibility | Cloaks, robes, long coats |
| armor | 150 | Protective equipment | Cuirasses, chainmail, plate armor |
| base | 200 | Regular clothing | Shirts, pants, boots |
| underwear | 300 | Undergarments | Intimate clothing |
| accessories | 350 | Accessories | Jewelry, belts, gloves |
| direct | 400 | Fallback | Uncovered body parts |

**Lower numbers = higher visibility priority**
```

#### Add Armor-Specific Section

Add a new section about armor coverage:

```markdown
### Armor Coverage Priority

Armor uses a dedicated priority tier (150) between outer and base layers. This allows:

1. **Armor under outer garments**: Chainmail under a cloak (cloak visible)
2. **Armor over base clothing**: Plate armor over a shirt (armor visible)
3. **Armor as outer layer**: Full plate with no cloak (armor visible)

**Example Scenarios**:

**Scenario 1**: Warrior with cloak over armor
```
Character wearing: shirt (base) → chainmail (armor) → cloak (outer)
Visible: Cloak (priority 100)
Hidden: Chainmail, shirt
```

**Scenario 2**: Warrior without cloak
```
Character wearing: shirt (base) → chainmail (armor)
Visible: Chainmail (priority 150)
Hidden: Shirt
```

**Scenario 3**: Civilian with coat
```
Character wearing: shirt (base) → leather jacket (outer)
Visible: Leather jacket (priority 100)
Hidden: Shirt
```
```

### 3. Anatomy System Guide

**File**: `docs/anatomy/anatomy-system-guide.md`

**Updates Required**:

#### Add Note About Armor Support

Find the section about clothing layers and add:

```markdown
### Armor Support

The anatomy system natively supports armor as a distinct clothing layer. Armor is defined in:
- Slot metadata component (`clothing:slot_metadata`)
- Humanoid slot library (`anatomy/libraries/humanoid.slot-library.json`)
- All anatomy blueprints (human, cat_girl, centaur, etc.)

**Allowed Layers by Slot**:
- `standard_torso_upper`: `["underwear", "base", "outer", "armor"]`
- `standard_legs`: `["underwear", "base", "outer", "armor"]`
- `standard_hands`: `["base", "armor"]`
- `standard_feet`: `["base", "armor"]`

Most clothing slots support armor by default.
```

### 4. CLAUDE.md (Project Instructions)

**File**: `CLAUDE.md`

**Updates Required**:

#### Update Clothing Layer Architecture Section

Find the "Clothing Layer Architecture" section and update it:

```markdown
### Clothing Layer Architecture

The clothing system uses a five-layer model:

\`\`\`
Layer Hierarchy (innermost to outermost):
1. underwear  - Undergarments, intimate clothing
2. base       - Regular clothing (shirts, pants, boots)
3. armor      - Protective equipment (cuirasses, chainmail, plate armor)
4. outer      - Outerwear (coats, jackets, cloaks, robes)
5. accessories - Accessories (jewelry, belts, gloves)
\`\`\`

**Coverage Priority Scoring**:
- `outer`: 100 (highest visibility)
- `armor`: 150 (NEW - protective equipment)
- `base`: 200
- `underwear`: 300
- `accessories`: 350
- `direct`: 400 (fallback)

**Armor Layer**: Added to support protective equipment in sword & sorcery scenarios. Armor has priority between outer garments and base clothing, allowing realistic layering (e.g., chainmail under a cloak, or visible plate armor).
```

### 5. Clothing Coverage Mapping Guide

**File**: `docs/anatomy/clothing-coverage-mapping.md`

**Updates Required**:

#### Add Armor Coverage Examples

Add examples showing armor coverage:

```markdown
### Armor Coverage Examples

**Example 1: Steel Cuirass**

\`\`\`json
{
  "clothing:wearable": {
    "layer": "armor",
    "equipmentSlots": {
      "primary": "torso_upper"
    }
  },
  "clothing:coverage_mapping": {
    "covers": ["torso_upper"],
    "coveragePriority": "armor"
  }
}
\`\`\`

**Example 2: Chainmail Hauberk (Multi-slot)**

\`\`\`json
{
  "clothing:wearable": {
    "layer": "armor",
    "equipmentSlots": {
      "primary": "torso_upper",
      "secondary": ["left_arm_clothing", "right_arm_clothing"]
    }
  },
  "clothing:coverage_mapping": {
    "covers": ["torso_upper", "torso_lower", "left_arm_clothing", "right_arm_clothing"],
    "coveragePriority": "armor"
  }
}
\`\`\`

**Example 3: Leather Leg Armor**

\`\`\`json
{
  "clothing:wearable": {
    "layer": "armor",
    "equipmentSlots": {
      "primary": "legs"
    }
  },
  "clothing:coverage_mapping": {
    "covers": ["legs"],
    "coveragePriority": "armor"
  }
}
\`\`\`
```

## Validation Steps

After updating documentation:

1. **Check Markdown Syntax**
   ```bash
   # Install markdownlint if not installed
   npm install -g markdownlint-cli

   # Lint documentation files
   markdownlint docs/modding/clothing-items.md
   markdownlint docs/developers/clothing-coverage-system.md
   markdownlint docs/anatomy/anatomy-system-guide.md
   markdownlint docs/anatomy/clothing-coverage-mapping.md
   markdownlint CLAUDE.md
   ```

2. **Verify Links**
   - Check all internal links work
   - Verify code example formatting
   - Ensure tables render correctly

3. **Review for Consistency**
   - Priority values match implementation
   - Examples are accurate
   - Terminology is consistent

4. **Build Documentation (if applicable)**
   ```bash
   # If using documentation build system
   npm run build:docs
   ```

## Documentation Style Guidelines

Follow these guidelines when writing documentation:

### 1. Code Examples

- Use proper JSON formatting
- Include comments where helpful
- Show complete, working examples
- Provide context for each example

### 2. Priority Values

- Always use exact values from implementation
- `outer`: 100, `armor`: 150, `base`: 200, etc.
- Include "lower = higher priority" note

### 3. Terminology

- Use "armor" not "armour" (US spelling)
- Use "layer" consistently
- Use "coverage priority" for priority system
- Use "equipment slot" for slot references

### 4. Examples

- Provide realistic examples (cuirass, chainmail)
- Show edge cases and common scenarios
- Include both simple and complex examples

## Success Criteria

- [ ] `docs/modding/clothing-items.md` updated with armor layer section
- [ ] `docs/developers/clothing-coverage-system.md` updated with armor priority
- [ ] `docs/anatomy/anatomy-system-guide.md` includes armor support note
- [ ] `docs/anatomy/clothing-coverage-mapping.md` has armor examples
- [ ] `CLAUDE.md` updated with five-layer architecture
- [ ] All markdown files pass linting
- [ ] All code examples are syntactically correct
- [ ] All priority values match implementation
- [ ] Documentation is internally consistent

## Additional Documentation (Optional)

Consider creating these additional documentation files:

### 1. Armor Modding Guide

**File**: `docs/modding/armor-items.md`

**Content**:
- Comprehensive guide to creating armor entities
- Common armor types (light, medium, heavy)
- Armor material considerations
- Armor coverage patterns
- Example armor entities

### 2. Layer System Deep Dive

**File**: `docs/developers/clothing-layer-system.md`

**Content**:
- Technical details of layer system
- Priority resolution algorithm
- Conflict resolution logic
- Performance considerations
- Debugging layer issues

## Related Tickets

- **Previous**: ARMSYSANA-006 (Run Comprehensive Tests)
- **Next**: ARMSYSANA-008 (Create Armor Examples)
- **Depends On**: ARMSYSANA-001 through ARMSYSANA-006

## Notes

Documentation is critical for:
- **Mod Developers**: Need to know how to create armor entities
- **System Developers**: Need to understand priority system
- **Future Maintainers**: Need to understand design decisions

Take time to write clear, accurate documentation. Good documentation prevents future confusion and bugs.

All priority values and examples should match the actual implementation exactly. If implementation changes, documentation must be updated.

## Reference

Files confirmed to exist:
- `docs/modding/clothing-items.md`
- `docs/developers/clothing-coverage-system.md`
- `docs/anatomy/anatomy-system-guide.md`
- `docs/anatomy/clothing-coverage-mapping.md`
- `CLAUDE.md`

These files are referenced in the original report and confirmed to exist in the codebase.
