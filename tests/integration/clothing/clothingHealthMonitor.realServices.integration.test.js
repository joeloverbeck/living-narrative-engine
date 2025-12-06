import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ClothingHealthMonitor from '../../../src/clothing/monitoring/clothingHealthMonitor.js';
import { ClothingAccessibilityService } from '../../../src/clothing/services/clothingAccessibilityService.js';
import createCoverageAnalyzer from '../../../src/clothing/analysis/coverageAnalyzer.js';
import PriorityRuleRegistry from '../../../src/scopeDsl/prioritySystem/priorityRuleRegistry.js';
import EventBus from '../../../src/events/eventBus.js';
import { ClothingErrorHandler } from '../../../src/clothing/errors/clothingErrorHandler.js';
import { ClothingServiceError } from '../../../src/clothing/errors/clothingErrors.js';

class RecordingLogger {
  constructor() {
    this.logs = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
  }

  debug(message, context) {
    this.logs.debug.push({ message, context });
  }

  info(message, context) {
    this.logs.info.push({ message, context });
  }

  warn(message, context) {
    this.logs.warn.push({ message, context });
  }

  error(message, context) {
    this.logs.error.push({ message, context });
  }
}

class InMemoryEntityManager {
  constructor(equipmentByEntity) {
    this.equipmentByEntity = equipmentByEntity;
  }

  getComponentData(entityId, componentId) {
    if (componentId === 'clothing:equipment') {
      return { equipped: this.equipmentByEntity[entityId] ?? {} };
    }
    if (componentId === 'core:actor') {
      return { name: entityId };
    }
    throw new Error(`Unsupported component request: ${componentId}`);
  }

  hasComponent(entityId, componentId) {
    if (componentId === 'clothing:equipment') {
      return Boolean(this.equipmentByEntity[entityId]);
    }
    return false;
  }
}

class InMemoryEntitiesGateway {
  constructor(coverageMappings, options = {}) {
    this.coverageMappings = coverageMappings;
    this.throwOnMissing = options.throwOnMissing ?? false;
  }

  getComponentData(itemId, componentId) {
    if (componentId === 'clothing:coverage_mapping') {
      const mapping = this.coverageMappings[itemId];
      if (!mapping) {
        if (this.throwOnMissing) {
          throw new Error(`Missing coverage mapping for ${itemId}`);
        }
        return null;
      }
      return mapping;
    }

    if (componentId === 'clothing:item') {
      return { name: itemId, slot: 'torso_upper' };
    }

    return null;
  }
}

