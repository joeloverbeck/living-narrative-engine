# Ticket 7: Integration Testing Enhancement

## Overview

Enhance the integration testing suite to validate interactions between multi-target action system components, ensuring proper data flow, interface contracts, and component integration. This focuses on testing the seams between components rather than complete end-to-end workflows.

## Problem Statement

**Current Issue**: Existing integration tests don't cover the complex interactions between multi-target action components, making it difficult to detect integration issues early and ensure component contracts are maintained.

**Root Cause**: Integration tests were designed for the original single-target system and need enhancement to validate:
- Data flow between action pipeline stages
- Interface contracts between services
- Event payload transformation across stages  
- Error propagation and handling across component boundaries
- Service dependency interactions

**Target Outcome**: Comprehensive integration test suite that validates all component interactions and prevents integration regressions.

## Dependencies

- **Tickets 1-6**: All previous implementation and testing tickets
- Existing Jest integration testing framework
- Component interface definitions and contracts
- Service dependency injection system
- Mock implementations for external dependencies

## Implementation Details

### 1. Enhanced Integration Test Framework

**Step 1.1**: Create multi-target integration test infrastructure

```javascript
/**
 * @file multiTargetIntegrationTestBed.js
 * @description Integration testing infrastructure for multi-target components
 */

import { createContainer } from '../../../src/dependencyInjection/container.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

class MultiTargetIntegrationTestBed {
  constructor() {
    this.#container = null;
    this.#services = new Map();
    this.#eventCapture = [];
    this.#performanceMetrics = new Map();
  }
  
  #container;
  #services;
  #eventCapture;
  #performanceMetrics;
  
  /**
   * Setup integration test environment
   * @param {Object} options - Configuration options
   * @returns {Promise<void>}
   */
  async setup(options = {}) {
    // Create dependency injection container
    this.#container = createContainer();
    
    // Register test implementations
    await this.#registerTestServices(options);
    
    // Setup event monitoring
    this.#setupEventCapture();
    
    // Initialize performance monitoring
    this.#setupPerformanceMonitoring();
    
    console.log('Multi-target integration test bed initialized');
  }
  
  /**
   * Get service instance for testing
   * @param {Symbol} token - Service token
   * @returns {Object} - Service instance
   */
  getService(token) {
    return this.#container.resolve(token);
  }
  
  /**
   * Create test context for multi-target action
   * @param {Object} config - Context configuration
   * @returns {Object} - Test context
   */
  createTestContext(config = {}) {
    return {
      actorId: config.actorId || 'test_actor',
      actionId: config.actionId || 'test:multi_target_action',
      actionDefinition: config.actionDefinition || this.#createTestActionDefinition(),
      gameState: config.gameState || {},
      targetHints: config.targetHints || {},
      timestamp: Date.now(),
      ...config.additionalProperties
    };
  }
  
  /**
   * Execute integration test scenario
   * @param {string} scenarioName - Name of scenario to execute
   * @param {Object} config - Scenario configuration
   * @returns {Promise<Object>} - Test result
   */
  async executeScenario(scenarioName, config = {}) {
    const startTime = Date.now();
    this.#eventCapture = [];
    
    try {
      const scenario = this.#getScenario(scenarioName);
      const result = await scenario.execute(config, this);
      
      return {
        success: true,
        scenario: scenarioName,
        result,
        executionTime: Date.now() - startTime,
        eventsCapured: this.#eventCapture.length,
        performanceMetrics: this.#getPerformanceSnapshot()
      };
      
    } catch (error) {
      return {
        success: false,
        scenario: scenarioName,
        error: error.message,
        executionTime: Date.now() - startTime,
        eventsCapured: this.#eventCapture.length,
        stack: error.stack
      };
    }
  }
  
  /**
   * Validate service integration
   * @param {Symbol} serviceToken - Service to validate
   * @param {Object} expectations - Expected behavior
   * @returns {Object} - Validation result
   */
  validateServiceIntegration(serviceToken, expectations) {
    const service = this.getService(serviceToken);
    const validation = {
      valid: true,
      checks: {},
      errors: []
    };
    
    // Validate service exists
    validation.checks.serviceExists = !!service;
    if (!service) {
      validation.valid = false;
      validation.errors.push(`Service ${serviceToken.toString()} not found`);
      return validation;
    }
    
    // Validate required methods exist
    if (expectations.requiredMethods) {
      expectations.requiredMethods.forEach(method => {
        const hasMethod = typeof service[method] === 'function';
        validation.checks[`hasMethod_${method}`] = hasMethod;
        
        if (!hasMethod) {
          validation.valid = false;
          validation.errors.push(`Service missing required method: ${method}`);
        }
      });
    }
    
    // Validate service dependencies
    if (expectations.dependencies) {
      expectations.dependencies.forEach(depToken => {
        try {
          const dependency = this.getService(depToken);
          validation.checks[`dependency_${depToken.toString()}`] = !!dependency;
          
          if (!dependency) {
            validation.valid = false;
            validation.errors.push(`Service dependency not available: ${depToken.toString()}`);
          }
        } catch (error) {
          validation.valid = false;
          validation.errors.push(`Dependency resolution failed: ${depToken.toString()}`);
        }
      });
    }
    
    return validation;
  }
  
  /**
   * Get captured events for analysis
   * @returns {Array} - Captured events
   */
  getCapturedEvents() {
    return [...this.#eventCapture];
  }
  
  /**
   * Get performance metrics
   * @returns {Object} - Performance metrics
   */
  getPerformanceMetrics() {
    const snapshot = this.#getPerformanceSnapshot();
    
    return {
      ...snapshot,
      averageOperationTime: this.#calculateAverageOperationTime(),
      totalOperations: this.#performanceMetrics.size,
      slowestOperation: this.#findSlowestOperation()
    };
  }
  
  /**
   * Cleanup test environment
   * @returns {Promise<void>}
   */
  async cleanup() {
    this.#eventCapture = [];
    this.#performanceMetrics.clear();
    
    if (this.#container) {
      // Cleanup container resources if needed
      this.#container = null;
    }
    
    this.#services.clear();
  }
  
  // Private helper methods
  
  /**
   * Register test service implementations
   * @private
   * @param {Object} options - Configuration options
   */
  async #registerTestServices(options) {
    // Register mock logger
    this.#container.register(tokens.ILogger, {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    });
    
    // Register mock entity query manager
    this.#container.register(tokens.IEntityQueryManager, {
      getEntity: jest.fn().mockImplementation(async (id) => ({
        id,
        name: `Mock Entity ${id}`,
        type: 'test_entity'
      })),
      entityExists: jest.fn().mockResolvedValue(true)
    });
    
    // Register mock event bus with capture
    this.#container.register(tokens.IEventBus, {
      dispatch: jest.fn((event) => {
        this.#eventCapture.push({
          ...event,
          timestamp: Date.now()
        });
      }),
      subscribe: jest.fn()
    });
    
    // Register real multi-target services for integration testing
    await this.#registerMultiTargetServices(options);
  }
  
  /**
   * Register multi-target services for integration testing
   * @private
   * @param {Object} options - Configuration options
   */
  async #registerMultiTargetServices(options) {
    // Register TargetReferenceResolver
    const { default: TargetReferenceResolver } = await import('../../../src/services/TargetReferenceResolver.js');
    this.#container.register(tokens.ITargetReferenceResolver, TargetReferenceResolver);
    
    // Register EnhancedTargetManager
    const { default: EnhancedTargetManager } = await import('../../../src/managers/EnhancedTargetManager.js');
    this.#container.register(tokens.ITargetManager, EnhancedTargetManager);
    
    // Register ActionFormattingStage
    const { default: ActionFormattingStage } = await import('../../../src/actions/pipeline/stages/ActionFormattingStage.js');
    this.#container.register(tokens.IActionFormattingStage, ActionFormattingStage);
    
    // Register other multi-target components as needed
    if (options.additionalServices) {
      for (const [token, service] of options.additionalServices) {
        this.#container.register(token, service);
      }
    }
  }
  
  /**
   * Setup event capture monitoring
   * @private
   */
  #setupEventCapture() {
    // Event capture is handled by the mock event bus
    // This method can be extended for more sophisticated monitoring
  }
  
  /**
   * Setup performance monitoring
   * @private
   */
  #setupPerformanceMonitoring() {
    // Hook into service methods to capture performance metrics
    // This would be implemented based on specific monitoring needs
  }
  
  /**
   * Create test action definition
   * @private
   * @returns {Object} - Test action definition
   */
  #createTestActionDefinition() {
    return {
      id: 'test:multi_target_action',
      name: 'Test Multi-Target Action',
      targets: [
        {
          name: 'primary',
          type: 'character',
          required: true
        },
        {
          name: 'secondary',
          type: 'item',
          required: true,
          contextFrom: 'primary'
        }
      ]
    };
  }
  
  /**
   * Get test scenario by name
   * @private
   * @param {string} scenarioName - Scenario name
   * @returns {Object} - Scenario implementation
   */
  #getScenario(scenarioName) {
    const scenarios = {
      'target-resolution-flow': new TargetResolutionFlowScenario(),
      'event-payload-transformation': new EventPayloadTransformationScenario(),
      'rule-execution-integration': new RuleExecutionIntegrationScenario(),
      'error-propagation': new ErrorPropagationScenario(),
      'service-dependency-validation': new ServiceDependencyValidationScenario()
    };
    
    const scenario = scenarios[scenarioName];
    if (!scenario) {
      throw new Error(`Unknown scenario: ${scenarioName}`);
    }
    
    return scenario;
  }
  
  /**
   * Get performance snapshot
   * @private
   * @returns {Object} - Performance snapshot
   */
  #getPerformanceSnapshot() {
    return {
      capturedAt: Date.now(),
      metricsCount: this.#performanceMetrics.size,
      // Additional performance data would be captured here
    };
  }
}

export default MultiTargetIntegrationTestBed;
```

