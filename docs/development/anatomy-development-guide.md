# Anatomy System Development Guide

Quick-start guide for developers working on the Living Narrative Engine's anatomy system.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Key Concepts](#key-concepts)
3. [Development Workflow](#development-workflow)
4. [Common Tasks](#common-tasks)
5. [Testing Your Changes](#testing-your-changes)
6. [Common Gotchas](#common-gotchas)
7. [Best Practices](#best-practices)
8. [Getting Help](#getting-help)

## Quick Start

### Prerequisites

- Node.js 18+ installed
- Living Narrative Engine repository cloned
- Basic understanding of ECS architecture
- Familiarity with JSON schemas

### Setup

```bash
# Install dependencies
npm install

# Run all tests to verify setup
npm run test:unit
npm run test:integration

# Start development server
npm run dev
```

### Your First Anatomy Creature

Let's create a simple quadruped creature (cat):

**Step 1: Create Structure Template**

```bash
# Create file: data/mods/my_mod/anatomy/structure-templates/structure_cat.structure-template.json
```

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.structure-template.schema.json",
  "id": "my_mod:structure_cat",
  "description": "Cat body structure with 4 legs and tail",
  "topology": {
    "rootType": "torso",
    "limbSets": [
      {
        "type": "leg",
        "count": 4,
        "arrangement": "quadrupedal",
        "socketPattern": {
          "idTemplate": "leg_{{orientation}}",
          "orientationScheme": "bilateral",
          "allowedTypes": ["cat_leg"],
          "nameTpl": "{{orientation}} leg"
        }
      }
    ],
    "appendages": [
      {
        "type": "head",
        "count": 1,
        "attachment": "anterior",
        "socketPattern": {
          "idTemplate": "head",
          "allowedTypes": ["cat_head"],
          "nameTpl": "head"
        }
      },
      {
        "type": "tail",
        "count": 1,
        "attachment": "posterior",
        "socketPattern": {
          "idTemplate": "tail",
          "allowedTypes": ["cat_tail"],
          "nameTpl": "tail"
        }
      }
    ]
  }
}
```

**Step 2: Create Blueprint**

```bash
# Create file: data/mods/my_mod/anatomy/blueprints/cat.blueprint.json
```

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json",
  "id": "my_mod:cat",
  "schemaVersion": "2.0",
  "description": "Cat blueprint using structure template",
  "root": "anatomy:mammal_torso",
  "structureTemplate": "my_mod:structure_cat"
}
```

**Step 3: Create Recipe**

```bash
# Create file: data/mods/my_mod/anatomy/recipes/cat_default.recipe.json
```

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.recipe.schema.json",
  "recipeId": "my_mod:cat_default",
  "blueprintId": "my_mod:cat",
  "description": "Standard domestic cat",
  "slots": {
    "head": {
      "partType": "cat_head",
      "tags": ["anatomy:part"]
    }
  },
  "patterns": [
    {
      "matchesGroup": "limbSet:leg",
      "partType": "cat_leg",
      "tags": ["anatomy:part"]
    },
    {
      "matchesGroup": "appendage:tail",
      "partType": "cat_tail",
      "tags": ["anatomy:part"]
    }
  ],
  "bodyDescriptors": {
    "build": "lithe",
    "skinColor": "tabby"
  }
}
```

**Step 4: Create Entity Definitions**

Create entity definitions for cat_head, cat_leg, cat_tail in `data/mods/my_mod/entities/`.

**Step 5: Test**

```javascript
// tests/integration/my_mod/catAnatomy.test.js
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('Cat Anatomy', () => {
  let testBed;

  beforeEach(async () => {
    testBed = createTestBed();
    await testBed.loadMods(['core', 'anatomy', 'my_mod']);
  });

  it('should generate cat anatomy', async () => {
    const anatomyService = testBed.getService('anatomyGenerationService');
    const result = await anatomyService.generateForEntity(
      'test_cat',
      'my_mod:cat',
      'my_mod:cat_default'
    );

    expect(result.partsMap.has('head')).toBe(true);
    expect(result.partsMap.has('tail')).toBe(true);
    expect(result.partsMap.has('leg_left_front')).toBe(true);
    expect(result.partsMap.has('leg_right_front')).toBe(true);
    expect(result.partsMap.has('leg_left_rear')).toBe(true);
    expect(result.partsMap.has('leg_right_rear')).toBe(true);
  });
});
```

```bash
# Run test
NODE_ENV=test npx jest tests/integration/my_mod/catAnatomy.test.js
```

## Key Concepts

### Blueprint → Recipe → Instance Pipeline

```
1. Structure Template (optional, V2)
   ↓
2. Blueprint (defines STRUCTURE)
   ↓
3. Recipe (defines CONTENT)
   ↓
4. Entity Graph (runtime INSTANCE)
```

### V1 vs V2 Blueprints

**V1** (Explicit Slots):
- Manually define each slot
- Good for simple, fixed anatomies
- Easy to debug

**V2** (Template-Based):
- Generate slots from templates
- Great for creatures with many limbs
- More complex but flexible

**Recommendation**: Use V2 for creatures with >4 repeating limbs.

### OrientationResolver

**Critical Component**: `src/anatomy/shared/orientationResolver.js`

**Purpose**: Single source of truth for orientation naming

**Supported Schemes**:
- `bilateral`: left, right
- `quadrupedal`: left_front, right_front, left_rear, right_rear
- `radial`: anterior, anterior_right, right, posterior_right, etc.
- `indexed`: 1, 2, 3, ...
- `custom`: explicit position arrays

**Important**: NEVER duplicate orientation logic. Always use OrientationResolver.

### Pattern Matching

Recipe patterns match blueprint slots:

- **matchesGroup**: `"limbSet:leg"` - Matches entire limb set
- **matchesPattern**: `"leg_*"` - Wildcard matching
- **matchesAll**: `{ "slotType": "leg" }` - Property-based filtering
- **matches**: `["leg_1", "leg_2"]` - Explicit list (V1)

**Tip**: Prefer `matchesGroup` for resilience against template changes.

## Development Workflow

### 1. Make Changes

Edit anatomy system files:
- Templates: `data/mods/*/anatomy/structure-templates/`
- Blueprints: `data/mods/*/anatomy/blueprints/`
- Recipes: `data/mods/*/anatomy/recipes/`
- Services: `src/anatomy/`

### 2. Validate

```bash
# Lint modified files
npx eslint src/anatomy/yourModifiedFile.js

# Type check
npm run typecheck

# Validate schemas
npm run scope:lint
```

### 3. Test

```bash
# Unit tests
npm run test:unit -- tests/unit/anatomy/

# Integration tests
npm run test:integration -- tests/integration/anatomy/

# Specific test file
NODE_ENV=test npx jest tests/unit/anatomy/orientationResolver.test.js
```

### 4. Debug

Enable debug logging:
```javascript
// Check logger configuration for anatomy services
// Debug logs show:
// - Pattern matching resolution
// - Socket index operations
// - Generation workflow steps
```

### 5. Commit

```bash
git add <modified-files>
git commit -m "feat(anatomy): descriptive message"
```

## Common Tasks

### Adding a New Orientation Scheme

**Location**: `src/anatomy/shared/orientationResolver.js`

**Steps**:

1. Add scheme case to `resolveOrientation()`:
```javascript
export class OrientationResolver {
  static resolveOrientation(scheme, index, totalCount, positions, arrangement) {
    switch (scheme) {
      case 'myNewScheme':
        return this.#resolveMyNewScheme(index, totalCount);
      // ... existing schemes
    }
  }

  static #resolveMyNewScheme(index, totalCount) {
    // Implementation
  }
}
```

2. Update schema: `data/schemas/anatomy.structure-template.schema.json`
```json
{
  "orientationScheme": {
    "enum": ["bilateral", "radial", "indexed", "custom", "myNewScheme"]
  }
}
```

3. Add unit tests:
```javascript
describe('OrientationResolver - myNewScheme', () => {
  it('should resolve myNewScheme correctly', () => {
    const result = OrientationResolver.resolveOrientation('myNewScheme', 1, 4);
    expect(result).toBe('expected_value');
  });
});
```

4. Add contract tests for SlotGenerator ↔ SocketGenerator synchronization

5. Document in [Structure Templates Guide](../anatomy/structure-templates.md)

### Adding a New Pattern Matcher

**Location**: `src/anatomy/recipePatternResolver.js`

**Steps**:

1. Add matcher method:
```javascript
#resolveMatchesX(pattern, blueprintSlots) {
  // Implementation
  return matchedSlots;
}
```

2. Update `resolve()` method:
```javascript
async resolve(blueprint, recipe) {
  // ... existing code
  if (pattern.matchesX) {
    resolvedSlots = this.#resolveMatchesX(pattern, blueprint.slots);
  }
  // ...
}
```

3. Update schema: `data/schemas/anatomy.recipe.schema.json`

4. Add tests for new matcher

5. Document in [Recipe Patterns Guide](../anatomy/recipe-patterns.md)

### Subscribing to Anatomy Events

**Event**: `ANATOMY_GENERATED`

**Steps**:

1. Add EventBus dependency:
```javascript
class MyService {
  constructor({ eventBus, anatomySocketIndex }) {
    this.#eventBus = eventBus;
    this.#socketIndex = anatomySocketIndex;

    this.#eventBus.on('ANATOMY_GENERATED', this.#handleAnatomyGenerated.bind(this));
  }

  async #handleAnatomyGenerated({ entityId, blueprintId, sockets }) {
    // Your logic here
  }
}
```

2. Register service with DI container

3. Test event handling:
```javascript
it('should handle ANATOMY_GENERATED event', async () => {
  const eventSpy = jest.fn();
  eventBus.on('ANATOMY_GENERATED', eventSpy);

  await anatomyService.generateForEntity('entity', 'blueprint', 'recipe');

  expect(eventSpy).toHaveBeenCalled();
});
```

### Debugging Pattern Matching Issues

**Symptoms**: Zero body parts generated, pattern warnings in logs

**Steps**:

1. Enable debug logging for anatomy services

2. Check logs for "Pattern matched zero slots"

3. Inspect blueprint slots:
```javascript
const blueprint = dataRegistry.get('anatomyBlueprints', 'your:blueprint');
console.log('Slot keys:', Object.keys(blueprint.slots));
```

4. Verify template socket pattern:
```javascript
const template = dataRegistry.get('anatomyStructureTemplates', 'your:template');
console.log('Socket patterns:', template.topology.limbSets.map(ls => ls.socketPattern));
```

5. Test pattern resolution:
```javascript
const recipe = dataRegistry.get('anatomyRecipes', 'your:recipe');
const resolved = await patternResolver.resolve(blueprint, recipe);
console.log('Resolved slots:', resolved.map(s => s.key));
```

6. Update recipe patterns to match actual slot keys

**Tip**: Use `matchesGroup` for resilience against template naming changes.

## Testing Your Changes

### Test Types

**Unit Tests** (70% of tests):
- Fast, isolated
- Test single functions/methods
- Mock dependencies
- Location: `tests/unit/anatomy/`

**Integration Tests** (25% of tests):
- Test component interactions
- Real dependencies
- Complete workflows
- Location: `tests/integration/anatomy/`

**E2E Tests** (5% of tests):
- Full user workflows
- Location: `tests/e2e/anatomy/`

### Writing Good Tests

```javascript
// ✅ Good test - Clear, focused, descriptive
describe('OrientationResolver - bilateral scheme', () => {
  it('should resolve bilateral with 2 items as left and right', () => {
    // Arrange
    const scheme = 'bilateral';

    // Act
    const left = OrientationResolver.resolveOrientation(scheme, 1, 2);
    const right = OrientationResolver.resolveOrientation(scheme, 2, 2);

    // Assert
    expect(left).toBe('left');
    expect(right).toBe('right');
  });
});

// ❌ Bad test - Vague, tests multiple things
it('should work', () => {
  const result = doSomething();
  expect(result).toBeTruthy();
});
```

### Test Coverage Requirements

- **Functions/Statements**: 90%+
- **Branches**: 80%+
- **Lines**: 90%+

```bash
# Check coverage
npm run test:unit -- --coverage

# View coverage report
open coverage/lcov-report/index.html
```

### Contract Testing

**Critical**: Test synchronization requirements

**Example**:
```javascript
describe('SlotGenerator ↔ SocketGenerator Contract', () => {
  it('should generate synchronized keys and IDs', async () => {
    const slots = await slotGenerator.generate(template);
    const sockets = await socketGenerator.generate(template);

    const slotKeys = slots.map(s => s.key).sort();
    const socketIds = sockets.map(s => s.id).sort();

    expect(slotKeys).toEqual(socketIds);
  });
});
```

## Common Gotchas

### 1. Orientation Mismatch

**Problem**: Slot keys don't match socket IDs

**Cause**: Not using OrientationResolver

**Solution**: Always use OrientationResolver:
```javascript
// ✅ Good
import { OrientationResolver } from './shared/orientationResolver.js';
const orientation = OrientationResolver.resolveOrientation(scheme, index, count);

// ❌ Bad
const orientation = index === 1 ? 'left' : 'right'; // Duplicates logic!
```

### 2. Pattern Matching Zero Slots

**Problem**: Recipe pattern matches no blueprint slots

**Cause**: Template socket pattern doesn't match recipe pattern

**Solution**: Use `matchesGroup` or check template orientation scheme:
```json
// Template generates: leg_left_front, leg_right_front, etc.
{
  "socketPattern": {
    "idTemplate": "leg_{{orientation}}",
    "orientationScheme": "bilateral"
  }
}

// Recipe must match:
{
  "matchesGroup": "limbSet:leg"  // ✅ Works regardless of naming
}
// or
{
  "matchesPattern": "leg_*"  // ✅ Works with current naming
}
```

### 3. Forgotten Event Subscription

**Problem**: Clothing not attaching after anatomy generation

**Cause**: Didn't subscribe to ANATOMY_GENERATED event

**Solution**: Subscribe during initialization:
```javascript
constructor({ eventBus }) {
  eventBus.on('ANATOMY_GENERATED', this.#handleAnatomyGenerated.bind(this));
}
```

### 4. Cache Staleness

**Problem**: Socket index returns stale data

**Cause**: Cache not invalidated after anatomy changes

**Solution**: Invalidate cache on structure changes:
```javascript
// After modifying anatomy
socketIndex.invalidateIndex(rootEntityId);

// Index auto-rebuilds on next access
```

### 5. Schema Validation Failures

**Problem**: Mod won't load, schema errors in console

**Cause**: JSON doesn't match schema requirements

**Solution**: Validate against schemas:
```bash
# Validate your mod files
npm run validate:mod:my_mod
```

## Best Practices

### 1. Use Structure Templates for Complex Anatomies

✅ **Do**: Use V2 blueprints with structure templates for creatures with >4 limbs
❌ **Don't**: Manually define 50+ slots in a V1 blueprint

### 2. Prefer matchesGroup for Patterns

✅ **Do**: Use `matchesGroup: "limbSet:leg"` for resilience
❌ **Don't**: Use `matches: ["leg_1", "leg_2", ...]` for generated slots

### 3. Test Pattern Matching

✅ **Do**: Test that recipe patterns match blueprint slots
❌ **Don't**: Assume patterns will work without testing

### 4. Follow Naming Conventions

✅ **Do**: Use descriptive IDs: `my_mod:structure_cat`, `my_mod:cat_default`
❌ **Don't**: Use generic IDs: `template_1`, `recipe_a`

### 5. Document Complex Templates

✅ **Do**: Add `description` field explaining template structure
❌ **Don't**: Leave complex templates undocumented

### 6. Enable Debug Logging During Development

✅ **Do**: Check anatomy service logs for pattern matching
❌ **Don't**: Debug pattern issues without logs

### 7. Write Contract Tests

✅ **Do**: Test critical synchronization requirements
❌ **Don't**: Only test individual components in isolation

### Working with Body Descriptors

**Body Descriptor Registry**: `src/anatomy/registries/bodyDescriptorRegistry.js`

The registry provides centralized management of body descriptor metadata:

```javascript
import {
  getDescriptorMetadata,
  validateDescriptorValue,
} from './anatomy/registries/bodyDescriptorRegistry.js';

// Get descriptor metadata
const meta = getDescriptorMetadata('height');
console.log(meta.validValues); // ['gigantic', 'very-tall', ...]

// Validate a value
const result = validateDescriptorValue('build', 'athletic');
console.log(result.valid); // true
```

**Adding New Descriptors**:

1. Add to registry (`src/anatomy/registries/bodyDescriptorRegistry.js`)
2. Update schema (`data/schemas/anatomy.recipe.schema.json`)
3. Add to formatting config (`data/mods/anatomy/anatomy-formatting/default.json`)
4. Run validation: `npm run validate:body-descriptors`
5. Add tests

**Validation Tool**:

```bash
npm run validate:body-descriptors
```

Checks:
- Registry completeness
- Formatting configuration
- Recipe descriptor values
- System consistency

**Documentation**:
- [Body Descriptor Registry](../anatomy/body-descriptor-registry.md) - Full API reference
- [Adding Body Descriptors](../anatomy/adding-body-descriptors.md) - Step-by-step guide
- [Validator Reference](../anatomy/body-descriptor-validator-reference.md) - Validator API

## Getting Help

### Documentation

- [Architecture Guide](../anatomy/architecture.md) - System overview
- [Structure Templates](../anatomy/structure-templates.md) - Template syntax
- [Recipe Patterns](../anatomy/recipe-patterns.md) - Pattern matching
- [Body Descriptor Registry](../anatomy/body-descriptor-registry.md) - Registry API
- [Adding Body Descriptors](../anatomy/adding-body-descriptors.md) - Step-by-step guide
- [Troubleshooting](../anatomy/troubleshooting.md) - Common issues
- [Testing Guide](../testing/anatomy-testing-guide.md) - Testing patterns
- [Refactoring History](../anatomy/refactoring-history.md) - Architectural changes

### Code References

**Key Files**:
- `src/anatomy/shared/orientationResolver.js` - Orientation logic
- `src/anatomy/workflows/anatomyGenerationWorkflow.js` - Main workflow
- `src/anatomy/services/anatomySocketIndex.js` - Socket caching
- `src/anatomy/recipePatternResolver.js` - Pattern matching
- `src/anatomy/slotGenerator.js` - Slot generation (V2)
- `src/anatomy/socketGenerator.js` - Socket generation (V2)

**Test Examples**:
- `tests/unit/anatomy/shared/orientationResolver.test.js` - Unit test example
- `tests/integration/anatomy/anatomyGeneration.integration.test.js` - Integration test example
- `tests/integration/anatomy/slotSocketSynchronization.contract.test.js` - Contract test example

### Debug Checklist

When stuck:

1. ✅ Enable debug logging
2. ✅ Check schema validation
3. ✅ Verify pattern matching
4. ✅ Inspect blueprint slots
5. ✅ Test with simple example
6. ✅ Check recent commits for breaking changes
7. ✅ Review [Troubleshooting Guide](../anatomy/troubleshooting.md)

### Community

- **Report Bugs**: GitHub Issues
- **Ask Questions**: Team chat or GitHub Discussions
- **Contribute**: Follow contribution guidelines in CLAUDE.md

---

**Happy Coding!** 🎮

For questions or improvements to this guide, please submit a pull request or open an issue.