describe('ClothingHealthMonitor integration with real services', () => {
  let logger;
  let entityManager;
  let entitiesGateway;
  let clothingService;
  let coverageAnalyzer;
  let priorityManager;
  let eventBus;
  let errorHandler;
  let monitor;
  let nowSpy;

  beforeEach(async () => {
    jest.useRealTimers();
    logger = new RecordingLogger();

    entitiesGateway = new InMemoryEntitiesGateway(
      {
        'item:jacket': { covers: ['torso_upper'], coveragePriority: 'outer' },
        'item:shirt': { covers: ['torso_upper'], coveragePriority: 'base' },
        'item:gloves': { covers: ['hands'], coveragePriority: 'direct' },
      },
      { throwOnMissing: true }
    );

    entityManager = new InMemoryEntityManager({
      'actor-1': {
        torso_upper: {
          outer: 'item:jacket',
          base: 'item:shirt',
        },
        hands: {
          accessories: 'item:gloves',
        },
      },
    });

    clothingService = new ClothingAccessibilityService({
      logger,
      entityManager,
      entitiesGateway,
    });

    coverageAnalyzer = createCoverageAnalyzer({
      entitiesGateway,
    });

    class UnstablePriorityManager extends PriorityRuleRegistry {
      calculatePriority() {
        throw new Error('priority spike');
      }
    }

    priorityManager = new UnstablePriorityManager({ logger });

    eventBus = new EventBus({ logger });
    errorHandler = new ClothingErrorHandler({ logger, eventBus });

    await errorHandler.handleError(
      new ClothingServiceError(
        'Accessibility degraded',
        'ClothingAccessibilityService',
        'initial-metric',
        { stage: 'initialization' }
      ),
      { requestId: 'metric-seed' }
    );

    nowSpy = jest.spyOn(performance, 'now');
    let timestamp = 0;
    nowSpy.mockImplementation(() => {
      timestamp += 7;
      return timestamp;
    });

    monitor = new ClothingHealthMonitor(
      {
        clothingAccessibilityService: clothingService,
        priorityManager,
        coverageAnalyzer,
        errorHandler,
      },
      logger,
      50
    );
  });

  afterEach(() => {
    if (nowSpy) {
      nowSpy.mockRestore();
    }
    if (monitor) {
      monitor.dispose();
    }
  });

  it('performs cross-service health checks and monitoring lifecycle', async () => {
    const defaultHealth = monitor.getServiceHealth('UnknownService');
    expect(defaultHealth).toMatchObject({
      healthy: false,
      error: 'No health check performed',
    });

    const initialOverall = monitor.getOverallHealth();
    expect(initialOverall).toMatchObject({
      healthy: false,
      totalServices: 0,
    });

    const results = await monitor.performHealthCheck();
    expect(results).toBeInstanceOf(Map);
    expect(Array.from(results.keys())).toEqual([
      'ClothingAccessibilityService',
      'ClothingPriorityManager',
      'CoverageAnalyzer',
      'ClothingErrorHandler',
    ]);

    const accessibilityHealth = results.get('ClothingAccessibilityService');
    expect(accessibilityHealth).toMatchObject({
      healthy: true,
      response: 'OK',
      testOperation: 'getAccessibleItems',
    });

    const priorityHealth = results.get('ClothingPriorityManager');
    expect(priorityHealth).toMatchObject({
      healthy: false,
      error: 'priority spike',
    });

    const analyzerHealth = results.get('CoverageAnalyzer');
    expect(analyzerHealth).toMatchObject({
      healthy: true,
      testOperation: 'analyzeCoverageBlocking',
    });

    const errorHandlerHealth = results.get('ClothingErrorHandler');
    expect(errorHandlerHealth).toMatchObject({
      healthy: true,
      errorCount: expect.any(Number),
    });

    expect(
      logger.logs.debug.some(
        ({ message }) => message === 'Health check completed'
      )
    ).toBe(true);
    expect(
      logger.logs.debug.some(
        ({ message, context }) =>
          message === 'Health check completed' &&
          context?.service === 'ClothingPriorityManager' &&
          context.healthy === false
      )
    ).toBe(true);

    const storedHealth = monitor.getServiceHealth('ClothingPriorityManager');
    expect(storedHealth.healthy).toBe(false);

    const overall = monitor.getOverallHealth();
    expect(overall.healthy).toBe(false);
    expect(overall.totalServices).toBe(4);
    expect(overall.healthyServices).toBe(3);
    expect(overall.unhealthyServices).toBe(1);

    const report = monitor.getHealthReport();
    expect(report.monitoringActive).toBe(false);
    expect(report.services.ClothingAccessibilityService.healthy).toBe(true);
    expect(report.services.ClothingErrorHandler.errorCount).toBeGreaterThan(0);

    jest.useFakeTimers();
    monitor.startMonitoring();
    await Promise.resolve();
    jest.runOnlyPendingTimers();
    await Promise.resolve();

    monitor.startMonitoring();
    monitor.stopMonitoring();
    jest.useRealTimers();

    expect(
      logger.logs.info.some(
        ({ message }) => message === 'Health monitoring started'
      )
    ).toBe(true);
    expect(
      logger.logs.warn.some(
        ({ message }) => message === 'Health monitoring already started'
      )
    ).toBe(true);
    expect(
      logger.logs.info.some(
        ({ message }) => message === 'Health monitoring stopped'
      )
    ).toBe(true);

    await new Promise((resolve) => setImmediate(resolve));
    monitor.dispose();
    const postDispose = await monitor.performHealthCheck();
    expect(postDispose.size).toBe(0);
    expect(monitor.getHealthReport().services).toEqual({});
  });
});