### 2. Component Integration Scenarios

**Step 2.1**: Create target resolution flow integration tests

```javascript
/**
 * @file targetResolutionIntegration.test.js  
 * @description Integration tests for target resolution flow
 */

import MultiTargetIntegrationTestBed from '../common/multiTargetIntegrationTestBed.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('Target Resolution Integration', () => {
  let testBed;
  
  beforeEach(async () => {
    testBed = new MultiTargetIntegrationTestBed();
    await testBed.setup();
  });
  
  afterEach(async () => {
    await testBed.cleanup();
  });
  
  describe('MultiTargetResolutionStage → EnhancedTargetManager', () => {
    it('should properly integrate target resolution with target manager', async () => {
      const resolutionStage = testBed.getService(tokens.IMultiTargetResolutionStage);
      const targetManager = testBed.getService(tokens.ITargetManager);
      
      const context = testBed.createTestContext({
        actionId: 'intimacy:adjust_clothing',
        targetHints: {
          primary: 'test_character_id',
          secondary: 'test_item_id'
        }
      });
      
      // Execute resolution stage
      const resolvedContext = await resolutionStage.execute(context);
      
      // Verify target manager was populated
      expect(resolvedContext.targetManager).toBeDefined();
      expect(resolvedContext.targetManager.getResolvedTargetCount()).toBe(2);
      expect(resolvedContext.targetManager.getEntityIdByPlaceholder('primary')).toBe('test_character_id');
      expect(resolvedContext.targetManager.getEntityIdByPlaceholder('secondary')).toBe('test_item_id');
      
      // Verify target manager provides correct information for next stage
      const targetInfo = resolvedContext.targetManager.getTargetInfoForEventPayload();
      expect(targetInfo.legacy.primaryId).toBe('test_character_id');
      expect(targetInfo.comprehensive.primary.entityId).toBe('test_character_id');
    });
    
    it('should handle context-dependent target resolution', async () => {
      const resolutionStage = testBed.getService(tokens.IMultiTargetResolutionStage);
      
      const context = testBed.createTestContext({
        actionId: 'intimacy:adjust_clothing',
        targetHints: {
          primary: 'test_character_id'
          // secondary will be resolved from primary's context
        }
      });
      
      // Mock context-dependent resolution
      const entityQueryManager = testBed.getService(tokens.IEntityQueryManager);
      entityQueryManager.getEntity.mockImplementation(async (id) => {
        if (id === 'test_character_id') {
          return {
            id: 'test_character_id',
            name: 'Test Character',
            clothing: ['test_clothing_id']
          };
        }
        if (id === 'test_clothing_id') {
          return {
            id: 'test_clothing_id',
            name: 'Test Clothing',
            owner: 'test_character_id'
          };
        }
        return null;
      });
      
      const resolvedContext = await resolutionStage.execute(context);
      
      // Verify context dependency was detected and handled
      expect(resolvedContext.targetManager.hasContextDependencies()).toBe(true);
      expect(resolvedContext.targetManager.getEntityIdByPlaceholder('secondary')).toBe('test_clothing_id');
      
      const targetInfo = resolvedContext.targetManager.getTargetInfoForEventPayload();
      expect(targetInfo.comprehensive.secondary.resolvedFromContext).toBe(true);
      expect(targetInfo.comprehensive.secondary.contextSource).toBe('primary');
    });
  });
  
  describe('EnhancedTargetManager → ActionFormattingStage', () => {
    it('should properly pass target information to action formatting', async () => {
      const targetManager = testBed.getService(tokens.ITargetManager);
      const formattingStage = testBed.getService(tokens.IActionFormattingStage);
      
      // Setup target manager with test data
      targetManager.addResolvedTarget('primary', 'character_id', {
        description: 'Test Character',
        resolutionMethod: 'direct'
      });
      targetManager.addResolvedTarget('secondary', 'item_id', {
        description: 'Test Item',
        resolvedFromContext: true,
        contextSource: 'primary'
      });
      
      const context = testBed.createTestContext({
        targetManager,
        formattedText: 'Test character adjusts test item'
      });
      
      // Execute formatting stage
      const formattedContext = await formattingStage.execute(context);
      
      // Verify enhanced event payload was created
      expect(formattedContext.actionEvent).toBeDefined();
      expect(formattedContext.actionEvent.payload.primaryId).toBe('character_id');
      expect(formattedContext.actionEvent.payload.secondaryId).toBe('item_id');
      expect(formattedContext.actionEvent.payload.targets.primary.entityId).toBe('character_id');
      expect(formattedContext.actionEvent.payload.targets.secondary.resolvedFromContext).toBe(true);
      expect(formattedContext.actionEvent.payload.hasContextDependencies).toBe(true);
    });
    
    it('should handle target manager errors gracefully', async () => {
      const formattingStage = testBed.getService(tokens.IActionFormattingStage);
      
      // Create context with malfunctioning target manager
      const context = testBed.createTestContext({
        targetManager: {
          getTargetInfoForEventPayload: () => {
            throw new Error('Target manager error');
          }
        }
      });
      
      // Should handle error gracefully
      const formattedContext = await formattingStage.execute(context);
      
      // Should create fallback event payload
      expect(formattedContext.actionEvent).toBeDefined();
      expect(formattedContext.actionEvent.payload.error).toBeDefined();
      expect(formattedContext.actionEvent.payload.resolvedTargetCount).toBe(0);
    });
  });
});
```

