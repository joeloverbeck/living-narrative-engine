import { describe, it, beforeEach, expect } from '@jest/globals';
import { LocationQueryService } from '../../../src/entities/locationQueryService.js';
import { createMockSpatialIndexManager } from '../../common/mockFactories/spatialIndexManager.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

describe('LocationQueryService', () => {
  let spatialIndexManager;
  let logger;
  let service;

  beforeEach(() => {
    spatialIndexManager = createMockSpatialIndexManager();
    logger = createMockLogger();
    service = new LocationQueryService({ spatialIndexManager, logger });
  });

  it('delegates queries to the spatial index manager for valid IDs', () => {
    const set = new Set(['a']);
    spatialIndexManager.getEntitiesInLocation.mockReturnValue(set);

    const result = service.getEntitiesInLocation('loc1');

    expect(spatialIndexManager.getEntitiesInLocation).toHaveBeenCalledWith(
      'loc1'
    );
    expect(result).toBe(set);
  });

  it('returns an empty set and warns when ID is invalid', () => {
    const result = service.getEntitiesInLocation('');

    expect(spatialIndexManager.getEntitiesInLocation).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "LocationQueryService.getEntitiesInLocation called with invalid locationId: ''"
    );
    expect(result).toEqual(new Set());
  });
});
