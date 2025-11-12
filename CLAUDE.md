# CLAUDE.md - Living Narrative Engine Project Context

## 🎮 Project Overview

Living Narrative Engine is a browser-based platform for creating and playing adventure games, RPGs, immersive sims, and similar narrative-driven experiences. The engine operates as an interpreter and processor of mod data, following a **"modding-first" philosophy** where all game content exists as mods in the `data/mods/` folder.

### Core Goals

1. **Total Moddability** - Every aspect of gameplay is definable through data files
2. **AI-Powered Narrative** - NPCs powered by LLMs with memory systems
3. **Browser-Based Accessibility** - Cross-platform, instant play
4. **Developer-Friendly Architecture** - Clear separation, comprehensive validation

## 🏗️ Architecture

### System Overview

```
Main Application (/)              LLM Proxy Server (/llm-proxy-server)
├── Game Engine (Browser)    ←→   Node.js Microservice
├── ECS Architecture              ├── Entry: src/core/server.js
├── Event Bus System              ├── API Key Management
└── Mod Loading System            ├── LLM Provider Abstraction
                                  └── Request Formatting
```

### Entity Component System (ECS)

```
Entity (ID) → Components (Data) → Systems (Rules + Operation Handlers)
```

- **Entities**: Simple string IDs that group components
- **Components**: JSON data files defining properties with schemas
- **Systems**: Rule definitions that process entities via operation handlers

### Event-Driven Architecture

```
Component A → Event → Event Bus → Component B
                          ↓
                     Component C
```

All communication flows through a central event bus with validated events.

### Technology Stack

- **Frontend**: Pure JavaScript ES6+ (no framework)
- **Bundler**: esbuild
- **Testing**: Jest with jsdom (80%+ coverage)
- **Validation**: AJV for JSON schemas
- **Core Libs**: json-logic-js, lodash, uuid, msgpack, pako
- **AI/LLM**: gpt-tokenizer for token counting

## 📁 Project Structure

```
/
├── src/                    # Main application source (key directories shown)
│   ├── engine/            # Core game engine
│   ├── entities/          # ECS implementation
│   ├── events/            # Event system
│   ├── loaders/           # Content loading
│   ├── ai/                # AI systems (memory, notes)
│   ├── domUI/             # UI components
│   ├── logic/             # JSON Logic evaluation
│   ├── scopeDsl/          # Custom query language
│   ├── dependencyInjection/ # IoC container
│   ├── anatomy/           # Character anatomy system
│   ├── characterBuilder/  # Character creation tools
│   ├── coreMotivationsGenerator/ # Psychological profile generator
│   ├── thematicDirection/ # Narrative theme system
│   ├── clothing/          # Clothing system
│   ├── config/            # Configuration management
│   ├── validation/        # Schema validation
│   └── ... (40+ directories total)
├── data/
│   ├── mods/              # Game content as mods
│   ├── schemas/           # JSON Schema definitions
│   └── prompts/           # AI prompt templates
├── tests/
│   ├── unit/              # Unit tests (mirror src/)
│   ├── integration/       # Integration tests
│   ├── e2e/               # End-to-end tests
│   ├── performance/       # Performance tests
│   ├── memory/            # Memory leak tests
│   ├── visual/            # Visual validation tests
│   ├── manual/            # Manual testing scenarios
│   ├── examples/          # Test examples
│   ├── setup/             # Test setup utilities
│   ├── helpers/           # Additional test helpers
│   ├── monitoring/        # Monitoring tests
│   └── common/            # Test utilities & helpers
├── llm-proxy-server/      # Separate LLM service (main: src/core/server.js)
└── docs/                  # Documentation
    ├── testing/           # Testing guides & patterns
    └── ... (15+ subdirectories)
```

## 🔧 Development Guidelines

### Code Structure & Conventions

#### Naming Conventions

