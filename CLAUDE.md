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
├── ECS Architecture              ├── API Key Management
├── Event Bus System              ├── LLM Provider Abstraction
└── Mod Loading System            └── Request Formatting
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
├── src/                    # Main application source
│   ├── engine/            # Core game engine
│   ├── entities/          # ECS implementation
│   ├── events/            # Event system
│   ├── loaders/           # Content loading
│   ├── ai/                # AI systems (memory, notes)
│   ├── domUI/             # UI components
│   ├── logic/             # JSON Logic evaluation
│   ├── scopeDsl/          # Custom query language
│   └── dependencyInjection/ # IoC container
├── data/
│   ├── mods/              # Game content as mods
│   ├── schemas/           # JSON Schema definitions
│   └── prompts/           # AI prompt templates
├── tests/
│   ├── unit/              # Unit tests (mirror src/)
│   ├── integration/       # Integration tests
│   └── common/            # Test utilities & helpers
├── llm-proxy-server/      # Separate LLM service
└── docs/                  # Documentation
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

1. **AJV Configuration**: Centralized in `AjvSchemaValidator`
2. **Schema Loading**: Batch loading during startup
3. **Validation Helper**: `validateAgainstSchema(data, schemaId)`
4. **Error Formatting**: `formatAjvErrors()` for readable messages

### Content ID Rules

- Format: `modId:identifier` (e.g., `core:actor`)
- Special cases: `none`, `self` (no namespace required)
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

## 🔄 Development Workflow

### Essential Commands

```bash
# Development
npm run dev              # Start app + proxy server concurrently
npm run start            # Build and serve main app only
npm run start:all        # Start both services

# Code Quality (ALWAYS run after modifications)
npm run lint            # Fix ESLint issues
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
```

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
  - `npm run lint` - fix style issues
  - `npm run test:ci` - ensure all tests pass
  - `npm run typecheck` - verify types
- **Comment non-obvious logic** with `// Reason:`
- **Use domain-specific errors** not generic ones

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
