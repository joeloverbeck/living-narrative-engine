/**
 * @file Debug script to reproduce and diagnose the park bench scope issue
 */

// Mock the runtime scenario based on the logs we have
console.log('=== Park Bench Scope Issue Debug ===');

// From the logs, we know:
console.log('Expected State:');
console.log('1. Park bench entity: p_erotica:park_bench_instance');
console.log('2. Definition has: positioning:allows_sitting component');
console.log(
  '3. Instance override adds: core:position component with locationId: p_erotica:park_instance'
);
console.log(
  '4. Actor (Ane Arrieta): p_erotica:ane_arrieta_instance in same location'
);
console.log('');

console.log('Scope to evaluate:');
console.log(
  'positioning:available_furniture := entities(positioning:allows_sitting)[][filter]'
);
console.log('');

console.log('Filter conditions:');
console.log(
  '1. entity.components.core:position.locationId == actor.components.core:position.locationId'
);
console.log(
  '2. entity.components.positioning:allows_sitting.spots has at least one null value'
);
console.log('');

console.log('The scope should find the park bench because:');
console.log('- Park bench has positioning:allows_sitting (from definition)');
console.log(
  '- Park bench has core:position with locationId: p_erotica:park_instance (from instance override)'
);
console.log(
  '- Actor also has core:position with locationId: p_erotica:park_instance'
);
console.log('- Park bench has spots: [null, null] which contains null values');
console.log('');

console.log('Current result from trace: targetCount: 0 (no entities found)');
console.log(
  'This suggests the scope resolution is not finding the park bench.'
);
console.log('');

console.log(
  'Hypothesis: The park bench entity being returned by entities(positioning:allows_sitting)'
);
console.log(
  'does not have the core:position component properly merged from the instance override.'
);
console.log('This would cause the first filter condition to fail.');

process.exit(0);
