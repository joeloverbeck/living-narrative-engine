#!/usr/bin/env node
const fs = require('fs-extra');
const path = require('path');

/**
 *
 */
async function testWrite() {
  try {
    await fs.writeFile(path.join('dist/readonly-test', 'test.js'), 'content');
    console.log('Write successful');
  } catch (error) {
    console.error(
      'Build failed: Permission denied - Cannot write to output directory'
    );
    process.exit(1);
  }
}

testWrite();