**Step 2.2**: Create event payload transformation integration tests

```javascript
/**
 * @file eventPayloadTransformation.integration.test.js
 * @description Integration tests for event payload transformation across stages
 */

describe('Event Payload Transformation Integration', () => {
  let testBed;
  
  beforeEach(async () => {
    testBed = new MultiTargetIntegrationTestBed();
    await testBed.setup();
  });
  
  afterEach(async () => {
    await testBed.cleanup();
  });
  
  describe('ActionFormattingStage → RuleExecutionStage', () => {
    it('should properly transform target information for rule execution', async () => {
      const result = await testBed.executeScenario('event-payload-transformation', {
        actionId: 'intimacy:adjust_clothing',
        targets: {
          primary: { id: 'amaia_id', name: 'Amaia Castillo' },
          secondary: { id: 'jacket_id', name: 'denim trucker jacket' }
        }
      });
      
      expect(result.success).toBe(true);
      
      // Verify event payload was properly transformed
      const events = testBed.getCapturedEvents();
      const actionEvent = events.find(e => e.type === 'core:attempt_action');
      
      expect(actionEvent).toBeDefined();
      expect(actionEvent.payload.primaryId).toBe('amaia_id');
      expect(actionEvent.payload.targets.primary.entityId).toBe('amaia_id');
      
      // Verify rule execution received correct payload
      expect(result.result.ruleExecutionReceived).toBeDefined();
      expect(result.result.ruleExecutionReceived.primaryId).toBe('amaia_id');
      expect(result.result.ruleExecutionReceived.targets.primary.entityId).toBe('amaia_id');
    });
    
    it('should maintain payload consistency between legacy and comprehensive formats', async () => {
      const result = await testBed.executeScenario('event-payload-transformation', {
        actionId: 'test:multi_target',
        validateConsistency: true,
        targets: {
          primary: { id: 'entity_1', name: 'Entity One' },
          secondary: { id: 'entity_2', name: 'Entity Two' },
          tertiary: { id: 'entity_3', name: 'Entity Three' }
        }
      });
      
      expect(result.success).toBe(true);
      
      const events = testBed.getCapturedEvents();
      const actionEvent = events.find(e => e.type === 'core:attempt_action');
      
      // Verify consistency between formats
      expect(actionEvent.payload.primaryId).toBe(actionEvent.payload.targets.primary.entityId);
      expect(actionEvent.payload.secondaryId).toBe(actionEvent.payload.targets.secondary.entityId);
      expect(actionEvent.payload.tertiaryId).toBe(actionEvent.payload.targets.tertiary.entityId);
      
      // Verify metadata is consistent
      expect(actionEvent.payload.resolvedTargetCount).toBe(3);
      expect(Object.keys(actionEvent.payload.targets)).toHaveLength(3);
    });
  });
  
  describe('Event Validation Integration', () => {
    it('should integrate with schema validation system', async () => {
      const schemaValidator = testBed.getService(tokens.ISchemaValidator);
      
      const result = await testBed.executeScenario('event-payload-transformation', {
        enableSchemaValidation: true,
        actionId: 'intimacy:adjust_clothing',
        targets: {
          primary: { id: 'valid_character_id', name: 'Valid Character' },
          secondary: { id: 'valid_item_id', name: 'Valid Item' }
        }
      });
      
      expect(result.success).toBe(true);
      
      // Verify schema validation was called
      expect(schemaValidator.validateEventPayload).toHaveBeenCalled();
      
      // Verify validation passed
      const validationCall = schemaValidator.validateEventPayload.mock.calls[0];
      const validationResult = await schemaValidator.validateEventPayload(...validationCall);
      expect(validationResult.valid).toBe(true);
    });
    
    it('should handle schema validation failures gracefully', async () => {
      const schemaValidator = testBed.getService(tokens.ISchemaValidator);
      schemaValidator.validateEventPayload.mockResolvedValue({
        valid: false,
        errors: [{ message: 'Test validation error' }]
      });
      
      const result = await testBed.executeScenario('event-payload-transformation', {
        enableSchemaValidation: true,
        actionId: 'test:invalid_action'
      });
      
      // Should handle validation failure appropriately
      if (result.success) {
        // If it continues, should log the validation error
        const logger = testBed.getService(tokens.ILogger);
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('validation'),
          expect.any(Object)
        );
      } else {
        // If it fails, should provide meaningful error
        expect(result.error).toContain('validation');
      }
    });
  });
});
```

