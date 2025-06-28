import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import WorldContext from '../../../src/context/worldContext.js';

const createMockEntityManager = () => ({
  getEntitiesWithComponent: jest.fn(),
  getComponentData: jest.fn(),
  getEntityInstance: jest.fn(),
  activeEntities: new Map(),
});

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

/** Utility to create world context with mocked dependencies */
function makeWorldContext() {
  const entityManager = createMockEntityManager();
  const logger = createMockLogger();
  const dispatcher = {
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  };
  const ctx = new WorldContext(entityManager, logger, dispatcher);
  return { ctx, entityManager, logger };
}

describe('WorldContext.getTargetLocationForDirection', () => {
  let ctx;
  let entityManager;
  let logger;

  beforeEach(() => {
    ({ ctx, entityManager, logger } = makeWorldContext());
    jest.clearAllMocks();
  });

  it('returns null and warns when current_location_id is invalid', () => {
    const result = ctx.getTargetLocationForDirection({
      current_location_id: null,
      direction_taken: 'north',
    });
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('current_location_id'),
      expect.objectContaining({
        current_location_id: null,
        direction_taken: 'north',
      })
    );
  });

  it('returns null and warns when direction_taken is invalid', () => {
    const result = ctx.getTargetLocationForDirection({
      current_location_id: 'loc1',
      direction_taken: '',
    });
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('direction_taken'),
      expect.objectContaining({
        current_location_id: 'loc1',
        direction_taken: '',
      })
    );
  });

  it('returns null when location has no exits', () => {
    entityManager.getComponentData.mockReturnValue(undefined);
    const result = ctx.getTargetLocationForDirection({
      current_location_id: 'loc1',
      direction_taken: 'north',
    });
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("loc1' has no exits")
    );
  });

  it('returns null when exit not found for direction', () => {
    entityManager.getComponentData.mockReturnValue([
      { direction: 'south', target: 'loc2' },
    ]);
    const result = ctx.getTargetLocationForDirection({
      current_location_id: 'loc1',
      direction_taken: 'north',
    });
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("no exit 'north'")
    );
  });

  it('returns null when exit is blocked', () => {
    entityManager.getComponentData.mockReturnValue([
      { direction: 'north', target: 'loc2', blocker: true },
    ]);
    const result = ctx.getTargetLocationForDirection({
      current_location_id: 'loc1',
      direction_taken: 'north',
    });
    expect(result).toBeNull();
  });

  it('returns target instance id when exit points to existing instance', () => {
    const instance = { id: 'loc2' };
    entityManager.getComponentData.mockReturnValue([
      { direction: 'north', target: 'loc2' },
    ]);
    entityManager.getEntityInstance.mockReturnValue(instance);
    const result = ctx.getTargetLocationForDirection({
      current_location_id: 'loc1',
      direction_taken: 'north',
    });
    expect(result).toBe('loc2');
  });

  it('returns null and warns when target instance is missing', () => {
    entityManager.getComponentData.mockReturnValue([
      { direction: 'north', target: 'loc2' },
    ]);
    entityManager.getEntityInstance.mockReturnValue(undefined);
    const result = ctx.getTargetLocationForDirection({
      current_location_id: 'loc1',
      direction_taken: 'north',
    });
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("points to 'loc2', but no such instance exists")
    );
  });
});
