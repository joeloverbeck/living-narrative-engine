/**
 * Test script to verify log flushing is working properly on Windows Terminal
 * Run this after implementing the fixes to ensure logs are being written without terminal focus issues
 */

import fs from 'fs/promises';
import path from 'path';

const API_ENDPOINT = 'http://localhost:3001/api/debug-log';
const LOG_DIR = './logs';

/**
 * @description Resolve the fetch implementation from the global scope.
 * @returns {typeof fetch}
 * @throws {Error} When the runtime does not provide a global fetch.
 */
function getFetchImplementation() {
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('Global fetch API is not available in this runtime.');
  }

  return globalThis.fetch.bind(globalThis);
}

// Generate test logs
/**
 *
 * @param count
 */
function generateTestLogs(count = 10) {
  const logs = [];
  const categories = ['engine', 'ui', 'entities', 'actions', 'general'];
  const levels = ['debug', 'info', 'warn', 'error'];

  for (let i = 0; i < count; i++) {
    logs.push({
      level: levels[Math.floor(Math.random() * levels.length)],
      message: `Test log message ${i + 1} - Testing Windows Terminal flush fix`,
      timestamp: new Date().toISOString(),
      category: categories[Math.floor(Math.random() * categories.length)],
      source: 'test-log-flushing.js',
      sessionId: 'test-session-' + Date.now(),
      metadata: {
        testRun: true,
        index: i + 1,
        timestamp: Date.now(),
      },
    });
  }

  return logs;
}

// Send logs to the server
/**
 *
 * @param logs
 */
async function sendLogs(logs) {
  try {
    const fetchImpl = getFetchImplementation();
    const response = await fetchImpl(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
      },
      body: JSON.stringify({ logs }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Failed to send logs:', error.message);
    throw error;
  }
}

// Check if log files are being written
/**
 *
 */
async function checkLogFiles() {
  const today = new Date().toISOString().split('T')[0];
  const todayLogDir = path.join(LOG_DIR, today);

  try {
    const files = await fs.readdir(todayLogDir);
    console.log(`\nLog files in ${todayLogDir}:`);

    for (const file of files) {
      const filePath = path.join(todayLogDir, file);
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf8');
      const lineCount = content
        .split('\n')
        .filter((line) => line.trim()).length;

      console.log(`  - ${file}: ${stats.size} bytes, ${lineCount} log entries`);
    }

    return files.length > 0;
  } catch (error) {
    console.error(`Failed to check log files:`, error.message);
    return false;
  }
}

// Main test function
/**
 *
 */
async function testLogFlushing() {
  console.log('🧪 Starting Windows Terminal Log Flush Test');
  console.log('='.repeat(50));

  // Initial check
  console.log('\n📁 Initial log file check:');
  await checkLogFiles();

  // Send test logs in batches
  console.log('\n📤 Sending test logs in batches...');

  for (let batch = 1; batch <= 3; batch++) {
    console.log(`\n  Batch ${batch}:`);
    const logs = generateTestLogs(15);

    try {
      const result = await sendLogs(logs);
      console.log(`    ✅ Sent ${logs.length} logs successfully`);
      console.log(`    📊 Server response:`, result);
    } catch (error) {
      console.log(`    ❌ Failed to send batch ${batch}`);
    }

    // Wait between batches
    console.log(`    ⏳ Waiting 2 seconds for logs to flush...`);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check if files are updated
    console.log(`    📁 Checking log files after batch ${batch}:`);
    const filesExist = await checkLogFiles();

    if (filesExist) {
      console.log(`    ✅ Log files are being written!`);
    } else {
      console.log(`    ⚠️ No log files found yet...`);
    }
  }

  // Final check after all batches
  console.log('\n⏳ Waiting 5 seconds for final flush...');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  console.log('\n📁 Final log file check:');
  const finalCheck = await checkLogFiles();

  console.log('\n' + '='.repeat(50));
  if (finalCheck) {
    console.log('✅ TEST PASSED: Logs are being flushed to files properly!');
    console.log('   The Windows Terminal focus issue appears to be fixed.');
  } else {
    console.log('❌ TEST FAILED: No log files found.');
    console.log('   Please check that:');
    console.log('   1. The llm-proxy-server is running');
    console.log('   2. Debug logging is enabled in config');
    console.log('   3. The log directory has write permissions');
  }

  console.log('\n💡 Tips:');
  console.log('   - Monitor the log files while this test runs');
  console.log('   - Try switching terminal focus during the test');
  console.log('   - Check that logs appear without needing to change focus');
}

export { generateTestLogs, sendLogs, checkLogFiles, testLogFlushing };

const isDirectExecution =
  process.env.NODE_ENV !== 'test' &&
  typeof process.argv[1] === 'string' &&
  path.basename(process.argv[1]) === 'test-log-flushing.js';

if (isDirectExecution) {
  testLogFlushing().catch(console.error);
}