### 3. Service Dependency Integration Tests

**Step 3.1**: Create service interaction tests

```javascript
/**
 * @file serviceDependencyIntegration.test.js
 * @description Integration tests for service dependencies and interactions
 */

describe('Service Dependency Integration', () => {
  let testBed;
  
  beforeEach(async () => {
    testBed = new MultiTargetIntegrationTestBed();
    await testBed.setup();
  });
  
  afterEach(async () => {
    await testBed.cleanup();
  });
  
  describe('TargetReferenceResolver Service Integration', () => {
    it('should integrate with rule execution context', async () => {
      const targetReferenceResolver = testBed.getService(tokens.ITargetReferenceResolver);
      const ruleExecutor = testBed.getService(tokens.IRuleExecutor);
      
      // Validate service integration
      const validation = testBed.validateServiceIntegration(tokens.ITargetReferenceResolver, {
        requiredMethods: ['resolvePlaceholder', 'validatePlaceholders', 'isPlaceholderName'],
        dependencies: [tokens.ILogger, tokens.IEntityQueryManager]
      });
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      
      // Test actual integration
      const eventPayload = {
        actorId: 'test_actor',
        actionId: 'test:action',
        primaryId: 'test_primary_entity',
        targets: {
          primary: {
            entityId: 'test_primary_entity',
            placeholder: 'primary'
          }
        }
      };
      
      const resolvedId = await targetReferenceResolver.resolvePlaceholder('primary', eventPayload);
      expect(resolvedId).toBe('test_primary_entity');
      
      // Verify integration with rule execution
      const mockRuleContext = {
        eventPayload,
        resolveEntityReference: jest.fn()
      };
      
      // Service should be usable in rule context
      expect(typeof targetReferenceResolver.resolvePlaceholder).toBe('function');
    });
    
    it('should handle entity query manager integration', async () => {
      const targetReferenceResolver = testBed.getService(tokens.ITargetReferenceResolver);
      const entityQueryManager = testBed.getService(tokens.IEntityQueryManager);
      
      // Test with valid entity
      entityQueryManager.getEntity.mockResolvedValue({
        id: 'test_entity',
        name: 'Test Entity'
      });
      
      const validation = await targetReferenceResolver.validatePlaceholders(
        ['primary'],
        {
          primaryId: 'test_entity',
          targets: {
            primary: { entityId: 'test_entity', placeholder: 'primary' }
          }
        }
      );
      
      expect(validation.valid).toBe(true);
      expect(entityQueryManager.getEntity).toHaveBeenCalledWith('test_entity');
      
      // Test with non-existent entity
      entityQueryManager.getEntity.mockRejectedValue(new Error('Entity not found'));
      
      const validationFailed = await targetReferenceResolver.validatePlaceholders(
        ['secondary'],
        {
          secondaryId: 'non_existent_entity',
          targets: {
            secondary: { entityId: 'non_existent_entity', placeholder: 'secondary' }
          }
        }
      );
      
      expect(validationFailed.valid).toBe(false);
      expect(validationFailed.errors.some(e => e.errorType === 'ENTITY_NOT_FOUND')).toBe(true);
    });
  });
  
  describe('Enhanced Target Manager Service Integration', () => {
    it('should integrate with action formatting stage', async () => {
      const targetManager = testBed.getService(tokens.ITargetManager);
      const formattingStage = testBed.getService(tokens.IActionFormattingStage);
      
      // Validate service integration
      const validation = testBed.validateServiceIntegration(tokens.ITargetManager, {
        requiredMethods: [
          'getTargetInfoForEventPayload',
          'getEntityIdByPlaceholder',
          'hasContextDependencies'
        ],
        dependencies: [tokens.ILogger, tokens.IEntityQueryManager]
      });
      
      expect(validation.valid).toBe(true);
      
      // Setup target manager
      targetManager.addResolvedTarget('primary', 'test_primary', {
        description: 'Test Primary Entity'
      });
      targetManager.addResolvedTarget('secondary', 'test_secondary', {
        description: 'Test Secondary Entity',
        resolvedFromContext: true,
        contextSource: 'primary'
      });
      
      // Test integration with formatting stage
      const context = {
        targetManager,
        actorId: 'test_actor',
        actionId: 'test:action',
        formattedText: 'Test action text'
      };
      
      const formattedContext = await formattingStage.execute(context);
      
      // Verify target manager information was used
      expect(formattedContext.actionEvent.payload.primaryId).toBe('test_primary');
      expect(formattedContext.actionEvent.payload.secondaryId).toBe('test_secondary');
      expect(formattedContext.actionEvent.payload.hasContextDependencies).toBe(true);
    });
    
    it('should integrate with multi-target resolution stage', async () => {
      const resolutionStage = testBed.getService(tokens.IMultiTargetResolutionStage);
      
      const context = testBed.createTestContext({
        actionDefinition: {
          targets: [
            { name: 'primary', type: 'character', required: true },
            { name: 'secondary', type: 'item', required: true, contextFrom: 'primary' }
          ]
        }
      });
      
      const resolvedContext = await resolutionStage.execute(context);
      
      // Verify target manager was created and populated
      expect(resolvedContext.targetManager).toBeDefined();
      expect(typeof resolvedContext.targetManager.getEntityIdByPlaceholder).toBe('function');
      expect(typeof resolvedContext.targetManager.hasContextDependencies).toBe('function');
      
      // Verify target manager has expected data structure
      const metadata = resolvedContext.targetManager.getResolutionMetadata();
      expect(metadata).toHaveProperty('resolvedTargets');
      expect(metadata).toHaveProperty('hasContextDependencies');
    });
  });
  
  describe('Event Bus Integration', () => {
    it('should properly integrate with event dispatching', async () => {
      const eventBus = testBed.getService(tokens.IEventBus);
      const formattingStage = testBed.getService(tokens.IActionFormattingStage);
      
      const context = testBed.createTestContext();
      await formattingStage.execute(context);
      
      // Verify event was dispatched
      expect(eventBus.dispatch).toHaveBeenCalled();
      
      const capturedEvents = testBed.getCapturedEvents();
      expect(capturedEvents.length).toBeGreaterThan(0);
      
      const actionEvent = capturedEvents.find(e => e.type === 'core:attempt_action');
      expect(actionEvent).toBeDefined();
      expect(actionEvent.payload).toBeDefined();
    });
    
    it('should handle event bus errors gracefully', async () => {
      const eventBus = testBed.getService(tokens.IEventBus);
      eventBus.dispatch.mockImplementation(() => {
        throw new Error('Event bus error');
      });
      
      const formattingStage = testBed.getService(tokens.IActionFormattingStage);
      const context = testBed.createTestContext();
      
      // Should handle event bus error gracefully
      const result = await formattingStage.execute(context);
      
      // Should either succeed with error logged or fail gracefully
      if (result.error) {
        expect(result.error).toContain('event');
      } else {
        const logger = testBed.getService(tokens.ILogger);
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('event'),
          expect.any(Error)
        );
      }
    });
  });
});
```

