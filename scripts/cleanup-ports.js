#!/usr/bin/env node

/**
 * @file Utility script to clean up processes using ports 3001 and 8080
 * @description Detects and kills processes occupying the ports used by the Living Narrative Engine
 */

import { execSync } from 'child_process';

// Ports used by the application
const PORTS = {
  PROXY_SERVER: 3001,
  MAIN_APP: 8080,
};

/**
 * Find process ID using a specific port
 * @param {number} port - Port number to check
 * @returns {string|null} Process ID or null if not found
 */
function findProcessOnPort(port) {
  try {
    const result = execSync(`lsof -ti:${port}`, { encoding: 'utf8' });
    return result.trim();
  } catch (error) {
    return null;
  }
}

/**
 * Get detailed process information
 * @param {string} pid - Process ID
 * @returns {string|null} Process information or null if not found
 */
function getProcessInfo(pid) {
  try {
    const result = execSync(`ps -p ${pid} -o pid,command`, { encoding: 'utf8' });
    return result.trim();
  } catch (error) {
    return null;
  }
}

/**
 * Kill a process by PID
 * @param {string} pid - Process ID to kill
 * @returns {boolean} True if successful
 */
function killProcess(pid) {
  try {
    execSync(`kill -9 ${pid}`, { encoding: 'utf8' });
    return true;
  } catch (error) {
    console.error(`❌ Failed to kill process ${pid}:`, error.message);
    return false;
  }
}

/**
 * Main cleanup function
 */
function cleanupPorts() {
  console.log('🧹 Living Narrative Engine - Port Cleanup Utility\n');

  let foundProcesses = false;
  const killResults = [];

  // Check each port
  for (const [name, port] of Object.entries(PORTS)) {
    console.log(`🔍 Checking port ${port} (${name})...`);

    const pid = findProcessOnPort(port);

    if (pid) {
      foundProcesses = true;
      const processInfo = getProcessInfo(pid);

      console.log(`  ⚠️  Process found:`);
      if (processInfo) {
        console.log(`     ${processInfo}`);
      } else {
        console.log(`     PID: ${pid}`);
      }

      // Kill the process
      console.log(`  🔨 Attempting to kill process ${pid}...`);
      const success = killProcess(pid);

      if (success) {
        console.log(`  ✅ Process ${pid} killed successfully\n`);
        killResults.push({ port, pid, success: true });
      } else {
        console.log(`  ❌ Failed to kill process ${pid}\n`);
        killResults.push({ port, pid, success: false });
      }
    } else {
      console.log(`  ✓ Port ${port} is available\n`);
    }
  }

  // Summary
  console.log('─'.repeat(50));
  if (!foundProcesses) {
    console.log('✨ All ports are available. No cleanup needed.');
  } else {
    const successful = killResults.filter((r) => r.success).length;
    const failed = killResults.filter((r) => !r.success).length;

    if (failed === 0) {
      console.log(`✅ Cleanup complete! Killed ${successful} process(es).`);
      console.log('   You can now start the application.');
    } else {
      console.log(
        `⚠️  Partial cleanup: ${successful} succeeded, ${failed} failed.`
      );
      console.log('   Manual intervention may be required for failed processes.');

      // Show manual cleanup instructions
      console.log('\n📋 Manual cleanup options:');
      for (const result of killResults.filter((r) => !r.success)) {
        console.log(`   Port ${result.port}: sudo kill -9 ${result.pid}`);
      }
    }
  }

  console.log('─'.repeat(50));

  // Exit with appropriate code
  const anyFailed = killResults.some((r) => !r.success);
  process.exit(anyFailed ? 1 : 0);
}

// Run cleanup
cleanupPorts();
