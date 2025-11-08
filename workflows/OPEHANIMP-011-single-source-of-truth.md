# OPEHANIMP-011: Design and Prototype Single Source of Truth Architecture

**Priority**: Medium
**Effort**: High
**Phase**: 3 (Month 1)
**Dependencies**: OPEHANIMP-007, OPEHANIMP-008

## Objective

Design and prototype a "single source of truth" architecture where all operation metadata is defined in one central location, and all registrations are automatically generated or derived from this source.

## Background

Currently, operation metadata is scattered across 7+ files with manual synchronization. A single source of truth would:
- Eliminate synchronization errors
- Reduce manual work
- Enable automatic code generation
- Provide clear documentation
- Simplify adding new operations

### Current Codebase Conventions

**IMPORTANT: Operation Handler Token Naming**

The codebase uses a specific naming convention for operation handler tokens that differs from other service interfaces:

- **Operation Handlers**: Use `[OperationName]Handler` pattern (NO "I" prefix)
  - Examples: `DrinkFromHandler`, `AddComponentHandler`, `DrinkEntirelyHandler`

- **Other Service Interfaces**: Use `I[ServiceName]` pattern (WITH "I" prefix)
  - Examples: `ILogger`, `IEntityManager`, `ISafeEventDispatcher`

This convention is documented in:
- `src/dependencyInjection/tokens/tokens-core.js` (lines 13-20)
- `src/utils/preValidationUtils.js` (lines 623-632)
- `CLAUDE.md` "Adding New Operations" section

**Event Patterns**

Handlers typically dispatch domain-specific events (not generic success/failure):
- `items:liquid_consumed` (DrinkFromHandler)
- `items:liquid_consumed_entirely` (DrinkEntirelyHandler)
- `core:component_added` (dispatched by EntityManager, not AddComponentHandler)

Handlers use `ISafeEventDispatcher` for error events only.

## Requirements

### 1. Research Phase

#### Evaluate Approaches

**Option A: Central JavaScript Registry**

```javascript
// src/operations/registry/operationDefinitions.js

export const OPERATION_DEFINITIONS = {
  DRINK_FROM: {
    type: 'DRINK_FROM',
    handlerClass: 'DrinkFromHandler',
    handlerToken: 'DrinkFromHandler', // NOTE: No "I" prefix for operation handlers
    schemaPath: 'data/schemas/operations/drinkFrom.schema.json',
    category: 'items',
    description: 'Drink from a container or drinkable item',
    dependencies: [
      'ILogger',
      'IEntityManager',
      'ISafeEventDispatcher',
    ],
    events: {
      dispatches: ['items:liquid_consumed'], // Domain event, not success/failure pattern
    },
    parameters: [
      {
        name: 'actorEntity',
        type: 'string',
        required: true,
        description: 'Entity ID of the actor drinking from the container',
      },
      {
        name: 'containerEntity',
        type: 'string',
        required: true,
        description: 'Entity ID of the liquid container being consumed from',
      },
      {
        name: 'result_variable',
        type: 'string',
        required: false,
        description: 'Optional variable name to store operation result',
      },
    ],
  },

  DRINK_ENTIRELY: {
    type: 'DRINK_ENTIRELY',
    handlerClass: 'DrinkEntirelyHandler',
    handlerToken: 'DrinkEntirelyHandler', // NOTE: No "I" prefix for operation handlers
    schemaPath: 'data/schemas/operations/drinkEntirely.schema.json',
    category: 'items',
    description: 'Drink all remaining liquid from an item',
    dependencies: [
      'ILogger',
      'IEntityManager',
      'ISafeEventDispatcher',
    ],
    events: {
      dispatches: ['items:liquid_consumed_entirely'], // Domain event, not success/failure pattern
    },
    parameters: [
      {
        name: 'actorEntity',
        type: 'string',
        required: true,
        description: 'Entity ID of the actor drinking from the container',
      },
      {
        name: 'containerEntity',
        type: 'string',
        required: true,
        description: 'Entity ID of the liquid container being consumed from',
      },
      {
        name: 'result_variable',
        type: 'string',
        required: false,
        description: 'Optional variable name to store operation result',
      },
    ],
  },

  // ... other operations
};

// Auto-generate arrays and registrations from definitions
export const KNOWN_OPERATION_TYPES = Object.keys(OPERATION_DEFINITIONS);

export const tokens = Object.values(OPERATION_DEFINITIONS).reduce((acc, def) => {
  acc[def.handlerToken] = def.handlerToken;
  return acc;
}, {});
```