### 4. Error Propagation Integration Tests

**Step 4.1**: Create error handling integration tests

```javascript
/**
 * @file errorPropagationIntegration.test.js
 * @description Integration tests for error propagation across components
 */

describe('Error Propagation Integration', () => {
  let testBed;
  
  beforeEach(async () => {
    testBed = new MultiTargetIntegrationTestBed();
    await testBed.setup();
  });
  
  afterEach(async () => {
    await testBed.cleanup();
  });
  
  describe('Target Resolution Error Propagation', () => {
    it('should propagate target resolution errors through pipeline', async () => {
      const result = await testBed.executeScenario('error-propagation', {
        errorType: 'target-resolution-failure',
        errorStage: 'MultiTargetResolutionStage',
        errorDetails: {
          missingTargets: ['primary', 'secondary'],
          actionId: 'intimacy:adjust_clothing'
        }
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('target');
      
      // Verify error was logged appropriately
      const logger = testBed.getService(tokens.ILogger);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('target resolution'),
        expect.any(Object)
      );
      
      // Verify downstream stages were not executed
      const events = testBed.getCapturedEvents();
      const actionEvents = events.filter(e => e.type === 'core:attempt_action');
      expect(actionEvents).toHaveLength(0);
    });
    
    it('should handle entity query manager errors', async () => {
      const entityQueryManager = testBed.getService(tokens.IEntityQueryManager);
      entityQueryManager.getEntity.mockRejectedValue(new Error('Database connection failed'));
      
      const result = await testBed.executeScenario('error-propagation', {
        errorType: 'entity-query-failure',
        errorStage: 'TargetReferenceResolver',
        testTargets: ['primary']
      });
      
      // Should handle database error gracefully
      if (result.success) {
        // Should have fallback behavior
        const logger = testBed.getService(tokens.ILogger);
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('entity'),
          expect.any(Error)
        );
      } else {
        // Should provide meaningful error
        expect(result.error).toContain('entity');
      }
    });
  });
  
  describe('Rule Execution Error Propagation', () => {
    it('should handle placeholder resolution failures in rules', async () => {
      const result = await testBed.executeScenario('error-propagation', {
        errorType: 'placeholder-resolution-failure',
        errorStage: 'RuleExecutionStage',
        placeholderErrors: {
          'primary': 'Placeholder not found in event payload',
          'secondary': 'Entity ID resolution failed'
        }
      });
      
      // Should handle placeholder resolution errors
      if (result.success) {
        // Should use fallback behavior (e.g., "Unnamed Character" replacement)
        expect(result.result.narrativeText).not.toContain('undefined');
        expect(result.result.narrativeText).not.toContain('null');
      } else {
        // Should provide clear error message
        expect(result.error).toContain('placeholder');
      }
      
      // Should not crash the system
      const events = testBed.getCapturedEvents();
      expect(events.length).toBeGreaterThan(0); // Some events should still be generated
    });
    
    it('should handle operation handler failures', async () => {
      const result = await testBed.executeScenario('error-propagation', {
        errorType: 'operation-handler-failure',
        errorStage: 'RuleExecutionStage',
        operationErrors: {
          'GET_NAME': 'Operation handler crashed'
        }
      });
      
      // Should handle operation failures gracefully
      if (result.success) {
        // Should have fallback behavior
        expect(result.result.ruleExecutionResult).toBeDefined();
      } else {
        // Should provide clear error information
        expect(result.error).toContain('operation');
      }
    });
  });
  
  describe('Cross-Component Error Recovery', () => {
    it('should recover from non-critical errors', async () => {
      const result = await testBed.executeScenario('error-propagation', {
        errorType: 'non-critical-failure',
        errorStage: 'ActionFormattingStage',
        errorDetails: {
          level: 'warning',
          recoverable: true
        }
      });
      
      expect(result.success).toBe(true);
      
      // Should have warning logged but execution continues
      const logger = testBed.getService(tokens.ILogger);
      expect(logger.warn).toHaveBeenCalled();
      
      // Should produce valid output despite warning
      expect(result.result).toBeDefined();
    });
    
    it('should fail fast on critical errors', async () => {
      const result = await testBed.executeScenario('error-propagation', {
        errorType: 'critical-failure',
        errorStage: 'MultiTargetResolutionStage',
        errorDetails: {
          level: 'critical',
          recoverable: false,
          message: 'Critical system error'
        }
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Critical system error');
      
      // Should not execute downstream stages
      const performanceMetrics = testBed.getPerformanceMetrics();
      expect(performanceMetrics.totalOperations).toBeLessThan(3); // Should stop early
    });
  });
});
```

