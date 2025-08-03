# ACTCAT-004: Dependency Injection Integration

## Overview

Integrate the `ActionCategorizationService` into the project's dependency injection system, ensuring proper registration, token definition, and container configuration. This enables the service to be injected into components that need categorization functionality.

## Priority

**HIGH** - Required before any components can use the categorization service

## Dependencies

- **Blocks**: ACTCAT-001 (ActionCategorizationService implementation)
- **Blocks**: ACTCAT-003 (Configuration schema and validation)
- **Enables**: ACTCAT-005, ACTCAT-009 (Components that depend on the service)

## Acceptance Criteria

- [ ] Service token defined following project conventions
- [ ] Service registered in dependency injection container
- [ ] Configuration loading integrated with DI system
- [ ] Service can be resolved correctly from container
- [ ] Proper dependency validation and error handling
- [ ] Integration with existing project DI patterns
- [ ] Container configuration tests pass
- [ ] Service lifecycle management (singleton pattern)

## Implementation Steps

### Step 1: Define Service Token

**File**: `src/dependencyInjection/tokens.js` (modify existing)

```javascript
// Add to existing tokens
export const IActionCategorizationService = Symbol(
  'IActionCategorizationService'
);
export const IActionCategorizationConfigLoader = Symbol(
  'IActionCategorizationConfigLoader'
);
```

### Step 2: Register Service in Container Configuration

**File**: `src/dependencyInjection/containerConfig.js` (modify existing)

First, let me check the existing container configuration pattern:

```javascript
// Add these imports to the existing file
import ActionCategorizationService from '../entities/utils/ActionCategorizationService.js';
import { ActionCategorizationConfigLoader } from '../entities/utils/actionCategorizationConfigLoader.js';
import {
  IActionCategorizationService,
  IActionCategorizationConfigLoader,
} from './tokens.js';

// Add to the configureContainer function
export function configureContainer(container, pathConfig) {
  // ... existing registrations ...

  // Register ActionCategorizationConfigLoader
  container.register({
    token: IActionCategorizationConfigLoader,
    factory: (c) =>
      new ActionCategorizationConfigLoader({
        logger: c.resolve(ILogger),
      }),
    lifetime: 'singleton',
  });

  // Register ActionCategorizationService
  container.register({
    token: IActionCategorizationService,
    factory: (c) =>
      new ActionCategorizationService({
        logger: c.resolve(ILogger),
      }),
    lifetime: 'singleton',
  });

  // ... rest of existing registrations ...
}
```

### Step 3: Create Service Registration Helper

**File**: `src/dependencyInjection/actionCategorizationRegistrations.js`

```javascript
/**
 * @file Action Categorization Service Registrations
 * Centralized registration for all action categorization related services
 */

import ActionCategorizationService from '../entities/utils/ActionCategorizationService.js';
import { ActionCategorizationConfigLoader } from '../entities/utils/actionCategorizationConfigLoader.js';
import {
  IActionCategorizationService,
  IActionCategorizationConfigLoader,
  ILogger,
} from './tokens.js';

/**
 * Register all action categorization services
 * @param {Container} container - Dependency injection container
 */
export function registerActionCategorizationServices(container) {
  // Configuration loader - manages loading configs from various sources
  container.register({
    token: IActionCategorizationConfigLoader,
    factory: (c) => {
      const logger = c.resolve(ILogger);
      return new ActionCategorizationConfigLoader({ logger });
    },
    lifetime: 'singleton',
    tags: ['configuration', 'action-categorization'],
  });

  // Main categorization service - provides categorization logic
  container.register({
    token: IActionCategorizationService,
    factory: (c) => {
      const logger = c.resolve(ILogger);
      return new ActionCategorizationService({ logger });
    },
    lifetime: 'singleton',
    tags: ['service', 'action-categorization'],
  });
}

/**
 * Validate action categorization service registrations
 * @param {Container} container - Container to validate
 * @throws {Error} If validation fails
 */
export function validateActionCategorizationRegistrations(container) {
  const requiredServices = [
    {
      token: IActionCategorizationService,
      name: 'ActionCategorizationService',
    },
    {
      token: IActionCategorizationConfigLoader,
      name: 'ActionCategorizationConfigLoader',
    },
  ];

  for (const { token, name } of requiredServices) {
    if (!container.isRegistered(token)) {
      throw new Error(`${name} is not registered in the container`);
    }

    try {
      const service = container.resolve(token);
      if (!service) {
        throw new Error(`${name} resolved to null/undefined`);
      }
    } catch (error) {
      throw new Error(`Failed to resolve ${name}: ${error.message}`);
    }
  }
}

/**
 * Create a test container with action categorization services
 * @param {Object} overrides - Service overrides for testing
 * @returns {Container} Configured test container
 */
export function createTestContainerWithActionCategorization(overrides = {}) {
  const { createTestContainer } = require('../../tests/common/testBed.js');
  const container = createTestContainer();

  // Register mock logger if not provided
  if (!container.isRegistered(ILogger)) {
    container.register({
      token: ILogger,
      factory: () =>
        overrides.logger || {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        },
      lifetime: 'singleton',
    });
  }

  // Register services
  registerActionCategorizationServices(container);

  // Apply any overrides
  for (const [token, implementation] of Object.entries(overrides)) {
    if (token !== 'logger') {
      container.register({
        token,
        factory: () => implementation,
        lifetime: 'singleton',
      });
    }
  }

  return container;
}
```

