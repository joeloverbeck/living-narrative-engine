# Ticket 01: Project Setup & Service Interfaces

**Epic**: MultiTargetResolutionStage Decomposition  
**Phase**: 1 - Foundation  
**Priority**: High  
**Estimated Time**: 4 hours  
**Dependencies**: None  
**Assignee**: Developer  

## 📋 Summary

Create the foundational infrastructure for decomposing the 734-line `MultiTargetResolutionStage` monolith. This ticket establishes service interfaces, base classes, dependency injection tokens, and the architectural framework for the 4 specialized services.

## 🎯 Objectives

- Set up the architectural foundation for service decomposition
- Define clear service interfaces with proper TypeScript-style documentation
- Establish dependency injection patterns and tokens
- Create base classes with validation and error handling
- Prepare the testing infrastructure for subsequent tickets

## 📝 Requirements Analysis

From the specification:
> "Decompose the monolith into 4 specialized services with clear separation of concerns, reducing complexity by ~70% and enabling independent testing and maintenance."

The current `MultiTargetResolutionStage` handles 6+ distinct responsibilities:
- Pipeline Orchestration (lines 85-201)
- Legacy Action Compatibility (lines 223-293) 
- Multi-Target Resolution (lines 295-529)
- Dependency Ordering (lines 531-567)
- Scope Context Building (lines 579-644)
- Display Name Resolution (lines 713-730)

## 🏗️ Implementation Tasks

### Task 1.1: Create Service Interface Definitions (1 hour)

**Objective**: Define TypeScript-style interfaces for all 4 services

**Files to Create**:
- `src/actions/pipeline/services/interfaces/ITargetDependencyResolver.js`
- `src/actions/pipeline/services/interfaces/ILegacyTargetCompatibilityLayer.js`
- `src/actions/pipeline/services/interfaces/IScopeContextBuilder.js`
- `src/actions/pipeline/services/interfaces/ITargetDisplayNameResolver.js`

**Acceptance Criteria**:
- [ ] Each interface defines all public methods with JSDoc types
- [ ] Method signatures match the specification exactly
- [ ] Proper error handling patterns defined
- [ ] Validation requirements documented
- [ ] Import/export statements follow project conventions

**Implementation Details**:

Create `ITargetDependencyResolver.js`:
```javascript
/**
 * @file ITargetDependencyResolver - Interface for target dependency resolution
 */

/**
 * @typedef {object} TargetDefinition
 * @property {string} scope - Scope ID or expression
 * @property {string} placeholder - Template placeholder name
 * @property {string} [description] - Human-readable description
 * @property {string} [contextFrom] - Use another target as context
 * @property {boolean} [optional] - Whether target is optional
 */

/**
 * @typedef {object} ValidationResult
 * @property {boolean} success - Whether validation passed
 * @property {string[]} errors - Array of error messages
 * @property {string[]} warnings - Array of warning messages
 */

/**
 * Interface for analyzing target definitions and determining resolution order
 */
export class ITargetDependencyResolver {
  /**
   * Analyze target definitions and return resolution order
   * @param {Object.<string, TargetDefinition>} targetDefinitions
   * @returns {string[]} Dependency-ordered target keys
   * @throws {Error} If circular dependencies detected
   */
  getResolutionOrder(targetDefinitions) {
    throw new Error('Method must be implemented by concrete class');
  }
  
  /**
   * Validate target definitions for dependency issues
   * @param {Object.<string, TargetDefinition>} targetDefinitions
   * @returns {ValidationResult}
   */
  validateDependencies(targetDefinitions) {
    throw new Error('Method must be implemented by concrete class');
  }
}
```

Similar patterns for other interfaces following the specification.

### Task 1.2: Create Base Service Classes (1 hour)

**Objective**: Establish common patterns for all services

**Files to Create**:
- `src/actions/pipeline/services/base/BaseService.js`
- `src/actions/pipeline/services/base/ServiceError.js`

**Acceptance Criteria**:
- [ ] Base class provides common validation patterns
- [ ] Standardized error handling with custom error types
- [ ] Logging integration following project patterns
- [ ] Dependency validation using project utilities
- [ ] JSDoc documentation for all public methods

**Implementation Details**:

Create `BaseService.js`:
```javascript
/**
 * @file BaseService - Base class for all pipeline services
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import { ServiceError } from './ServiceError.js';

/**
 * Base class providing common functionality for pipeline services
 */
export class BaseService {
  #logger;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger');
    this.#logger = logger;
  }

  /**
   * Get logger instance
   * @protected
   * @returns {ILogger}
   */
  get logger() {
    return this.#logger;
  }

  /**
   * Validate required parameters
   * @protected
   * @param {object} params - Parameters to validate
   * @param {string[]} required - Required parameter names
   * @throws {ServiceError} If validation fails
   */
  validateParams(params, required) {
    const missing = required.filter(key => 
      params[key] === undefined || params[key] === null
    );
    
    if (missing.length > 0) {
      throw new ServiceError(
        `Missing required parameters: ${missing.join(', ')}`,
        'VALIDATION_ERROR'
      );
    }
  }

  /**
   * Log service operation with consistent format
   * @protected
   * @param {string} operation - Operation name
   * @param {object} context - Operation context
   * @param {string} level - Log level
   */
  logOperation(operation, context, level = 'debug') {
    this.#logger[level](`${this.constructor.name}: ${operation}`, context);
  }
}
```

### Task 1.3: Create Dependency Injection Tokens (0.5 hours)

**Objective**: Define DI tokens for all new services

**File to Modify**: `src/dependencyInjection/tokens.js`

**Acceptance Criteria**:
- [ ] Tokens follow existing project naming conventions
- [ ] Each service has a corresponding interface token
- [ ] Tokens are properly exported
- [ ] Documentation explains token purpose

**Implementation Details**:

Add to `tokens.js`:
```javascript
// Multi-Target Resolution Stage Services
export const ITargetDependencyResolver = Symbol('ITargetDependencyResolver');
export const ILegacyTargetCompatibilityLayer = Symbol('ILegacyTargetCompatibilityLayer');
export const IScopeContextBuilder = Symbol('IScopeContextBuilder');
export const ITargetDisplayNameResolver = Symbol('ITargetDisplayNameResolver');
```

### Task 1.4: Create Service Directory Structure (0.5 hours)

**Objective**: Organize services with clear directory structure

**Directories to Create**:
```
src/actions/pipeline/services/
├── base/
│   ├── BaseService.js
│   └── ServiceError.js
├── interfaces/
│   ├── ITargetDependencyResolver.js
│   ├── ILegacyTargetCompatibilityLayer.js
│   ├── IScopeContextBuilder.js
│   └── ITargetDisplayNameResolver.js
├── implementations/
│   └── (created in subsequent tickets)
└── tests/
    └── (created in subsequent tickets)
```

**Acceptance Criteria**:
- [ ] Directory structure follows project conventions
- [ ] Each directory has appropriate README files if needed
- [ ] File organization supports easy navigation
- [ ] Import paths will work correctly

### Task 1.5: Create Service Factory Pattern (1 hour)

**Objective**: Establish factory pattern for service creation

**Files to Create**:
- `src/actions/pipeline/services/ServiceFactory.js`
- `src/actions/pipeline/services/ServiceRegistry.js`

**Acceptance Criteria**:
- [ ] Factory supports dependency injection
- [ ] Registry manages service lifecycles
- [ ] Proper error handling for missing dependencies
- [ ] Supports testing scenarios with mock services

**Implementation Details**:

Create `ServiceFactory.js`:
```javascript
/**
 * @file ServiceFactory - Factory for creating pipeline services
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * Factory for creating and configuring pipeline services
 */
export class ServiceFactory {
  #container;
  #logger;

  /**
   * @param {object} deps
   * @param {IContainer} deps.container - DI container
   * @param {ILogger} deps.logger
   */
  constructor({ container, logger }) {
    validateDependency(container, 'IContainer');
    validateDependency(logger, 'ILogger');
    
    this.#container = container;
    this.#logger = logger;
  }

  /**
   * Create service instance with dependencies
   * @param {Symbol} token - Service token
   * @returns {object} Service instance
   */
  createService(token) {
    try {
      return this.#container.resolve(token);
    } catch (error) {
      this.#logger.error(`Failed to create service for token ${token.toString()}`, error);
      throw error;
    }
  }

  /**
   * Register service in container
   * @param {Symbol} token - Service token
   * @param {Function} implementation - Service class
   * @param {object} [options] - Registration options
   */
  registerService(token, implementation, options = {}) {
    this.#container.register(token, implementation, options);
    this.#logger.debug(`Registered service: ${token.toString()}`);
  }
}
```

### Task 1.6: Update Container Configuration (1 hour)

**Objective**: Prepare DI container for new services

