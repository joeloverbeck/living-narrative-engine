/**
 * Test script to verify action tracing file output
 */

import fs from 'fs/promises';
import path from 'path';

// Check if trace directory exists and has files
/**
 *
 */
async function checkTraceOutput() {
  console.log('Checking trace output directory...\n');

  const traceDir = './traces/rub-vagina-debugging';

  try {
    // Check if directory exists
    await fs.access(traceDir);
    console.log(`✓ Directory exists: ${traceDir}`);

    // List files in directory
    const files = await fs.readdir(traceDir);

    if (files.length === 0) {
      console.log('✗ No trace files found in directory');
      console.log('\nTo generate traces:');
      console.log('1. Ensure llm-proxy-server is running (npm run dev:proxy)');
      console.log('2. Start the main application (npm run dev)');
      console.log(
        '3. Perform actions in the game that trigger the traced action'
      );
      console.log('4. Check this directory again');
    } else {
      console.log(`✓ Found ${files.length} trace file(s):`);

      // Show file details
      for (const file of files) {
        const filePath = path.join(traceDir, file);
        const stats = await fs.stat(filePath);
        console.log(
          `  - ${file} (${stats.size} bytes, created: ${stats.birthtime.toLocaleString()})`
        );

        // Show first few lines of first file
        if (files.indexOf(file) === 0 && file.endsWith('.json')) {
          try {
            const content = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(content);
            console.log('\n  Sample trace data:');
            console.log(`    Timestamp: ${parsed.timestamp}`);
            console.log(`    Action ID: ${parsed.metadata?.actionId || 'N/A'}`);
            console.log(`    Actor ID: ${parsed.metadata?.actorId || 'N/A'}`);
          } catch (e) {
            console.log('  Could not parse trace file:', e.message);
          }
        }
      }
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`✗ Directory does not exist: ${traceDir}`);
      console.log('  Creating directory...');
      await fs.mkdir(traceDir, { recursive: true });
      console.log('  ✓ Directory created');
    } else {
      console.error('Error checking trace output:', error);
    }
  }

  console.log('\n---');
  console.log('Configuration check:');

  // Check if config file exists and is correct
  try {
    const configPath = './config/trace-config.json';
    const config = JSON.parse(await fs.readFile(configPath, 'utf8'));

    console.log('✓ trace-config.json found');
    console.log(`  Tracing enabled: ${config.actionTracing?.enabled || false}`);
    console.log(
      `  Output directory: ${config.actionTracing?.outputDirectory || 'not set'}`
    );
    console.log(
      `  Traced actions: ${JSON.stringify(config.actionTracing?.tracedActions || [])}`
    );

    if (!config.actionTracing?.enabled) {
      console.log('\n⚠ Action tracing is DISABLED in config');
      console.log('  Set actionTracing.enabled to true to enable tracing');
    }
  } catch (error) {
    console.log('✗ Could not read trace-config.json:', error.message);
  }
}

// Run the check
checkTraceOutput().catch(console.error);
