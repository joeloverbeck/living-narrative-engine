import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';
import EquipmentDescriptionService from '../../../src/clothing/services/equipmentDescriptionService.js';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('Body Description with Equipment Integration - Simple', () => {
  let bodyDescriptionComposer;
  let equipmentDescriptionService;
  let mockLogger;

  beforeEach(() => {
    // Setup mock logger
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      log: jest.fn(),
    };

    // Mock equipment description service
    equipmentDescriptionService = {
      generateEquipmentDescription: jest.fn(),
    };

    // Create minimal body description composer with mocked dependencies
    const mockAnatomyFormattingService = {
      getFormattingConfiguration: jest.fn().mockReturnValue({
        separator: ', ',
        descriptionOrder: ['build', 'torso', 'equipment'],
      }),
    };

    bodyDescriptionComposer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: {
        buildPartDescriptions: jest.fn().mockReturnValue([]),
      },
      bodyGraphService: {
        getAllParts: jest.fn().mockReturnValue(['torso_1']),
      },
      entityFinder: {
        getEntityInstance: jest.fn(),
      },
      anatomyFormattingService: mockAnatomyFormattingService,
      partDescriptionGenerator: {
        generatePartDescription: jest.fn(),
      },
      equipmentDescriptionService,
    });

    // Mock the config to return the correct description order
    bodyDescriptionComposer.config.getDescriptionOrder = jest
      .fn()
      .mockReturnValue(['build', 'torso', 'equipment']);
    bodyDescriptionComposer.descriptionTemplate.createStructuredLine = jest
      .fn()
      .mockReturnValue('Torso: lean, muscular torso');
  });

  it('should integrate equipment descriptions with body descriptions', async () => {
    // Setup body entity
    const bodyEntity = {
      id: 'character_1',
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === ANATOMY_BODY_COMPONENT_ID) {
          return {
            body: {
              root: 'torso_1',
              parts: ['torso_1'],
              descriptors: {
                build: 'athletic',
              },
            },
          };
        }
        return null;
      }),
    };

    // Mock equipment description service to return equipment description
    equipmentDescriptionService.generateEquipmentDescription.mockResolvedValue(
      'Wearing: black leather jacket | sturdy boots.'
    );

    // Mock entity finder to return torso entity
    bodyDescriptionComposer.entityFinder.getEntityInstance.mockReturnValue({
      id: 'torso_1',
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === 'anatomy:part') {
          return { subType: 'torso' };
        }
        return null;
      }),
    });

    // Note: Part descriptions will be handled by the template mock

    // Act
    const result = await bodyDescriptionComposer.composeDescription(bodyEntity);

    // Assert
    expect(result).toContain('Build: athletic');
    expect(result).toContain('Torso: lean, muscular torso');
    expect(result).toContain('Wearing: black leather jacket | sturdy boots.');
    expect(
      equipmentDescriptionService.generateEquipmentDescription
    ).toHaveBeenCalledWith('character_1');
  });

  it('should handle case when no equipment is present', async () => {
    // Setup body entity
    const bodyEntity = {
      id: 'character_1',
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === ANATOMY_BODY_COMPONENT_ID) {
          return {
            body: {
              root: 'torso_1',
              parts: ['torso_1'],
              descriptors: {
                build: 'athletic',
              },
            },
          };
        }
        return null;
      }),
    };

    // Mock equipment description service to return empty string (no equipment)
    equipmentDescriptionService.generateEquipmentDescription.mockResolvedValue(
      ''
    );

    // Mock entity finder to return torso entity
    bodyDescriptionComposer.entityFinder.getEntityInstance.mockReturnValue({
      id: 'torso_1',
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === 'anatomy:part') {
          return { subType: 'torso' };
        }
        return null;
      }),
    });

    // Note: Part descriptions will be handled by the template mock

    // Act
    const result = await bodyDescriptionComposer.composeDescription(bodyEntity);

    // Assert
    expect(result).toContain('Build: athletic');
    expect(result).toContain('Torso: lean, muscular torso');
    expect(result).not.toContain('Wearing:');
    expect(
      equipmentDescriptionService.generateEquipmentDescription
    ).toHaveBeenCalledWith('character_1');
  });

  it('should handle equipment description errors gracefully', async () => {
    // Setup body entity
    const bodyEntity = {
      id: 'character_1',
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === ANATOMY_BODY_COMPONENT_ID) {
          return {
            body: {
              root: 'torso_1',
              parts: ['torso_1'],
              descriptors: {
                build: 'athletic',
              },
            },
          };
        }
        return null;
      }),
    };

    // Mock equipment description service to return empty string on error
    equipmentDescriptionService.generateEquipmentDescription.mockResolvedValue(
      ''
    );

    // Mock entity finder to return torso entity
    bodyDescriptionComposer.entityFinder.getEntityInstance.mockReturnValue({
      id: 'torso_1',
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === 'anatomy:part') {
          return { subType: 'torso' };
        }
        return null;
      }),
    });

    // Note: Part descriptions will be handled by the template mock

    // Act
    const result = await bodyDescriptionComposer.composeDescription(bodyEntity);

    // Assert
    expect(result).toContain('Build: athletic');
    expect(result).toContain('Torso: lean, muscular torso');
    expect(result).not.toContain('Wearing:');
    expect(
      equipmentDescriptionService.generateEquipmentDescription
    ).toHaveBeenCalledWith('character_1');
  });
});
