#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const files = [
  'tests/integration/mods/positioning/turnAroundKneelInteraction.integration.test.js',
  'tests/integration/mods/positioning/turnAroundKneelInteractionMultiActor.integration.test.js',
  'tests/integration/mods/positioning/turn_around_action.test.js',
  'tests/integration/mods/positioning/turn_around_to_face_action.test.js',
];

const projectRoot = '/home/joeloverbeck/projects/living-narrative-engine';

files.forEach((file) => {
  const filePath = path.join(projectRoot, file);

  if (!fs.existsSync(filePath)) {
    console.log(`Skipping non-existent file: ${file}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Check if import is already present
  if (content.includes('createMockTargetRequiredComponentsValidator')) {
    console.log(`Import already present in ${file}`);
    return;
  }

  // Find any import statement and add our import after the last one
  const importLines = content.match(/^import .+ from .+;$/gm);

  if (importLines && importLines.length > 0) {
    const lastImport = importLines[importLines.length - 1];
    const importToAdd = "import { createMockTargetRequiredComponentsValidator } from '../../../common/mockFactories/actions.js';";

    content = content.replace(lastImport, lastImport + '\n' + importToAdd);
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Added import to ${file}`);
  } else {
    console.log(`- Could not add import to ${file}`);
  }
});

console.log('\nDone!');
