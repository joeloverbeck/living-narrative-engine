# OPEHANIMP-013: Implement Auto-Discovery Registration Pattern

**Priority**: Low
**Effort**: Medium
**Phase**: 3 (Month 2-3)
**Dependencies**: OPEHANIMP-011

## Objective

Implement an auto-discovery registration pattern where operation handlers are automatically discovered and registered based on file system conventions and metadata, eliminating manual registration files entirely.

## Background

Convention-over-configuration pattern used successfully by frameworks like Rails, Spring, and NestJS. Handlers are discovered at runtime or build-time based on:
- File location and naming
- Class metadata (static properties or decorators)
- Automatic registration without manual configuration

## Requirements

### 1. Research Phase

#### Discovery Approaches

**Approach A: Static Metadata on Classes**

```javascript
// src/logic/operationHandlers/drinkFromHandler.js

class DrinkFromHandler extends BaseOperationHandler {
  // Static metadata for auto-discovery
  static operationType = 'DRINK_FROM';
  static token = 'IDrinkFromHandler';
  static category = 'items';
  static dependencies = ['IComponentMutationService', 'IEntityStateQuerier'];

  // ... implementation
}

export default DrinkFromHandler;
```

**Approach B: File System Convention**

```
src/logic/operationHandlers/
├── items/
│   ├── drinkFrom.handler.js        # Operation type derived from filename
│   └── drinkEntirely.handler.js
├── positioning/
│   ├── sitDown.handler.js
│   └── standUp.handler.js
└── core/
    ├── addComponent.handler.js
    └── removeComponent.handler.js
```

Category from directory, operation type from filename.

**Approach C: Decorator Pattern (requires TypeScript)**

```typescript
@Operation({
  type: 'DRINK_FROM',
  category: 'items',
})
export class DrinkFromHandler extends BaseOperationHandler {
  @Inject() componentMutationService: IComponentMutationService;
  @Inject() entityStateQuerier: IEntityStateQuerier;

  // ... implementation
}
```

### 2. Auto-Discovery Implementation

**Discovery Service**: `src/operations/discovery/operationDiscovery.js`

```javascript
/**
 * Automatic Operation Handler Discovery Service
 *
 * Discovers and registers operation handlers based on:
 * - File system location
 * - Static class metadata
 * - Naming conventions
 *
 * No manual registration required.
 */

import glob from 'glob';
import path from 'path';

/**
 * Discovers all operation handlers in the project
 *
 * @param {string} [basePath='src/logic/operationHandlers'] - Base directory to scan
 * @returns {Array<OperationHandlerMetadata>} Discovered handlers
 */
export function discoverOperationHandlers(basePath = 'src/logic/operationHandlers') {
  const handlerFiles = glob.sync(`${basePath}/**/*.handler.js`);
  const handlers = [];

  for (const filePath of handlerFiles) {
    try {
      // Dynamic import of handler
      const handlerModule = require(path.resolve(filePath));
      const HandlerClass = handlerModule.default;

      // Extract metadata
      if (HandlerClass && HandlerClass.operationType) {
        const metadata = extractHandlerMetadata(HandlerClass, filePath);
        handlers.push(metadata);
      } else {
        console.warn(`Handler ${filePath} missing static operationType`);
      }
    } catch (error) {
      console.error(`Failed to load handler ${filePath}:`, error);
    }
  }

  return handlers;
}

/**
 * Extract metadata from handler class
 */
function extractHandlerMetadata(HandlerClass, filePath) {
  // Extract from static properties
  const operationType = HandlerClass.operationType;
  const token = HandlerClass.token || generateTokenName(operationType);
  const category = HandlerClass.category || extractCategoryFromPath(filePath);
  const dependencies = HandlerClass.dependencies || [];

  return {
    operationType,
    token,
    category,
    dependencies,
    HandlerClass,
    filePath,
  };
}

/**
 * Auto-generate token name from operation type
 */
function generateTokenName(operationType) {
  return 'I' + operationType.split('_').map(word =>
    word.charAt(0) + word.slice(1).toLowerCase()
  ).join('') + 'Handler';
}

/**
 * Extract category from file path
 * e.g., src/logic/operationHandlers/items/drinkFrom.handler.js → items
 */
function extractCategoryFromPath(filePath) {
  const parts = filePath.split(path.sep);
  const handlersIndex = parts.indexOf('operationHandlers');

  if (handlersIndex !== -1 && parts.length > handlersIndex + 2) {
    return parts[handlersIndex + 1]; // Category directory
  }

  return 'core'; // Default category
}

/**
 * Auto-register discovered handlers with DI container
 */
export function autoRegisterHandlers(container, handlers) {
  const operationRegistry = container.resolve('IOperationRegistry');

  for (const handler of handlers) {
    // Register handler class with container
    container.register(handler.token, handler.HandlerClass);

    // Map operation type to handler
    operationRegistry.registerOperation(handler.operationType, handler.token);

    console.debug('Auto-registered operation handler', {
      operationType: handler.operationType,
      token: handler.token,
      category: handler.category,
    });
  }

  console.log(`✅ Auto-registered ${handlers.length} operation handlers`);
}

/**
 * Generate KNOWN_OPERATION_TYPES from discovered handlers
 */
export function generateOperationTypes(handlers) {
  return handlers.map(h => h.operationType).sort();
}
```

