import LogCategoryDetector from './src/logging/logCategoryDetector.js';

const detector = new LogCategoryDetector();

// Test messages from the failing tests
const testCases = [
  { message: 'GameEngine initialization started', level: 'info', expected: 'engine' },
  { message: 'Renderer updating display elements', level: 'debug', expected: 'ui' },
  { message: 'EntityManager created new actor', level: 'info', expected: 'ecs' }
];

console.log('Testing LogCategoryDetector patterns:\n');

testCases.forEach(({ message, level, expected }) => {
  const detected = detector.detectCategory(message, { level });
  console.log(`Message: "${message}"`);
  console.log(`Level: ${level}`);
  console.log(`Expected: ${expected}`);
  console.log(`Detected: ${detected || 'undefined'}`);
  console.log(`Match: ${detected === expected ? '✅' : '❌'}`);
  console.log('---');
});

// Also test the patterns directly
console.log('\nDirect pattern tests:');
const patterns = detector.getPatterns();
testCases.forEach(({ message, expected }) => {
  const patternInfo = patterns[expected];
  if (patternInfo) {
    const pattern = new RegExp(patternInfo.pattern.slice(1, -2), 'i');
    console.log(`"${message}" vs ${expected} pattern: ${pattern.test(message) ? '✅' : '❌'}`);
  }
});