**Pros**:
- Pure JavaScript, no build step
- Easy to understand and maintain
- Can be imported directly
- IDE support with JSDoc

**Cons**:
- Redundancy (have to maintain both registry and handler files)
- No compile-time validation
- Still requires schemas to be separate

**Option B: Schema-First Approach**

Enhance schemas with metadata, generate everything else:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://living-narrative-engine/schemas/operations/drinkFrom.schema.json",
  "description": "Drink from a container or drinkable item",
  "meta": {
    "handlerClass": "DrinkFromHandler",
    "handlerToken": "DrinkFromHandler",
    "category": "items",
    "dependencies": [
      "ILogger",
      "IEntityManager",
      "ISafeEventDispatcher"
    ],
    "events": {
      "dispatches": ["items:liquid_consumed"]
    },
    "stateQueries": ["items:liquid_container", "items:drinkable"],
    "stateMutations": ["items:liquid_container"]
  },
  "allOf": [...]
}
```

Generate from schemas:
- Handler boilerplate
- Token definitions
- All registrations
- Documentation

**Pros**:
- Schema is already required
- Single source for structure and metadata
- Can generate code, tests, docs
- Validation built-in

**Cons**:
- Build step required
- Less intuitive for pure code developers
- Mixing structure and metadata in JSON

**Option C: TypeScript Definitions**

Use TypeScript decorators and metadata:

```typescript
@OperationHandler({
  type: 'DRINK_FROM',
  token: 'DrinkFromHandler', // No "I" prefix for operation handlers
  category: 'items',
  description: 'Drink from a container or drinkable item',
  events: {
    dispatches: ['items:liquid_consumed']
  }
})
export class DrinkFromHandler extends BaseOperationHandler {
  @Inject() logger: ILogger;
  @Inject() entityManager: IEntityManager;
  @Inject() safeEventDispatcher: ISafeEventDispatcher;

  async execute(params: DrinkFromParams, context: ExecutionContext): Promise<DrinkFromResult> {
    // Implementation
  }
}
```

Auto-register via reflection at runtime.

**Pros**:
- Type safety
- IDE support
- Modern pattern
- Auto-registration

**Cons**:
- Requires TypeScript migration
- More complex setup
- Runtime reflection overhead

#### Recommendation Matrix

| Criterion | Option A (JS Registry) | Option B (Schema-First) | Option C (TypeScript) |
|-----------|------------------------|-------------------------|------------------------|
| Implementation Effort | Low | Medium | High |
| Maintainability | Medium | High | High |
| Developer Experience | Good | Medium | Excellent |
| Type Safety | No | No | Yes |
| Auto-generation | Limited | Extensive | Extensive |
| Migration Path | Easy | Medium | Hard |

### 2. Prototype Implementation

Implement a proof-of-concept for the recommended approach.

#### Prototype Scope

1. Implement central registry for 3 operations (DRINK_FROM, DRINK_ENTIRELY, ADD_COMPONENT)
2. Auto-generate:
   - KNOWN_OPERATION_TYPES array
   - Token definitions
   - Handler registrations
   - Operation mappings
3. Validate approach works with existing code
4. Measure performance impact
5. Document migration path

#### Prototype Structure (Option A: JS Registry)

**File**: `src/operations/registry/operationDefinitions.js`

```javascript
/**
 * Single Source of Truth for Operation Definitions
 *
 * All operation metadata is defined here. Registrations are auto-generated.
 *
 * When adding a new operation:
 * 1. Add definition to OPERATION_DEFINITIONS
 * 2. Create handler class file
 * 3. Create schema file (or generate from definition)
 * 4. Run npm run generate:registrations
 *
 * @see docs/architecture/single-source-of-truth.md
 */