### Step 4: Update Main Container Configuration

**File**: `src/dependencyInjection/containerConfig.js` (modify existing)

```javascript
// Add import for the new registration helper
import { registerActionCategorizationServices } from './actionCategorizationRegistrations.js';

// In the main configureContainer function
export function configureContainer(container, pathConfig) {
  // ... existing service registrations ...

  // Register action categorization services
  registerActionCategorizationServices(container);

  // ... rest of existing registrations ...
}
```

### Step 5: Create Interface Definition

**File**: `src/interfaces/IActionCategorizationService.js`

```javascript
/**
 * @file IActionCategorizationService interface definition
 * Defines the contract for action categorization services
 */

/**
 * Interface for action categorization services
 * @interface IActionCategorizationService
 */

/**
 * Extract namespace from actionId
 * @method
 * @name IActionCategorizationService#extractNamespace
 * @param {string} actionId - The action identifier
 * @returns {string} Extracted namespace or 'unknown'
 */

/**
 * Determine if actions should be grouped based on configuration
 * @method
 * @name IActionCategorizationService#shouldUseGrouping
 * @param {ActionComposite[]} actions - Array of actions
 * @param {CategorizationConfig} config - Grouping configuration
 * @returns {boolean} Whether to use grouping
 */

/**
 * Group actions by namespace with priority ordering
 * @method
 * @name IActionCategorizationService#groupActionsByNamespace
 * @param {ActionComposite[]} actions - Array of actions
 * @param {CategorizationConfig} config - Grouping configuration
 * @returns {Map<string, ActionComposite[]>} Grouped actions by namespace
 */

/**
 * Sort namespaces by priority configuration
 * @method
 * @name IActionCategorizationService#getSortedNamespaces
 * @param {string[]} namespaces - Array of namespace strings
 * @param {CategorizationConfig} config - Grouping configuration
 * @returns {string[]} Sorted namespace array
 */

/**
 * Format namespace for display
 * @method
 * @name IActionCategorizationService#formatNamespaceDisplayName
 * @param {string} namespace - Raw namespace string
 * @returns {string} Formatted display name
 */

export default 'IActionCategorizationService';
```

### Step 6: Create Service Factory

**File**: `src/entities/utils/actionCategorizationServiceFactory.js`

