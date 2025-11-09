# ANASYSIMP-010: Interactive Recipe Wizard

**Phase:** 3 (Architectural Enhancements)
**Priority:** P2
**Effort:** High (5-6 days)
**Impact:** Medium - Prevents common mistakes
**Status:** Not Started

## Context

Manual recipe creation is error-prone. An interactive wizard can guide creators through the process with real-time validation.

## Solution Overview

Create interactive CLI wizard using `inquirer` that:
- Guides through recipe creation step-by-step
- Validates inputs in real-time
- Suggests values from registry
- Auto-completes component/entity IDs
- Generates validated recipe file

## Implementation

```bash
npm run create:recipe

? Recipe ID: red_dragon
? Select blueprint: (Use arrow keys)
  ❯ anatomy:winged_quadruped
    anatomy:biped
    anatomy:quadruped

? Blueprint: anatomy:winged_quadruped selected

Required slots from blueprint:
  ✓ head
  ✓ neck
  ✓ torso
  ...

? Configure slot 'head':
  ? Part type: dragon_head
  ? Required components: (Select with space)
    ◉ anatomy:part
    ◉ anatomy:horned
    ◯ anatomy:scaled

✓ Recipe validation passed!
✓ Saved to: data/mods/anatomy/recipes/red_dragon.recipe.json
```

## Key Features

1. **Blueprint Selection** - List from registry
2. **Slot Configuration** - Guided setup
3. **Component Selection** - Multi-select from registry
4. **Property Configuration** - Enum selection with validation
5. **Pattern Creation** - Optional pattern definition
6. **Real-time Validation** - Validate as you build
7. **File Generation** - Create validated recipe

## File Structure

```
scripts/
└── create-recipe-wizard.js       # Interactive wizard

package.json                       # Add npm script
```

## Acceptance Criteria

- [ ] Wizard guides through all recipe steps
- [ ] Real-time validation feedback
- [ ] Blueprint selection from registry
- [ ] Component auto-completion
- [ ] Property enum selection
- [ ] Generated recipe passes validation
- [ ] Saved to correct location
- [ ] User-friendly error messages

## Dependencies

**Depends On:**
- ANASYSIMP-003 (Pre-flight Validator for real-time validation)
- inquirer (npm package)

## References

- **Report Section:** Recommendation 2.5
- **Report Pages:** Lines 838-896
