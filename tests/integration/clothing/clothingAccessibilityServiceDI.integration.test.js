import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { Registrar } from '../../../src/utils/registrarHelpers.js';
import { ClothingAccessibilityService } from '../../../src/clothing/services/clothingAccessibilityService.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';

describe('ClothingAccessibilityService DI Integration', () => {
  let container;
  let accessibilityService;

  beforeEach(async () => {
    container = new AppContainer();
    const registrar = new Registrar(container);

    // Register minimal dependencies
    const logger = new ConsoleLogger(LogLevel.ERROR);
    registrar.instance(tokens.ILogger, logger);

    // Create mock entity manager
    const mockEntityManager = {
      getComponent: jest.fn().mockReturnValue(null),
      getComponentData: jest.fn().mockReturnValue(null),
      hasComponent: jest.fn().mockReturnValue(false),
    };
    registrar.instance(tokens.IEntityManager, mockEntityManager);

    // Register ClothingAccessibilityService
    registrar.singletonFactory(tokens.ClothingAccessibilityService, (c) => {
      return new ClothingAccessibilityService({
        logger: c.resolve(tokens.ILogger),
        entityManager: c.resolve(tokens.IEntityManager),
        entitiesGateway: c.resolve(tokens.IEntityManager),
      });
    });

    accessibilityService = container.resolve(
      tokens.ClothingAccessibilityService
    );
  });

  afterEach(() => {
    if (container) {
      container = null;
    }
  });

  it('should resolve ClothingAccessibilityService from container', () => {
    expect(accessibilityService).toBeDefined();
    expect(accessibilityService.getAccessibleItems).toBeDefined();
  });

  it('should wire up dependencies correctly', () => {
    // Service should be functional
    const result = accessibilityService.getAccessibleItems('test-entity');
    expect(Array.isArray(result)).toBe(true);
  });

  it('should use EntityManager as entitiesGateway', () => {
    // Should be able to call service methods without errors
    expect(() => {
      accessibilityService.getAccessibleItems('test-entity', {});
    }).not.toThrow();
  });
});
