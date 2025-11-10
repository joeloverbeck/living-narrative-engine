# WEASYSIMP-001: Setup Weapons Mod Directory Structure

**Phase:** Foundation
**Timeline:** 0.5 days
**Status:** Not Started
**Dependencies:** None
**Priority:** P0 (Blocking)

## Overview

Create the complete directory structure for the weapons mod following Living Narrative Engine's mod conventions. This includes all necessary subdirectories for components, actions, rules, scopes, events, conditions, and entities.

## Objectives

1. Create base `data/mods/weapons/` directory
2. Create all required subdirectories following mod structure conventions
3. Verify directory permissions and structure
4. Prepare for subsequent content creation

## Technical Details

### 1. Directory Structure to Create

Create the following directory structure:

```
data/mods/weapons/
├── components/              # Component definitions
├── actions/                # Action definitions
├── rules/                  # Rule definitions
├── scopes/                 # Scope DSL files
├── events/                 # Event definitions
├── conditions/             # Condition definitions
├── entities/               # Entity files (subdirectories below)
│   ├── definitions/        # Entity definition files (.entity.json)
│   └── instances/          # Entity instance files (.entity.json)
├── README.md               # Mod documentation (optional but recommended)
└── mod-manifest.json       # Mod manifest (created in WEASYSIMP-002)
```

**Note:** Optional directories (not created by default, add only if needed):
- `macros/` - Reusable action sequences (used by core and companionship mods)
- `lookups/` - Lookup tables (rarely used)
- `goals/` - Goal definitions (not currently used by any mod)

### 2. Directory Creation Script

Execute the following commands:

```bash
# Create base mod directory
mkdir -p data/mods/weapons

# Create standard subdirectories
mkdir -p data/mods/weapons/components
mkdir -p data/mods/weapons/actions
mkdir -p data/mods/weapons/rules
mkdir -p data/mods/weapons/scopes
mkdir -p data/mods/weapons/events
mkdir -p data/mods/weapons/conditions

# Create entities subdirectories (required structure for mod loader)
mkdir -p data/mods/weapons/entities/definitions
mkdir -p data/mods/weapons/entities/instances

# Verify structure
ls -la data/mods/weapons/
ls -la data/mods/weapons/entities/
```

### 3. Verification

After creation, verify:
- All directories exist
- Directories are readable/writable
- Structure matches Living Narrative Engine mod conventions
- Compare with existing mods (items, core, positioning) for consistency

## Acceptance Criteria

- [ ] `data/mods/weapons/` directory exists
- [ ] All 7 standard subdirectories exist (components, actions, rules, scopes, events, conditions, entities/)
- [ ] `entities/` has proper subdirectories (`definitions/` and `instances/`)
- [ ] Directory structure matches existing mod patterns (especially items mod structure)
- [ ] Permissions allow file creation in all directories
- [ ] Structure validated against mod loader expectations (see `src/loaders/loaderMeta.js`)

## Testing Requirements

```bash
# Verification script
test -d data/mods/weapons && echo "✓ Base directory exists" || echo "✗ Base directory missing"
test -d data/mods/weapons/components && echo "✓ Components directory exists" || echo "✗ Components missing"
test -d data/mods/weapons/actions && echo "✓ Actions directory exists" || echo "✗ Actions missing"
test -d data/mods/weapons/rules && echo "✓ Rules directory exists" || echo "✗ Rules missing"
test -d data/mods/weapons/scopes && echo "✓ Scopes directory exists" || echo "✗ Scopes missing"
test -d data/mods/weapons/events && echo "✓ Events directory exists" || echo "✗ Events missing"
test -d data/mods/weapons/conditions && echo "✓ Conditions directory exists" || echo "✗ Conditions missing"
test -d data/mods/weapons/entities && echo "✓ Entities directory exists" || echo "✗ Entities missing"
test -d data/mods/weapons/entities/definitions && echo "✓ Entities/definitions exists" || echo "✗ Entities/definitions missing"
test -d data/mods/weapons/entities/instances && echo "✓ Entities/instances exists" || echo "✗ Entities/instances missing"

# Compare with items mod structure (reference)
echo ""
echo "Reference: Items mod structure"
ls -la data/mods/items/
```

## Additional Notes

- This is a foundational ticket that blocks all subsequent weapons mod tickets
- No code files are created in this ticket (only directories)
- Mod manifest creation is handled in WEASYSIMP-002
- Follow the exact same structure as existing mods for consistency
- The weapons mod will depend on both `core` and `items` mods

### Directory Structure Details

**Entities Subdirectories:**
- `entities/definitions/` - Entity definition templates (e.g., `revolver.entity.json`)
- `entities/instances/` - Specific entity instances (e.g., `rusty_revolver_001.entity.json`)
- The mod loader (`src/loaders/loaderMeta.js`) expects this exact subdirectory structure

**Optional Directories (Not Included):**
- `macros/` - Only needed if the mod defines reusable action sequences (like core mod's `displaySuccessAndEndTurn.macro.json`)
- `lookups/` - Only needed for lookup tables (rarely used)
- `goals/` - Not currently used by any mod in the codebase

**Documentation (Recommended):**
- Consider adding a `README.md` file (see `data/mods/items/README.md` as a template)
- This helps developers understand the mod's purpose and structure

## Related Tickets

- **Blocks:** WEASYSIMP-002 (Mod Manifest), WEASYSIMP-008 through WEASYSIMP-019 (All mod content)
- **Reference:** Check `data/mods/items/` and `data/mods/positioning/` for structure examples