/**
 * @typedef {Object} OperationDefinition
 * @property {string} type - Operation type constant (UPPER_SNAKE_CASE)
 * @property {string} handlerClass - Handler class name (PascalCase)
 * @property {string} handlerToken - DI token name (PascalCase + Handler, NO "I" prefix)
 * @property {string} schemaPath - Path to operation schema
 * @property {string} category - Operation category (items, positioning, etc.)
 * @property {string} description - Human-readable description
 * @property {string[]} dependencies - Required DI dependencies (use "I" prefix for services, not for operation handlers)
 * @property {Object} events - Events dispatched by handler
 * @property {string[]} events.dispatches - Domain event IDs dispatched (e.g., 'items:liquid_consumed')
 * @property {Array<Object>} parameters - Operation parameters
 */

export const OPERATION_DEFINITIONS = {
  ADD_COMPONENT: {
    type: 'ADD_COMPONENT',
    handlerClass: 'AddComponentHandler',
    handlerToken: 'AddComponentHandler', // NOTE: No "I" prefix for operation handlers
    schemaPath: 'data/schemas/operations/addComponent.schema.json',
    category: 'core',
    description: 'Add a component to an entity',
    dependencies: [
      'ILogger',
      'IEntityManager',
      'ISafeEventDispatcher',
      'IGameDataRepository', // Optional dependency
    ],
    events: {
      // EntityManager dispatches core:component_added via internal systems
      // Handler itself doesn't dispatch success/failure events
      dispatches: [], // Dispatches errors via ISafeEventDispatcher only
    },
    parameters: [
      { name: 'entity_ref', type: 'string|object', required: true, description: 'Reference to the entity (actor/target/entityId)' },
      { name: 'component_type', type: 'string', required: true, description: 'Namespaced component type ID' },
      { name: 'value', type: 'object', required: true, description: 'Component data object' },
    ],
  },

  DRINK_FROM: {
    type: 'DRINK_FROM',
    handlerClass: 'DrinkFromHandler',
    handlerToken: 'IDrinkFromHandler',
    schemaPath: 'data/schemas/operations/drinkFrom.schema.json',
    category: 'items',
    description: 'Drink from a container or drinkable item',
    dependencies: [
      'IComponentMutationService',
      'IEntityStateQuerier',
    ],
    events: {
      success: 'DRINK_FROM_COMPLETED',
      failure: 'DRINK_FROM_FAILED',
    },
    parameters: [
      { name: 'drinkableItemId', type: 'string', required: true },
      { name: 'consumptionQuantity', type: 'number', required: false, default: 1 },
    ],
  },

  DRINK_ENTIRELY: {
    type: 'DRINK_ENTIRELY',
    handlerClass: 'DrinkEntirelyHandler',
    handlerToken: 'IDrinkEntirelyHandler',
    schemaPath: 'data/schemas/operations/drinkEntirely.schema.json',
    category: 'items',
    description: 'Drink all remaining liquid from an item',
    dependencies: [
      'IComponentMutationService',
      'IEntityStateQuerier',
    ],
    events: {
      success: 'DRINK_ENTIRELY_COMPLETED',
      failure: 'DRINK_ENTIRELY_FAILED',
    },
    parameters: [
      { name: 'drinkableItemId', type: 'string', required: true },
    ],
  },
};

/**
 * Auto-generated array of operation types
 * Used by pre-validation whitelist
 */
