#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import { validateGoalPaths } from '../src/goap/planner/goalPathValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const shouldFail = process.env.GOAP_GOAL_PATH_LINT === '1';
const goalFiles = await glob('data/**/*.goal.json', { cwd: projectRoot, nodir: true });

if (goalFiles.length === 0) {
  console.log('✅ No goal files found to validate.');
  process.exit(0);
}

console.log(`🔍 Validating ${goalFiles.length} goal definition(s) for canonical PlanningStateView paths...`);

const violations = [];

for (const relativePath of goalFiles) {
  const filePath = path.join(projectRoot, relativePath);
  try {
    const fileContents = await fs.readFile(filePath, 'utf8');
    const goalDefinition = JSON.parse(fileContents);
    if (!goalDefinition.goalState) {
      continue;
    }
    const validation = validateGoalPaths(goalDefinition.goalState, {
      goalId: goalDefinition.id ?? path.basename(relativePath, path.extname(relativePath)),
    });
    if (!validation.isValid) {
      violations.push({
        file: relativePath,
        goalId: goalDefinition.id ?? 'unknown-goal',
        entries: validation.violations,
      });
    }
  } catch (error) {
    console.error(`❌ Failed to validate ${relativePath}: ${error.message}`);
    process.exit(1);
  }
}

if (violations.length === 0) {
  console.log('✅ All goal files use canonical actor.components paths.');
  process.exit(0);
}

console.log('\n⚠️ Goal path violations detected:\n');
violations.forEach((violation, index) => {
  console.log(`${index + 1}. ${violation.goalId} (${violation.file})`);
  violation.entries.forEach((entry) => {
    console.log(`   • ${entry.path} — ${entry.reason}`);
  });
});

if (shouldFail) {
  console.error('\n❌ GOAP_GOAL_PATH_LINT=1 — failing validation due to invalid goal paths.');
  process.exit(1);
}

console.log('\n⚠️ GOAP_GOAL_PATH_LINT is not enabled, so violations were reported but not treated as fatal.');
process.exit(0);