### 5. Performance Integration Tests

**Step 5.1**: Create component performance integration tests

```javascript
/**
 * @file performanceIntegration.test.js
 * @description Performance integration tests for multi-target system
 */

describe('Performance Integration', () => {
  let testBed;
  
  beforeEach(async () => {
    testBed = new MultiTargetIntegrationTestBed();
    await testBed.setup();
  });
  
  afterEach(async () => {
    await testBed.cleanup();
  });
  
  describe('Component Performance Integration', () => {
    it('should maintain performance targets across component interactions', async () => {
      const startTime = Date.now();
      
      const result = await testBed.executeScenario('target-resolution-flow', {
        performanceTest: true,
        targetCount: 3,
        complexityLevel: 'medium'
      });
      
      const executionTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(100); // 100ms target for integration
      
      const performanceMetrics = testBed.getPerformanceMetrics();
      expect(performanceMetrics.averageOperationTime).toBeLessThan(50); // 50ms per operation
    });
    
    it('should handle high-frequency operations efficiently', async () => {
      const operations = [];
      const startTime = Date.now();
      
      // Execute 50 operations concurrently
      for (let i = 0; i < 50; i++) {
        operations.push(
          testBed.executeScenario('target-resolution-flow', {
            operationId: i,
            targetCount: 2
          })
        );
      }
      
      const results = await Promise.all(operations);
      const totalTime = Date.now() - startTime;
      
      // All operations should succeed
      const successfulOperations = results.filter(r => r.success);
      expect(successfulOperations).toHaveLength(50);
      
      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(5000); // 5 seconds for 50 operations
      
      // Average time per operation should be reasonable
      const averageTime = totalTime / 50;
      expect(averageTime).toBeLessThan(100);
    });
    
    it('should scale efficiently with target count', async () => {
      const testCases = [
        { targetCount: 1, expectedMaxTime: 50 },
        { targetCount: 2, expectedMaxTime: 100 },
        { targetCount: 3, expectedMaxTime: 150 }
      ];
      
      for (const testCase of testCases) {
        const startTime = Date.now();
        
        const result = await testBed.executeScenario('target-resolution-flow', {
          targetCount: testCase.targetCount,
          scalabilityTest: true
        });
        
        const executionTime = Date.now() - startTime;
        
        expect(result.success).toBe(true);
        expect(executionTime).toBeLessThan(testCase.expectedMaxTime);
      }
    });
  });
  
  describe('Memory Usage Integration', () => {
    it('should maintain reasonable memory usage during operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Execute multiple operations
      for (let i = 0; i < 100; i++) {
        await testBed.executeScenario('target-resolution-flow', {
          memoryTest: true,
          iteration: i
        });
        
        // Force garbage collection periodically
        if (i % 20 === 0 && global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
    
    it('should clean up resources after operations', async () => {
      const initialMetrics = testBed.getPerformanceMetrics();
      
      await testBed.executeScenario('target-resolution-flow', {
        resourceCleanupTest: true
      });
      
      // Simulate cleanup
      await testBed.cleanup();
      await testBed.setup();
      
      const postCleanupMetrics = testBed.getPerformanceMetrics();
      
      // Metrics should be reset after cleanup
      expect(postCleanupMetrics.totalOperations).toBeLessThan(initialMetrics.totalOperations || 1);
    });
  });
});
```