- **Files**: camelCase (`entityManager.js`, `gameEngine.js`)
- **Classes**: PascalCase (`EntityManager`, `EventBus`)
- **Functions**: camelCase (`createEntity`, `validateSchema`)
- **Constants**: UPPER_SNAKE_CASE (`ENTITY_CREATED`, `MAX_DEPTH`)
- **Private fields**: Prefix with `#` (`#logger`, `#registry`)
- **Content IDs**: Namespaced format `modId:identifier` (`core:actor`)

#### File Structure Template

```javascript
/**
 * @file Brief description of file purpose
 * @see relatedFile.js
 */

// Regular imports
import { something } from './path.js';

// Type imports (runtime-removed)
/** @typedef {import('./types.js').MyType} MyType */

// Main class/function
class MyClass {
  #privateField;

  constructor({ dependency1, dependency2 }) {
    validateDependency(dependency1, 'IDependency1', console, {
      requiredMethods: ['method1', 'method2'],
    });
    this.#privateField = dependency1;
  }
}

export default MyClass;
```

#### Module Organization

- **Never create files > 500 lines** - split into modules
- Group by feature/responsibility
- Use dependency injection for all services
- Separate concerns clearly

### Dependency Injection Pattern

```javascript
// Token definition (actual implementation uses string tokens)
export const tokens = {
  IEntityManager: 'IEntityManager',
  IEventBus: 'IEventBus',
  ILogger: 'ILogger',
};

// Service implementation
class EntityManager {
  constructor({ logger, eventBus, repository }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(eventBus, 'IEventBus', logger, {
      requiredMethods: ['dispatch'],
    });
    this.#logger = logger;
    this.#eventBus = eventBus;
  }
}

// Registration
container.register(tokens.IEntityManager, EntityManager);
```

### Common Utilities

#### Validation Helpers

```javascript
import {
  validateDependency,
  assertPresent,
  assertNonBlankString,
} from './utils/dependencyUtils.js';
import { string, logger } from './utils/validationCore.js';
import { ensureValidLogger } from './utils/loggerUtils.js';

// Use in constructors
validateDependency(service, 'IService', logger, {
  requiredMethods: ['method1', 'method2'],
});

// Use for parameters
assertPresent(value, 'Value is required');
assertNonBlankString(id, 'Entity ID', 'constructor validation', logger);

// Alternative validation core usage
string.assertNonBlank(id, 'Entity ID', 'constructor validation', logger);
logger.assertValid(loggerInstance, 'logger');
```

#### Error Handling Pattern

```javascript
// Custom domain errors
import { EntityNotFoundError } from './errors/entityNotFoundError.js';
import { InvalidArgumentError } from './errors/invalidArgumentError.js';

// Consistent error handling
try {
  // operation
} catch (err) {
  this.#logger.error(`Context: descriptive message`, err);
  throw new InvalidArgumentError('User-friendly message');
}

// NEVER log errors directly - dispatch events
this.#eventBus.dispatch({
  type: 'SYSTEM_ERROR_OCCURRED',
  payload: { error: err.message, context },
});
```

## 🧪 Testing Strategy

