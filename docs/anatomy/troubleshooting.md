# Anatomy System Troubleshooting

This guide helps diagnose and resolve common issues with the anatomy system.

## Quick Diagnostics Checklist

Before diving into specific issues:

1. **Enable Debug Logging**: Check logger configuration for anatomy services
2. **Check Mod Loading**: Verify mods loaded successfully without schema errors
3. **Inspect Generated Slots**: Use explicit slot definitions to verify blueprint structure
4. **Review Event Logs**: Check for ANATOMY_GENERATED event dispatch
5. **Verify Socket Index**: Confirm socket index was built after anatomy generation

## Problem: Body parts not generated

**Symptoms**: Entity has anatomy component but missing body parts in the entity graph

### Root Causes

#### 1. Recipe pattern matching failed

**Check logs for**: "Pattern matched zero slots" debug messages

**Common causes**:
- Structure template socket pattern doesn't match recipe pattern
- Orientation scheme mismatch (e.g., template uses `bilateral` but recipe expects `indexed`)
- Template variable naming changed without updating recipes

**Debugging steps**:
```javascript
// 1. Enable debug logging
// Check logger configuration for anatomy services

// 2. Inspect blueprint slots manually
const blueprint = dataRegistry.get('anatomyBlueprints', 'anatomy:spider_common');
console.log('Blueprint slots:', Object.keys(blueprint.slots));

// 3. Test pattern matching
const recipe = dataRegistry.get('anatomyRecipes', 'anatomy:spider_garden');
console.log('Recipe patterns:', recipe.patterns);

// 4. Check structure template
const template = dataRegistry.get('anatomyStructureTemplates', 'anatomy:structure_spider');
console.log('Socket patterns:', template.topology.limbSets.map(ls => ls.socketPattern));
```

**Solution**:
- Use `matchesGroup: "limbSet:leg"` for resilience against template naming changes
- Verify template's `orientationScheme` matches expected slot keys
- Update recipe patterns when structure templates change
- See [Pattern Matching Best Practices](./pattern-matching-best-practices.md)

#### 2. Blueprint-recipe mismatch

**Check logs for**: Schema validation errors, missing blueprint warnings

**Common causes**:
- Recipe references non-existent blueprint ID
- Blueprint missing required fields
- Recipe's `blueprintId` doesn't match actual blueprint

**Debugging steps**:
1. Verify blueprint exists: `dataRegistry.get('anatomyBlueprints', blueprintId)`
2. Check recipe's `blueprintId` field matches actual blueprint
3. Validate blueprint against schema: `data/schemas/anatomy.blueprint.schema.json`

**Solution**:
- Correct recipe's `blueprintId` reference
- Ensure blueprint is loaded before recipe
- Check mod loading order in `game.json`

#### 3. Structure template error

**Check logs for**: Template validation errors, schema violations

**Common causes**:
- Invalid count ranges (limbSets > 100, appendages > 10)
- Malformed socket patterns
- Missing required fields (id, topology.rootType)
- Invalid orientation schemes

**Debugging steps**:
1. Validate template against schema: `data/schemas/anatomy.structure-template.schema.json`
2. Check required fields are present
3. Verify count ranges are within limits
4. Ensure orientation scheme is valid: `bilateral`, `radial`, `indexed`, `custom`, `quadrupedal`

**Solution**:
- Fix template schema violations
- Use valid orientation schemes
- Keep counts within schema limits
- See [Structure Templates Guide](./structure-templates.md)

#### 4. Part selection failure

**Check logs for**: "No valid parts found" or part selection errors

**Common causes**:
- No entity definitions match `partType` requirement
- Part entities missing required components
- Part entity definitions have invalid schemas

**Debugging steps**:
```javascript
// Check if part entities exist for required type
const partType = 'spider_leg';
const partDefs = dataRegistry.getAll('entityDefinitions').filter(
  def => def.partType === partType
);
console.log(`Found ${partDefs.length} part definitions for ${partType}`);
```

