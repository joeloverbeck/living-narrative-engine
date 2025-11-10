# Anatomy Recipe Testing Patterns

This guide provides comprehensive testing patterns for anatomy recipes, from unit tests to integration tests and validation workflows. Following these patterns ensures reliable, maintainable tests that catch errors early in the development cycle.

**Related Documentation:**
- [Validation Workflow](./validation-workflow.md) - Complete validation pipeline details
- [Recipe Creation Checklist](./recipe-creation-checklist.md) - Recipe development workflow
- [Anatomy System Guide](./anatomy-system-guide.md) - System architecture overview
- [Common Errors Catalog](./common-errors.md) - Error reference and solutions
- [Mod Testing Guide](../testing/mod-testing-guide.md) - General mod testing patterns

## Table of Contents

1. [Overview](#overview)
2. [Unit Testing Patterns](#unit-testing-patterns)
3. [Integration Testing Patterns](#integration-testing-patterns)
4. [Test Utilities](#test-utilities)
5. [Test Checklist](#test-checklist)
6. [CLI Validation Workflow](#cli-validation-workflow)
7. [Best Practices](#best-practices)
8. [Common Testing Scenarios](#common-testing-scenarios)

## Overview

### Testing Philosophy

The anatomy system uses a layered testing approach:

- **Unit Tests**: Test individual components in isolation with mocked dependencies
- **Integration Tests**: Test complete anatomy generation workflows with real components
- **CLI Validation**: Pre-development validation of recipe structure and constraints
- **Manual Validation**: Visual testing via the anatomy visualizer

### Test Organization

```
tests/
├── unit/
│   └── anatomy/                    # Unit tests for anatomy services
│       ├── anatomyGenerationService.test.js
│       ├── recipeProcessor.test.js
│       ├── bodyBlueprintFactory/
│       └── validation/
├── integration/
│   └── anatomy/                    # Integration tests for complete workflows
│       ├── giantSpiderGeneration.test.js
│       ├── humanAnatomyGeneration.test.js
│       └── recipeValidation.test.js
└── common/
    ├── anatomy/                    # Test beds and helpers
    │   ├── anatomyIntegrationTestBed.js
    │   ├── simplifiedAnatomyTestBed.js
    │   └── enhancedAnatomyTestBed.js
    └── mockFactories/              # Mock creation utilities
        └── index.js
```

## Unit Testing Patterns

### Basic Unit Test Structure

Unit tests focus on testing individual services with mocked dependencies:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { RecipeProcessor } from '../../../src/anatomy/recipeProcessor.js';
import { createMockLogger, createMockDataRegistry } from '../../common/mockFactories/index.js';

describe('RecipeProcessor', () => {
  let processor;
  let mockLogger;
  let mockRegistry;

  beforeEach(() => {
    // Arrange: Create mocks
    mockLogger = createMockLogger();
    mockRegistry = createMockDataRegistry();

    // Arrange: Create service under test
    processor = new RecipeProcessor({
      dataRegistry: mockRegistry,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    // Cleanup
    jest.clearAllMocks();
  });

  it('should process recipe slots correctly', () => {
    // Arrange
    const recipe = {
      id: 'anatomy:test_recipe',
      slots: [
        { id: 'head', required: true, count: 1 },
      ],
    };

    // Act
    const result = processor.processRecipe(recipe);

    // Assert
    expect(result).toBeDefined();
    expect(result.slots).toHaveLength(1);
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('should handle missing required properties', () => {
    // Arrange
    const invalidRecipe = { id: 'anatomy:test' }; // Missing slots

    // Act & Assert
    expect(() => {
      processor.processRecipe(invalidRecipe);
    }).toThrow();
  });
});
```

### Mock Factories

The project provides standardized mock factories in `tests/common/mockFactories/index.js`:

```javascript
import {
  createMockLogger,
  createMockEventDispatcher,
  createMockSchemaValidator,
  createMockDataRegistry,
} from '../../common/mockFactories/index.js';

// Usage in tests
const mockLogger = createMockLogger();
const mockEventDispatcher = createMockEventDispatcher();
const mockValidator = createMockSchemaValidator();
const mockRegistry = createMockDataRegistry();
```

**Available Mock Factories:**

- `createMockLogger()` - Logger with `info`, `warn`, `error`, `debug` methods
- `createMockEventDispatcher()` - Event dispatcher with `dispatch` method
- `createMockSchemaValidator()` - Schema validator with `validate` method
- `createMockDataRegistry()` - Data registry with `getData`, `setData` methods
- `createMockEventBus()` - Event bus with subscription and dispatch
- `createMockEntityManager()` - Entity manager with component operations

### Mocking Strategies

**1. Jest Mocks for Services:**

```javascript
// Mock a service method
const mockService = {
  generateDescription: jest.fn().mockReturnValue('A test description'),
  validateEntity: jest.fn().mockReturnValue(true),
};

// Verify calls
expect(mockService.generateDescription).toHaveBeenCalledWith(expectedArg);
expect(mockService.generateDescription).toHaveBeenCalledTimes(1);
```

**2. In-Memory Implementations for Data:**

```javascript
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';

// Use real in-memory registry for data operations
const registry = new InMemoryDataRegistry();
registry.setData('anatomy:components', [
  { id: 'anatomy:part', dataSchema: {} },
]);
```

**3. Test Doubles for Complex Dependencies:**

```javascript
// Create a test double with partial implementation
class TestEntityManager {
  constructor() {
    this.entities = new Map();
  }

  createEntity(definition) {
    const id = `test_${Math.random()}`;
    this.entities.set(id, { definition });
    return { id };
  }

  getEntityInstance(id) {
    return this.entities.get(id);
  }
}

const testEntityManager = new TestEntityManager();
```

## Integration Testing Patterns

### AnatomyIntegrationTestBed

The `AnatomyIntegrationTestBed` is the primary test bed for integration tests. It provides a complete anatomy system with real components and minimal mocking.

**Location:** `tests/common/anatomy/anatomyIntegrationTestBed.js`

**Key Features:**
- Real `EntityManager` with component operations
- Complete anatomy service stack (generation, validation, description)
- Data registry pre-loaded with mod data
- Helper methods for common test scenarios

### Basic Integration Test Pattern

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { AnatomyGenerationService } from '../../../src/anatomy/anatomyGenerationService.js';

describe('Recipe Generation - Integration', () => {
  /** @type {AnatomyIntegrationTestBed} */
  let testBed;
  /** @type {AnatomyGenerationService} */
  let anatomyGenerationService;

  beforeEach(async () => {
    // Create test bed and load mod data
    testBed = new AnatomyIntegrationTestBed();
    await testBed.loadAnatomyModData();

    // Get anatomy generation service
    anatomyGenerationService = new AnatomyGenerationService({
      entityManager: testBed.entityManager,
      dataRegistry: testBed.registry,
      logger: testBed.logger,
      bodyBlueprintFactory: testBed.bodyBlueprintFactory,
      anatomyDescriptionService: testBed.anatomyDescriptionService,
      bodyGraphService: testBed.bodyGraphService,
    });
  });

  afterEach(() => {
    if (testBed && testBed.cleanup) {
      testBed.cleanup();
    }
  });

  it('should generate anatomy from recipe', async () => {
    // Arrange: Create actor entity with recipe reference
    const actor = await testBed.createActor({
      recipeId: 'anatomy:human_male',
    });

    // Act: Generate anatomy
    const result = await anatomyGenerationService.generateAnatomyIfNeeded(actor.id);

    // Assert: Verify generation succeeded
    expect(result).toBe(true);

    // Assert: Verify body component was created
    const bodyComponent = testBed.entityManager.getComponentData(
      actor.id,
      'anatomy:body'
    );
    expect(bodyComponent).toBeDefined();
    expect(bodyComponent.body).toBeDefined();
    expect(bodyComponent.body.parts).toBeDefined();
  });

  it('should generate correct number of parts', async () => {
    // Arrange
    const actor = await testBed.createActor({
      recipeId: 'anatomy:human_male',
    });

    // Act
    await anatomyGenerationService.generateAnatomyIfNeeded(actor.id);

    // Assert: Verify expected parts exist
    const bodyComponent = testBed.entityManager.getComponentData(
      actor.id,
      'anatomy:body'
    );

    const parts = Object.values(bodyComponent.body.parts);
    expect(parts.length).toBeGreaterThan(0);

    // Verify specific parts
    const headParts = parts.filter(partId => {
      const partEntity = testBed.entityManager.getEntityInstance(partId);
      const partComponent = partEntity.getComponentData('anatomy:part');
      return partComponent && partComponent.subType === 'head';
    });
    expect(headParts).toHaveLength(1);
  });
});
```

### Real-World Example: Giant Spider Generation

This example from `tests/integration/anatomy/giantSpiderGeneration.test.js` demonstrates comprehensive integration testing:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { AnatomyGenerationService } from '../../../src/anatomy/anatomyGenerationService.js';

describe('Giant Spider Anatomy Generation', () => {
  let testBed;
  let anatomyGenerationService;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.loadAnatomyModData();

    anatomyGenerationService = new AnatomyGenerationService({
      entityManager: testBed.entityManager,
      dataRegistry: testBed.registry,
      logger: testBed.logger,
      bodyBlueprintFactory: testBed.bodyBlueprintFactory,
      anatomyDescriptionService: testBed.anatomyDescriptionService,
      bodyGraphService: testBed.bodyGraphService,
    });
  });

  afterEach(() => {
    if (testBed && testBed.cleanup) {
      testBed.cleanup();
    }
  });

  it('should generate complete spider anatomy with correct part counts', async () => {
    // Arrange: Create spider entity
    const spider = await testBed.createActor({
      recipeId: 'anatomy:giant_forest_spider',
    });

    // Act: Generate spider anatomy
    const result = await anatomyGenerationService.generateAnatomyIfNeeded(spider.id);

    // Assert: Generation succeeded
    expect(result).toBe(true);

    // Assert: Body component exists
    const bodyComponent = testBed.entityManager.getComponentData(
      spider.id,
      'anatomy:body'
    );
    expect(bodyComponent).toBeDefined();
    expect(bodyComponent.body).toBeDefined();
    expect(bodyComponent.body.parts).toBeDefined();
    expect(Object.keys(bodyComponent.body.parts).length).toBeGreaterThan(0);

    // Assert: Verify spider has 8 legs
    const legParts = Object.values(bodyComponent.body.parts).filter(partId => {
      const partEntity = testBed.entityManager.getEntityInstance(partId);
      const partComponent = partEntity.getComponentData('anatomy:part');
      return partComponent && partComponent.subType === 'spider_leg';
    });
    expect(legParts).toHaveLength(8);

    // Assert: Verify spider has 2 pedipalps
    const pedipalpParts = Object.values(bodyComponent.body.parts).filter(partId => {
      const partEntity = testBed.entityManager.getEntityInstance(partId);
      const partComponent = partEntity.getComponentData('anatomy:part');
      return partComponent && partComponent.subType === 'spider_pedipalp';
    });
    expect(pedipalpParts).toHaveLength(2);

    // Assert: Verify spider has 1 abdomen
    const abdomenParts = Object.values(bodyComponent.body.parts).filter(partId => {
      const partEntity = testBed.entityManager.getEntityInstance(partId);
      const partComponent = partEntity.getComponentData('anatomy:part');
      return partComponent && partComponent.subType === 'spider_abdomen';
    });
    expect(abdomenParts).toHaveLength(1);

    // Assert: Verify spider has 1 cephalothorax
    const cephalothoraxParts = Object.values(bodyComponent.body.parts).filter(partId => {
      const partEntity = testBed.entityManager.getEntityInstance(partId);
      const partComponent = partEntity.getComponentData('anatomy:part');
      return partComponent && partComponent.subType === 'spider_cephalothorax';
    });
    expect(cephalothoraxParts).toHaveLength(1);
  });

  it('should verify socket compatibility with entity subTypes', async () => {
    // Arrange
    const spider = await testBed.createActor({
      recipeId: 'anatomy:giant_forest_spider',
    });

    // Act
    await anatomyGenerationService.generateAnatomyIfNeeded(spider.id);

    // Assert: Get the cephalothorax entity (root body part)
    const bodyComponent = testBed.entityManager.getComponentData(
      spider.id,
      'anatomy:body'
    );
    const cephalothoraxPartId = Object.values(bodyComponent.body.parts).find(partId => {
      const partEntity = testBed.entityManager.getEntityInstance(partId);
      const partComponent = partEntity.getComponentData('anatomy:part');
      return partComponent && partComponent.subType === 'spider_cephalothorax';
    });

    expect(cephalothoraxPartId).toBeDefined();

    const cephalothoraxEntity = testBed.entityManager.getEntityInstance(cephalothoraxPartId);
    const socketsComponent = cephalothoraxEntity.getComponentData('anatomy:sockets');

    expect(socketsComponent).toBeDefined();
    expect(socketsComponent.sockets).toBeDefined();

    // Assert: Verify leg sockets allow "spider_leg" type
    const legSockets = socketsComponent.sockets.filter(s => s.id.startsWith('leg_'));
    expect(legSockets).toHaveLength(8);
    legSockets.forEach(socket => {
      expect(socket.allowedTypes).toContain('spider_leg');
    });

    // Assert: Verify pedipalp sockets allow "spider_pedipalp" type
    const pedipalpSockets = socketsComponent.sockets.filter(s => s.id.includes('pedipalp'));
    expect(pedipalpSockets.length).toBeGreaterThanOrEqual(2);
    pedipalpSockets.forEach(socket => {
      expect(socket.allowedTypes).toContain('spider_pedipalp');
    });

    // Assert: Verify abdomen socket allows "spider_abdomen" type
    const abdomenSocket = socketsComponent.sockets.find(s => s.id === 'abdomen');
    expect(abdomenSocket).toBeDefined();
    expect(abdomenSocket.allowedTypes).toContain('spider_abdomen');
  });
});
```

## Test Utilities

### Test Beds

The anatomy system provides three specialized test beds:

#### 1. AnatomyIntegrationTestBed

**Use Case:** Full integration tests with complete anatomy system

**Features:**
- Complete anatomy service stack
- Real `EntityManager` and data registry
- Mod data loading via `loadAnatomyModData()`
- Actor creation via `createActor({ recipeId })`

**Example:**
```javascript
const testBed = new AnatomyIntegrationTestBed();
await testBed.loadAnatomyModData();
const actor = await testBed.createActor({ recipeId: 'anatomy:human_male' });
```

#### 2. SimplifiedAnatomyTestBed

**Use Case:** Lightweight tests without full mod loading

**Features:**
- Minimal service initialization
- Fast setup for focused tests
- Manual data injection

**Example:**
```javascript
const testBed = new SimplifiedAnatomyTestBed();
testBed.registry.setData('anatomy:recipes', [myRecipe]);
```

#### 3. EnhancedAnatomyTestBed

**Use Case:** Extended functionality for advanced scenarios

**Features:**
- Additional helper methods
- Extended validation utilities
- Custom configuration options

### Manual Browser Testing

The anatomy visualizer provides visual validation of generated anatomy:

**URL:** `/anatomy-visualizer.html`

**Usage:**
1. Open the visualizer in a browser
2. Select a recipe from the dropdown
3. Click "Generate" to create anatomy
4. Inspect the visual graph and description
5. Verify parts, connections, and properties

**Best For:**
- Visual validation of complex recipes
- Interactive exploration of anatomy graphs
- Quick prototyping and iteration

## Test Checklist

Use this checklist to ensure comprehensive test coverage for anatomy recipes:

### Stage 1: Schema Validation

- [ ] **JSON Schema Valid**: Recipe passes JSON schema validation
  - Automatic during mod loading via `AjvSchemaValidator`
  - CLI check: `npm run validate`
  - Manual check: Verify recipe structure matches schema

- [ ] **All Required Properties Present**: Recipe includes all required fields
  - Check: `id`, `blueprintId`, `slots` (minimum)
  - Verify: Property types match schema definitions

### Stage 2: Pre-flight Recipe Validation

- [ ] **Pre-flight Validation Passes**: Recipe passes all 9 pre-flight checks
  - Run: `npm run validate:recipe path/to/recipe.json`
  - Validates via `RecipePreflightValidator`
  - **9 Validation Checks:**
    1. Blueprint exists and is valid
    2. All referenced components are registered
    3. Property schemas are valid
    4. Socket compatibility (blueprint sockets match recipe slots)
    5. Part entity definitions exist
    6. Pattern matching rules are valid
    7. Constraints are well-formed
    8. Required slots are properly defined
    9. Count values are valid integers

- [ ] **Components Exist**: All referenced components are registered
  - Check: `anatomy:part`, `anatomy:sockets`, custom components
  - Verify: Components defined in mod's `components/` directory

- [ ] **Entities Defined**: All part entities have definitions
  - Check: Entity definitions exist for all `partType` values
  - Verify: Definitions in mod's `entities/` directory

### Stage 3: Generation-Time Runtime Validation

- [ ] **Graph Generates Without Errors**: Anatomy generation completes successfully
  - Test: Integration test calling `generateAnatomyIfNeeded()`
  - Verify: No runtime exceptions
  - Check: Logs for warnings or errors

- [ ] **All Parts Appear**: Generated anatomy includes expected parts
  - Test: Count parts in `anatomy:body` component
  - Verify: Part counts match recipe slot definitions
  - Check: Part types match expected `subType` values

- [ ] **Pattern Matching Works**: Pattern resolution produces valid results
  - Test: `RecipePatternResolver` integration
  - Verify: Patterns like `*.fingers` resolve correctly
  - Check: Pattern results include expected slots

- [ ] **Constraints Validate**: Runtime constraint evaluation succeeds
  - Test: `RecipeConstraintEvaluator` validation
  - Verify: Constraints (min/max, required) are enforced
  - Check: Invalid configurations are rejected

- [ ] **Description Generated**: Body description is created
  - Test: Check for `anatomy:body` description field
  - Verify: Description includes expected body parts
  - Check: Description formatting is correct

- [ ] **Graph Integrity**: Entity graph passes integrity validation
  - Test: `GraphIntegrityValidator` checks
  - **6 Runtime Validation Rules:**
    1. No orphaned parts (all parts connected to body)
    2. No circular references in part hierarchy
    3. All sockets properly occupied
    4. Socket-part type compatibility
    5. Required parts present
    6. Part count constraints satisfied

### Stage 4: Body Descriptor Validation

- [ ] **Descriptors Valid**: Body descriptor values are valid
  - Run: `npm run validate:body-descriptors`
  - Check: Descriptor values match allowed values
  - Verify: Registry consistency (see [Body Descriptors Guide](./body-descriptors-complete.md))

- [ ] **Formatting Consistent**: Descriptor formatting config is consistent
  - Check: `bodyDescriptionComposerFormatting.js` matches registry
  - Verify: All descriptors have formatters

## CLI Validation Workflow

### Pre-Development Validation

Before writing tests, validate recipe structure using CLI tools:

```bash
# Validate a specific recipe
npm run validate:recipe data/mods/anatomy/recipes/my_recipe.recipe.json

# Validate multiple recipes
npm run validate:recipe data/mods/anatomy/recipes/*.recipe.json

# Verbose output for detailed information
npm run validate:recipe --verbose my_recipe.recipe.json

# JSON output for programmatic use
npm run validate:recipe --json my_recipe.recipe.json
```

**Location:** `scripts/validate-recipe.js`

**What It Validates:**
- Recipe schema compliance
- Blueprint existence and compatibility
- Component registration
- Entity definition availability
- Pattern matching syntax
- Constraint well-formedness

### Body Descriptor Validation

```bash
# Validate body descriptor system consistency
npm run validate:body-descriptors
```

**Location:** `scripts/validate-body-descriptors.js`

**What It Validates:**
- Body Descriptor Registry completeness
- Formatting config consistency
- Recipe descriptor usage
- Allowed values match registry

### Full Mod Validation

```bash
# Validate all mods (includes recipes)
npm run validate

# Strict validation with all checks
npm run validate:strict
```

**What It Validates:**
- All recipe files
- Component schemas
- Entity definitions
- Mod manifest integrity
- Cross-mod dependencies

### Validation Workflow

```
1. Create Recipe
   ↓
2. CLI Validation (validate:recipe)
   ↓ (validation passes)
3. Write Integration Tests
   ↓
4. Run Tests (npm run test:integration)
   ↓ (tests pass)
5. Manual Visual Validation (anatomy-visualizer.html)
   ↓
6. Full Validation (npm run validate)
   ↓
7. Commit
```

## Best Practices

### Test Organization

**1. Group Related Tests:**
```javascript
describe('Giant Spider Anatomy', () => {
  describe('Part Generation', () => {
    it('should generate 8 legs', () => { /* ... */ });
    it('should generate 2 pedipalps', () => { /* ... */ });
  });

  describe('Socket Compatibility', () => {
    it('should validate leg socket types', () => { /* ... */ });
  });
});
```

**2. Use Descriptive Test Names:**
```javascript
// ❌ Bad: Vague and unhelpful
it('should work', () => { /* ... */ });

// ✅ Good: Clear and specific
it('should generate spider anatomy with correct number of legs', () => { /* ... */ });
```

**3. Follow AAA Pattern (Arrange, Act, Assert):**
```javascript
it('should create anatomy from recipe', async () => {
  // Arrange: Setup test data
  const testBed = new AnatomyIntegrationTestBed();
  await testBed.loadAnatomyModData();
  const actor = await testBed.createActor({ recipeId: 'anatomy:test' });

  // Act: Perform the operation
  const result = await service.generateAnatomyIfNeeded(actor.id);

  // Assert: Verify expectations
  expect(result).toBe(true);
});
```

### Test Data Management

**1. Use Realistic Test Data:**
```javascript
// Create test recipes that mirror real use cases
const testRecipe = {
  id: 'anatomy:test_humanoid',
  blueprintId: 'anatomy:humanoid',
  slots: [
    { id: 'head', required: true, count: 1 },
    { id: 'torso', required: true, count: 1 },
    { id: 'arms', required: true, count: 2 },
  ],
};
```

**2. Isolate Test Data:**
```javascript
// Don't modify shared test data
beforeEach(() => {
  testData = JSON.parse(JSON.stringify(originalData)); // Deep clone
});
```

**3. Clean Up After Tests:**
```javascript
afterEach(() => {
  if (testBed && testBed.cleanup) {
    testBed.cleanup();
  }
  jest.clearAllMocks();
});
```

### Assertion Strategies

**1. Test Behavior, Not Implementation:**
```javascript
// ❌ Bad: Tests internal structure
expect(service._internalCache.size).toBe(5);

// ✅ Good: Tests observable behavior
const result = service.getCachedData('key');
expect(result).toBeDefined();
```

**2. Use Specific Assertions:**
```javascript
// ❌ Bad: Weak assertion
expect(parts.length > 0).toBe(true);

// ✅ Good: Precise assertion
expect(parts).toHaveLength(8);
```

**3. Verify Error Conditions:**
```javascript
it('should throw on invalid recipe', () => {
  const invalidRecipe = { /* missing required fields */ };

  expect(() => {
    processor.processRecipe(invalidRecipe);
  }).toThrow('Missing required property: blueprintId');
});
```

### Performance Considerations

**1. Use `beforeEach` for Common Setup:**
```javascript
// Setup runs once per test
beforeEach(async () => {
  testBed = new AnatomyIntegrationTestBed();
  await testBed.loadAnatomyModData();
});
```

**2. Minimize Async Operations:**
```javascript
// Cache heavy operations where possible
let loadedData;

beforeAll(async () => {
  // Load once for all tests
  loadedData = await loadHeavyTestData();
});
```

**3. Use Lightweight Mocks:**
```javascript
// Prefer simple mocks over full implementations
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
};
```

## Common Testing Scenarios

### Testing Non-Human Anatomy

```javascript
describe('Dragon Anatomy Generation', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.loadAnatomyModData();
  });

  it('should generate dragon with wings and tail', async () => {
    const dragon = await testBed.createActor({
      recipeId: 'anatomy:red_dragon',
    });

    await anatomyGenerationService.generateAnatomyIfNeeded(dragon.id);

    const bodyComponent = testBed.entityManager.getComponentData(
      dragon.id,
      'anatomy:body'
    );

    // Verify wings
    const wings = Object.values(bodyComponent.body.parts).filter(partId => {
      const part = testBed.entityManager.getEntityInstance(partId);
      return part.getComponentData('anatomy:part')?.subType === 'wing';
    });
    expect(wings).toHaveLength(2);

    // Verify tail
    const tails = Object.values(bodyComponent.body.parts).filter(partId => {
      const part = testBed.entityManager.getEntityInstance(partId);
      return part.getComponentData('anatomy:part')?.subType === 'tail';
    });
    expect(tails).toHaveLength(1);
  });
});
```

### Testing Pattern Matching

```javascript
describe('Pattern Matching', () => {
  it('should resolve wildcard patterns correctly', async () => {
    const testBed = new AnatomyIntegrationTestBed();
    await testBed.loadAnatomyModData();

    const actor = await testBed.createActor({
      recipeId: 'anatomy:human_with_fingers',
    });

    await anatomyGenerationService.generateAnatomyIfNeeded(actor.id);

    const bodyComponent = testBed.entityManager.getComponentData(
      actor.id,
      'anatomy:body'
    );

    // Verify pattern "*.fingers" resolved to all hand fingers
    const fingers = Object.values(bodyComponent.body.parts).filter(partId => {
      const part = testBed.entityManager.getEntityInstance(partId);
      const partComp = part.getComponentData('anatomy:part');
      return partComp?.subType === 'finger';
    });

    // Expect 10 fingers (5 per hand, 2 hands)
    expect(fingers).toHaveLength(10);
  });
});
```

### Testing Error Conditions

```javascript
describe('Error Handling', () => {
  it('should handle missing blueprint gracefully', async () => {
    const testBed = new AnatomyIntegrationTestBed();
    await testBed.loadAnatomyModData();

    const actor = await testBed.createActor({
      recipeId: 'anatomy:invalid_recipe',
    });

    // Should throw or return false
    await expect(
      anatomyGenerationService.generateAnatomyIfNeeded(actor.id)
    ).rejects.toThrow(/blueprint.*not found/i);

    // Verify error was logged
    expect(testBed.logger.error).toHaveBeenCalled();
  });

  it('should reject incompatible socket types', async () => {
    const testBed = new AnatomyIntegrationTestBed();

    // Create recipe with mismatched socket types
    const invalidRecipe = {
      id: 'anatomy:invalid',
      blueprintId: 'anatomy:humanoid',
      slots: [
        {
          id: 'head',
          partType: 'spider_leg', // Wrong type for head socket
          count: 1
        },
      ],
    };

    testBed.registry.setData('anatomy:recipes', [invalidRecipe]);

    const actor = await testBed.createActor({
      recipeId: 'anatomy:invalid',
    });

    // Should fail during generation
    await expect(
      anatomyGenerationService.generateAnatomyIfNeeded(actor.id)
    ).rejects.toThrow(/socket.*type.*mismatch/i);
  });
});
```

### Testing Optional Parts

```javascript
describe('Optional Parts', () => {
  it('should handle optional slots correctly', async () => {
    const testBed = new AnatomyIntegrationTestBed();
    await testBed.loadAnatomyModData();

    const spider = await testBed.createActor({
      recipeId: 'anatomy:giant_forest_spider',
    });

    await anatomyGenerationService.generateAnatomyIfNeeded(spider.id);

    const bodyComponent = testBed.entityManager.getComponentData(
      spider.id,
      'anatomy:body'
    );

    // Spinnerets are optional
    const spinnerets = Object.values(bodyComponent.body.parts).filter(partId => {
      const part = testBed.entityManager.getEntityInstance(partId);
      return part.getComponentData('anatomy:part')?.subType === 'spinneret';
    });

    // Should be 0 or 1 (optional)
    expect(spinnerets.length).toBeLessThanOrEqual(1);
  });
});
```

### Testing Body Descriptors

```javascript
describe('Body Descriptors', () => {
  it('should apply descriptor values from recipe', async () => {
    const testBed = new AnatomyIntegrationTestBed();
    await testBed.loadAnatomyModData();

    const actor = await testBed.createActor({
      recipeId: 'anatomy:tall_human',
    });

    await anatomyGenerationService.generateAnatomyIfNeeded(actor.id);

    const bodyComponent = testBed.entityManager.getComponentData(
      actor.id,
      'anatomy:body'
    );

    // Verify height descriptor
    expect(bodyComponent.body.height).toBe('tall');

    // Verify descriptor in description
    expect(bodyComponent.body.description).toMatch(/tall/i);
  });

  it('should validate descriptor values', async () => {
    const testBed = new AnatomyIntegrationTestBed();

    // Create recipe with invalid descriptor
    const invalidRecipe = {
      id: 'anatomy:invalid_descriptors',
      blueprintId: 'anatomy:humanoid',
      descriptors: {
        height: 'super_ultra_mega_tall', // Invalid value
      },
      slots: [],
    };

    testBed.registry.setData('anatomy:recipes', [invalidRecipe]);

    const actor = await testBed.createActor({
      recipeId: 'anatomy:invalid_descriptors',
    });

    // Should fail validation
    await expect(
      anatomyGenerationService.generateAnatomyIfNeeded(actor.id)
    ).rejects.toThrow(/invalid.*descriptor/i);
  });
});
```

---

## Summary

Following these testing patterns ensures:

- ✅ **Reliable Tests**: Consistent, repeatable test results
- ✅ **Early Error Detection**: Catch issues before runtime
- ✅ **Maintainable Tests**: Clear structure and organization
- ✅ **Comprehensive Coverage**: Unit, integration, and CLI validation
- ✅ **Confidence**: Deploy anatomy changes with assurance

**Next Steps:**
1. Review [Validation Workflow](./validation-workflow.md) for complete pipeline details
2. Check [Recipe Creation Checklist](./recipe-creation-checklist.md) for development workflow
3. Reference [Common Errors](./common-errors.md) for troubleshooting
4. Explore [Anatomy System Guide](./anatomy-system-guide.md) for architecture details

**Need Help?**
- Consult [Troubleshooting Guide](./troubleshooting.md) for common issues
- Review existing tests in `tests/integration/anatomy/` for examples
- Check test utilities in `tests/common/anatomy/` for available helpers