### Test Structure

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('ComponentName - Feature', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should perform expected behavior', () => {
    // Arrange
    const mockLogger = testBed.createMockLogger();
    const input = testBed.createMock('testInput', ['method1', 'method2']);

    // Act
    const result = testBed.performAction(input);

    // Assert
    expect(result).toBe(expected);
    expect(mockLogger.info).toHaveBeenCalled();
  });
});
```

### Testing Requirements

- **Always create tests** for new features
- **Use test helpers** from `/tests/common/`
- **Test coverage**: 80% branches, 90% functions/lines
- **Test types required**:
  - Expected use case
  - Edge cases
  - Failure scenarios
  - If modifying logic, update existing tests

### Test Organization

- Unit tests: `/tests/unit/` (mirror src structure)
- Integration tests: `/tests/integration/`
- E2E tests: `/tests/e2e/`
- Performance tests: `/tests/performance/`
- Memory tests: `/tests/memory/`
- Test utilities: `/tests/common/`
- Use descriptive test suite functions when available

### Mod Testing Guidelines

When working with mod content in `data/mods/`, follow the established testing patterns documented in `docs/testing/`:

- **Primary Reference**: [`docs/testing/mod-testing-guide.md`](../docs/testing/mod-testing-guide.md)
  - ModTestFixture factories (`forAction`, `forRule`, `forCategory`)
  - Scenario helpers (seating, inventory, containers)
  - Domain matchers from `tests/common/mods/domainMatchers.js`
  - Action validation proxies for schema enforcement
  - Action Discovery Bed for resolver introspection
  - Diagnostics workflows and troubleshooting
  - Migration from legacy patterns guide

**Key practices for mod testing:**

- Use `await ModTestFixture.forAction(modId, fullActionId)` for action tests
- Leverage scenario builders (`createSittingPair`, `createInventoryLoadout`, etc.)
- Import domain matchers: `import '../../common/mods/domainMatchers.js'`
- Validate rule JSON with `createActionValidationProxy` before testing
- Enable diagnostics only for debugging: `fixture.enableDiagnostics()`
- Always call `fixture.cleanup()` in `afterEach` blocks

**Quick reference:**

```javascript
// ✅ Preferred pattern
const fixture = await ModTestFixture.forAction('positioning', 'positioning:sit_down');
const scenario = fixture.createStandardActorTarget(['Actor Name', 'Target Name']);
await fixture.executeAction(scenario.actor.id, scenario.target.id);

// ❌ Deprecated and unsupported
ModTestFixture.createFixture({ type: 'action' });
ModTestHandlerFactory.createHandler({ actionId: 'sit_down' });
new ModEntityBuilder(); // Missing ID and validation
```

## 📋 JSON Schema & Validation

### Schema Patterns

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "modId:componentId",
  "description": "Human-readable description",
  "dataSchema": {
    "type": "object",
    "properties": {
      "field": { "type": "string" }
    },
    "required": ["field"]
  }
}
```

### Validation Flow

1. **AJV Configuration**: Centralized in `ajvSchemaValidator.js` (src/validation/)
2. **Schema Loading**: Batch loading during startup
3. **Validation Helper**: `validateAgainstSchema(data, schemaId)`
4. **Error Formatting**: `formatAjvErrors()` for readable messages

### Content ID Rules

- Format: `modId:identifier` (e.g., `core:actor`)
- Special scope names: `none`, `self` (no namespace required for scope DSL)
- Special entity IDs: `system` (reserved for system-generated events, no entity required)
- Mod IDs: Alphanumeric + underscore only
- Always validate IDs with schemas

### Scope DSL Syntax

The Scope DSL supports the following operators:

- `.` - Field access (e.g., `actor.name`)
- `[]` - Array iteration (e.g., `actor.items[]`)
- `[{...}]` - JSON Logic filters (e.g., `actor.items[{"==": [{"var": "type"}, "weapon"]}]`)
- `+` or `|` - Union operators (e.g., `actor.followers | actor.partners`)
- `:` - Component namespacing (e.g., `core:actor`)

Note: Both `+` and `|` produce identical union behavior. Use whichever feels more natural.

### Body Descriptor Registry

The Body Descriptor Registry provides a centralized, single source of truth for all body descriptor metadata in the anatomy system.

**Location**: `src/anatomy/registries/bodyDescriptorRegistry.js`

**Purpose**: Eliminates manual synchronization across multiple files (schema, code, formatting config) by centralizing all descriptor metadata.

**Registry Structure**:

Each descriptor contains 9 properties:
- `schemaProperty` - Property name in JSON schema (camelCase)
- `displayLabel` - Human-readable label
- `displayKey` - Key in formatting config (snake_case)
- `dataPath` - Path in body component
- `validValues` - Array of valid values or `null` for free-form
- `displayOrder` - Numeric priority (10, 20, 30, ...)
- `extractor` - Function to extract value from body component
- `formatter` - Function to format value for display
- `required` - Whether descriptor is required

**Current Descriptors** (6 total):
- height (10), skinColor (20), build (30), composition (40), hairDensity (50), smell (60)
- Next available display order: 70

**Exports**:
```javascript
import {
  BODY_DESCRIPTOR_REGISTRY,
  getDescriptorMetadata,
  getAllDescriptorNames,
  getDescriptorsByDisplayOrder,
  validateDescriptorValue,
} from './registries/bodyDescriptorRegistry.js';
```

