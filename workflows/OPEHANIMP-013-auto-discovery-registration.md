# OPEHANIMP-013: Implement Auto-Discovery Registration Pattern

**Priority**: Low
**Effort**: Medium
**Phase**: 3 (Month 2-3)
**Dependencies**: OPEHANIMP-011

**⚠️ STATUS: REQUIRES MAJOR REVISION - ASSUMPTIONS INCORRECT**

---

## Codebase Assumptions Review (2025-01-08)

This workflow file made several incorrect assumptions about the current codebase architecture. Below are the critical discrepancies that must be addressed before implementation:

### Critical Architectural Discrepancies

1. **❌ Browser vs Node Environment**
   - **Assumed**: Node.js runtime with file system access (`require()`, `glob.sync()`, `fs`)
   - **Reality**: Browser-based application - main app runs in browser, not Node.js
   - **Impact**: Auto-discovery MUST be build-time only, cannot be runtime
   - **Fix Required**: Discovery must happen during build process (esbuild plugin or pre-build script)

2. **❌ BaseOperationHandler Constructor Pattern**
   - **Assumed**: `super({ logger, eventBus })`
   - **Reality**: `super('HandlerName', { logger: { value: logger }, dep: { value: dep, requiredMethods: [...] } })`
   - **Source**: `src/logic/operationHandlers/baseOperationHandler.js:36`
   - **Impact**: Current constructor validates dependencies with required methods - metadata pattern would require complete refactor of all 50+ handlers

3. **❌ No Static Metadata Pattern Exists**
   - **Assumed**: Handlers have static properties (`static operationType`, `static token`, etc.)
   - **Reality**: No handlers currently use static metadata - would need to add to all existing handlers
   - **Impact**: Migration would touch every single operation handler

### Naming and Structure Discrepancies

4. **❌ Token Naming Convention**
   - **Assumed**: `IDrinkFromHandler` (with "I" prefix)
   - **Reality**: `DrinkFromHandler` (NO "I" prefix for operation handlers)
   - **Source**:
     - `src/dependencyInjection/tokens/tokens-core.js:13-20`
     - `workflows/OPEHANIMP-011-single-source-of-truth.md:22-35`
     - `CLAUDE.md` "Adding New Operations" section
   - **Convention**: Operation handlers use `[OperationName]Handler`, other services use `I[ServiceName]`

5. **❌ File Structure**
   - **Assumed**: Categorized directories (`items/`, `positioning/`, `core/`)
   - **Reality**: Flat directory structure - all handlers in `src/logic/operationHandlers/`
   - **Impact**: Category extraction from file path won't work

6. **❌ File Naming Convention**
   - **Assumed**: `drinkFrom.handler.js`
   - **Reality**: `drinkFromHandler.js` (camelCase with Handler suffix, no `.handler` extension)
   - **Impact**: Glob patterns `**/*.handler.js` won't match any existing files

### API and Registration Discrepancies

7. **❌ OperationRegistry API**
   - **Assumed**: `operationRegistry.registerOperation(operationType, handlerToken)`
   - **Reality**: `registry.register(operationType, handlerFunction)` - takes a function, not a token
   - **Source**: `src/logic/operationRegistry.js:38-72`
   - **Pattern**:
     ```javascript
     const bind = (tkn) => (...args) => c.resolve(tkn).execute(...args);
     registry.register('DRINK_FROM', bind(tokens.DrinkFromHandler));
     ```

8. **❌ Registration Pattern**
   - **Assumed**: Direct class registration with container
   - **Reality**: Factory pattern with lazy resolution wrapper
   - **Source**: `src/dependencyInjection/registrations/interpreterRegistrations.js:74-78`

### Redundancy and Value Assessment

9. **⚠️ Overlaps with OPEHANIMP-011**
   - OPEHANIMP-011: Single source of truth with central JavaScript registry
   - OPEHANIMP-013: Auto-discovery with static metadata on handlers
   - **Both solve the same problem** - different approaches
   - OPEHANIMP-011 appears more aligned with current architecture

10. **⚠️ Diminishing Returns**
    - 12 previous tickets have already made operation handler registration robust
    - Current system is well-documented in CLAUDE.md with complete checklist
    - Validation script exists: `npm run validate:operations`
    - Manual registration is understood by team and works reliably
    - **Question**: Is auto-discovery solving a real pain point or over-engineering?

### Recommendation

Before implementing OPEHANIMP-013, consider:

1. **Is this ticket still needed?**
   - OPEHANIMP-011 may provide a better solution path
   - Current system works well after 12 iterations of improvement

