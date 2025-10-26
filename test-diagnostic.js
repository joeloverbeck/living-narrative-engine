import AnatomyIntegrationTestBed from './tests/common/anatomy/anatomyIntegrationTestBed.js';

const testBed = new AnatomyIntegrationTestBed();
testBed.loadCoreTestData();

const jonEntity = await testBed.entityManager.createEntityInstance('core:actor');
console.log('Entity created:', jonEntity.id);
console.log('Component type IDs:', jonEntity.componentTypeIds);

testBed.entityManager.addComponent(jonEntity.id, 'test:activity_state', {
  activityMetadata: {
    shouldDescribeInActivity: true,
    template: '{actor} is testing',
    priority: 75,
  },
});

const updatedEntity = testBed.entityManager.getEntityInstance(jonEntity.id);
console.log('After adding component:');
console.log('Component type IDs:', updatedEntity.componentTypeIds);
console.log('Has test:activity_state?', updatedEntity.componentTypeIds.includes('test:activity_state'));

if (updatedEntity.componentTypeIds.includes('test:activity_state')) {
  const componentData = updatedEntity.getComponentData('test:activity_state');
  console.log('Component data:', JSON.stringify(componentData, null, 2));
}

testBed.cleanup();