**Validation**:
- CLI Tool: `npm run validate:body-descriptors`
- Validator Class: `src/anatomy/validators/bodyDescriptorValidator.js`
- Validates: Registry completeness, formatting config, recipe descriptors

**Documentation**:
- [Body Descriptors Complete](docs/anatomy/body-descriptors-complete.md) - Complete guide including registry, adding descriptors, and validation

### Clothing Removal Blocking System

The blocking system enforces realistic clothing physics by preventing removal of items that are secured by other items.

**Key Components**:
- `clothing:blocks_removal` component (data/mods/clothing/components/blocks_removal.component.json)
- `IsRemovalBlockedOperator` (src/logic/operators/isRemovalBlockedOperator.js)
- `ClothingAccessibilityService` (src/clothing/services/clothingAccessibilityService.js) - **primary blocking logic**
- Registered in `src/logic/jsonLogicCustomOperators.js`
- ⚠️ `can-remove-item` condition NOT FOUND - may need to be created

**Integration Points**:
1. Component defines blocking rules in entity definitions
2. Operator evaluates blocking in JSON Logic expressions
3. `ClothingAccessibilityService` filters blocked items during accessibility queries
4. Service used by action discovery and scope resolution
5. ⚠️ Integration with `SlotAccessResolver` needs verification

**Usage Example**:
```json
{
  "clothing:blocks_removal": {
    "blockedSlots": [
      { "slot": "legs", "layers": ["base"], "blockType": "must_remove_first" }
    ]
  }
}
```

**Real Examples**: See belt entities in `data/mods/clothing/entities/definitions/*_belt.entity.json`

**Testing**: See `tests/integration/clothing/blockingEdgeCases.integration.test.js` for examples.

**Documentation**: See `docs/modding/clothing-blocking-system.md`.

## 🔄 Development Workflow

### Essential Commands

```bash
# Development
npm run dev              # Start app + proxy server concurrently
npm run start            # Build and serve main app only
npm run start:all        # Start both services

# Code Quality (ALWAYS run after modifications)
npx eslint <modified-files>  # Fix ESLint issues (only on modified files)
npm run format          # Format with Prettier
npm run typecheck       # TypeScript type checking
npm run scope:lint      # Validate scope DSL files

# Testing (run after every modification)
npm run test:unit        # Run unit tests with coverage
npm run test:integration # Run integration tests with coverage
npm run test:e2e        # Run end-to-end tests with coverage
npm run test:single     # Sequential tests for debugging

# Build
npm run build           # Bundle for browser

# Utilities
npm run create-mod      # Create new mod scaffold
npm run update-manifest # Update mod manifests

# Validation
npm run validate:body-descriptors  # Validate body descriptor system consistency
```

### Adding New Operations - Complete Checklist

When adding a new operation to the system, follow this checklist to ensure complete integration:

#### Step-by-Step Process

1. **Create operation schema** ✅ Validation: Schema is valid JSON
   - File: `data/schemas/operations/[operationName].schema.json`
   - Use `allOf` to extend `../base-operation.schema.json`
   - Define `type` constant and `parameters`
   - Verify: `npm run validate` or `npm run validate:strict`

2. **Add schema reference** ✅ Validation: Reference resolves
   - File: `data/schemas/operation.schema.json` (root schemas directory)
   - Add `$ref` entry to the `anyOf` array in the `Operation` definition
   - Keep alphabetically sorted
   - Verify: `npm run validate` or `npm run validate:strict`

3. **Create operation handler** ✅ Validation: Handler compiles
   - File: `src/logic/operationHandlers/[operationName]Handler.js`
   - Extend `BaseOperationHandler`
   - Implement `execute(context)` method
   - Add comprehensive error handling
   - Verify: `npm run typecheck`

4. **Define DI token** ✅ Validation: Token is unique
   - File: `src/dependencyInjection/tokens/tokens-core.js`
   - Add `[OperationName]Handler: '[OperationName]Handler'`
   - Follow naming convention: PascalCase (no "I" prefix for operation handlers)
   - Verify: `npm run typecheck`