export const KNOWN_OPERATION_TYPES = Object.keys(OPERATION_DEFINITIONS).sort();

/**
 * Auto-generated token definitions
 * Used by DI container
 */
export const generateTokens = () => {
  return Object.values(OPERATION_DEFINITIONS).reduce((acc, def) => {
    // NOTE: Operation handler tokens do NOT use "I" prefix
    // Pattern: [OperationName]Handler (e.g., DrinkFromHandler, not IDrinkFromHandler)
    acc[def.handlerToken] = def.handlerToken;
    return acc;
  }, {});
};

/**
 * Auto-generate handler registrations code
 * Used by registration generator
 */
export const generateHandlerRegistrations = () => {
  const lines = [
    '// AUTO-GENERATED - DO NOT EDIT MANUALLY',
    '// Generated from src/operations/registry/operationDefinitions.js',
    '',
  ];

  // Generate imports
  for (const def of Object.values(OPERATION_DEFINITIONS)) {
    const fileName = def.handlerClass.charAt(0).toLowerCase() + def.handlerClass.slice(1) + '.js';
    lines.push(`import ${def.handlerClass} from '../../logic/operationHandlers/${fileName}';`);
  }

  lines.push('');
  lines.push('export function registerOperationHandlers(container) {');

  // Generate registrations
  for (const def of Object.values(OPERATION_DEFINITIONS)) {
    lines.push(`  container.register(tokens.${def.handlerToken}, ${def.handlerClass});`);
  }

  lines.push('}');

  return lines.join('\n');
};

/**
 * Auto-generate operation mappings code
 */
export const generateOperationMappings = () => {
  const lines = [
    '// AUTO-GENERATED - DO NOT EDIT MANUALLY',
    '// Generated from src/operations/registry/operationDefinitions.js',
    '',
    'export function registerOperationMappings(container, operationRegistry) {',
  ];

  for (const def of Object.values(OPERATION_DEFINITIONS)) {
    lines.push(`  operationRegistry.registerOperation('${def.type}', tokens.${def.handlerToken});`);
  }

  lines.push('}');

  return lines.join('\n');
};

/**
 * Get operation definition by type
 */
export function getOperationDefinition(operationType) {
  return OPERATION_DEFINITIONS[operationType] || null;
}

/**
 * Get all operation definitions for a category
 */
export function getOperationsByCategory(category) {
  return Object.values(OPERATION_DEFINITIONS).filter(def => def.category === category);
}
```

**Generator Script**: `scripts/generateRegistrations.js`

```javascript
#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import {
  generateTokens,
  generateHandlerRegistrations,
  generateOperationMappings,
  OPERATION_DEFINITIONS,
} from '../src/operations/registry/operationDefinitions.js';

console.log('🔧 Generating operation registrations from single source of truth...\n');

// Generate tokens file
console.log('📝 Generating tokens...');
const tokensCode = generateTokensFile();
fs.writeFileSync('src/dependencyInjection/tokens/tokens-operations.generated.js', tokensCode);
console.log('  ✅ Generated src/dependencyInjection/tokens/tokens-operations.generated.js');

// Generate handler registrations
console.log('\n📝 Generating handler registrations...');
const registrationsCode = generateHandlerRegistrations();
fs.writeFileSync('src/dependencyInjection/registrations/operationHandlerRegistrations.generated.js', registrationsCode);
console.log('  ✅ Generated src/dependencyInjection/registrations/operationHandlerRegistrations.generated.js');

// Generate operation mappings
console.log('\n📝 Generating operation mappings...');
const mappingsCode = generateOperationMappings();
fs.writeFileSync('src/dependencyInjection/registrations/interpreterRegistrations.generated.js', mappingsCode);
console.log('  ✅ Generated src/dependencyInjection/registrations/interpreterRegistrations.generated.js');

