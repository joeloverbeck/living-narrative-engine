import { describe, expect, it, jest } from '@jest/globals';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createEntityManager = () => ({
  getComponentData: jest.fn(),
  removeComponent: jest.fn(),
});

const createEventDispatcher = () => ({
  dispatch: jest.fn(),
});

describe('BodyGraphService constructor validation and component checks', () => {
  it('throws an error when entityManager is not provided', () => {
    const logger = createLogger();
    const eventDispatcher = createEventDispatcher();

    expect(
      () => new BodyGraphService({ logger, eventDispatcher })
    ).toThrow(new InvalidArgumentError('entityManager is required'));
  });

  it('throws an error when eventDispatcher is not provided', () => {
    const logger = createLogger();
    const entityManager = createEntityManager();

    expect(
      () => new BodyGraphService({ entityManager, logger })
    ).toThrow(new InvalidArgumentError('eventDispatcher is required'));
  });

  it('returns false when no parts expose the requested component', () => {
    const logger = createLogger();
    const entityManager = createEntityManager();
    const eventDispatcher = createEventDispatcher();

    const service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
    });

    const getAllPartsSpy = jest
      .spyOn(service, 'getAllParts')
      .mockReturnValue(['arm-1', 'leg-1']);

    entityManager.getComponentData.mockReturnValueOnce(null);
    entityManager.getComponentData.mockReturnValueOnce({});

    const result = service.hasPartWithComponent(
      { root: 'root-entity' },
      'anatomy:musculature'
    );

    expect(result).toBe(false);
    expect(getAllPartsSpy).toHaveBeenCalledWith({ root: 'root-entity' });
    expect(entityManager.getComponentData).toHaveBeenCalledTimes(2);

    getAllPartsSpy.mockRestore();
  });
});
