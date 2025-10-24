# Vampirism Mod and Neck-Biting Components Specification

## Overview

This specification details the creation of a new **vampirism mod** for the Living Narrative Engine and the addition of two state-based components to the **positioning mod** that enable neck-biting interactions. The vampirism mod will provide an empty structural foundation for vampire-themed content, while the neck-biting components establish bilateral state management following the patterns used by hugging and hand-holding interactions.

## Goals

1. **Create vampirism mod structure** - Establish a complete mod directory scaffold following Living Narrative Engine conventions, ready for future vampire-themed content
2. **Add neck-biting components to positioning mod** - Create `being_bitten_in_neck` and `biting_neck` components that other mods can reference for vampire actions
3. **Enable cross-mod compatibility** - Place anatomical state components in the positioning mod so they're available as a common dependency
4. **Follow established patterns** - Mirror the bilateral state management approach from hugging and hand-holding mods

## Background

### Why positioning mod for neck-biting components?

The positioning mod serves as a common dependency for anatomical poses and physical state management. By placing `being_bitten_in_neck` and `biting_neck` components here rather than in the vampirism mod:

- Other mods (e.g., `intimacy`, `violence`, `physical-control`) can reference these states without depending on vampirism
- The components become part of the shared anatomical vocabulary alongside `hugging`, `being_hugged`, `giving_blowjob`, etc.
- Future vampire-related mods can depend on positioning to access these states【positioning manifest shows hugging, being_hugged, giving_blowjob already in positioning†data/mods/positioning/mod-manifest.json†L24-L34】

### Pattern references

This implementation follows the bilateral state pattern established by:
- **Hugging components** - `positioning:hugging` and `positioning:being_hugged` with entity ID references【data/mods/positioning/components/hugging.component.json†L1-L26】【data/mods/positioning/components/being_hugged.component.json†L1-L22】
- **Hand-holding components** - Similar pattern with initiator tracking and consent flags【Referenced in hug-tight spec†specs/hug-tight-state-based-action.spec.md†L12】

## Vampirism Mod Structure

### Directory Layout

```
data/mods/vampirism/
├── mod-manifest.json          # Mod metadata and content registry
├── actions/                   # Empty - future vampire actions
├── rules/                     # Empty - future rule handlers
├── conditions/                # Empty - future condition definitions
├── events/                    # Empty - future event definitions
├── components/                # Empty - future vampire-specific components
├── scopes/                    # Empty - future scope definitions
└── entities/                  # Empty - future entity definitions/instances
    ├── definitions/
    └── instances/
```

### Mod Manifest

