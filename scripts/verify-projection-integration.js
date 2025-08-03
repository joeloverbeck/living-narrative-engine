#!/usr/bin/env node

/**
 * Verify projection descriptor integration
 */

import { promises as fs } from 'fs';

/**
 *
 */
async function verifyProjection() {
  console.log('🔍 Verifying Projection Descriptor Integration...\n');

  const errors = [];

  // 1. Check configuration
  console.log('1️⃣ Checking configuration...');
  try {
    const configContent = await fs.readFile(
      'data/mods/anatomy/anatomy-formatting/default.json',
      'utf8'
    );
    const config = JSON.parse(configContent);

    if (!config.descriptorOrder.includes('descriptors:projection')) {
      errors.push('descriptors:projection missing from descriptorOrder');
    } else {
      console.log('✅ descriptors:projection in descriptorOrder');
    }

    if (!config.descriptorValueKeys.includes('projection')) {
      errors.push('projection missing from descriptorValueKeys');
    } else {
      console.log('✅ projection in descriptorValueKeys');
    }
  } catch (error) {
    errors.push(`Failed to check configuration: ${error.message}`);
  }

  // 2. Check component schema
  console.log('\n2️⃣ Checking projection component schema...');
  try {
    await fs.access(
      'data/mods/descriptors/components/projection.component.json'
    );
    console.log('✅ Projection component exists');

    const componentContent = await fs.readFile(
      'data/mods/descriptors/components/projection.component.json',
      'utf8'
    );
    const component = JSON.parse(componentContent);

    if (component.id !== 'descriptors:projection') {
      errors.push('Projection component has incorrect ID');
    }

    if (
      !component.dataSchema?.properties?.projection?.enum?.includes('flat') ||
      !component.dataSchema?.properties?.projection?.enum?.includes('bubbly') ||
      !component.dataSchema?.properties?.projection?.enum?.includes('shelf')
    ) {
      errors.push('Projection component missing required enum values');
    }
  } catch {
    errors.push('Projection component file missing or invalid');
  }

  // 3. Check for example usage
  console.log('\n3️⃣ Checking for example entities...');
  const exampleFiles = [
    'data/mods/anatomy/entities/definitions/human_breast_shelf.entity.json',
    'data/mods/anatomy/entities/definitions/human_breast_bubbly.entity.json',
    'data/mods/anatomy/entities/definitions/human_ass_cheek_shelf.entity.json',
    'data/mods/anatomy/entities/definitions/human_ass_cheek_flat.entity.json',
  ];

  for (const file of exampleFiles) {
    try {
      await fs.access(file);
      console.log(`✅ Example entity exists: ${file}`);
    } catch {
      console.log(`⚠️  Example entity missing: ${file}`);
    }
  }

  // 4. Check DescriptorFormatter defaults
  console.log('\n4️⃣ Checking DescriptorFormatter defaults...');
  try {
    const formatterContent = await fs.readFile(
      'src/anatomy/descriptorFormatter.js',
      'utf8'
    );

    if (
      formatterContent.includes("'descriptors:projection',") &&
      formatterContent.includes("'projection',")
    ) {
      console.log('✅ DescriptorFormatter defaults updated');
    } else {
      errors.push('DescriptorFormatter defaults not properly updated');
    }
  } catch (error) {
    errors.push(`Failed to check DescriptorFormatter: ${error.message}`);
  }

  // Report results
  if (errors.length === 0) {
    console.log('\n✨ Projection descriptor integration verified!');
  } else {
    console.log('\n❌ Integration issues found:');
    errors.forEach((err) => console.log(`  - ${err}`));
    process.exit(1);
  }
}

verifyProjection().catch(console.error);