### 6. Backward Compatibility Integration Tests

**Step 6.1**: Create compatibility integration tests

```javascript
/**
 * @file backwardCompatibilityIntegration.test.js
 * @description Integration tests for backward compatibility
 */

describe('Backward Compatibility Integration', () => {
  let testBed;
  
  beforeEach(async () => {
    testBed = new MultiTargetIntegrationTestBed();
    await testBed.setup();
  });
  
  afterEach(async () => {
    await testBed.cleanup();
  });
  
  describe('Legacy Event Format Integration', () => {
    it('should handle legacy single-target events', async () => {
      const result = await testBed.executeScenario('event-payload-transformation', {
        useLegacyFormat: true,
        singleTarget: true,
        eventPayload: {
          actorId: 'test_actor',
          actionId: 'legacy:single_target_action',
          targetId: 'test_target'
        }
      });
      
      expect(result.success).toBe(true);
      
      // Should work with existing rule system
      const events = testBed.getCapturedEvents();
      const actionEvent = events.find(e => e.type === 'core:attempt_action');
      expect(actionEvent).toBeDefined();
      
      // Should be processable by enhanced components
      expect(actionEvent.payload.actorId).toBe('test_actor');
    });
    
    it('should handle mixed legacy and enhanced format events', async () => {
      const result = await testBed.executeScenario('event-payload-transformation', {
        mixedFormats: true,
        eventPayload: {
          actorId: 'test_actor',
          actionId: 'mixed:action',
          targetId: 'legacy_target', // Legacy field
          primaryId: 'enhanced_primary', // Enhanced field
          targets: { // Enhanced structure
            primary: {
              entityId: 'enhanced_primary',
              placeholder: 'primary'
            }
          }
        }
      });
      
      expect(result.success).toBe(true);
      
      // Should resolve conflicts appropriately
      const events = testBed.getCapturedEvents();
      const actionEvent = events.find(e => e.type === 'core:attempt_action');
      
      // Enhanced format should take precedence
      expect(actionEvent.payload.primaryId).toBe('enhanced_primary');
      expect(actionEvent.payload.targets.primary.entityId).toBe('enhanced_primary');
    });
  });
  
  describe('Legacy Rule Integration', () => {
    it('should work with existing rules that use traditional entity references', async () => {
      const result = await testBed.executeScenario('rule-execution-integration', {
        legacyRules: true,
        ruleOperations: [
          {
            type: 'GET_NAME',
            parameters: {
              entity_ref: 'actor', // Traditional reference
              result_variable: 'actorName'
            }
          },
          {
            type: 'GET_NAME',
            parameters: {
              entity_ref: 'target', // Traditional reference
              result_variable: 'targetName'
            }
          }
        ]
      });
      
      expect(result.success).toBe(true);
      
      // Should resolve traditional references correctly
      expect(result.result.ruleVariables.actorName).toBeDefined();
      expect(result.result.ruleVariables.targetName).toBeDefined();
    });
    
    it('should work with rules that mix traditional and placeholder references', async () => {
      const result = await testBed.executeScenario('rule-execution-integration', {
        mixedReferences: true,
        ruleOperations: [
          {
            type: 'GET_NAME',
            parameters: {
              entity_ref: 'actor', // Traditional
              result_variable: 'actorName'
            }
          },
          {
            type: 'GET_NAME',
            parameters: {
              entity_ref: 'primary', // Enhanced placeholder
              result_variable: 'primaryName'
            }
          },
          {
            type: 'GET_NAME',
            parameters: {
              entity_ref: { entity_id: 'direct_entity_id' }, // Object reference
              result_variable: 'directName'
            }
          }
        ]
      });
      
      expect(result.success).toBe(true);
      
      // All reference types should work
      expect(result.result.ruleVariables.actorName).toBeDefined();
      expect(result.result.ruleVariables.primaryName).toBeDefined();
      expect(result.result.ruleVariables.directName).toBeDefined();
    });
  });
  
  describe('Legacy API Integration', () => {
    it('should maintain backward compatibility for existing API consumers', async () => {
      const targetManager = testBed.getService(tokens.ITargetManager);
      
      // Test legacy API methods still work
      if (targetManager.addTarget) { // Legacy method
        targetManager.addTarget({
          name: 'primary',
          entityId: 'test_entity',
          description: 'Test Entity'
        });
        
        const targets = targetManager.getTargets(); // Legacy method
        expect(targets).toHaveLength(1);
        expect(targets[0].name).toBe('primary');
      }
      
      // Enhanced methods should also work
      expect(targetManager.getEntityIdByPlaceholder('primary')).toBe('test_entity');
    });
  });
});
```