```javascript
/**
 * @file Action Categorization Service Factory
 * Factory for creating configured action categorization services
 */

import ActionCategorizationService from './ActionCategorizationService.js';
import {
  ActionCategorizationConfigLoader,
  CONFIG_SOURCES,
} from './actionCategorizationConfigLoader.js';
import {
  LLM_CATEGORIZATION_CONFIG,
  UI_CATEGORIZATION_CONFIG,
} from './actionCategorizationConfig.js';

/**
 * Factory for creating action categorization services with specific configurations
 */
export class ActionCategorizationServiceFactory {
  #logger;
  #configLoader;

  constructor({ logger, configLoader }) {
    this.#logger = logger;
    this.#configLoader = configLoader;
  }

  /**
   * Create service for UI usage
   * @returns {ActionCategorizationService} Configured service
   */
  createForUI() {
    const config = this.#configLoader.loadConfiguration(CONFIG_SOURCES.UI);
    const service = new ActionCategorizationService({
      logger: this.#logger,
    });

    this.#logger.debug('Created ActionCategorizationService for UI', {
      config: Object.keys(config),
    });

    return service;
  }

  /**
   * Create service for LLM usage
   * @returns {ActionCategorizationService} Configured service
   */
  createForLLM() {
    const config = this.#configLoader.loadConfiguration(CONFIG_SOURCES.LLM);
    const service = new ActionCategorizationService({
      logger: this.#logger,
    });

    this.#logger.debug('Created ActionCategorizationService for LLM', {
      config: Object.keys(config),
    });

    return service;
  }

  /**
   * Create service with custom configuration
   * @param {CategorizationConfig} config - Custom configuration
   * @returns {ActionCategorizationService} Configured service
   */
  createWithConfig(config) {
    const validatedConfig = this.#configLoader.loadConfiguration(
      CONFIG_SOURCES.RUNTIME,
      { config }
    );
    const service = new ActionCategorizationService({
      logger: this.#logger,
    });

    this.#logger.debug(
      'Created ActionCategorizationService with custom config'
    );

    return service;
  }

  /**
   * Create service for testing
   * @param {Object} overrides - Configuration overrides
   * @returns {ActionCategorizationService} Test-configured service
   */
  createForTesting(overrides = {}) {
    const testConfig = {
      enabled: true,
      minActionsForGrouping: 3,
      minNamespacesForGrouping: 2,
      namespaceOrder: ['core', 'test'],
      showCounts: false,
      performance: {
        enableCaching: false,
        performanceLogging: true,
        slowOperationThresholdMs: 1,
      },
      errorHandling: {
        logLevel: 'debug',
        fallbackBehavior: 'flatten',
        maxRetries: 0,
      },
      ...overrides,
    };

    return this.createWithConfig(testConfig);
  }
}

/**
 * Create default factory instance
 * @param {Object} dependencies - Required dependencies
 * @returns {ActionCategorizationServiceFactory} Factory instance
 */
export function createActionCategorizationServiceFactory({ logger }) {
  const configLoader = new ActionCategorizationConfigLoader({ logger });
  return new ActionCategorizationServiceFactory({ logger, configLoader });
}
```

### Step 7: Integration Tests

**File**: `tests/integration/dependencyInjection/actionCategorizationDI.test.js`