**File to Modify**: `src/dependencyInjection/containerConfig.js`

**Acceptance Criteria**:
- [ ] Container knows about new service tokens
- [ ] Placeholder registrations for services (will be implemented in later tickets)
- [ ] Proper dependency declarations
- [ ] Configuration supports testing scenarios

**Implementation Details**:

Add to container configuration:
```javascript
// Import new tokens
import {
  ITargetDependencyResolver,
  ILegacyTargetCompatibilityLayer,
  IScopeContextBuilder,
  ITargetDisplayNameResolver,
} from './tokens.js';

// Register placeholder services (implementations added in later tickets)
// These will be replaced with actual implementations in subsequent tickets
container.register(ITargetDependencyResolver, class PlaceholderTargetDependencyResolver {
  constructor() {
    throw new Error('TargetDependencyResolver implementation not yet created');
  }
});

// Similar placeholders for other services...
```

## 🧪 Testing Requirements

### Unit Tests Required:

**File**: `tests/unit/actions/pipeline/services/base/BaseService.test.js`
- [ ] Test constructor validation
- [ ] Test parameter validation
- [ ] Test logging functionality
- [ ] Test error handling

**File**: `tests/unit/actions/pipeline/services/ServiceFactory.test.js`
- [ ] Test service creation
- [ ] Test service registration
- [ ] Test error scenarios
- [ ] Test container integration

### Integration Tests Required:

**File**: `tests/integration/actions/pipeline/services/ServiceRegistration.test.js`
- [ ] Test DI container configuration
- [ ] Test service resolution
- [ ] Test circular dependency detection
- [ ] Test missing dependency scenarios

## 📊 Success Criteria

### Functional Requirements:
- [ ] All service interfaces properly defined with complete method signatures
- [ ] Base service class provides common functionality
- [ ] DI container properly configured for new services
- [ ] Service factory pattern enables easy testing and mocking
- [ ] Directory structure supports organized development

### Quality Requirements:
- [ ] All files follow project coding standards
- [ ] JSDoc documentation for all public interfaces
- [ ] Error handling follows project patterns
- [ ] Validation uses project utilities
- [ ] Import/export statements follow conventions

### Testing Requirements:
- [ ] Unit test coverage ≥ 90% for all base classes
- [ ] Integration tests verify DI container configuration
- [ ] All tests pass with existing project test runner
- [ ] Test structure follows project conventions

## 🚨 Risk Assessment

### High Risk:
- **DI Container Integration**: Ensure new services integrate properly with existing container
- **Mitigation**: Thorough testing of container configuration and service resolution

### Medium Risk:
- **Interface Compatibility**: Ensure interfaces match future implementation needs
- **Mitigation**: Review interfaces against specification requirements

### Low Risk:
- **Directory Structure**: File organization may need adjustment
- **Mitigation**: Follow existing project patterns closely

## 🔄 Dependencies

### Prerequisites:
- None (foundational ticket)

### Blocks:
- Ticket 02: TargetDependencyResolver Implementation
- Ticket 03: LegacyTargetCompatibilityLayer Implementation
- Ticket 05: ScopeContextBuilder Implementation
- Ticket 06: TargetDisplayNameResolver Implementation

## 📋 Definition of Done

- [ ] All service interfaces created with complete method signatures
- [ ] Base service class implemented with common functionality
- [ ] DI tokens defined and container configured
- [ ] Service factory pattern implemented
- [ ] Directory structure established
- [ ] Unit tests written and passing (≥90% coverage)
- [ ] Integration tests verify DI configuration
- [ ] Code follows project standards
- [ ] JSDoc documentation complete
- [ ] Code review completed and approved

## 📚 Resources

### Specification References:
- Section: "Service-Oriented Design" (lines 52-68)
- Section: "Implementation Guidelines" (lines 730-791)
- Section: "Dependency Injection Registration" (lines 794-812)

### Code References:
- Current MultiTargetResolutionStage: `src/actions/pipeline/stages/MultiTargetResolutionStage.js`
- Project DI patterns: `src/dependencyInjection/`
- Project validation utilities: `src/utils/dependencyUtils.js`

### Related Files:
- `src/dependencyInjection/tokens.js` - Token definitions
- `src/dependencyInjection/containerConfig.js` - Container setup
- `src/utils/dependencyUtils.js` - Validation utilities

---

**Created**: 2025-01-08  
**Last Updated**: 2025-01-08  
**Status**: Ready for Implementation