**File:** `data/mods/vampirism/mod-manifest.json`

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "vampirism",
  "version": "1.0.0",
  "name": "Vampirism",
  "description": "Vampire-themed content including blood mechanics, vampire abilities, and supernatural interactions.",
  "author": "Living Narrative Engine",
  "gameVersion": ">=0.0.1",
  "dependencies": [
    {
      "id": "core",
      "version": "^1.0.0"
    },
    {
      "id": "positioning",
      "version": "^1.0.0"
    },
    {
      "id": "anatomy",
      "version": "^1.0.0"
    },
    {
      "id": "clothing",
      "version": "^1.0.0"
    }
  ],
  "content": {
    "actions": [],
    "components": [],
    "conditions": [],
    "rules": [],
    "entities": {
      "definitions": [],
      "instances": []
    },
    "events": [],
    "macros": [],
    "scopes": []
  }
}
```

### Dependency Rationale

- **core** - Required base dependency for all mods
- **positioning** - Access to neck-biting components and closeness mechanics
- **anatomy** - Access to body part definitions (neck, blood vessels, etc.)
- **clothing** - For clothing coverage rules (exposed neck vs. covered)

### Future Content Guidance

When populating the vampirism mod, consider:

**Actions:**
- `bite_neck.action.json` - Initiate neck biting (uses positioning:biting_neck component)
- `stop_biting_neck.action.json` - End neck bite (removes neck-biting components)
- `drink_blood.action.json` - Drain blood while biting
- `bare_fangs.action.json` - Intimidation or display action

**Components (vampirism-specific):**
- `vampire.component.json` - Marks entity as vampire with blood hunger level
- `blood_level.component.json` - Tracks entity's remaining blood
- `vampiric_charm.component.json` - Supernatural influence effects

**Scopes:**
- `vulnerable_victims.scope` - Entities with accessible necks
- `vampires_in_location.scope` - Detect vampires nearby

**Rules:**
- Handle neck-biting actions with state management
- Blood drain mechanics
- Vampire transformation events

## Neck-Biting Components (Positioning Mod)

### Component 1: being_bitten_in_neck

**File:** `data/mods/positioning/components/being_bitten_in_neck.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "positioning:being_bitten_in_neck",
  "description": "Marks an entity whose neck is currently being bitten by another actor, preventing conflicting neck-based actions and anatomically implausible interactions.",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["biting_entity_id"],
    "properties": {
      "biting_entity_id": {
        "type": "string",
        "description": "The ID of the entity currently biting this entity's neck",
        "pattern": "^([a-zA-Z0-9_]+:[a-zA-Z0-9_-]+|[a-zA-Z0-9_]+)$"
      },
      "consented": {
        "type": "boolean",
        "description": "Whether this entity consents to the neck bite interaction",
        "default": true
      }
    }
  }
}
```

**Design Notes:**
- `biting_entity_id` follows the standard entity ID pattern (namespace:id or plain id)
- `consented` defaults to true but can be set to false for non-consensual biting scenarios
- Description emphasizes anatomical exclusivity - being bitten prevents other neck actions

### Component 2: biting_neck

**File:** `data/mods/positioning/components/biting_neck.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "positioning:biting_neck",
  "description": "Marks an entity actively biting another entity's neck, occupying the mouth and preventing conflicting mouth-based or proximity actions.",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["bitten_entity_id", "initiated"],
    "properties": {
      "bitten_entity_id": {
        "type": "string",
        "description": "The ID of the entity whose neck is being bitten",
        "pattern": "^([a-zA-Z0-9_]+:[a-zA-Z0-9_-]+|[a-zA-Z0-9_]+)$"
      },
      "initiated": {
        "type": "boolean",
        "description": "Whether this entity initiated the neck bite interaction"
      },
      "consented": {
        "type": "boolean",
        "description": "Whether the bitten entity has consented to remain in the bite",
        "default": true
      }
    }
  }
}
```

**Design Notes:**
- `bitten_entity_id` references the victim using standard entity ID format
- `initiated` tracks who started the bite (important for consent and state cleanup)
- `consented` tracks the victim's consent status from the biter's perspective
- Description emphasizes mouth engagement - biting prevents kissing, speaking, eating, etc.

### Bilateral State Pattern

The two components work together to create a symmetric state relationship:

```
Actor A (biter)                    Target B (victim)
├─ positioning:biting_neck    ←→   ├─ positioning:being_bitten_in_neck
│  ├─ bitten_entity_id: "B"        │  ├─ biting_entity_id: "A"
│  ├─ initiated: true               │  └─ consented: true
│  └─ consented: true               │
```

This mirrors the patterns in:
- Hugging: `hugging.embraced_entity_id` ↔ `being_hugged.hugging_entity_id`
- Hand-holding: Similar paired ID references

### Positioning Mod Manifest Integration

**File:** `data/mods/positioning/mod-manifest.json`

Add the new components to the `content.components` array:

```json
{
  "content": {
    "components": [
      "allows_bending_over.component.json",
      "allows_lying_on.component.json",
      "allows_sitting.component.json",
      "being_bitten_in_neck.component.json",    // NEW
      "being_hugged.component.json",
      "bending_over.component.json",
      "biting_neck.component.json",              // NEW
      "closeness.component.json",
      "facing_away.component.json",
      "giving_blowjob.component.json",
      "hugging.component.json",
      "kneeling_before.component.json",
      "lying_down.component.json",
      "receiving_blowjob.component.json",
      "sitting_on.component.json",
      "straddling_waist.component.json"
    ],
    // ... rest of manifest unchanged
  }
}
```

**Alphabetical ordering:** Insert components alphabetically to maintain manifest organization.

## Implementation Guidelines

### For Future Vampire Actions

When creating actions in the vampirism mod that use neck-biting:

**Action gating (bite_neck.action.json example):**
```json
{
  "forbidden_components": {
    "actor": [
      "positioning:biting_neck",
      "positioning:being_bitten_in_neck",
      "core:mouth_engagement"
    ],
    "primary": [
      "positioning:being_bitten_in_neck"
    ]
  }
}
```

**Rule state management (handle_bite_neck.rule.json pattern):**
1. Query existing `positioning:biting_neck` and `positioning:being_bitten_in_neck` on both actor and target
2. Clean up cross-linked components from previous interactions (like hugging rule does)
3. Remove stale neck-biting components from actor and target
4. Add new components:
   - Actor: `positioning:biting_neck` with `bitten_entity_id`, `initiated: true`
   - Target: `positioning:being_bitten_in_neck` with `biting_entity_id`, `consented: true`

Reference the hugging rule for the complete cleanup pattern:【data/mods/hugging/rules/handle_hug_tight.rule.json†L56-L165】

### Anatomical Exclusivity

Components that should forbid neck-biting:
- `positioning:being_hugged` - Can't bite someone's neck while hugging them (face buried in shoulder)
- `positioning:giving_blowjob` - Mouth is already occupied
- `positioning:receiving_blowjob` - Neck area blocked by kneeling partner
- `core:mouth_engagement` - General mouth occupation flag

Neck-biting should forbid:
- Other neck bites (can't bite two people at once)
- Kissing actions (mouth occupied)
- Speaking actions (mouth occupied)
- Eating/drinking actions (mouth occupied)

## Testing Strategy

### Integration Tests for Neck-Biting Components

When implementing vampire actions, create tests following these patterns:

**File:** `tests/integration/mods/vampirism/bite_neck_action.test.js`

```javascript
describe('Bite Neck Action - State Management', () => {
  it('should assign positioning:biting_neck to actor after successful bite', () => {
    // Arrange: Create actor and victim with positioning:closeness
    // Act: Execute bite_neck action
    // Assert: Actor has biting_neck component with victim's ID
  });

  it('should assign positioning:being_bitten_in_neck to victim', () => {
    // Assert: Victim has being_bitten_in_neck with actor's ID
  });

  it('should prevent repeated bite attempts when already biting', () => {
    // Arrange: Actor already has positioning:biting_neck
    // Act: Attempt another bite_neck action
    // Assert: Forbidden component validation error
  });

  it('should prevent biting a victim already being bitten', () => {
    // Arrange: Victim has positioning:being_bitten_in_neck from another entity
    // Act: Actor attempts bite_neck
    // Assert: Target forbidden component error
  });

  it('should clean up stale bite components before applying new ones', () => {
    // Arrange: Seed actor with stale biting_neck pointing to entity X
    // Act: Actor bites entity Y
    // Assert: Entity X no longer has being_bitten_in_neck
    // Assert: Entity Y has correct being_bitten_in_neck
  });
});
```

**Reference test suites:**
- Hugging tests: `tests/integration/mods/hugging/hug_tight_action.test.js`【specs/hug-tight-state-based-action.spec.md†L47-L56】
- Hand-holding tests: More comprehensive state management examples

### Component Schema Validation

Create unit tests for the component schemas:

```javascript
describe('Neck-Biting Component Schemas', () => {
  it('should validate being_bitten_in_neck with required biting_entity_id', () => {
    // Test schema validation with AJV
  });

  it('should reject being_bitten_in_neck without biting_entity_id', () => {
    // Assert schema validation failure
  });

  it('should validate biting_neck with required fields', () => {
    // Test bitten_entity_id and initiated are required
  });
});
```

## Acceptance Criteria

### Vampirism Mod Structure
- [ ] Directory structure created: `data/mods/vampirism/` with all subdirectories
- [ ] `mod-manifest.json` created with proper schema, ID, dependencies
- [ ] All content arrays in manifest are empty but present
- [ ] Mod follows naming conventions (lowercase ID, properly formatted name)

### Neck-Biting Components
- [ ] `being_bitten_in_neck.component.json` created in `data/mods/positioning/components/`
- [ ] Component has correct schema reference and ID format
- [ ] Required `biting_entity_id` field with entity ID pattern validation
- [ ] Optional `consented` field with boolean type and default value
- [ ] `biting_neck.component.json` created in `data/mods/positioning/components/`
- [ ] Required `bitten_entity_id` and `initiated` fields present
- [ ] Both components use clear descriptions explaining anatomical exclusivity

### Positioning Mod Integration
- [ ] Both components added to positioning mod manifest's `content.components` array
- [ ] Components inserted in alphabetical order within the array
- [ ] Manifest remains valid JSON with no syntax errors

### Documentation Quality
- [ ] Implementation guidelines clearly explain bilateral state pattern
- [ ] Testing strategy provides concrete examples for future implementation
- [ ] References to existing patterns (hugging, hand-holding) are clear and accurate
- [ ] Forbidden component patterns documented for future vampire actions

## Future Work

After this specification is implemented:

1. **Vampire action suite** - Populate vampirism mod with bite_neck, stop_biting_neck, drink_blood actions
2. **Vampire components** - Add vampire.component.json, blood_level.component.json to vampirism mod
3. **Integration testing** - Implement the test suite described above
4. **Cross-mod actions** - Consider violent neck-biting (violence mod) vs. consensual (intimacy mod)
5. **Scope definitions** - Create scopes for finding vulnerable victims, detecting vampires
6. **Events** - Define vampire-specific events (neck_bitten, blood_drained, vampire_revealed)

## References

- Living Narrative Engine CLAUDE.md: Entity Component System architecture, mod structure conventions
- Component Schema: `data/schemas/component.schema.json`
- Mod Manifest Schema: `data/schemas/mod-manifest.schema.json`
- Hugging components: `data/mods/positioning/components/hugging.component.json`, `being_hugged.component.json`
- Positioning manifest: `data/mods/positioning/mod-manifest.json`
- Hug-tight specification: `specs/hug-tight-state-based-action.spec.md` (bilateral state pattern reference)