**Solution**:
- Create entity definitions for required part types
- Ensure part entities have `anatomy:part` component
- Verify entity definitions validate against schemas

**Note**: Some validation features (e.g., BlueprintRecipeValidator, zero-match warnings) are planned improvements from ANASYSREF-002 and may not yet be implemented. Check [Refactoring History](./refactoring-history.md) for implementation status.

## Problem: Clothing not attaching to body parts

**Symptoms**: Clothing items created but not attached to sockets, or clothing instantiation fails

### Root Causes

#### 1. Socket IDs don't match clothing slot expectations

**Check logs for**: "Socket not found" warnings in clothing instantiation

**Common causes**:
- Clothing slot mappings reference non-existent socket IDs
- Socket IDs changed due to template modifications
- SlotResolver couldn't resolve clothing slots

**Debugging steps**:
```javascript
// 1. Check socket index for entity
const sockets = await anatomySocketIndex.getEntitySockets(entityId);
console.log('Available sockets:', sockets.map(s => s.id));

// 2. Check clothing slot mappings
const slotMetadata = await entityManager.getComponentData(
  entityId,
  'clothing:slot_metadata'
);
console.log('Clothing slot mappings:', slotMetadata?.slotMappings);

// 3. Verify SlotResolver strategies
// Check SlotResolver service logs for strategy resolution
```

**Solution**:
- Verify socket IDs in AnatomySocketIndex match expected clothing slots
- Update clothing slot mappings when templates change
- Ensure anatomy generation completes before clothing instantiation
- See [Architecture Guide](./architecture.md) for clothing integration details

#### 2. Cache invalidation timing issue

**Check logs for**: Stale cache warnings, missing socket index entries

**Common causes**:
- Cache not invalidated after anatomy changes
- Socket index not rebuilt after template modifications
- Race condition between anatomy generation and clothing instantiation

**Debugging steps**:
```javascript
// Check if socket index is current
const hasIndex = await anatomySocketIndex.getEntitiesWithSockets(rootEntityId);
console.log('Entities with sockets:', hasIndex);

// Manually rebuild index if needed
await anatomySocketIndex.buildIndex(rootEntityId);
```

**Solution**:
- Ensure cache coordinator properly registers anatomy caches
- Socket index auto-builds on first access if missing
- Invalidate caches when anatomy structure changes
- See `src/anatomy/services/anatomySocketIndex.js:51-68` for cache registration

#### 3. Missing ANATOMY_GENERATED event

**Check logs for**: Event dispatch logs, missing event subscribers

**Common causes**:
- EventBus not provided to AnatomyGenerationWorkflow
- Event subscribers not registered before anatomy generation
- Event dispatch failed silently

**Debugging steps**:
```javascript
// Check if ANATOMY_GENERATED event was dispatched
// Look for logs from anatomyGenerationWorkflow.js around line 197

// Verify event subscribers
// Check clothing instantiation service registered event handlers
```

**Solution**:
- Ensure AnatomyGenerationWorkflow receives eventBus dependency
- Register clothing event subscribers during initialization
- Check event bus configuration
- See `src/anatomy/workflows/anatomyGenerationWorkflow.js:187-217` for event dispatch

**Implementation note**: The ANATOMY_GENERATED event is dispatched from `anatomyGenerationWorkflow.js` after successful anatomy generation, including socket information for clothing integration.

## Problem: Orientation mismatch between slots and sockets

**Symptoms**: Clothing attaches to wrong body parts, or part names don't match expected orientation

### Root Causes

**Common cause**: SlotGenerator and SocketGenerator using different orientation resolution logic

**Critical requirement**: Both generators MUST use OrientationResolver (`src/anatomy/shared/orientationResolver.js`)

**Debugging steps**:
```javascript
// Verify both use OrientationResolver
// Check imports in:
// - src/anatomy/slotGenerator.js (line 8)
// - src/anatomy/socketGenerator.js (line 8)

// Test orientation resolution
import { OrientationResolver } from './src/anatomy/shared/orientationResolver.js';

const bilateral = OrientationResolver.resolveOrientation('bilateral', 1, 2);
console.log('Bilateral result:', bilateral); // Should be 'left'

const quadrupedal = OrientationResolver.resolveOrientation('bilateral', 1, 4);
console.log('Quadrupedal result:', quadrupedal); // Should be 'left_front'
```

