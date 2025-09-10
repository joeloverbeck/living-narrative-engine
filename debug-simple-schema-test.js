/**
 * Simple debug test to verify SchemaPhase functionality
 */

// Mock minimal logger
const mockLogger = {
  debug: (...args) => console.log('[DEBUG]', ...args),
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.log('[ERROR]', ...args),
  warn: (...args) => console.log('[WARN]', ...args),
};

async function debugSchemaPhase() {
  console.log('=== Simple Schema Phase Debug Test ===');

  try {
    // Try to import and test SchemaPhase directly
    const { default: SchemaPhase } = await import(
      './src/loaders/phases/SchemaPhase.js'
    );

    // Create mock dependencies
    const mockSchemaLoader = {
      loadAndCompileAllSchemas: async () => {
        console.log('Mock loadAndCompileAllSchemas called');
        return true;
      },
    };

    const mockConfig = {
      getContentTypeSchemaId: (type) => {
        console.log(`Mock getContentTypeSchemaId called for type: ${type}`);
        return `schema://living-narrative-engine/${type}.schema.json`;
      },
    };

    const mockValidator = {
      isSchemaLoaded: (id) => {
        console.log(`Mock isSchemaLoaded called for id: ${id}`);
        // Simulate that essential schemas are loaded after SchemaPhase runs
        return true;
      },
    };

    // Create SchemaPhase instance
    const schemaPhase = new SchemaPhase({
      schemaLoader: mockSchemaLoader,
      config: mockConfig,
      validator: mockValidator,
      logger: mockLogger,
    });

    console.log('SchemaPhase created successfully');
    console.log('Phase name:', schemaPhase.name);

    // Test execution with mock context
    const mockContext = {
      worldName: 'test-world',
      finalModOrder: ['core'],
      totals: {},
    };

    console.log('Executing SchemaPhase...');
    const result = await schemaPhase.execute(mockContext);
    console.log('SchemaPhase executed successfully');
    console.log('Result keys:', Object.keys(result));
  } catch (error) {
    console.error('Debug test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the debug test
debugSchemaPhase().catch(console.error);
