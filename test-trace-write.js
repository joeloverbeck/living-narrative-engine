#!/usr/bin/env node
/**
 * Test script to simulate trace writing via the server endpoint
 */

/**
 *
 */
async function testTraceWrite() {
  console.log('Testing trace file writing via server endpoint...\n');

  const traceData = {
    timestamp: new Date().toISOString(),
    outputDirectory: './traces/rub-vagina-debugging',
    trace: {
      actionId: 'sex:rub_vagina_over_clothes',
      actorId: 'test_actor_123',
      pipeline: {
        componentFiltering: {
          startTime: Date.now(),
          duration: 2.5,
          passed: true,
        },
        prerequisiteEvaluation: {
          startTime: Date.now() + 3,
          duration: 5.3,
          result: true,
        },
        targetResolution: {
          startTime: Date.now() + 9,
          duration: 8.7,
          resolvedTargets: [{ id: 'target_1', displayName: 'Test Target' }],
        },
        formatting: {
          startTime: Date.now() + 18,
          duration: 1.2,
          formattedCommand: 'rub vagina over clothes',
        },
      },
      execution: {
        startTime: Date.now() + 20,
        endTime: Date.now() + 122,
        duration: 102,
        result: 'success',
      },
    },
    metadata: {
      actionId: 'sex:rub_vagina_over_clothes',
      actorId: 'test_actor_123',
      isComplete: true,
      hasError: false,
      generatedBy: 'Test Script',
    },
  };

  const fileName = `trace_test_${Date.now()}.json`;

  try {
    console.log('Sending trace to server endpoint...');
    console.log(`  Endpoint: http://localhost:3001/api/traces/write`);
    console.log(`  File name: ${fileName}`);
    console.log(`  Output directory: ./traces/rub-vagina-debugging`);

    const response = await fetch('http://localhost:3001/api/traces/write', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        traceData: JSON.stringify(traceData, null, 2),
        fileName: fileName,
        outputDirectory: './traces/rub-vagina-debugging',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`✗ Server returned error ${response.status}:`, errorData);
      console.log('\nMake sure the llm-proxy-server is running:');
      console.log('  cd llm-proxy-server && npm run dev');
      return;
    }

    const result = await response.json();
    console.log('✓ Trace written successfully!');
    console.log(`  Path: ${result.path}`);
    console.log(`  Size: ${result.size} bytes`);
    console.log(`\nVerify the file was created:`);
    console.log(`  ls -la traces/rub-vagina-debugging/${fileName}`);
  } catch (error) {
    console.error('✗ Failed to write trace:', error.message);

    if (error.message.includes('fetch')) {
      console.log(
        '\n⚠ Could not connect to server. Make sure llm-proxy-server is running:'
      );
      console.log('  cd llm-proxy-server && npm run dev');
    }
  }
}

// Run the test
testTraceWrite().catch(console.error);