**Solution**:
- Verify both generators import and use OrientationResolver
- Never duplicate orientation logic
- Update OrientationResolver for new orientation schemes
- See [Refactoring History](./refactoring-history.md) for orientation resolution architecture

## Problem: Tests failing after template changes

**Symptoms**: Previously passing tests now fail with missing body parts or incorrect anatomy structure

### Root Causes

**Common cause**: Template changes broke recipe pattern matching without updating tests

**Debugging steps**:
1. Review recent template changes
2. Check if slot key format changed (e.g., `leg_1` → `leg_left`)
3. Verify recipe patterns still match new slot format
4. Update test fixtures to match new template structure

**Solution**:
- Update recipes when templates change
- Use `matchesGroup` for template-independent patterns
- Update test fixtures to reflect new slot structure
- Run integration tests after template modifications
- See [Testing Guide](../testing/anatomy-testing-guide.md) for contract testing patterns

## Problem: Performance degradation with complex anatomy

**Symptoms**: Slow anatomy generation, high memory usage, or timeout errors

### Root Causes

#### 1. Excessive limb counts

**Common causes**:
- Templates with very high limb counts (> 20)
- Deep nesting in body graph
- Redundant socket index rebuilds

**Solution**:
- Keep limb counts reasonable (most creatures need ≤ 20 limbs)
- Use socket index for O(1) lookups instead of graph traversal
- Cache socket index, invalidate only when structure changes

#### 2. Inefficient pattern matching

**Common causes**:
- Overly broad patterns (e.g., `matchesPattern: "*"`)
- Multiple overlapping patterns
- Complex `matchesAll` filters

**Solution**:
- Use specific patterns (matchesGroup > matchesPattern > matchesAll)
- Minimize pattern overlap
- Profile pattern resolution performance
- See [Pattern Matching Best Practices](./pattern-matching-best-practices.md)

## Diagnostic Tools

### Enable Debug Logging

Check logger configuration for anatomy services:
```javascript
// Logger shows:
// - Pattern matching resolution
// - Socket index operations
// - Anatomy generation workflow steps
// - Event dispatch
```

### Inspect Socket Index

Available at `src/anatomy/services/anatomySocketIndex.js`:
```javascript
// Get all sockets for entity
const sockets = await anatomySocketIndex.getEntitySockets(entityId);

// Find entity with specific socket
const entityId = await anatomySocketIndex.findEntityWithSocket(rootEntityId, socketId);

// Get all entities with sockets in hierarchy
const entities = await anatomySocketIndex.getEntitiesWithSockets(rootEntityId);
```

### Check Event Dispatch

Monitor ANATOMY_GENERATED events:
```javascript
// Event payload includes:
// - entityId: Owner entity
// - blueprintId: Blueprint used
// - sockets: Array of socket objects {id, orientation}
// - timestamp: Generation timestamp
// - bodyParts: Array of part entity IDs
// - partsMap: Object mapping part names to entity IDs
// - slotEntityMappings: Object mapping slot IDs to entity IDs
```

## Related Documentation

- [Structure Templates](./structure-templates.md) - Template syntax and validation
- [Recipe Patterns](./recipe-patterns.md) - Pattern matching and debugging
- [Architecture Guide](./architecture.md) - System architecture and event flow
- [Testing Guide](../testing/anatomy-testing-guide.md) - Contract testing patterns
- [Refactoring History](./refactoring-history.md) - Architectural changes and migration guidance

## Getting Help

If you're still stuck:

1. Check recent commits for breaking changes
2. Review [Refactoring History](./refactoring-history.md) for architectural changes
3. Enable debug logging and examine output
4. Verify all schemas validate correctly
5. Check integration tests for similar scenarios
6. Review [Architecture Guide](./architecture.md) for system overview
