# COMMODMIG-008: Update Operation Schemas

## Overview
Update operation schema files to reference companionship components while keeping the schemas in the core mod. The schemas define the structure for operations but need to be aware of the new component namespaces.

## Prerequisites
- COMMODMIG-007 (JavaScript handlers must be updated first)

## Acceptance Criteria
1. ✅ All 5 operation schemas updated to reference companionship components
2. ✅ Schemas remain in core but are namespace-aware
3. ✅ Component references in schemas use companionship namespace
4. ✅ Schemas validate successfully
5. ✅ Operation handlers work with updated schemas

## Implementation Steps

### Step 1: Update establishFollowRelation.schema.json
Edit `data/schemas/operations/establishFollowRelation.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/establishFollowRelation.schema.json",
  "title": "Establish Follow Relation Operation",
  "description": "Creates a following relationship between two entities",
  "type": "object",
  "properties": {
    "type": {
      "const": "establishFollowRelation"
    },
    "actorId": {
      "type": "string",
      "description": "ID of the entity that will follow"
    },
    "targetId": {
      "type": "string",
      "description": "ID of the entity to be followed"
    }
  },
  "required": ["type", "actorId", "targetId"],
  "additionalProperties": false,
  "_metadata": {
    "creates_components": [
      "companionship:following",  // Updated from core:following
      "companionship:leading"     // Updated from core:leading
    ],
    "modifies_components": [
      "companionship:leading"     // May modify existing leading component
    ]
  }
}
```

### Step 2: Update breakFollowRelation.schema.json
Edit `data/schemas/operations/breakFollowRelation.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/breakFollowRelation.schema.json",
  "title": "Break Follow Relation Operation",
  "description": "Removes a following relationship",
  "type": "object",
  "properties": {
    "type": {
      "const": "breakFollowRelation"
    },
    "actorId": {
      "type": "string",
      "description": "ID of the entity that is following"
    },
    "leaderId": {
      "type": "string",
      "description": "Optional ID of specific leader to stop following"
    }
  },
  "required": ["type", "actorId"],
  "additionalProperties": false,
  "_metadata": {
    "removes_components": [
      "companionship:following"   // Updated from core:following
    ],
    "modifies_components": [
      "companionship:leading"     // Updated from core:leading
    ]
  }
}
```

### Step 3: Update checkFollowCycle.schema.json
Edit `data/schemas/operations/checkFollowCycle.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/checkFollowCycle.schema.json",
  "title": "Check Follow Cycle Operation",
  "description": "Checks if establishing a follow relationship would create a cycle",
  "type": "object",
  "properties": {
    "type": {
      "const": "checkFollowCycle"
    },
    "followerId": {
      "type": "string",
      "description": "ID of the entity that wants to follow"
    },
    "leaderId": {
      "type": "string",
      "description": "ID of the entity to be followed"
    }
  },
  "required": ["type", "followerId", "leaderId"],
  "additionalProperties": false,
  "_metadata": {
    "reads_components": [
      "companionship:following"   // Updated from core:following
    ],
    "validation_operation": true,
    "returns": {
      "type": "boolean",
      "description": "True if cycle would be created, false otherwise"
    }
  }
}
```

### Step 4: Update autoMoveFollowers.schema.json
Edit `data/schemas/operations/autoMoveFollowers.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/autoMoveFollowers.schema.json",
  "title": "Auto Move Followers Operation",
  "description": "Automatically moves all followers when a leader moves",
  "type": "object",
  "properties": {
    "type": {
      "const": "autoMoveFollowers"
    },
    "leaderId": {
      "type": "string",
      "description": "ID of the leader that moved"
    },
    "newLocation": {
      "type": "string",
      "description": "The new location of the leader"
    }
  },
  "required": ["type", "leaderId", "newLocation"],
  "additionalProperties": false,
  "_metadata": {
    "reads_components": [
      "companionship:leading",    // Updated from core:leading
      "companionship:following"   // Updated from core:following
    ],
    "modifies_components": [
      "core:location"             // Keep core - this is a core component
    ],
    "triggers_events": [
      "core:entity_moved"         // Keep core - this is a core event
    ]
  }
}
```

