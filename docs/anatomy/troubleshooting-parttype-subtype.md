# Troubleshooting: partType and subType Mismatches

## Problem Overview

If you encounter errors like:
```
No entity definitions found matching anatomy requirements.
Need part type: 'spider_leg'.
Allowed types: [leg]
```

This indicates a **partType/subType mismatch** between recipe requirements and entity definitions.

## Understanding the Three-Layer Type System

The anatomy system uses a three-layer type hierarchy for validation:

### Layer 1: Socket Layer (`allowedTypes`)
Defines what **CAN** physically attach to a socket (most permissive).

**Example:**
```json
{
  "id": "leg_socket_1",
  "allowedTypes": ["leg", "spider_leg", "dragon_leg"]
}
```

### Layer 2: Selection Layer (`partType`)
Defines what **SHOULD** be selected for a slot (from recipe).

**Example:**
```json
{
  "partType": "spider_leg",
  "components": ["anatomy:part"]
}
```

### Layer 3: Entity Layer (`subType`)
Defines what an entity **IS** (runtime classification).

**Example:**
```json
{
  "id": "anatomy:spider_leg",
  "components": {
    "anatomy:part": {
      "subType": "spider_leg"
    }
  }
}
```

## The Critical Rule

**`partType` must EQUAL `subType`** for entity selection to work.

**Relationship:** `allowedTypes ⊇ partType = subType`

- `allowedTypes` can contain multiple values (e.g., `["leg", "spider_leg"]`)
- `partType` must be a single specific value (e.g., `"spider_leg"`)
- Entity's `subType` must match `partType` exactly (e.g., `"spider_leg"`)

## Why Two Separate Concepts?

While `partType` and `subType` must have identical **values**, they serve different **architectural roles**:

### `partType` (Specification Layer)
- **Purpose**: "What to select"
- **Context**: Recipe requirements
- **Audience**: Part selection system
- **Meaning**: "I want a spider leg specifically"

### `subType` (Classification Layer)
- **Purpose**: "What it is"
- **Context**: Entity definition
- **Audience**: Runtime type system
- **Meaning**: "This entity is a spider leg"

This separation allows:
1. Recipes to specify requirements independently of entity implementation
2. Entity types to be classified independently of usage context
3. Future extensibility (e.g., multiple recipes using same entity type)

## Validation Flow

```javascript
// PartSelectionService validation (src/anatomy/partSelectionService.js:271-305)

// Step 1: Check if subType is allowed by socket
if (!allowedTypes.includes(entity.subType)) {
  return null; // Entity rejected
}

// Step 2: Check if subType matches recipe partType
if (requirements.partType && entity.subType !== requirements.partType) {
  return null; // Entity rejected
}

// Both checks passed - entity selected
return entity;
```

## Common Mistakes

### ❌ Mistake 1: Generic Entity, Specific Recipe
```json
// Recipe (WRONG)
{
  "partType": "spider_leg"  // Specific
}

// Entity (WRONG)
{
  "subType": "leg"  // Generic - MISMATCH!
}
```

### ❌ Mistake 2: Specific Entity, Generic Recipe
```json
// Recipe (WRONG)
{
  "partType": "leg"  // Generic
}

// Entity (WRONG)
{
  "subType": "spider_leg"  // Specific - MISMATCH!
}
```

### ✅ Solution 1: Both Generic (Kraken Pattern)
```json
// Recipe (CORRECT)
{
  "partType": "tentacle"  // Generic
}

// Entity (CORRECT)
{
  "subType": "tentacle"  // Generic - MATCH!
}
```

### ✅ Solution 2: Both Specific (Spider Pattern)
```json
// Recipe (CORRECT)
{
  "partType": "spider_leg"  // Specific
}

// Entity (CORRECT)
{
  "subType": "spider_leg"  // Specific - MATCH!
}
```

## Design Philosophy

**Either approach is valid** (generic or specific types), but you must be **consistent** between recipe and entity.

### When to Use Generic Types
- Reusable across multiple creatures
- Simple anatomy with few variations
- Example: Kraken uses `"tentacle"`, `"head"`, `"mantle"`

### When to Use Specific Types
- Creature-specific anatomy parts
- Distinct variations requiring different behaviors
- Example: Spider uses `"spider_leg"`, `"spider_pedipalp"`, `"spider_abdomen"`

## Diagnostic Steps

If you encounter a `partType`/`subType` mismatch:

1. **Find the recipe** that defines the requirements:
   ```bash
   grep -r "partType.*spider_leg" data/mods/anatomy/recipes/
   ```

2. **Find the entity** definition:
   ```bash
   ls data/mods/anatomy/entities/definitions/spider_leg.entity.json
   ```

3. **Compare values**:
   - Recipe `partType`: `"spider_leg"`
   - Entity `subType`: `"leg"` ← **MISMATCH!**

4. **Fix the mismatch** by updating entity `subType` to match recipe `partType`:
   ```json
   {
     "id": "anatomy:spider_leg",
     "components": {
       "anatomy:part": {
         "subType": "spider_leg"  // Changed from "leg"
       }
     }
   }
   ```

5. **Update structure templates** if using V2 blueprints:
   ```json
   {
     "socketPattern": {
       "allowedTypes": ["spider_leg"]  // Changed from ["leg"]
     }
   }
   ```

## Testing Pattern

Create unit tests to reproduce and verify fixes:

```javascript
describe('PartSelectionService - partType/subType Matching', () => {
  it('should reject entity when subType does not match partType', async () => {
    const entityDef = {
      id: 'anatomy:spider_leg',
      components: {
        'anatomy:part': {
          subType: 'leg', // Generic (WRONG)
        },
      },
    };

    const requirements = {
      partType: 'spider_leg', // Specific (expected)
      components: ['anatomy:part'],
    };

    const allowedTypes = ['leg']; // Socket allows generic

    const result = await service.selectPart(requirements, allowedTypes);

    expect(result).toBeNull(); // Should fail validation
  });

  it('should accept entity when subType matches partType', async () => {
    const entityDef = {
      id: 'anatomy:spider_leg',
      components: {
        'anatomy:part': {
          subType: 'spider_leg', // Specific (CORRECT)
        },
      },
    };

    const requirements = {
      partType: 'spider_leg', // Specific (matches)
      components: ['anatomy:part'],
    };

    const allowedTypes = ['spider_leg']; // Socket allows specific

    const result = await service.selectPart(requirements, allowedTypes);

    expect(result).toBe('anatomy:spider_leg'); // Should pass validation
  });
});
```

## References

- **Architecture Documentation**: `docs/anatomy/architecture.md`
- **Part Selection Service**: `src/anatomy/partSelectionService.js:271-305`
- **Test Examples**: `tests/unit/anatomy/partSelectionService.partTypeMatching.test.js`
- **Fixed Examples**:
  - Spider anatomy: `data/mods/anatomy/entities/definitions/spider_*.entity.json`
  - Dragon anatomy: `data/mods/anatomy/entities/definitions/dragon_head.entity.json`
- **Correct Examples**:
  - Kraken anatomy: `data/mods/anatomy/entities/definitions/kraken_*.entity.json`

## Quick Reference

| Component | Role | Example Value |
|-----------|------|---------------|
| `allowedTypes` (socket) | What CAN attach | `["leg", "spider_leg"]` |
| `partType` (recipe) | What SHOULD be selected | `"spider_leg"` |
| `subType` (entity) | What it IS | `"spider_leg"` |

**Remember:** `allowedTypes ⊇ partType = subType`