**Bootstrap Integration**: `src/main.js`

```javascript
import { discoverOperationHandlers, autoRegisterHandlers } from './operations/discovery/operationDiscovery.js';

// During app initialization
export function initializeOperations(container) {
  console.log('🔍 Discovering operation handlers...');

  // Discover all handlers
  const handlers = discoverOperationHandlers();

  // Auto-register with container
  autoRegisterHandlers(container, handlers);

  // Generate whitelist for validation
  const knownTypes = generateOperationTypes(handlers);

  console.log(`✅ Initialized ${handlers.length} operations`);

  return { handlers, knownTypes };
}
```

### 3. Handler Template with Metadata

**Updated Handler Pattern**:

```javascript
/**
 * @file Handler for DRINK_FROM operation
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { validateDependency, assertPresent } from '../utils/dependencyUtils.js';

/**
 * Handles DRINK_FROM operation execution
 *
 * @extends BaseOperationHandler
 */
class DrinkFromHandler extends BaseOperationHandler {
  // ===== AUTO-DISCOVERY METADATA =====
  // These static properties enable automatic registration
  static operationType = 'DRINK_FROM';
  static token = 'IDrinkFromHandler';  // Optional: auto-generated if not specified
  static category = 'items';            // Optional: derived from directory if not specified
  static dependencies = [               // Optional: for documentation
    'IComponentMutationService',
    'IEntityStateQuerier',
  ];
  // ====================================

  #componentMutationService;
  #entityStateQuerier;

  constructor({ componentMutationService, entityStateQuerier, logger, eventBus }) {
    super({ logger, eventBus });

    validateDependency(componentMutationService, 'IComponentMutationService', logger, {
      requiredMethods: ['updateComponent', 'removeComponent'],
    });
    validateDependency(entityStateQuerier, 'IEntityStateQuerier', logger, {
      requiredMethods: ['getEntity', 'hasComponent'],
    });

    this.#componentMutationService = componentMutationService;
    this.#entityStateQuerier = entityStateQuerier;
  }

  async execute(context) {
    // ... implementation
  }
}

export default DrinkFromHandler;
```

### 4. Migration Strategy

**Phase 1: Add Metadata to Existing Handlers**

- Add static properties to all existing handlers
- Keep manual registrations in place
- Both systems work in parallel

**Phase 2: Verify Auto-Discovery**

- Run auto-discovery alongside manual registration
- Compare results
- Fix any discrepancies

**Phase 3: Switch to Auto-Discovery**

- Enable auto-discovery as primary registration
- Remove manual registration files
- Update documentation

**Phase 4: Cleanup**

- Delete obsolete registration files
- Update tooling and scripts
- Complete migration

### 5. Tooling Support