```javascript
/**
 * @file Action Categorization Dependency Injection Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createTestContainerWithActionCategorization,
  validateActionCategorizationRegistrations,
} from '../../../src/dependencyInjection/actionCategorizationRegistrations.js';
import {
  IActionCategorizationService,
  IActionCategorizationConfigLoader,
} from '../../../src/dependencyInjection/tokens.js';

describe('Action Categorization Dependency Injection Integration', () => {
  let container;

  beforeEach(() => {
    container = createTestContainerWithActionCategorization();
  });

  afterEach(() => {
    if (container && typeof container.dispose === 'function') {
      container.dispose();
    }
  });

  describe('Service Registration', () => {
    it('should register ActionCategorizationService', () => {
      expect(container.isRegistered(IActionCategorizationService)).toBe(true);
    });

    it('should register ActionCategorizationConfigLoader', () => {
      expect(container.isRegistered(IActionCategorizationConfigLoader)).toBe(
        true
      );
    });

    it('should resolve ActionCategorizationService successfully', () => {
      const service = container.resolve(IActionCategorizationService);

      expect(service).toBeDefined();
      expect(service).toHaveProperty('extractNamespace');
      expect(service).toHaveProperty('shouldUseGrouping');
      expect(service).toHaveProperty('groupActionsByNamespace');
      expect(service).toHaveProperty('getSortedNamespaces');
      expect(service).toHaveProperty('formatNamespaceDisplayName');
    });

    it('should resolve ActionCategorizationConfigLoader successfully', () => {
      const configLoader = container.resolve(IActionCategorizationConfigLoader);

      expect(configLoader).toBeDefined();
      expect(configLoader).toHaveProperty('loadConfiguration');
      expect(configLoader).toHaveProperty('clearCache');
    });

    it('should return same instance for singleton services', () => {
      const service1 = container.resolve(IActionCategorizationService);
      const service2 = container.resolve(IActionCategorizationService);

      expect(service1).toBe(service2);
    });
  });

  describe('Service Dependencies', () => {
    it('should inject logger into services', () => {
      const service = container.resolve(IActionCategorizationService);

      // Test that logger is working by calling a method that logs
      expect(() => service.extractNamespace('invalid')).not.toThrow();
    });

    it('should handle missing dependencies gracefully', () => {
      // Create container without logger
      const {
        DIContainer,
      } = require('../../../src/dependencyInjection/appContainer.js');
      const emptyContainer = new DIContainer();

      expect(() => {
        emptyContainer.register({
          token: IActionCategorizationService,
          factory: (c) =>
            new ActionCategorizationService({
              logger: c.resolve('ILogger'), // This should fail
            }),
        });
        emptyContainer.resolve(IActionCategorizationService);
      }).toThrow();
    });
  });

  describe('Configuration Integration', () => {
    it('should load configuration correctly', () => {
      const configLoader = container.resolve(IActionCategorizationConfigLoader);

      const config = configLoader.loadConfiguration('default');

      expect(config).toBeDefined();
      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('minActionsForGrouping');
      expect(config).toHaveProperty('namespaceOrder');
    });

    it('should handle configuration errors gracefully', () => {
      const configLoader = container.resolve(IActionCategorizationConfigLoader);

      // This should not throw, but return default config
      expect(() => {
        configLoader.loadConfiguration('invalid_source');
      }).not.toThrow();
    });
  });

  describe('Service Validation', () => {
    it('should pass registration validation', () => {
      expect(() => {
        validateActionCategorizationRegistrations(container);
      }).not.toThrow();
    });

    it('should detect missing registrations', () => {
      const {
        DIContainer,
      } = require('../../../src/dependencyInjection/appContainer.js');
      const incompleteContainer = new DIContainer();

      expect(() => {
        validateActionCategorizationRegistrations(incompleteContainer);
      }).toThrow(/not registered/);
    });
  });

  describe('Service Functionality Integration', () => {
    it('should categorize actions correctly through DI', () => {
      const service = container.resolve(IActionCategorizationService);

      const actions = [
        {
          index: 1,
          actionId: 'core:wait',
          commandString: 'wait',
          description: 'Wait',
        },
        {
          index: 2,
          actionId: 'intimacy:kiss',
          commandString: 'kiss',
          description: 'Kiss',
        },
        {
          index: 3,
          actionId: 'core:go',
          commandString: 'go',
          description: 'Go',
        },
      ];

      const config = {
        enabled: true,
        minActionsForGrouping: 3,
        minNamespacesForGrouping: 2,
        namespaceOrder: ['core', 'intimacy'],
        showCounts: false,
      };

      expect(service.shouldUseGrouping(actions, config)).toBe(true);

      const grouped = service.groupActionsByNamespace(actions, config);
      expect(grouped.size).toBe(2);
      expect(grouped.has('core')).toBe(true);
      expect(grouped.has('intimacy')).toBe(true);
    });

    it('should handle service method failures gracefully', () => {
      const service = container.resolve(IActionCategorizationService);

      // Test with invalid inputs - should not throw
      expect(() => service.extractNamespace(null)).not.toThrow();
      expect(() => service.shouldUseGrouping(null)).not.toThrow();
      expect(() => service.groupActionsByNamespace(null)).not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should not create memory leaks', () => {
      const services = [];

      // Resolve service multiple times
      for (let i = 0; i < 100; i++) {
        services.push(container.resolve(IActionCategorizationService));
      }

      // All should be the same instance (singleton)
      expect(services.every((service) => service === services[0])).toBe(true);
    });

    it('should dispose resources properly', () => {
      const service = container.resolve(IActionCategorizationService);
      const configLoader = container.resolve(IActionCategorizationConfigLoader);

      expect(service).toBeDefined();
      expect(configLoader).toBeDefined();

      // Container disposal should not throw
      expect(() => {
        if (container.dispose) {
          container.dispose();
        }
      }).not.toThrow();
    });
  });
});
```

### Step 8: Update Container Tests