### Step 5: Update rebuildLeaderListCache.schema.json
Edit `data/schemas/operations/rebuildLeaderListCache.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/rebuildLeaderListCache.schema.json",
  "title": "Rebuild Leader List Cache Operation",
  "description": "Rebuilds the cache of leader-follower relationships for performance",
  "type": "object",
  "properties": {
    "type": {
      "const": "rebuildLeaderListCache"
    }
  },
  "required": ["type"],
  "additionalProperties": false,
  "_metadata": {
    "reads_components": [
      "companionship:following",  // Updated from core:following
      "companionship:leading"     // Updated from core:leading
    ],
    "cache_operation": true,
    "performance_optimization": true
  }
}
```

### Step 6: Validate All Operation Schemas
Run validation for all updated schemas:

```bash
# Validate each schema file
for schema in data/schemas/operations/*FollowRelation.schema.json \
              data/schemas/operations/checkFollowCycle.schema.json \
              data/schemas/operations/autoMoveFollowers.schema.json \
              data/schemas/operations/rebuildLeaderListCache.schema.json; do
  echo "Validating $schema"
  npm run validate-schema "$schema"
done
```

### Step 7: Verify Schema References
Check that all companionship references are correct:

```bash
# Should find companionship references
grep -r "companionship:" data/schemas/operations/

# Should still find some core references (for core components/events)
grep -r "core:location" data/schemas/operations/
grep -r "core:entity_moved" data/schemas/operations/
```

## Testing Requirements

### Schema Validation
1. All schemas must be valid JSON Schema format:
   ```bash
   npm run validate-schema data/schemas/operations/*.schema.json
   ```

2. Verify metadata sections are updated:
   ```bash
   # Check for companionship references in metadata
   grep -A5 "_metadata" data/schemas/operations/*.schema.json | grep "companionship:"
   ```

### Integration Tests
1. Operation handlers should work with updated schemas
2. Schema validation in operation handlers should pass
3. Component references should resolve correctly

## Important Design Decision

### Why Keep Schemas in Core?

The operation schemas remain in the core mod because:
1. **Engine Integration**: Operation handlers are part of the engine infrastructure
2. **Cross-Mod Operations**: Operations may affect multiple mods
3. **Central Validation**: Core provides centralized schema validation
4. **Architectural Consistency**: Operations are engine-level, not mod-level

The schemas are made **namespace-aware** by updating the component references in the `_metadata` sections to use the companionship namespace.

## Metadata Section Reference

The `_metadata` section in schemas provides hints about:
- `creates_components`: Components that may be created
- `modifies_components`: Components that may be modified
- `removes_components`: Components that may be removed
- `reads_components`: Components that are read-only accessed
- `triggers_events`: Events that may be dispatched
- `validation_operation`: If true, operation only validates
- `cache_operation`: If true, operation manages caches

## Notes
- The `_metadata` section is informational and not validated by JSON Schema
- Core components (like `core:location`) remain with core namespace
- Core events (like `core:entity_moved`) remain with core namespace
- Only companionship-specific components get the new namespace

## Dependencies
- Blocks: COMMODMIG-009 (tests need schemas to be correct)
- Blocked by: COMMODMIG-007 (handlers should be updated first)

## Estimated Effort
- 1 hour

## Risk Assessment
- **Low Risk**: Schemas are mainly documentation
- **Validation Impact**: Changes are in metadata, not structure
- **Mitigation**: Validate each schema after modification

## Success Metrics
- All 5 operation schemas updated with companionship references
- Schemas validate successfully
- Metadata sections reflect new component namespaces
- Core components/events retain core namespace
- Operation handlers continue to work