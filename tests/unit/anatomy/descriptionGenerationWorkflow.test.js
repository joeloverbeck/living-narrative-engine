import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DescriptionGenerationWorkflow } from '../../../src/anatomy/workflows/descriptionGenerationWorkflow.js';
import { DescriptionGenerationError } from '../../../src/anatomy/orchestration/anatomyErrorHandler.js';
import {
  createMockLogger,
  createMockEntityManager,
  createTestEntity,
} from '../../common/mockFactories/index.js';

/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */

describe('DescriptionGenerationWorkflow', () => {
  /** @type {ReturnType<typeof createMockLogger>} */
  let logger;
  /** @type {ReturnType<typeof createMockEntityManager>} */
  let entityManager;
  let anatomyService;
  let workflow;

  beforeEach(() => {
    logger = createMockLogger();
    entityManager = createMockEntityManager();
    anatomyService = {
      generateAllDescriptions: jest.fn(),
      generatePartDescription: jest.fn(),
    };
    workflow = new DescriptionGenerationWorkflow({
      entityManager,
      logger,
      anatomyDescriptionService: anatomyService,
    });
  });

  describe('generateAll', () => {
    it('generates descriptions for an existing entity', async () => {
      const entity = createTestEntity('e1');
      entityManager.getEntityInstance.mockReturnValue(entity);

      await workflow.generateAll('e1');

      expect(anatomyService.generateAllDescriptions).toHaveBeenCalledWith(
        entity
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Successfully generated descriptions for entity'
        )
      );
    });

    it('throws DescriptionGenerationError when entity is missing', async () => {
      entityManager.getEntityInstance.mockReturnValue(null);
      await expect(workflow.generateAll('missing')).rejects.toBeInstanceOf(
        DescriptionGenerationError
      );
      expect(anatomyService.generateAllDescriptions).not.toHaveBeenCalled();
    });

    it('wraps errors from the description service', async () => {
      const entity = createTestEntity('e2');
      entityManager.getEntityInstance.mockReturnValue(entity);
      const boom = new Error('boom');
      anatomyService.generateAllDescriptions.mockImplementation(() => {
        throw boom;
      });

      await expect(workflow.generateAll('e2')).rejects.toEqual(
        expect.objectContaining({ cause: boom, entityId: 'e2' })
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate descriptions for entity'),
        expect.objectContaining({ error: boom.message, stack: boom.stack })
      );
    });
  });

  describe('generateForParts', () => {
    it('generates descriptions for each provided part', async () => {
      const partA = createTestEntity('a');
      const partB = createTestEntity('b');
      entityManager.getEntityInstance.mockImplementation((id) =>
        id === 'a' ? partA : id === 'b' ? partB : null
      );

      await workflow.generateForParts('body1', ['a', 'b']);

      expect(anatomyService.generatePartDescription).toHaveBeenCalledTimes(2);
      expect(anatomyService.generatePartDescription).toHaveBeenNthCalledWith(
        1,
        partA
      );
      expect(anatomyService.generatePartDescription).toHaveBeenNthCalledWith(
        2,
        partB
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Successfully generated descriptions for parts')
      );
    });

    it('warns when a part entity is missing', async () => {
      const part = createTestEntity('p1');
      entityManager.getEntityInstance.mockImplementation((id) =>
        id === 'p1' ? part : null
      );

      await workflow.generateForParts('body', ['p1', 'p2']);

      expect(anatomyService.generatePartDescription).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Part entity 'p2' not found")
      );
    });

    it('throws DescriptionGenerationError when generation fails for a part', async () => {
      const part = createTestEntity('p1');
      entityManager.getEntityInstance.mockReturnValue(part);
      anatomyService.generatePartDescription.mockImplementation(() => {
        throw new Error('fail');
      });

      await expect(workflow.generateForParts('body', ['p1'])).rejects.toEqual(
        expect.objectContaining({ partIds: ['p1'], entityId: 'body' })
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('needsDescriptions', () => {
    it('returns false when entity is missing', () => {
      entityManager.getEntityInstance.mockReturnValue(null);
      expect(workflow.needsDescriptions('x')).toBe(false);
    });

    it('returns false when entity lacks anatomy:body', () => {
      const entity = createTestEntity('e');
      entity.hasComponent = jest.fn(() => false);
      entityManager.getEntityInstance.mockReturnValue(entity);
      expect(workflow.needsDescriptions('e')).toBe(false);
    });

    it('returns true when anatomy body has a root', () => {
      const entity = createTestEntity('e', {
        'anatomy:body': { body: { root: {} } },
      });
      entity.hasComponent = jest.fn((id) => id === 'anatomy:body');
      entityManager.getEntityInstance.mockReturnValue(entity);
      expect(workflow.needsDescriptions('e')).toBeTruthy();
    });
  });
});
