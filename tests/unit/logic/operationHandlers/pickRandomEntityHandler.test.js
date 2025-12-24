/**
 * @file Unit tests for PickRandomEntityHandler
 */

import PickRandomEntityHandler from '../../../../src/logic/operationHandlers/pickRandomEntityHandler.js';

describe('PickRandomEntityHandler', () => {
  let handler;
  let mockEntityManager;
  let mockLogger;
  let context;

  beforeEach(() => {
    mockEntityManager = {
      getEntitiesWithComponent: jest.fn(),
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    handler = new PickRandomEntityHandler({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    context = {
      evaluationContext: {
        context: {},
        event: {
          payload: {},
        },
      },
      logger: mockLogger,
    };
  });

  test('should initialize correctly', () => {
    expect(handler).toBeDefined();
  });

  test('should store null if location_id is missing or invalid', async () => {
    await handler.execute(
      {
        location_id: null,
        result_variable: 'result',
      },
      context
    );

    expect(context.evaluationContext.context.result).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('No location_id provided')
    );
  });

  test('should pick a random entity from location', async () => {
    const locationId = 'loc1';
    const entities = [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }];

    // Mock getting entities with position
    mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);

    // Mock position data check
    mockEntityManager.getComponentData.mockImplementation((id, type) => {
      if (type === 'core:position') {
        return { locationId };
      }
      return null;
    });

    // Mock Math.random to pick 'e2' (index 1)
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    await handler.execute(
      {
        location_id: locationId,
        result_variable: 'result',
      },
      context
    );

    expect(mockEntityManager.getEntitiesWithComponent).toHaveBeenCalledWith(
      'core:position'
    );
    expect(context.evaluationContext.context.result).toBe('e2');
  });

  test('should filter out entities not in the location', async () => {
    const locationId = 'loc1';
    const entities = [
      { id: 'e1' }, // in loc1
      { id: 'e2' }, // in loc2
    ];

    mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);

    mockEntityManager.getComponentData.mockImplementation((id, type) => {
      if (type === 'core:position') {
        return { locationId: id === 'e1' ? 'loc1' : 'loc2' };
      }
      return null;
    });

    await handler.execute(
      {
        location_id: locationId,
        result_variable: 'result',
      },
      context
    );

    expect(context.evaluationContext.context.result).toBe('e1');
  });

  test('should exclude specified entities', async () => {
    const locationId = 'loc1';
    const entities = [{ id: 'e1' }, { id: 'e2' }];

    mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
    mockEntityManager.getComponentData.mockReturnValue({ locationId });

    await handler.execute(
      {
        location_id: locationId,
        exclude_entities: ['e1'],
        result_variable: 'result',
      },
      context
    );

    expect(context.evaluationContext.context.result).toBe('e2');
  });

  test('should filter by required components', async () => {
    const locationId = 'loc1';
    const entities = [{ id: 'e1' }, { id: 'e2' }];

    mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
    mockEntityManager.getComponentData.mockReturnValue({ locationId });

    // e1 has component, e2 does not
    mockEntityManager.hasComponent.mockImplementation((id, type) => {
      if (type === 'compA') {
        return id === 'e1';
      }
      return false;
    });

    await handler.execute(
      {
        location_id: locationId,
        require_components: ['compA'],
        result_variable: 'result',
      },
      context
    );

    expect(context.evaluationContext.context.result).toBe('e1');
  });

  test('should filter by excluded components', async () => {
    const locationId = 'loc1';
    const entities = [{ id: 'e1' }, { id: 'e2' }];

    mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
    mockEntityManager.getComponentData.mockReturnValue({ locationId });

    // e1 has component, e2 does not
    mockEntityManager.hasComponent.mockImplementation((id, type) => {
      if (type === 'compA') {
        return id === 'e1';
      }
      return false;
    });

    await handler.execute(
      {
        location_id: locationId,
        exclude_components: ['compA'],
        result_variable: 'result',
      },
      context
    );

    expect(context.evaluationContext.context.result).toBe('e2');
  });

  test('should return null if no candidates match', async () => {
    const locationId = 'loc1';
    const entities = [{ id: 'e1' }];

    mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
    mockEntityManager.getComponentData.mockReturnValue({ locationId });

    // Exclude everything
    await handler.execute(
      {
        location_id: locationId,
        exclude_entities: ['e1'],
        result_variable: 'result',
      },
      context
    );

    expect(context.evaluationContext.context.result).toBeNull();
  });

  test('should resolve context references', async () => {
    const locationId = 'loc1';
    const entities = [{ id: 'e1' }, { id: 'e2' }];

    mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
    mockEntityManager.getComponentData.mockReturnValue({ locationId });

    // Set context variable
    context.evaluationContext.context.myLoc = 'loc1';
    context.evaluationContext.event.payload.excludeId = 'e1';

    await handler.execute(
      {
        location_id: '{context.myLoc}',
        exclude_entities: ['{event.payload.excludeId}'],
        result_variable: 'result',
      },
      context
    );

    expect(context.evaluationContext.context.result).toBe('e2');
  });

  // Constructor validation tests
  describe('Constructor', () => {
    test('should throw when entityManager is missing', () => {
      expect(
        () =>
          new PickRandomEntityHandler({
            logger: mockLogger,
          })
      ).toThrow();
    });

    test('should throw when logger is missing', () => {
      expect(
        () =>
          new PickRandomEntityHandler({
            entityManager: mockEntityManager,
          })
      ).toThrow();
    });

    test('should throw when entityManager lacks required methods', () => {
      expect(
        () =>
          new PickRandomEntityHandler({
            entityManager: { someMethod: jest.fn() },
            logger: mockLogger,
          })
      ).toThrow();
    });
  });

  // Entity exclusion tests
  describe('Entity Exclusion', () => {
    test('should exclude multiple entities simultaneously', async () => {
      const locationId = 'loc1';
      const entities = [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
      mockEntityManager.getComponentData.mockReturnValue({ locationId });

      await handler.execute(
        {
          location_id: locationId,
          exclude_entities: ['e1', 'e2'],
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toBe('e3');
    });
  });

  // Required components tests
  describe('Required Components', () => {
    test('should handle multiple required components (AND logic)', async () => {
      const locationId = 'loc1';
      const entities = [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
      mockEntityManager.getComponentData.mockReturnValue({ locationId });

      // e1 has both compA and compB, e2 has only compA, e3 has neither
      mockEntityManager.hasComponent.mockImplementation((id, type) => {
        if (id === 'e1') return true; // has all
        if (id === 'e2' && type === 'compA') return true; // only compA
        return false;
      });

      await handler.execute(
        {
          location_id: locationId,
          require_components: ['compA', 'compB'],
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toBe('e1');
    });

    test('should return null when no entity has required component', async () => {
      const locationId = 'loc1';
      const entities = [{ id: 'e1' }, { id: 'e2' }];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
      mockEntityManager.getComponentData.mockReturnValue({ locationId });

      // No entity has the required component
      mockEntityManager.hasComponent.mockReturnValue(false);

      await handler.execute(
        {
          location_id: locationId,
          require_components: ['nonexistent:component'],
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toBeNull();
    });
  });

  // Excluded components tests
  describe('Excluded Components', () => {
    test('should handle multiple excluded components (OR logic)', async () => {
      const locationId = 'loc1';
      const entities = [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
      mockEntityManager.getComponentData.mockReturnValue({ locationId });

      // e1 has compA, e2 has compB, e3 has neither
      mockEntityManager.hasComponent.mockImplementation((id, type) => {
        if (id === 'e1' && type === 'compA') return true;
        if (id === 'e2' && type === 'compB') return true;
        return false;
      });

      await handler.execute(
        {
          location_id: locationId,
          exclude_components: ['compA', 'compB'],
          result_variable: 'result',
        },
        context
      );

      // Only e3 has neither excluded component
      expect(context.evaluationContext.context.result).toBe('e3');
    });

    test('should return null when all entities have excluded components', async () => {
      const locationId = 'loc1';
      const entities = [{ id: 'e1' }, { id: 'e2' }];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
      mockEntityManager.getComponentData.mockReturnValue({ locationId });

      // All entities have the excluded component
      mockEntityManager.hasComponent.mockReturnValue(true);

      await handler.execute(
        {
          location_id: locationId,
          exclude_components: ['core:actor'],
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toBeNull();
    });
  });

  // Combined filtering tests
  describe('Combined Filtering', () => {
    test('should apply exclusions AND component filters together', async () => {
      const locationId = 'loc1';
      const entities = [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }, { id: 'e4' }];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
      mockEntityManager.getComponentData.mockReturnValue({ locationId });

      // e1 is excluded, e2 has core:actor (excluded component),
      // e3 lacks required, e4 passes all filters
      mockEntityManager.hasComponent.mockImplementation((id, type) => {
        if (type === 'core:actor') return id === 'e2';
        if (type === 'items-core:portable') return id === 'e4';
        return false;
      });

      await handler.execute(
        {
          location_id: locationId,
          exclude_entities: ['e1'],
          require_components: ['items-core:portable'],
          exclude_components: ['core:actor'],
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toBe('e4');
    });

    test('should handle complex filtering scenario', async () => {
      const locationId = 'loc1';
      const entities = [
        { id: 'actor1' },
        { id: 'target1' },
        { id: 'bystander1' },
        { id: 'furniture1' },
      ];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
      mockEntityManager.getComponentData.mockReturnValue({ locationId });

      // Simulate fumble scenario: exclude actor and target, require collateral target to be another actor
      mockEntityManager.hasComponent.mockImplementation((id, type) => {
        if (type === 'core:actor') {
          return id === 'actor1' || id === 'target1' || id === 'bystander1';
        }
        return false;
      });

      await handler.execute(
        {
          location_id: locationId,
          exclude_entities: ['actor1', 'target1'],
          require_components: ['core:actor'],
          result_variable: 'fumbleVictim',
        },
        context
      );

      // Result should be the remaining actor
      expect(context.evaluationContext.context.fumbleVictim).toBe('bystander1');
    });

    test('should return null when combined filters exclude all', async () => {
      const locationId = 'loc1';
      const entities = [{ id: 'e1' }, { id: 'e2' }];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
      mockEntityManager.getComponentData.mockReturnValue({ locationId });

      // e1 is excluded directly, e2 lacks required component
      mockEntityManager.hasComponent.mockReturnValue(false);

      await handler.execute(
        {
          location_id: locationId,
          exclude_entities: ['e1'],
          require_components: ['nonexistent:component'],
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toBeNull();
    });
  });

  // Edge cases tests
  describe('Edge Cases', () => {
    test('should return null for empty location', async () => {
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

      await handler.execute(
        {
          location_id: 'empty-location',
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toBeNull();
    });

    test('should handle empty exclude_entities array', async () => {
      const locationId = 'loc1';
      const entities = [{ id: 'e1' }];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
      mockEntityManager.getComponentData.mockReturnValue({ locationId });

      await handler.execute(
        {
          location_id: locationId,
          exclude_entities: [],
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toBe('e1');
    });

    test('should handle empty require_components array', async () => {
      const locationId = 'loc1';
      const entities = [{ id: 'e1' }];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
      mockEntityManager.getComponentData.mockReturnValue({ locationId });

      await handler.execute(
        {
          location_id: locationId,
          require_components: [],
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toBe('e1');
    });

    test('should handle empty exclude_components array', async () => {
      const locationId = 'loc1';
      const entities = [{ id: 'e1' }];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
      mockEntityManager.getComponentData.mockReturnValue({ locationId });

      await handler.execute(
        {
          location_id: locationId,
          exclude_components: [],
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toBe('e1');
    });

    test('should handle location with single entity', async () => {
      const locationId = 'loc1';
      const entities = [{ id: 'single-entity' }];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
      mockEntityManager.getComponentData.mockReturnValue({ locationId });

      await handler.execute(
        {
          location_id: locationId,
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toBe('single-entity');
    });

    test('should store result in specified result_variable', async () => {
      const locationId = 'loc1';
      const entities = [{ id: 'e1' }];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
      mockEntityManager.getComponentData.mockReturnValue({ locationId });

      await handler.execute(
        {
          location_id: locationId,
          result_variable: 'customResultVar',
        },
        context
      );

      expect(context.evaluationContext.context.customResultVar).toBe('e1');
      expect(context.evaluationContext.context.result).toBeUndefined();
    });
  });
});
