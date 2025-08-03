#!/usr/bin/env node

/**
 * Test projection descriptor functionality
 */

// Create test breasts with different projections
const breastVariants = [
  { id: 'breast-flat', projection: 'flat', size: 'small' },
  { id: 'breast-bubbly', projection: 'bubbly', size: 'medium' },
  { id: 'breast-shelf', projection: 'shelf', size: 'large' },
];

console.log('🧪 Testing Projection Descriptor...\n');

breastVariants.forEach((variant) => {
  // Create mock entity using the project's entity structure
  const mockEntity = {
    id: variant.id,
    hasComponent: (componentId) => {
      return [
        'anatomy:part',
        'descriptors:size_category',
        'descriptors:projection',
        'descriptors:firmness',
      ].includes(componentId);
    },
    getComponentData: (componentId) => {
      const components = {
        'anatomy:part': {
          type: 'breast',
          subType: 'breasts',
          count: 2,
        },
        'descriptors:size_category': {
          size: variant.size,
        },
        'descriptors:projection': {
          projection: variant.projection,
        },
        'descriptors:firmness': {
          firmness: 'firm',
        },
      };
      return components[componentId] || null;
    },
  };

  console.log(`Created ${variant.id}:`);
  console.log(`- Size: ${variant.size}`);
  console.log(`- Projection: ${variant.projection}`);
  console.log(
    `- Expected output: "${variant.size} ${variant.projection} firm breasts"\n`
  );
});

// Create test buttocks with projection
const buttocksVariants = [
  { id: 'buttocks-flat', projection: 'flat', shape: 'narrow' },
  { id: 'buttocks-bubbly', projection: 'bubbly', shape: 'round' },
  { id: 'buttocks-shelf', projection: 'shelf', shape: 'wide' },
];

buttocksVariants.forEach((variant) => {
  // Create mock entity using the project's entity structure
  const mockEntity = {
    id: variant.id,
    hasComponent: (componentId) => {
      return [
        'anatomy:part',
        'descriptors:shape_general',
        'descriptors:projection',
      ].includes(componentId);
    },
    getComponentData: (componentId) => {
      const components = {
        'anatomy:part': {
          type: 'ass',
          subType: 'buttocks',
        },
        'descriptors:shape_general': {
          shape: variant.shape,
        },
        'descriptors:projection': {
          projection: variant.projection,
        },
      };
      return components[componentId] || null;
    },
  };

  console.log(`Created ${variant.id}:`);
  console.log(`- Shape: ${variant.shape}`);
  console.log(`- Projection: ${variant.projection}`);
  console.log(
    `- Expected output: "${variant.shape} ${variant.projection} buttocks"\n`
  );
});

console.log(
  '✅ Test script completed. Use this output to verify projection descriptors are working correctly.'
);
