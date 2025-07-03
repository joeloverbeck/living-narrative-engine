name: "AnatomyGenerationService Refactoring PRP"
description: |

## Purpose
Comprehensive refactoring plan for AnatomyGenerationService to achieve clean separation of concerns, atomic operations with rollback capability, and improved error handling following SOLID principles.

## Core Principles
1. **Context is King**: Include ALL necessary documentation, examples, and caveats
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Be sure to follow all rules in CLAUDE.md

---

## Goal
Refactor the AnatomyGenerationService to achieve clear separation of concerns by extracting orchestration logic, implementing transactional consistency, and improving error handling. The refactored service should follow SOLID principles, particularly Single Responsibility Principle (SRP), and align with existing codebase patterns.

## Why
- **Current Issues**: Mixed concerns (orchestration, validation, description generation, cache building), tight coupling, inconsistent error handling, no rollback on partial failures
- **Business Value**: Improved maintainability, easier testing, better error visibility, atomic operations
- **Integration**: Aligns with existing coordinator and service patterns in the codebase

## What
Transform a monolithic service into a well-orchestrated system with:
- AnatomyOrchestrator for high-level coordination
- AnatomyUnitOfWork for transactional consistency
- Dedicated workflows for different operations
- Comprehensive error handling with specific error types
- Maintained backward compatibility

### Success Criteria
- [ ] All existing tests pass without modification
- [ ] New components have 100% test coverage
- [ ] Clear separation of orchestration from implementation
- [ ] Atomic operations with proper rollback on failure
- [ ] Improved error messages and handling

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- file: /src/refactoring_principles.md
  why: Comprehensive refactoring principles to follow (SOLID, DRY, CQS, etc.)
  
- file: /src/anatomy/anatomyGenerationService.js
  why: Current implementation to refactor
  
- file: /src/persistence/manualSaveCoordinator.js
  why: Example of coordinator pattern to follow
  
- file: /src/engine/persistenceCoordinator.js
  why: Another coordinator pattern example with phases
  
- file: /src/entities/services/componentMutationService.js
  why: Service pattern with BaseService and dependency validation
  
- file: /src/initializers/services/initializationService.js
  why: Complex orchestration service pattern
  
- file: /src/utils/serviceBase.js
  why: BaseService pattern all services should extend
  
- file: /tests/unit/anatomy/anatomyGenerationService.test.js
  why: Existing tests that must continue to pass
```

### Current Codebase tree
```bash
src/
├── anatomy/
│   ├── anatomyDescriptionService.js
│   ├── anatomyGenerationService.js  # Service to refactor
│   ├── anatomyGraphContext.js
│   ├── anatomyInitializationService.js
│   ├── bodyBlueprintFactory.js
│   ├── bodyDescriptionComposer.js
│   ├── bodyGraphService.js
│   ├── bodyPartDescriptionBuilder.js
│   ├── descriptorFormatter.js
│   ├── entityGraphBuilder.js
│   ├── graphIntegrityValidator.js
│   ├── partSelectionService.js
│   ├── recipeConstraintEvaluator.js
│   ├── recipeProcessor.js
│   └── socketManager.js
├── errors/
│   ├── validationError.js
│   ├── invalidArgumentError.js
│   └── ... (many specific error types)
└── utils/
    ├── serviceBase.js
    └── ... (utility functions)
```

### Desired Codebase tree with files to be added
```bash
src/
├── anatomy/
│   ├── anatomyDescriptionService.js
│   ├── anatomyGenerationService.js  # Simplified, delegates to orchestrator
│   ├── orchestration/
│   │   ├── anatomyOrchestrator.js  # NEW: High-level coordination
│   │   ├── anatomyUnitOfWork.js  # NEW: Transactional wrapper
│   │   └── anatomyErrorHandler.js  # NEW: Centralized error handling
│   ├── workflows/
│   │   ├── anatomyGenerationWorkflow.js  # NEW: Generation logic
│   │   ├── descriptionGenerationWorkflow.js  # NEW: Description logic
│   │   └── graphBuildingWorkflow.js  # NEW: Graph construction logic
│   └── ... (existing files)
```

### Known Gotchas & Patterns

```javascript
// CRITICAL: BaseService pattern - ALL services must extend BaseService
class MyService extends BaseService {
  constructor({ logger, dependency }) {
    super();
    this.#logger = this._init('MyService', logger, {
      dependency: { value: dependency, requiredMethods: ['method1'] }
    });
  }
}