**File**: `tests/integration/containerConfig.test.js` (modify existing)

```javascript
// Add to existing container configuration tests

import {
  IActionCategorizationService,
  IActionCategorizationConfigLoader,
} from '../../src/dependencyInjection/tokens.js';

describe('Container Configuration - Action Categorization', () => {
  // Add to existing test suite

  it('should register action categorization services', () => {
    expect(container.isRegistered(IActionCategorizationService)).toBe(true);
    expect(container.isRegistered(IActionCategorizationConfigLoader)).toBe(
      true
    );
  });

  it('should resolve action categorization services', () => {
    expect(() => container.resolve(IActionCategorizationService)).not.toThrow();
    expect(() =>
      container.resolve(IActionCategorizationConfigLoader)
    ).not.toThrow();
  });
});
```

### Step 9: Service Usage Examples

**File**: `docs/examples/actionCategorizationServiceUsage.js`

```javascript
/**
 * @file Action Categorization Service Usage Examples
 * Demonstrates how to use the service through dependency injection
 */

// Example 1: Basic service resolution
function basicUsageExample(container) {
  const service = container.resolve(IActionCategorizationService);

  const namespace = service.extractNamespace('core:wait');
  console.log('Extracted namespace:', namespace); // 'core'
}

// Example 2: Component integration
class ExampleComponent {
  #actionCategorizationService;
  #logger;

  constructor({ actionCategorizationService, logger }) {
    validateDependency(
      actionCategorizationService,
      'IActionCategorizationService'
    );
    validateDependency(logger, 'ILogger');

    this.#actionCategorizationService = actionCategorizationService;
    this.#logger = logger;
  }

  categorizeActions(actions) {
    const config = {
      enabled: true,
      minActionsForGrouping: 6,
      minNamespacesForGrouping: 2,
      namespaceOrder: ['core', 'intimacy', 'clothing'],
      showCounts: false,
    };

    if (this.#actionCategorizationService.shouldUseGrouping(actions, config)) {
      return this.#actionCategorizationService.groupActionsByNamespace(
        actions,
        config
      );
    }

    return new Map([['all', actions]]);
  }
}

// Example 3: Factory usage
function factoryUsageExample(container) {
  const factory = container.resolve(IActionCategorizationServiceFactory);

  const uiService = factory.createForUI();
  const llmService = factory.createForLLM();
  const testService = factory.createForTesting({ minActionsForGrouping: 2 });
}

export { basicUsageExample, ExampleComponent, factoryUsageExample };
```

## Quality Gates

### Registration Validation

- [ ] All services registered with correct tokens
- [ ] Services resolve correctly from container
- [ ] Singleton lifetime enforced
- [ ] Dependency validation works
- [ ] Error handling for missing dependencies

### Integration Testing

- [ ] Services work correctly when resolved from container
- [ ] Configuration loading integrates properly
- [ ] Memory management (no leaks)
- [ ] Performance acceptable for DI resolution

### Container Health

- [ ] Container configuration tests pass
- [ ] All existing tests still pass
- [ ] No breaking changes to existing DI setup
- [ ] Service tags and metadata correct

## Performance Targets

- [ ] Service resolution: <1ms
- [ ] Container startup impact: <10ms
- [ ] Memory overhead: <100KB for services
- [ ] No performance degradation for existing services

## Files Created

- [ ] `src/dependencyInjection/actionCategorizationRegistrations.js`
- [ ] `src/interfaces/IActionCategorizationService.js`
- [ ] `src/entities/utils/actionCategorizationServiceFactory.js`
- [ ] `tests/integration/dependencyInjection/actionCategorizationDI.test.js`
- [ ] `docs/examples/actionCategorizationServiceUsage.js`

## Files Modified

- [ ] `src/dependencyInjection/tokens.js`
- [ ] `src/dependencyInjection/containerConfig.js`
- [ ] `tests/integration/containerConfig.test.js`

## Dependencies

- **Completes**: ACTCAT-001, ACTCAT-003
- **Enables**: ACTCAT-005, ACTCAT-009

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Services registered and resolvable
- [ ] Integration tests pass
- [ ] No performance regression
- [ ] Documentation and examples complete
- [ ] Code review approved
- [ ] Container validation passes