**Validation Script**: `scripts/validateAutoDiscovery.js`

```javascript
#!/usr/bin/env node

/**
 * Validates auto-discovery metadata on all handlers
 */

import { discoverOperationHandlers } from '../src/operations/discovery/operationDiscovery.js';

console.log('🔍 Validating auto-discovery metadata...\n');

const handlers = discoverOperationHandlers();

let errors = 0;

for (const handler of handlers) {
  const issues = [];

  // Check required metadata
  if (!handler.operationType) {
    issues.push('Missing operationType');
  }

  if (!handler.token) {
    issues.push('Missing or invalid token');
  }

  if (!handler.category) {
    issues.push('Missing category');
  }

  // Check naming conventions
  const expectedToken = generateTokenName(handler.operationType);
  if (handler.token !== expectedToken) {
    issues.push(`Token mismatch: expected ${expectedToken}, got ${handler.token}`);
  }

  // Report issues
  if (issues.length > 0) {
    console.log(`❌ ${handler.filePath}`);
    issues.forEach(issue => console.log(`   - ${issue}`));
    console.log();
    errors++;
  }
}

if (errors === 0) {
  console.log(`✅ All ${handlers.length} handlers have valid metadata`);
} else {
  console.log(`❌ Found issues in ${errors} handler(s)`);
  process.exit(1);
}
```

**CLI Tool Update**: Update `create-operation` to generate handler with metadata

```javascript
// Generated handler includes static metadata
class ${HandlerClass} extends BaseOperationHandler {
  static operationType = '${OPERATION_TYPE}';
  static token = '${TOKEN_NAME}';
  static category = '${CATEGORY}';

  // ... rest of handler
}
```

## Acceptance Criteria

- [ ] Discovery service finds all handlers automatically
- [ ] Handlers are registered without manual configuration
- [ ] Static metadata pattern is clear and documented
- [ ] Migration path from manual to auto-discovery is safe
- [ ] Validation script ensures metadata correctness
- [ ] Performance impact is acceptable (<100ms startup cost)
- [ ] CLI tool generates handlers with correct metadata
- [ ] All existing handlers migrated successfully
- [ ] Tests verify auto-discovery works correctly

## Testing

### Discovery Tests

**File**: `tests/unit/operations/discovery/operationDiscovery.test.js`

```javascript
describe('Operation Discovery', () => {
  it('should discover all handlers with metadata', () => {
    const handlers = discoverOperationHandlers('tests/fixtures/handlers');
    expect(handlers).toHaveLength(3);
  });

  it('should extract correct metadata', () => {
    const handlers = discoverOperationHandlers('tests/fixtures/handlers');
    const drinkFrom = handlers.find(h => h.operationType === 'DRINK_FROM');

    expect(drinkFrom).toBeDefined();
    expect(drinkFrom.token).toBe('IDrinkFromHandler');
    expect(drinkFrom.category).toBe('items');
  });

  it('should auto-generate token if not specified', () => {
    // Test with handler missing static token
    const handlers = discoverOperationHandlers('tests/fixtures/handlers-no-token');
    const handler = handlers[0];

    expect(handler.token).toBe('IDrinkFromHandler');
  });
});

describe('Auto-Registration', () => {
  it('should register all discovered handlers', () => {
    const handlers = discoverOperationHandlers('tests/fixtures/handlers');
    const mockContainer = createMockContainer();
    const mockRegistry = createMockRegistry();

    autoRegisterHandlers(mockContainer, handlers);

    expect(mockContainer.register).toHaveBeenCalledTimes(3);
    expect(mockRegistry.registerOperation).toHaveBeenCalledTimes(3);
  });
});
```

## Time Estimate

2-3 weeks (implementation, migration, testing)

## Related Tickets

- OPEHANIMP-011: Single source of truth (alternative approach)
- OPEHANIMP-007: CLI scaffolding (needs update for metadata)

## Success Metrics

- Zero manual registration files
- Handler addition requires only creating handler file
- Discovery time <100ms
- All handlers discovered correctly
- Team adoption and satisfaction