5. **Register handler factory** ✅ Validation: Registration syntax correct
   - File: `src/dependencyInjection/registrations/operationHandlerRegistrations.js`
   - Add factory to the `handlerFactories` array with proper dependency injection
   - Add import statement for the handler class
   - Verify: `npm run typecheck`

6. **Map operation to handler** ✅ Validation: Type string matches schema
   - File: `src/dependencyInjection/registrations/interpreterRegistrations.js`
   - Add `registry.register('[OPERATION_TYPE]', bind(tokens.[OperationName]Handler))`
   - Ensure type matches schema exactly (use the same string as in schema's `const` field)
   - Verify: `npm run typecheck` and `npm run test:unit`

7. **⚠️ CRITICAL: Add to pre-validation whitelist** ✅ Validation: Type in whitelist
   - File: `src/utils/preValidationUtils.js`
   - Add `'[OPERATION_TYPE]'` to `KNOWN_OPERATION_TYPES` array
   - Keep alphabetically sorted
   - **Failure to do this will cause validation failures during mod loading**
   - Verify: `npm run validate` or `npm run test:ci`

8. **Create tests** ✅ Validation: Tests pass with coverage
   - Unit: `tests/unit/logic/operationHandlers/[operationName]Handler.test.js`
   - Integration: `tests/integration/mods/[category]/[operationName]RuleExecution.test.js`
   - Verify: `npm run test:unit && npm run test:integration`

#### Validation Commands

Run after each step for immediate feedback:

```bash
# After steps 1-2: Validate schemas and mod structure
npm run validate           # Basic validation
npm run validate:strict    # Strict validation with all checks

# After steps 3-6: Type check and compile
npm run typecheck

# After step 7: Validate operation completeness
npm run validate           # Will check operation type registration
npm run test:unit          # Unit tests will catch missing registrations

# After step 8: Run tests
npm run test:unit
npm run test:integration

# Final verification: Full test suite
npm run test:ci           # Runs unit, integration, and e2e tests
npx eslint <modified-files>  # Lint the modified files
```

#### Common Pitfalls

❌ **Forgetting pre-validation whitelist** (Step 7)
- Symptom: "Unknown operation type" error during mod loading
- Fix: Add to `KNOWN_OPERATION_TYPES` in `preValidationUtils.js`

❌ **Type string mismatch**
- Symptom: "No handler registered" error at runtime
- Fix: Ensure type matches exactly in schema, registry, and whitelist

❌ **Missing schema $ref**
- Symptom: AJV validation fails with "no matching schema"
- Fix: Add `$ref` to `operation.schema.json`

❌ **Incomplete DI registration**
- Symptom: "Cannot resolve token" error
- Fix: Check token defined, factory registered, and operation mapped

#### Quick Reference

| File | Purpose | Pattern |
|------|---------|---------|
| `operations/[operation].schema.json` | Structure | `"const": "OPERATION_NAME"` |
| `operation.schema.json` | Reference | `{ "$ref": "./operations/[operation].schema.json" }` in `anyOf` |
| `[operation]Handler.js` | Logic | `class extends BaseOperationHandler` |
| `tokens-core.js` | Token | `[Operation]Handler: '[Operation]Handler'` |
| `operationHandlerRegistrations.js` | Factory | Factory in `handlerFactories` array |
| `interpreterRegistrations.js` | Mapping | `registry.register('TYPE', bind(token))` |
| `preValidationUtils.js` | Whitelist | `'OPERATION_NAME'` in `KNOWN_OPERATION_TYPES` |

**Note**: There is currently no dedicated operation-adding documentation file. Refer to existing operation handlers in `src/logic/operationHandlers/` as examples.

### Character Builder Tools

The project includes several character creation tools accessible from the main index:

#### Core Motivations Generator

- **Purpose**: Generate psychological profiles with core motivations, internal contradictions, and central questions
- **Location**: `/core-motivations-generator.html`
- **Entry Point**: `src/core-motivations-generator-main.js`
- **Build Output**: `dist/core-motivations-generator.js`
- **Dependencies**: Requires thematic directions with generated clichés
- **Key Features**:
  - AI-powered generation using LLM
  - Accumulative storage across generations
  - Export functionality (JSON/text)
  - Keyboard shortcuts (Ctrl+Enter, Ctrl+E, Ctrl+Shift+Del)
  - WCAG AA accessibility compliance
- **Testing**: Full test coverage in `tests/unit/coreMotivationsGenerator/`, `tests/integration/coreMotivationsGenerator/`

#### Other Character Builder Tools

- **Thematic Direction Generator**: Create narrative themes
- **Clichés Generator**: Generate story clichés for themes
- **Character Concepts Manager**: Manage character concepts
- **Anatomy Visualizer**: Visual character anatomy system

### Development Process

1. **Before coding**: Read this file completely
2. **Check for existing code**: Search before creating
3. **Test-driven**: Write tests first for new features
4. **Validate constantly**: Run lint, format, tests
5. **Use utilities**: Don't reinvent test helpers
6. **Follow patterns**: Match existing code style

### Mod Development

1. Create mod structure:

   ```
   data/mods/my-mod/
   ├── mod-manifest.json
   ├── components/
   ├── actions/
   ├── rules/
   └── entities/
   ```

2. Define manifest:

   ```json
   {
     "id": "my_mod",
     "version": "1.0.0",
     "name": "My Mod",
     "dependencies": ["core"]
   }
   ```

3. Add to `game.json`:
   ```json
   {
     "mods": ["core", "my_mod"]
   }
   ```

## 🤖 AI Assistant Guidelines

### Project Awareness

- **This file contains complete project context**
- **Always check existing code** before creating new files
- **Use project utilities** - don't reinvent the wheel

### Code Generation Rules

- **Never create files > 500 lines** - refactor into modules
- **Always use dependency injection** for services
- **Follow exact naming conventions** shown above
- **Include JSDoc types** for better IDE support
- **Match existing patterns** in the codebase

### Testing Requirements

- **Create tests for all new code** - no exceptions
- **Check test helpers first** at `/tests/common/`
- **Update tests when modifying logic**
- **Verify tests pass** before marking complete

### Quality Standards

- **Run after EVERY modification**:
  - `npx eslint <modified-files>` - fix style issues (target files only)
  - `npm run test:ci` - ensure all tests pass
  - `npm run typecheck` - verify types
- **Comment non-obvious logic** with `// Reason:`
- **Use domain-specific errors** not generic ones

#### Linting Strategy for Performance

- **For Claude Code sessions**: Use `npx eslint <file-paths>` on modified files only
- **For full codebase validation**: Use `npm run lint` (may timeout on large codebases)
- **Example**: `npx eslint src/entities/entityManager.js src/events/eventBus.js`
- **Rationale**: Avoids timeout issues while maintaining code quality on changed files

### Documentation

- **Update README.md** for new features/dependencies
- **Document complex logic** inline
- **Keep this file updated** with new patterns

### Error Handling

- **Never log directly** - use event dispatching
- **Throw domain errors** with clear messages
- **Validate all inputs** using utility functions

### Best Practices

- **Fail fast** on critical errors
- **Be defensive** - validate dependencies
- **Think modular** - separate concerns
- **Test everything** - aim for high coverage
- **Follow patterns** - consistency matters

### Common Pitfalls to Avoid

- Creating large monolithic files
- Hardcoding game logic in engine
- Skipping validation
- Forgetting to run tests
- Not using existing utilities
- Direct console logging

### Remember

- **Ask if uncertain** - don't assume
- **Verify paths exist** before referencing
- **Check schemas** for data structure
- **Use test beds** for complex tests
- **Follow ECS pattern** strictly
- **Everything is a mod** - even core mechanics

---

_This is the complete project context for Living Narrative Engine. Follow these guidelines for consistent, high-quality contributions._

# important-instruction-reminders

Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (\*.md) or README files. Only create documentation files if explicitly requested by the User.

      IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task.
