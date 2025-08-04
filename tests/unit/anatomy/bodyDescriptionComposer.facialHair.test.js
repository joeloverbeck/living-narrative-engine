import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

/**
 * Tests for facial hair head description support in BodyDescriptionComposer
 */
describe('BodyDescriptionComposer - Facial Hair Head Support', () => {
  let bodyPartDescriptionBuilder;
  let bodyGraphService;
  let entityFinder;
  let anatomyFormattingService;
  let partDescriptionGenerator;
  let composer;

  beforeEach(() => {
    // Mock dependencies
    bodyPartDescriptionBuilder = {
      buildDescription: jest.fn(),
    };

    bodyGraphService = {
      getAllParts: jest.fn(),
    };

    entityFinder = {
      getEntityInstance: jest.fn(),
    };

    partDescriptionGenerator = {
      generatePartDescription: jest.fn(),
    };

    // Mock anatomy formatting service with head in description order
    anatomyFormattingService = {
      getDescriptionOrder: jest.fn(() => [
        'build',
        'body_composition',
        'body_hair',
        'head',
        'hair',
        'eye',
        'face',
        'ear',
        'nose',
        'mouth',
        'neck',
        'torso',
        'arm',
        'hand',
        'leg',
        'foot',
      ]),
      getPairedParts: jest.fn(
        () => new Set(['eye', 'ear', 'arm', 'leg', 'hand', 'foot'])
      ),
      getIrregularPlurals: jest.fn(() => ({ foot: 'feet' })),
    };

    composer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder,
      bodyGraphService,
      entityFinder,
      anatomyFormattingService,
      partDescriptionGenerator,
    });
  });

  describe('composeDescription with head parts', () => {
    it('should include head with facial hair descriptor in final description', async () => {
      // Arrange
      const bodyEntity = {
        id: 'test:body',
        hasComponent: jest.fn(() => true),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return { body: { root: 'test:torso' } };
          }
          return null;
        }),
      };

      const headEntity = {
        id: 'test:bearded_head',
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:part'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:part') {
            return { subType: 'head' };
          }
          if (componentId === 'core:description') {
            return { text: 'bearded' };
          }
          return null;
        }),
      };

      const hairEntity = {
        id: 'test:hair',
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:part'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:part') {
            return { subType: 'hair' };
          }
          if (componentId === 'core:description') {
            return { text: 'medium, brown, straight' };
          }
          return null;
        }),
      };

      // Mock the graph service to return head and hair parts
      bodyGraphService.getAllParts.mockReturnValue([
        'test:bearded_head',
        'test:hair',
      ]);

      // Mock entity finder to return our entities
      entityFinder.getEntityInstance.mockImplementation((id) => {
        if (id === 'test:bearded_head') return headEntity;
        if (id === 'test:hair') return hairEntity;
        return null;
      });

      // Act
      const description = await composer.composeDescription(bodyEntity);

      // Assert
      expect(description).toContain('Head: bearded');
      expect(description).toContain('Hair: medium, brown, straight');

      // Verify order - head should come before hair
      const headIndex = description.indexOf('Head: bearded');
      const hairIndex = description.indexOf('Hair: medium, brown, straight');
      expect(headIndex).toBeLessThan(hairIndex);
    });

    it('should handle different facial hair styles', async () => {
      // Arrange
      const bodyEntity = {
        id: 'test:body',
        hasComponent: jest.fn(() => true),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return { body: { root: 'test:torso' } };
          }
          return null;
        }),
      };

      const facialHairStyles = ['mustache', 'goatee', 'full-beard', 'van-dyke'];

      for (const style of facialHairStyles) {
        const headEntity = {
          id: `test:${style}_head`,
          hasComponent: jest.fn(
            (componentId) => componentId === 'anatomy:part'
          ),
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'anatomy:part') {
              return { subType: 'head' };
            }
            if (componentId === 'core:description') {
              return { text: style };
            }
            return null;
          }),
        };

        bodyGraphService.getAllParts.mockReturnValue([`test:${style}_head`]);
        entityFinder.getEntityInstance.mockReturnValue(headEntity);

        // Act
        const description = await composer.composeDescription(bodyEntity);

        // Assert
        expect(description).toContain(`Head: ${style}`);
      }
    });

    it('should not show head line when head has no description', async () => {
      // Arrange
      const bodyEntity = {
        id: 'test:body',
        hasComponent: jest.fn(() => true),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return { body: { root: 'test:torso' } };
          }
          return null;
        }),
      };

      const headEntity = {
        id: 'test:plain_head',
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:part'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:part') {
            return { subType: 'head' };
          }
          // No description component
          return null;
        }),
      };

      const torsoEntity = {
        id: 'test:torso',
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:part'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:part') {
            return { subType: 'torso' };
          }
          if (componentId === 'core:description') {
            return { text: 'muscular' };
          }
          return null;
        }),
      };

      bodyGraphService.getAllParts.mockReturnValue([
        'test:plain_head',
        'test:torso',
      ]);
      entityFinder.getEntityInstance.mockImplementation((id) => {
        if (id === 'test:plain_head') return headEntity;
        if (id === 'test:torso') return torsoEntity;
        return null;
      });

      // Act
      const description = await composer.composeDescription(bodyEntity);

      // Assert
      expect(description).not.toContain('Head:');
      expect(description).toContain('Torso: muscular');
    });

    it('should use part description generator for head when no persisted description', async () => {
      // Arrange
      const bodyEntity = {
        id: 'test:body',
        hasComponent: jest.fn(() => true),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return { body: { root: 'test:torso' } };
          }
          return null;
        }),
      };

      const headEntity = {
        id: 'test:generated_head',
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:part'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:part') {
            return { subType: 'head' };
          }
          // No description component - should trigger generation
          return null;
        }),
      };

      bodyGraphService.getAllParts.mockReturnValue(['test:generated_head']);
      entityFinder.getEntityInstance.mockReturnValue(headEntity);

      // Mock the part description generator to return a generated description
      partDescriptionGenerator.generatePartDescription.mockReturnValue(
        'bearded'
      );

      // Act
      const description = await composer.composeDescription(bodyEntity);

      // Assert
      expect(
        partDescriptionGenerator.generatePartDescription
      ).toHaveBeenCalledWith('test:generated_head');
      expect(description).toContain('Head: bearded');
    });

    it('should handle multiple heads with different descriptors', async () => {
      // Arrange
      const bodyEntity = {
        id: 'test:body',
        hasComponent: jest.fn(() => true),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return { body: { root: 'test:torso' } };
          }
          return null;
        }),
      };

      const beardedHead = {
        id: 'test:bearded_head',
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:part'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:part') {
            return { subType: 'head' };
          }
          if (componentId === 'core:description') {
            return { text: 'bearded' };
          }
          return null;
        }),
      };

      const mustacheHead = {
        id: 'test:mustache_head',
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:part'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:part') {
            return { subType: 'head' };
          }
          if (componentId === 'core:description') {
            return { text: 'mustache' };
          }
          return null;
        }),
      };

      bodyGraphService.getAllParts.mockReturnValue([
        'test:bearded_head',
        'test:mustache_head',
      ]);
      entityFinder.getEntityInstance.mockImplementation((id) => {
        if (id === 'test:bearded_head') return beardedHead;
        if (id === 'test:mustache_head') return mustacheHead;
        return null;
      });

      // Act
      const description = await composer.composeDescription(bodyEntity);

      // Assert - the actual implementation shows numbered heads
      expect(description).toContain('Head 1: bearded');
      expect(description).toContain('Head 2: mustache');
    });
  });
});