// Update pre-validation utils
console.log('\n📝 Updating pre-validation whitelist...');
updatePreValidationWhitelist();
console.log('  ✅ Updated src/utils/preValidationUtils.js');

console.log('\n✅ Registration generation complete!');
console.log(`📊 ${Object.keys(OPERATION_DEFINITIONS).length} operations processed`);

function generateTokensFile() {
  const tokens = generateTokens();
  const lines = [
    '// AUTO-GENERATED - DO NOT EDIT MANUALLY',
    '// Generated from src/operations/registry/operationDefinitions.js',
    '// Run npm run generate:registrations to regenerate',
    '',
    'export const operationTokens = {',
  ];

  for (const [key, value] of Object.entries(tokens).sort()) {
    lines.push(`  ${key}: '${value}',`);
  }

  lines.push('};');

  return lines.join('\n');
}

function updatePreValidationWhitelist() {
  // Read current file
  const filePath = 'src/utils/preValidationUtils.js';
  let content = fs.readFileSync(filePath, 'utf8');

  // Import from registry
  const importStatement = "import { KNOWN_OPERATION_TYPES } from '../operations/registry/operationDefinitions.js';";

  // Replace or add import
  if (!content.includes(importStatement)) {
    content = importStatement + '\n\n' + content;
  }

  // Remove old KNOWN_OPERATION_TYPES definition
  content = content.replace(/const KNOWN_OPERATION_TYPES = \[[\s\S]*?\];/, '// KNOWN_OPERATION_TYPES imported from registry');

  fs.writeFileSync(filePath, content);
}
```

### 3. Evaluation Criteria

Evaluate the prototype against these criteria:

1. **Developer Experience**
   - Is it easier to add operations?
   - Is it clear where to make changes?
   - Does it reduce cognitive load?

2. **Maintainability**
   - Is synchronization automatic?
   - Are errors caught early?
   - Is the code self-documenting?

3. **Performance**
   - What is the build time impact?
   - What is the runtime impact?
   - Is the impact acceptable?

4. **Migration Path**
   - Can existing operations migrate incrementally?
   - What is the effort to migrate one operation?
   - What is the effort to migrate all operations?

5. **Extensibility**
   - Can new metadata be added easily?
   - Does it support future requirements?
   - Is it flexible for different operation types?

### 4. Documentation

Create comprehensive documentation:

**File**: `docs/architecture/single-source-of-truth.md`

Document:
- Architecture overview
- How it works
- Adding new operations
- Migration guide
- Troubleshooting
- Performance considerations
- Future enhancements

## Deliverables

- [ ] Research document comparing 3 approaches
- [ ] Recommendation with rationale
- [ ] Prototype implementation (3 operations)
- [ ] Generator script
- [ ] Evaluation report
- [ ] Architecture documentation
- [ ] Migration guide
- [ ] Presentation to team for feedback

## Acceptance Criteria

- [ ] All three approaches evaluated thoroughly
- [ ] Clear recommendation with pros/cons
- [ ] Working prototype demonstrates concept
- [ ] Generator script produces valid code
- [ ] Performance measured and documented
- [ ] Migration path is clear and feasible
- [ ] Team feedback incorporated
- [ ] Decision made on whether to proceed

## Testing

### Prototype Tests

1. Generate registrations from definitions
2. Verify generated code is syntactically valid
3. Verify generated code matches manual code
4. Run existing tests with generated code
5. Measure performance impact

### Migration Test

1. Migrate one operation to new pattern
2. Verify all tests pass
3. Verify no functionality changes
4. Document time and effort

## Time Estimate

2-3 weeks (research, prototype, evaluation, documentation)

## Related Tickets

- OPEHANIMP-012: Schema-driven code generation (related approach)
- OPEHANIMP-013: Auto-discovery registration (alternative approach)

## Success Metrics

- Clear recommendation made
- Team consensus on approach
- Prototype validates concept
- Migration path is feasible
- Decision to proceed or not is data-driven