2. **If proceeding, major changes required:**
   - Rewrite for build-time discovery (esbuild plugin or script)
   - Use actual file naming (`drinkFromHandler.js`)
   - Use correct token names (no "I" prefix)
   - Understand handlers are in flat directory structure
   - Account for BaseOperationHandler's complex constructor pattern

3. **Alternative approach:**
   - Pursue OPEHANIMP-011's central registry instead
   - Keep current manual registration with improved tooling
   - Generate registration code from schemas at build time

---

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
// ⚠️ CORRECTED: Token naming, constructor pattern

class DrinkFromHandler extends BaseOperationHandler {
  // Static metadata for auto-discovery
  static operationType = 'DRINK_FROM';
  static token = 'DrinkFromHandler'; // ✅ CORRECTED: No "I" prefix for operation handlers
  static category = 'items';
  static dependencies = ['ILogger', 'IEntityManager', 'ISafeEventDispatcher']; // ✅ CORRECTED: Actual dependencies

  constructor({ logger, entityManager, safeEventDispatcher }) {
    // ⚠️ PROBLEM: Current BaseOperationHandler requires different constructor:
    // super('DrinkFromHandler', { logger: { value: logger }, ... })
    // Adding static metadata would still require full constructor refactor
    super('DrinkFromHandler', {
      logger: { value: logger },
      entityManager: { value: entityManager, requiredMethods: ['getComponentData', 'hasComponent'] },
      safeEventDispatcher: { value: safeEventDispatcher, requiredMethods: ['dispatch'] },
    });
    // ... implementation
  }
}

export default DrinkFromHandler;
```

**Approach B: File System Convention**

```
# ❌ INCORRECT ASSUMPTION - Not current structure
src/logic/operationHandlers/
├── items/
│   ├── drinkFrom.handler.js        # Wrong naming
│   └── drinkEntirely.handler.js
├── positioning/
│   ├── sitDown.handler.js
│   └── standUp.handler.js
```

```
# ✅ ACTUAL CURRENT STRUCTURE - Flat directory
src/logic/operationHandlers/
├── drinkFromHandler.js              # Correct: camelCase + Handler suffix
├── drinkEntirelyHandler.js
├── addComponentHandler.js
├── removeComponentHandler.js
├── dispatchEventHandler.js
└── ... (50+ handlers in flat structure)
```

**Reality**: All handlers are in a flat directory structure with no categorization by subdirectories. Categories would need to be derived differently (e.g., from static metadata or separate config file).

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

**⚠️ CRITICAL: Browser Context Issue**

The code below assumes Node.js runtime, but the Living Narrative Engine is a **browser-based application**. Discovery MUST happen at **build time**, not runtime.

**Options for Build-Time Discovery:**
1. **esbuild plugin** - Run discovery during bundling process
2. **Pre-build script** - Generate registration file before build
3. **npm script** - Part of build pipeline

**Discovery Service**: `scripts/discoverOperationHandlers.js` (Build-time script)

```javascript
/**
 * ⚠️ CORRECTED: Build-time Operation Handler Discovery Script
 *
 * This runs during build process (NOT at runtime) because the app runs in browser.
 *
 * Discovers and generates registration code based on:
 * - File system scanning (Node.js only, at build time)
 * - Static class metadata (requires adding to all handlers)
 * - Naming conventions
 *
 * Outputs: Generated registration file for runtime use
 */

import glob from 'glob'; // ✅ Available in package.json v11.0.3
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Discovers all operation handlers in the project
 * ⚠️ RUNS AT BUILD TIME ONLY - not available at runtime in browser
 *
 * @param {string} [basePath='src/logic/operationHandlers'] - Base directory to scan
 * @returns {Array<OperationHandlerMetadata>} Discovered handlers
 */
export function discoverOperationHandlers(basePath = 'src/logic/operationHandlers') {
  // ✅ CORRECTED: Glob pattern for actual file naming
  const handlerFiles = glob.sync(`${basePath}/*Handler.js`); // Not *.handler.js
  const handlers = [];

  for (const filePath of handlerFiles) {
    try {
      // ⚠️ PROBLEM: Static imports don't work well with dynamic discovery
      // Would need to use dynamic import() or require() in Node.js context

      // For build-time, we can't easily inspect static properties without loading modules
      // Alternative: Parse file content or use separate metadata file

      const fileName = path.basename(filePath, '.js');
      const operationType = deriveOperationType(fileName);
      const token = fileName; // Already in correct format (e.g., 'DrinkFromHandler')

      handlers.push({
        operationType,
        token,
        filePath,
        handlerClass: fileName,
      });
    } catch (error) {
      console.error(`Failed to process handler ${filePath}:`, error);
    }
  }

  return handlers;
}

