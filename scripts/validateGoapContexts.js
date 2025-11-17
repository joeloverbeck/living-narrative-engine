#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const patterns = [
  {
    regex: /actor\.core(?!\.components)/i,
    message: 'use actor.components.* paths instead of actor.core',
  },
  {
    regex: /state\.actor\.core(?!\.components)/i,
    message: 'use state.actor.components.* paths instead of state.actor.core',
  },
];

const files = await glob('{data/**/*.goal.json,data/**/*.task.json}', {
  cwd: projectRoot,
  nodir: true,
});

if (files.length === 0) {
  console.log('✅ No GOAP goal/task files found for context validation.');
  process.exit(0);
}

console.log(`🔍 Scanning ${files.length} GOAP goal/task definition(s) for deprecated actor.core paths...`);

const violations = [];

for (const relativePath of files) {
  const absolutePath = path.join(projectRoot, relativePath);
  const contents = await fs.readFile(absolutePath, 'utf8');
  const lines = contents.split(/\r?\n/);

  lines.forEach((line, index) => {
    patterns.forEach((pattern) => {
      if (pattern.regex.test(line)) {
        violations.push({
          file: relativePath,
          line: index + 1,
          message: pattern.message,
          snippet: line.trim(),
        });
      }
    });
  });
}

if (violations.length === 0) {
  console.log('✅ All GOAP definitions reference actor.components paths.');
  process.exit(0);
}

console.log('\n❌ Deprecated GOAP context references found:\n');
violations.forEach((violation, index) => {
  console.log(
    `${index + 1}. ${violation.file}:${violation.line} — ${violation.message}\n   ${violation.snippet}`
  );
});

console.error('\nPlease update these files to use PlanningStateView-friendly actor.components paths.');
process.exit(1);