// CRITICAL: Error handling pattern - swallowing errors is BAD
// Current AnatomyGenerationService swallows description errors (lines 177-183)
// This must be replaced with proper error propagation

// CRITICAL: Dependency injection pattern
// All dependencies passed via constructor object
// Never use 'new' directly in service methods

// CRITICAL: Event dispatching pattern
// Use safeEventDispatcher for UI events
// Events are defined in constants/eventIds.js
```

## Implementation Blueprint

### Data models and structure

The refactoring maintains existing data structures but introduces new organizational classes:

```yaml
AnatomyOrchestrator:
  - Coordinates the entire anatomy generation process
  - Manages dependencies between steps
  - Delegates to workflows and services
  
AnatomyUnitOfWork:
  - Wraps operations in a transaction-like context
  - Tracks created entities for rollback
  - Ensures atomicity of operations
  
Workflows:
  - AnatomyGenerationWorkflow: Creates anatomy graph
  - DescriptionGenerationWorkflow: Generates descriptions
  - GraphBuildingWorkflow: Builds adjacency cache
```

### List of tasks to be completed in order

```yaml
Task 1: Create base orchestration infrastructure
CREATE src/anatomy/orchestration/anatomyErrorHandler.js:
  - MIRROR pattern from: src/errors/validationError.js
  - ADD specific error types: AnatomyGenerationError, DescriptionGenerationError
  - IMPLEMENT error context preservation

CREATE src/anatomy/orchestration/anatomyUnitOfWork.js:
  - IMPLEMENT transaction-like pattern
  - ADD entity tracking for rollback
  - INCLUDE commit/rollback methods
  
Task 2: Extract workflows from existing service
CREATE src/anatomy/workflows/anatomyGenerationWorkflow.js:
  - EXTRACT lines 134-167 from anatomyGenerationService.js
  - REFACTOR to pure generation logic
  - RETURN generated entities list

