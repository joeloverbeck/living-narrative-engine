import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from './tests/common/anatomy/anatomyIntegrationTestBed.js';
import ActivityDescriptionService from './src/anatomy/services/activityDescriptionService.js';

describe('Activity Description Debug', () => {
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    testBed.loadCoreTestData();

    testBed.loadComponents({
      'test:activity_state': {
        id: 'test:activity_state',
        dataSchema: { type: 'object', properties: {} },
      },
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should show entity structure', async () => {
    const jonEntity = await testBed.entityManager.createEntityInstance('core:actor');
    console.log('Entity ID:', jonEntity.id);
    console.log('Component type IDs:', jonEntity.componentTypeIds);

    testBed.entityManager.addComponent(jonEntity.id, 'test:activity_state', {
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is testing',
        priority: 75,
      },
    });

    const updatedEntity = testBed.entityManager.getEntityInstance(jonEntity.id);
    console.log('After adding component - Component type IDs:', updatedEntity.componentTypeIds);

    if (updatedEntity.componentTypeIds.includes('test:activity_state')) {
      const componentData = updatedEntity.getComponentData('test:activity_state');
      console.log('Component data:', JSON.stringify(componentData, null, 2));
      console.log('Activity metadata:', JSON.stringify(componentData.activityMetadata, null, 2));
    } else {
      console.log('Component NOT found in entity!');
    }
  });
});