/**
 * Derive operation type from handler class name
 * Example: DrinkFromHandler -> DRINK_FROM
 */
function deriveOperationType(className) {
  // Remove 'Handler' suffix
  const name = className.replace(/Handler$/, '');

  // Convert camelCase to SCREAMING_SNAKE_CASE
  return name
    .replace(/([A-Z])/g, '_$1')
    .toUpperCase()
    .replace(/^_/, '');
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
 * ✅ CORRECTED: No "I" prefix for operation handlers
 */
function generateTokenName(operationType) {
  return operationType.split('_').map(word =>
    word.charAt(0) + word.slice(1).toLowerCase()
  ).join('') + 'Handler';
  // Example: 'DRINK_FROM' -> 'DrinkFromHandler' (not 'IDrinkFromHandler')
}

/**
 * Extract category from file path
 * ⚠️ PROBLEM: Won't work with flat directory structure
 * e.g., src/logic/operationHandlers/drinkFromHandler.js → no category info in path
 */
function extractCategoryFromPath(filePath) {
  // ❌ INCORRECT: Assumes categorized directories
  // const parts = filePath.split(path.sep);
  // const handlersIndex = parts.indexOf('operationHandlers');
  // if (handlersIndex !== -1 && parts.length > handlersIndex + 2) {
  //   return parts[handlersIndex + 1]; // Category directory
  // }

  // ✅ REALITY: All handlers in flat structure, cannot extract category from path
  // Options:
  // 1. Add static category metadata to handler classes
  // 2. Use separate category mapping file
  // 3. Derive category from operation type prefix (e.g., 'items:' in event names)
  // 4. Don't use categories at all

  return 'unknown'; // Cannot determine from flat file structure
}

/**
 * Auto-register discovered handlers with DI container
 * ⚠️ CORRECTED: Registry API and token patterns
 */
export function autoRegisterHandlers(container, handlers) {
  // ✅ CORRECTED: Token is 'OperationRegistry', not 'IOperationRegistry'
  const operationRegistry = container.resolve('OperationRegistry');

  for (const handler of handlers) {
    // ⚠️ PROBLEM: This assumes handler classes are available at runtime
    // In browser context, we'd need all handlers bundled and registered manually
    // OR generate registration code at build time

    // Register handler class with container (factory pattern required)
    // See operationHandlerRegistrations.js for actual pattern:
    // container.register(token, (c) => new HandlerClass({ deps from container }))

    // ❌ INCORRECT: operationRegistry.registerOperation doesn't exist
    // operationRegistry.registerOperation(handler.operationType, handler.token);

    // ✅ CORRECT: Registry expects a function, not a token
    const bind = (tkn) => (...args) => container.resolve(tkn).execute(...args);
    operationRegistry.register(handler.operationType, bind(handler.token));

    console.debug('Auto-registered operation handler', {
      operationType: handler.operationType,
      token: handler.token,
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

**Updated Handler Pattern** (with corrections):

```javascript
/**
 * @file Handler for DRINK_FROM operation
 * ⚠️ CORRECTED: Token naming, constructor pattern, dependencies
 */

import BaseOperationHandler from './baseOperationHandler.js';

/**
 * Handles DRINK_FROM operation execution
 *
 * @extends BaseOperationHandler
 */
class DrinkFromHandler extends BaseOperationHandler {
  // ===== AUTO-DISCOVERY METADATA =====
  // These static properties would enable automatic registration
  static operationType = 'DRINK_FROM';
  static token = 'DrinkFromHandler';    // ✅ CORRECTED: No "I" prefix for operation handlers
  static category = 'items';             // ⚠️ Cannot be derived from flat file structure
  static dependencies = [                // ✅ CORRECTED: Actual dependencies used in codebase
    'ILogger',
    'IEntityManager',
    'ISafeEventDispatcher',
  ];
  // ====================================

  #entityManager;
  #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    // ⚠️ PROBLEM: Current BaseOperationHandler uses different constructor signature
    // Reality:
    super('DrinkFromHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'hasComponent', 'batchAddComponentsOptimized'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });

    // The BaseOperationHandler constructor validates dependencies automatically
    // No need for manual validateDependency calls

    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
  }

  async execute(params, executionContext) {
    // ✅ CORRECT: Current handlers receive (params, executionContext)
    // Use this.getLogger(executionContext) for contextual logging
    const log = this.getLogger(executionContext);

    // ... implementation
  }
}

export default DrinkFromHandler;
```

**Key Differences from Original Template:**

1. Token: `DrinkFromHandler` not `IDrinkFromHandler`
2. Constructor: Completely different signature with validation metadata
3. Dependencies: Actual services used (`IEntityManager`, `ISafeEventDispatcher`)
4. Execute signature: `(params, executionContext)` not just `(context)`
5. Logging: Use `this.getLogger(executionContext)` pattern

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
    expect(drinkFrom.token).toBe('DrinkFromHandler'); // ✅ CORRECTED: No "I" prefix
    expect(drinkFrom.category).toBe('items'); // ⚠️ Won't work with flat structure
  });

  it('should auto-generate token if not specified', () => {
    // Test with handler missing static token
    const handlers = discoverOperationHandlers('tests/fixtures/handlers-no-token');
    const handler = handlers[0];

    expect(handler.token).toBe('DrinkFromHandler'); // ✅ CORRECTED: No "I" prefix
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

---

## Final Assessment: Is This Ticket Overkill?

### Current State Analysis

After 12 previous improvement tickets (OPEHANIMP-001 through OPEHANIMP-012), the operation handler registration system is:

✅ **Well-documented**
- Complete checklist in CLAUDE.md
- Clear step-by-step process
- Common pitfalls documented
- Related files cross-referenced

✅ **Well-validated**
- `npm run validate:operations` script exists
- Pre-validation whitelist (KNOWN_OPERATION_TYPES)
- Build-time type checking
- Schema validation at multiple points

✅ **Well-understood**
- Team knows the process after 12 iterations
- Consistent patterns across 50+ handlers
- Clear error messages when steps are missed

✅ **Relatively painless**
- Adding a new operation: 7 clear steps
- Most steps are simple file additions
- Validation catches mistakes early

### Cost-Benefit Analysis

**OPEHANIMP-013 Implementation Cost:**

1. **Code changes**: High
   - Add static metadata to all 50+ handlers
   - Refactor BaseOperationHandler constructor (breaking change)
   - Create build-time discovery script
   - Generate registration files at build time
   - Update all handler tests
   - Migration path for existing handlers

2. **Risk**: High
   - Browser context requires build-time approach only
   - Breaking changes to BaseOperationHandler affect everything
   - Build process becomes more complex
   - New failure modes during build

3. **Maintenance**: Medium
   - Build-time generation adds complexity
   - Generated files need version control decisions
   - Static metadata could drift from reality

**OPEHANIMP-013 Benefit:**

1. **Developer experience**: Marginal
   - Saves 2-3 manual registration steps out of 7 total
   - Still need to create handler file, schema, add to whitelist
   - Trade-off: Manual steps vs understanding build-time generation

2. **Error reduction**: Marginal
   - Current validation already catches registration mistakes
   - New errors possible from build-time generation failures

3. **Code quality**: Neutral to negative
   - Less manual code (good)
   - More magic/implicit behavior (bad for understanding)
   - Generated code (harder to debug)

### Comparison with OPEHANIMP-011

**OPEHANIMP-011** (Single Source of Truth) offers similar benefits with lower cost:

- Central registry of operation metadata
- Generate schemas, types, docs from registry
- No breaking changes to handlers
- Works in browser context
- More aligned with current architecture

**Recommendation**: Pursue OPEHANIMP-011 instead of OPEHANIMP-013.

### Final Verdict

**Yes, this ticket is overkill** for the following reasons:

1. **Diminishing returns**
   - 12 previous tickets already solved the pain points
   - Current system works reliably
   - Small remaining manual work (2-3 steps)

2. **High implementation cost**
   - Breaking changes to 50+ handlers
   - Build-time complexity
   - Browser context constraints

3. **Better alternative exists**
   - OPEHANIMP-011 solves similar problems
   - Lower cost, better fit for architecture
   - No breaking changes required

4. **Not solving real pain**
   - Team understands current process
   - Validation catches errors early
   - Adding operations is not a frequent bottleneck

### Recommended Action

**Option 1: Close this ticket**
- Accept that the manual process is acceptable
- Focus on other higher-value improvements
- Keep the well-documented current system

**Option 2: Pursue OPEHANIMP-011 instead**
- Implement central registry approach
- Get similar benefits with lower cost
- Better architectural fit

**Option 3: Defer indefinitely**
- Wait to see if operation creation becomes a bottleneck
- Revisit if team size scales significantly
- Keep as "nice to have" for future

---

**Updated**: 2025-01-08
**Status**: ⚠️ Recommend against implementation - assumptions incorrect, cost too high, better alternatives exist