## Acceptance Criteria

### Component Integration Criteria
1. ✅ **Service Dependency Validation**: All multi-target services integrate correctly with their dependencies
2. ✅ **Interface Contract Compliance**: All components implement required interfaces correctly
3. ✅ **Data Flow Validation**: Data flows correctly between pipeline stages
4. ✅ **Event Payload Transformation**: Event payloads transform correctly across component boundaries
5. ✅ **Error Propagation**: Errors propagate appropriately without system crashes

### Integration Quality Criteria
6. ✅ **Error Handling Integration**: Components handle errors from dependencies gracefully
7. ✅ **Performance Integration**: Component interactions meet performance targets
8. ✅ **Memory Management**: No memory leaks in component interactions
9. ✅ **Transaction Consistency**: Operations maintain data consistency across components
10. ✅ **Concurrent Access**: Components handle concurrent access correctly

### Backward Compatibility Criteria
11. ✅ **Legacy Format Support**: System handles legacy event formats correctly
12. ✅ **Mixed Format Handling**: System resolves conflicts between legacy and enhanced formats
13. ✅ **API Backward Compatibility**: Existing API consumers continue to work
14. ✅ **Rule Compatibility**: Existing rules work with enhanced system
15. ✅ **Migration Path**: Clear upgrade path from legacy to enhanced functionality

### Testing Infrastructure Criteria
16. ✅ **Test Isolation**: Tests are isolated and don't interfere with each other
17. ✅ **Mock Quality**: Mocks accurately represent real service behavior
18. ✅ **Test Coverage**: Integration tests cover all critical component interactions
19. ✅ **Performance Testing**: Tests validate performance requirements
20. ✅ **Error Scenario Coverage**: Tests cover various error and edge case scenarios

## Testing Requirements

### Test Organization
```javascript
// Integration test structure
tests/
├── integration/
│   ├── multiTarget/
│   │   ├── targetResolutionIntegration.test.js
│   │   ├── eventPayloadTransformation.integration.test.js
│   │   ├── serviceDependencyIntegration.test.js
│   │   ├── errorPropagationIntegration.test.js
│   │   ├── performanceIntegration.test.js
│   │   └── backwardCompatibilityIntegration.test.js
│   └── common/
│       ├── multiTargetIntegrationTestBed.js
│       ├── integrationScenarios.js
│       └── mockServiceFactory.js
```

### Test Execution Commands
```bash
# Run all integration tests
npm run test:integration

# Run multi-target integration tests specifically
npm run test:integration:multi-target

# Run with performance profiling
npm run test:integration:multi-target:performance

# Run backward compatibility tests only
npm run test:integration:multi-target:compatibility
```

### Continuous Integration Integration
```yaml
# CI workflow for integration tests
integration-tests:
  runs-on: ubuntu-latest
  steps:
    - name: Run Integration Tests
      run: npm run test:integration:multi-target
      
    - name: Check Performance Regressions
      run: npm run test:integration:performance-check
      
    - name: Validate Backward Compatibility  
      run: npm run test:integration:compatibility
```

## Performance Benchmarks

- Component integration operations: <50ms per interaction
- Service dependency resolution: <10ms per dependency
- Event payload transformation: <5ms per transformation
- Error propagation handling: <5ms additional overhead
- Memory usage during integration tests: <200MB total

## Dependencies and Prerequisites

### System Dependencies
- **Tickets 1-5**: All implementation tickets completed
- **Ticket 6**: E2E testing infrastructure for comparison
- Jest integration testing framework
- Dependency injection system
- Service interface definitions

### Testing Dependencies
- Mock service implementations
- Test bed infrastructure
- Performance monitoring tools
- Memory profiling utilities

## Notes and Considerations

### Implementation Order
1. **Phase 1**: Basic integration test infrastructure and test bed
2. **Phase 2**: Service dependency integration tests
3. **Phase 3**: Component interaction tests (target resolution, event transformation)
4. **Phase 4**: Error propagation and handling tests
5. **Phase 5**: Performance integration tests
6. **Phase 6**: Backward compatibility tests
7. **Phase 7**: CI/CD integration and automation

### Test Maintenance Strategy
- **Mock Synchronization**: Keep mocks synchronized with real service interfaces
- **Contract Testing**: Validate that mocks accurately represent real behavior
- **Performance Baseline**: Maintain performance baselines for regression detection
- **Coverage Monitoring**: Track integration test coverage and identify gaps

### Risk Mitigation
- **Test Isolation**: Prevent test interference through proper setup/cleanup
- **Resource Management**: Prevent resource leaks in long-running test suites
- **Error Handling**: Ensure tests themselves handle errors gracefully
- **Performance Impact**: Minimize test execution time while maintaining coverage

### Future Enhancements
- Contract-based testing with service interface validation
- Property-based testing for component interactions
- Chaos engineering tests for resilience validation
- Integration with production monitoring for real-world validation
- Automated performance regression detection and alerting
- Visual testing for component output validation

This comprehensive integration testing suite ensures that all multi-target action system components work together correctly and maintain their contracts under various conditions.