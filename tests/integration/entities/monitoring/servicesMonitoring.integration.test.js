import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createDefaultServicesWithConfig } from '../../../../src/entities/utils/createDefaultServicesWithConfig.js';
import { TestData } from '../../../common/entities/testData.js';
import EntityManagerIntegrationTestBed from '../../../common/entities/entityManagerIntegrationTestBed.js';
import {
  createMockIdGenerator,
  createMockComponentCloner,
  createMockDefaultComponentPolicy,
} from '../../../common/mockFactories/entities.js';
import {
  initializeGlobalConfig,
  resetGlobalConfig,
} from '../../../../src/entities/utils/configUtils.js';
import EntityDefinition from '../../../../src/entities/entityDefinition.js';

describe('Services Monitoring Integration', () => {
  let services = null;
  let testBed = null;
  let monitoringCoordinator = null;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset global config first to ensure clean state
    resetGlobalConfig();

    // Create test bed with dependencies
    testBed = new EntityManagerIntegrationTestBed();

    // Initialize configuration with monitoring enabled BEFORE creating services
    const userConfig = {
      performance: {
        ENABLE_MONITORING: true,
        SLOW_OPERATION_THRESHOLD: 50, // Low threshold for testing
      },
      errorHandling: {
        ENABLE_CIRCUIT_BREAKER: true,
        CIRCUIT_BREAKER_THRESHOLD: 3,
        CIRCUIT_BREAKER_TIMEOUT: 1000,
      },
      monitoring: {
        ENABLE_HEALTH_CHECKS: true,
        HEALTH_CHECK_INTERVAL: 5000,
        SLOW_OPERATION_ALERT_THRESHOLD: 50,
      },
    };
    initializeGlobalConfig(testBed.mocks.logger, userConfig);

    // Add test entity definition to registry
    const actorDefinition = new EntityDefinition('core:actor', {
      description: 'Test actor entity',
      components: {
        'core:actor': {},
      },
    });
    testBed.mocks.registry.store(
      'entityDefinitions',
      'core:actor',
      actorDefinition
    );

    // Add component definition to registry
    testBed.mocks.registry.store('components', 'core:short_term_memory', {
      id: 'core:short_term_memory',
      dataSchema: {
        type: 'object',
        properties: {
          capacity: { type: 'number' },
          entries: { type: 'array' },
        },
        required: ['capacity', 'entries'],
      },
    });

    // Create services with monitoring enabled
    services = createDefaultServicesWithConfig({
      registry: testBed.mocks.registry,
      validator: testBed.mocks.validator,
      logger: testBed.mocks.logger,
      eventDispatcher: testBed.mocks.eventDispatcher,
      idGenerator: createMockIdGenerator(),
      cloner: createMockComponentCloner(),
      defaultPolicy: createMockDefaultComponentPolicy(),
    });

    // Get monitoring coordinator
    monitoringCoordinator = services.monitoringCoordinator;
  });

  afterEach(async () => {
    // Clean up any created entities
    if (services && services.entityRepository) {
      services.entityRepository.clear();
    }
    if (monitoringCoordinator) {
      monitoringCoordinator.close();
    }
    if (testBed) {
      await testBed.cleanup();
    }
    // Clear the global config
    resetGlobalConfig();

    // Reset all variables
    services = null;
    testBed = null;
    monitoringCoordinator = null;
  });

  describe('EntityLifecycleManager Monitoring', () => {
    it('should monitor entity creation', async () => {
      const { entityLifecycleManager } = services;

      // Create an entity
      const entityId = `test-entity-creation-${Date.now()}-${Math.random()}`;

      await entityLifecycleManager.createEntityInstance('core:actor', {
        instanceId: entityId,
      });

      // Check monitoring stats
      const stats = monitoringCoordinator.getStats();
      expect(stats.totalOperations).toBeGreaterThan(0);

      // Check specific operation stats
      const performanceMonitor = monitoringCoordinator.getPerformanceMonitor();
      const opStats = performanceMonitor.getOperationsByType(
        'createEntityInstance'
      );
      expect(opStats.length).toBeGreaterThan(0);
      expect(opStats[0].duration).toBeGreaterThan(0);
    });

    it('should monitor entity removal', async () => {
      const { entityLifecycleManager } = services;

      // Create and remove an entity
      const entityId = `test-entity-removal-${Date.now()}-${Math.random()}`;
      await entityLifecycleManager.createEntityInstance('core:actor', {
        instanceId: entityId,
      });

      await entityLifecycleManager.removeEntityInstance(entityId);

      // Check monitoring stats
      const performanceMonitor = monitoringCoordinator.getPerformanceMonitor();
      const removeStats = performanceMonitor.getOperationsByType(
        'removeEntityInstance'
      );
      expect(removeStats.length).toBeGreaterThan(0);
    });

    it('should use createEntityInstanceWithMonitoring method', async () => {
      const { entityLifecycleManager } = services;

      // Use explicit monitoring method
      const entityId = `test-entity-monitoring-${Date.now()}-${Math.random()}`;
      await entityLifecycleManager.createEntityInstanceWithMonitoring(
        'core:actor',
        { instanceId: entityId }
      );

      // Verify monitoring occurred
      const stats = monitoringCoordinator.getStats();
      expect(stats.totalOperations).toBeGreaterThan(0);
    });

    it('should handle monitoring when disabled', async () => {
      // Clear global config and set it to disabled
      resetGlobalConfig();
      const disabledUserConfig = {
        performance: {
          ENABLE_MONITORING: false,
        },
      };
      initializeGlobalConfig(testBed.mocks.logger, disabledUserConfig);

      // Create services with monitoring disabled
      const disabledServices = createDefaultServicesWithConfig({
        registry: testBed.mocks.registry,
        validator: testBed.mocks.validator,
        logger: testBed.mocks.logger,
        eventDispatcher: testBed.mocks.eventDispatcher,
        idGenerator: createMockIdGenerator(),
        cloner: createMockComponentCloner(),
        defaultPolicy: createMockDefaultComponentPolicy(),
      });

      // Create entity with monitoring disabled
      const entityId = `test-entity-disabled-${Date.now()}-${Math.random()}`;
      await disabledServices.entityLifecycleManager.createEntityInstance(
        'core:actor',
        { instanceId: entityId }
      );

      // Monitoring should be disabled
      const stats = disabledServices.monitoringCoordinator.getStats();
      expect(stats.enabled).toBe(false);
    });
  });

  describe('ComponentMutationService Monitoring', () => {
    let entity;

    beforeEach(async () => {
      // Reset circuit breaker to ensure clean state for each test
      const circuitBreaker =
        monitoringCoordinator.getCircuitBreaker('addComponent');
      if (circuitBreaker) {
        circuitBreaker.close();
      }

      // Create an entity to work with
      const entityId = `test-entity-component-${Date.now()}-${Math.random()}`;
      entity = await services.entityLifecycleManager.createEntityInstance(
        'core:actor',
        { instanceId: entityId }
      );
    });

    it('should monitor component addition with circuit breaker', async () => {
      const { componentMutationService } = services;

      // Add a component
      await componentMutationService.addComponent(
        entity.id,
        'core:short_term_memory',
        { capacity: 5, entries: [] }
      );

      // Check monitoring stats
      const performanceMonitor = monitoringCoordinator.getPerformanceMonitor();
      const addStats = performanceMonitor.getOperationsByType('addComponent');
      expect(addStats.length).toBeGreaterThan(0);

      // Check circuit breaker status
      const circuitBreaker =
        monitoringCoordinator.getCircuitBreaker('addComponent');
      const cbStats = circuitBreaker.getStats();
      expect(cbStats.state).toBe('CLOSED');
    });

    it('should monitor component removal with circuit breaker', async () => {
      const { componentMutationService } = services;

      // Add then remove a component
      await componentMutationService.addComponent(
        entity.id,
        'core:short_term_memory',
        { capacity: 5, entries: [] }
      );

      await componentMutationService.removeComponent(
        entity.id,
        'core:short_term_memory'
      );

      // Check monitoring stats
      const performanceMonitor = monitoringCoordinator.getPerformanceMonitor();
      const removeStats =
        performanceMonitor.getOperationsByType('removeComponent');
      expect(removeStats.length).toBeGreaterThan(0);
    });

    it('should trigger circuit breaker on repeated failures', async () => {
      const { componentMutationService } = services;

      // Get circuit breaker for addComponent operation
      const circuitBreaker =
        monitoringCoordinator.getCircuitBreaker('addComponent');

      // Verify initial state
      expect(circuitBreaker.getStats().state).toBe('CLOSED');

      // Try to add component to non-existent entity multiple times sequentially
      const results = [];
      for (let i = 0; i < 3; i++) {
        try {
          await componentMutationService.addComponent(
            'non-existent-entity',
            'core:short_term_memory',
            {}
          );
          results.push(null); // Shouldn't happen, but handle success case
        } catch (error) {
          results.push(error);
        }
      }

      // The circuit breaker should open after 2 failures (test environment threshold)
      expect(results.length).toBe(3);

      // First 2 errors should be the actual entity errors
      expect(results[0].message).toContain('Entity instance not found');
      expect(results[1].message).toContain('Entity instance not found');

      // The third error should be from the circuit breaker being open
      expect(results[2].message).toContain(
        "Circuit breaker 'addComponent' is OPEN"
      );

      // Verify circuit breaker state after failures
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe('OPEN');
      expect(stats.totalFailures).toBe(2); // Test environment uses threshold of 2 (from errorHandling.config.js)
      expect(stats.totalRequests).toBe(3); // Should have 3 requests total (2 failures + 1 rejected when open)
    });
  });

  describe('EntityRepositoryAdapter Monitoring', () => {
    it('should monitor repository add operations', () => {
      const { entityRepository } = services;

      // Add an entity directly to repository
      const entity = {
        id: 'test-entity-1',
        definitionId: 'core:actor',
        componentTypeIds: ['core:short_term_memory'],
        getComponentData: () => ({}),
        hasComponent: () => true,
      };

      entityRepository.add(entity);

      // Check monitoring stats
      const performanceMonitor = monitoringCoordinator.getPerformanceMonitor();
      const addStats = performanceMonitor.getOperationsByType('repository.add');
      expect(addStats.length).toBeGreaterThan(0);
    });

    it('should monitor repository get operations', () => {
      const { entityRepository } = services;

      // Add and get an entity
      const entity = {
        id: 'test-entity-2',
        definitionId: 'core:actor',
        componentTypeIds: [],
        getComponentData: () => ({}),
        hasComponent: () => false,
      };

      entityRepository.add(entity);
      entityRepository.get('test-entity-2');

      // Check monitoring stats
      const performanceMonitor = monitoringCoordinator.getPerformanceMonitor();
      const getStats = performanceMonitor.getOperationsByType('repository.get');
      expect(getStats.length).toBeGreaterThan(0);
    });

    it('should monitor repository has operations', () => {
      const { entityRepository } = services;

      // Check if entity exists
      entityRepository.has('test-entity-3');

      // Check monitoring stats
      const performanceMonitor = monitoringCoordinator.getPerformanceMonitor();
      const hasStats = performanceMonitor.getOperationsByType('repository.has');
      expect(hasStats.length).toBeGreaterThan(0);
    });

    it('should monitor repository remove operations', () => {
      const { entityRepository } = services;

      // Add and remove an entity
      const entity = {
        id: 'test-entity-4',
        definitionId: 'core:actor',
        componentTypeIds: [],
        getComponentData: () => ({}),
        hasComponent: () => false,
      };

      entityRepository.add(entity);
      entityRepository.remove('test-entity-4');

      // Check monitoring stats
      const performanceMonitor = monitoringCoordinator.getPerformanceMonitor();
      const removeStats =
        performanceMonitor.getOperationsByType('repository.remove');
      expect(removeStats.length).toBeGreaterThan(0);
    });
  });

  describe('Monitoring Coordinator Health Checks', () => {
    it('should report healthy status', () => {
      const report = monitoringCoordinator.getMonitoringReport();
      expect(report).toContain('Entity Module Monitoring Report');
      expect(report).toContain('Monitoring Status: Enabled');
    });

    it('should detect slow operations', async () => {
      const { entityLifecycleManager } = services;

      // Create multiple entities to potentially trigger slow operation warnings
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          entityLifecycleManager.createEntityInstance('core:actor', {
            instanceId: `test-entity-slow-${i}`,
          })
        );
      }

      await Promise.all(promises);

      // Check for slow operations
      const stats = monitoringCoordinator.getStats();
      // Depending on system performance, there might be slow operations
      expect(stats.performance).toHaveProperty('slowOperations');
    });

    it('should provide comprehensive stats', async () => {
      const { entityLifecycleManager } = services;

      // Perform various operations
      await entityLifecycleManager.createEntityInstance('core:actor', {
        instanceId: TestData.InstanceIDs.PRIMARY,
      });

      const stats = monitoringCoordinator.getStats();

      // Verify stats structure
      expect(stats).toHaveProperty('enabled', true);
      expect(stats).toHaveProperty('performance');
      expect(stats.performance).toHaveProperty('totalOperations');
      expect(stats.performance).toHaveProperty('averageOperationTime');
      expect(stats).toHaveProperty('circuitBreakers');
      expect(stats).toHaveProperty('recentAlerts');
    });
  });
});
