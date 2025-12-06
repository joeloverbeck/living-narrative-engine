#!/usr/bin/env node

/**
 * @file Body Descriptor System Validation CLI Tool
 * Validates consistency of body descriptor configuration across the system
 *
 * Usage: npm run validate:body-descriptors
 */

import { BodyDescriptorValidator } from '../src/anatomy/validators/bodyDescriptorValidator.js';
import { getAllDescriptorNames } from '../src/anatomy/registries/bodyDescriptorRegistry.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock console logger for validator
const logger = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  warn: (msg) => console.warn(`⚠️  ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
  debug: () => {}, // Silent debug
};

/**
 * Load formatting configuration
 *
 * @returns {object|null} Formatting config object or null if loading fails
 */
function loadFormattingConfig() {
  const configPath = path.join(
    __dirname,
    '../data/mods/anatomy/anatomy-formatting/default.json'
  );

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`❌ Failed to load formatting config: ${err.message}`);
    return null;
  }
}

/**
 * Load anatomy recipe
 *
 * @param {string} recipeFile - Name of the recipe file to load
 * @returns {object|null} Recipe object or null if loading fails
 */
function loadRecipe(recipeFile) {
  const recipePath = path.join(
    __dirname,
    '../data/mods/anatomy/recipes',
    recipeFile
  );

  try {
    const content = fs.readFileSync(recipePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.warn(`⚠️  Failed to load recipe ${recipeFile}: ${err.message}`);
    return null;
  }
}

/**
 * Main validation function
 */
async function main() {
  console.log('\n🔍 Body Descriptor System Validation\n');
  console.log('━'.repeat(60));

  const validator = new BodyDescriptorValidator({ logger });
  let hasErrors = false;

  // 1. Validate Registry
  console.log('\n📋 Checking Registry...');
  const registeredDescriptors = getAllDescriptorNames();
  console.log(
    `   Found ${registeredDescriptors.length} registered descriptors`
  );
  console.log(`   ${registeredDescriptors.join(', ')}`);

  // 2. Validate Formatting Config
  console.log('\n📄 Validating Formatting Configuration...');
  const formattingConfig = loadFormattingConfig();

  if (formattingConfig) {
    const configResult = validator.validateFormattingConfig(formattingConfig);

    if (configResult.errors.length > 0) {
      hasErrors = true;
      console.log('\n❌ Errors:');
      configResult.errors.forEach((err) => console.log(`   ${err}`));
    }

    if (configResult.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      configResult.warnings.forEach((warn) => console.log(`   ${warn}`));
    }

    if (
      configResult.errors.length === 0 &&
      configResult.warnings.length === 0
    ) {
      console.log('   ✅ Formatting configuration is valid');
    }
  } else {
    hasErrors = true;
  }

  // 3. Validate Sample Recipes
  console.log('\n🧬 Validating Anatomy Recipes...');
  const sampleRecipes = ['human_male.recipe.json', 'human_female.recipe.json'];

  for (const recipeFile of sampleRecipes) {
    const recipe = loadRecipe(recipeFile);
    if (recipe?.bodyDescriptors) {
      const recipeResult = validator.validateRecipeDescriptors(
        recipe.bodyDescriptors
      );

      if (recipeResult.errors.length > 0) {
        hasErrors = true;
        console.log(`\n   ❌ ${recipeFile}:`);
        recipeResult.errors.forEach((err) => console.log(`      ${err}`));
      }

      if (recipeResult.warnings.length > 0) {
        console.log(`\n   ⚠️  ${recipeFile}:`);
        recipeResult.warnings.forEach((warn) => console.log(`      ${warn}`));
      }

      if (
        recipeResult.errors.length === 0 &&
        recipeResult.warnings.length === 0
      ) {
        console.log(`   ✅ ${recipeFile}`);
      }
    }
  }

  // 4. Summary
  console.log('\n' + '━'.repeat(60));

  if (hasErrors) {
    console.log('\n❌ Validation Failed\n');
    console.log('Fix the errors above and run validation again.');
    console.log('See data/mods/anatomy/anatomy-formatting/default.json\n');
    process.exit(1);
  } else {
    console.log('\n✅ Validation Passed\n');
    console.log('Body descriptor system is consistent.\n');
    process.exit(0);
  }
}

// Run validation
main().catch((err) => {
  console.error('\n❌ Unexpected error during validation:');
  console.error(err);
  process.exit(1);
});
