#!/usr/bin/env node

/**
 * Simple test script to reproduce the RemoteLogger connection issue
 * This simulates exactly what the browser RemoteLogger does
 */

// Using built-in fetch (Node.js 18+)

/**
 *
 */
async function testRemoteLoggerConnection() {
  console.log('Testing RemoteLogger connection...');

  // Simulate the exact request that RemoteLogger makes
  const endpoint = 'http://127.0.0.1:3001/api/debug-log';
  const logs = [
    {
      level: 'debug',
      message: 'Test debug message during startup',
      timestamp: new Date().toISOString(),
      category: 'engine',
      sessionId: 'a38e7cf1-e10b-44e0-9f4b-ec0ce87d71f1', // Valid UUID v4
      source: 'test-script.js:1',
    },
  ];

  try {
    console.log(`Making request to: ${endpoint}`);
    console.log(`Payload:`, JSON.stringify({ logs }, null, 2));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ logs }),
    });

    console.log(`Response status: ${response.status} ${response.statusText}`);
    console.log('Response headers:');
    for (const [key, value] of response.headers.entries()) {
      console.log(`  ${key}: ${value}`);
    }

    if (response.ok) {
      const result = await response.json();
      console.log('Success! Server response:', result);
    } else {
      const errorText = await response.text();
      console.error('Error response:', errorText);
    }
  } catch (error) {
    console.error('Connection failed:', error.message);
    console.error('Error type:', error.constructor.name);
    console.error('Error code:', error.code);

    if (error.code === 'ECONNREFUSED') {
      console.log(
        '\nThis is the same error as net::ERR_CONNECTION_REFUSED in browsers!'
      );
    }
  }
}

// Test multiple times to simulate rapid logging during bootstrap
/**
 *
 */
async function testMultipleRequests() {
  console.log(
    '\n=== Testing multiple rapid requests (simulating bootstrap) ==='
  );

  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(testRemoteLoggerConnection());
    // Small delay to simulate rapid but not simultaneous requests
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  await Promise.all(promises);
}

console.log('RemoteLogger Connection Test');
console.log('============================');
await testRemoteLoggerConnection();
await testMultipleRequests();
