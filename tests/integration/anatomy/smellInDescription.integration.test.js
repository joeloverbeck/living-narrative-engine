/**
 * @file Integration test for smell descriptor in body descriptions
 * @description Validates that smell descriptor from anatomy recipe appears correctly in composed descriptions
 */

import { describe, it, expect } from '@jest/globals';
import { createContainer } from '../../../src/dependencyInjection/container.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('Smell in Body Description - Integration', () => {
  it('should include smell descriptor in body description', async () => {
    // Create container with all dependencies
    const container = createContainer();

    // Get required services
    const entityFactory = container.resolve(tokens.IEntityFactory);
    const componentManager = container.resolve(tokens.IComponentManager);
    const bodyDescriptionComposer = container.resolve(
      tokens.IBodyDescriptionComposer
    );

    // Create a body entity with smell descriptor
    const bodyEntity = entityFactory.createEntity('test-body');
    componentManager.addComponent(bodyEntity.id, 'anatomy:body', {
      recipeId: 'test:recipe',
      body: {
        root: 'root-id',
        descriptors: {
          height: 'tall',
          smell: 'musky',
          build: 'athletic',
        },
      },
    });

    // Compose the description
    const description = await bodyDescriptionComposer.composeDescription(
      bodyEntity
    );

    // Verify smell appears in description
    expect(description).toContain('Smell: musky');
    expect(description).toContain('Height: tall');
    expect(description).toContain('Build: athletic');
  });

  it('should handle multiple complex smell values', async () => {
    const container = createContainer();
    const entityFactory = container.resolve(tokens.IEntityFactory);
    const componentManager = container.resolve(tokens.IComponentManager);
    const bodyDescriptionComposer = container.resolve(
      tokens.IBodyDescriptionComposer
    );

    const testCases = [
      'sweaty and musky',
      'pungent manly perfume',
      'rotten meat and feces',
      'fresh mountain air',
    ];

    for (const smellValue of testCases) {
      const bodyEntity = entityFactory.createEntity(`test-body-${smellValue}`);
      componentManager.addComponent(bodyEntity.id, 'anatomy:body', {
        recipeId: 'test:recipe',
        body: {
          root: 'root-id',
          descriptors: {
            smell: smellValue,
          },
        },
      });

      const description = await bodyDescriptionComposer.composeDescription(
        bodyEntity
      );

      expect(description).toContain(`Smell: ${smellValue}`);
    }
  });

  it('should work when smell is not provided', async () => {
    const container = createContainer();
    const entityFactory = container.resolve(tokens.IEntityFactory);
    const componentManager = container.resolve(tokens.IComponentManager);
    const bodyDescriptionComposer = container.resolve(
      tokens.IBodyDescriptionComposer
    );

    const bodyEntity = entityFactory.createEntity('test-body-no-smell');
    componentManager.addComponent(bodyEntity.id, 'anatomy:body', {
      recipeId: 'test:recipe',
      body: {
        root: 'root-id',
        descriptors: {
          build: 'slim',
          composition: 'average',
        },
      },
    });

    const description = await bodyDescriptionComposer.composeDescription(
      bodyEntity
    );

    expect(description).not.toContain('Smell:');
    expect(description).toContain('Build: slim');
    expect(description).toContain('Body composition: average');
  });
});