CREATE src/anatomy/workflows/descriptionGenerationWorkflow.js:
  - EXTRACT lines 169-184 from anatomyGenerationService.js
  - IMPROVE error handling (don't swallow errors)
  - MAKE it throwable for unit of work rollback

CREATE src/anatomy/workflows/graphBuildingWorkflow.js:
  - EXTRACT adjacency cache building logic
  - ADD validation before building
  
Task 3: Create the orchestrator
CREATE src/anatomy/orchestration/anatomyOrchestrator.js:
  - EXTEND BaseService pattern
  - COORDINATE workflows in correct order
  - USE AnatomyUnitOfWork for atomicity
  - IMPLEMENT proper error propagation

Task 4: Refactor the main service
MODIFY src/anatomy/anatomyGenerationService.js:
  - SIMPLIFY to delegate to AnatomyOrchestrator
  - MAINTAIN backward compatibility
  - PRESERVE public API

Task 5: Create comprehensive tests
CREATE tests/unit/anatomy/orchestration/anatomyOrchestrator.test.js:
  - TEST coordination logic
  - TEST rollback scenarios
  - VERIFY error propagation

CREATE tests/unit/anatomy/orchestration/anatomyUnitOfWork.test.js:
  - TEST transaction semantics
  - TEST rollback functionality
  - TEST entity tracking

Task 6: Update integration tests
MODIFY tests/integration/anatomy/*.test.js:
  - ENSURE all pass with new implementation
  - ADD tests for rollback scenarios
```

### Per task pseudocode

#### Task 1: AnatomyUnitOfWork pseudocode
```javascript
class AnatomyUnitOfWork {
  constructor({ entityManager, logger }) {
    // Track created entities
    this.createdEntities = [];
    this.operations = [];
  }
  
  trackEntity(entityId) {
    this.createdEntities.push(entityId);
  }
  
  async execute(operation) {
    try {
      const result = await operation();
      this.operations.push({ operation, result });
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }
  
  async rollback() {
    // Delete created entities in reverse order
    for (const entityId of this.createdEntities.reverse()) {
      await this.entityManager.deleteEntity(entityId);
    }
  }
  
  async commit() {
    // Clear tracking - operation succeeded
    this.createdEntities = [];
    this.operations = [];
  }
}
```

#### Task 3: AnatomyOrchestrator pseudocode
```javascript
class AnatomyOrchestrator extends BaseService {
  async orchestrateGeneration(entityId, recipeId, blueprintId) {
    const unitOfWork = new AnatomyUnitOfWork({ ... });
    
    try {
      // Phase 1: Generate anatomy graph
      const graphResult = await unitOfWork.execute(() => 
        this.#generationWorkflow.generate(blueprintId, recipeId, { ownerId: entityId })
      );
      
      // Track all created entities
      graphResult.entities.forEach(id => unitOfWork.trackEntity(id));
      
      // Phase 2: Build parts map
      const partsMap = await this.#buildPartsMap(graphResult.entities);
      
      // Phase 3: Update parent entity
      await this.#updateParentEntity(entityId, graphResult.rootId, partsMap);
      
      // Phase 4: Build adjacency cache
      await this.#graphBuildingWorkflow.buildCache(graphResult.rootId);
      
      // Phase 5: Generate descriptions (with proper error handling)
      await this.#descriptionWorkflow.generateAll(entityId);
      
      // Success - commit the unit of work
      await unitOfWork.commit();
      
      return { success: true, entityCount: graphResult.entities.length };
      
    } catch (error) {
      // Unit of work automatically rolled back
      this.#errorHandler.handle(error, { entityId, recipeId });
      throw error;
    }
  }
}
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Run these FIRST - fix any errors before proceeding
npm run lint
# Expected: No errors in files under src/anatomy/
```

### Level 2: Unit Tests
```bash
# Run existing tests - they MUST all pass
npm run test -- tests/unit/anatomy/anatomyGenerationService.test.js

# Run new tests
npm run test -- tests/unit/anatomy/orchestration/
npm run test -- tests/unit/anatomy/workflows/

# Expected: 100% pass rate, no test modifications needed
```

### Level 3: Integration Tests
```bash
# Run anatomy integration tests
npm run test -- tests/integration/anatomy/

# These test the full anatomy generation flow
# All must pass without modification
```

### Level 4: Full Test Suite
```bash
# Final validation - run all tests
npm run test

# No regressions should be introduced
```

## Final Validation Checklist
- [ ] All tests pass: `npm run test`
- [ ] No linting errors: `npm run lint`
- [ ] Backward compatibility maintained
- [ ] Error handling improved (no swallowed errors)
- [ ] Rollback functionality works correctly
- [ ] Code follows SOLID principles
- [ ] Documentation updated if needed

---

## Anti-Patterns to Avoid
- ❌ Don't modify the public API of AnatomyGenerationService
- ❌ Don't create new dependencies without proper injection
- ❌ Don't swallow errors - propagate them properly
- ❌ Don't use 'new' directly - use dependency injection
- ❌ Don't skip the BaseService pattern
- ❌ Don't create circular dependencies

## Implementation Notes

1. **Start with infrastructure** - Create error handler and unit of work first
2. **Extract incrementally** - Move logic piece by piece, testing each step
3. **Maintain compatibility** - The public API must remain unchanged
4. **Test continuously** - Run tests after each file creation
5. **Follow patterns** - Use existing coordinator and service patterns as guides

## Confidence Score: 9/10

This PRP provides comprehensive context and clear implementation steps. The confidence is high because:
- All necessary patterns and examples are included
- The refactoring follows established codebase conventions
- Validation steps are clear and executable
- The approach is incremental and testable

The only uncertainty is around potential edge cases in the rollback mechanism, which will be discovered during implementation.