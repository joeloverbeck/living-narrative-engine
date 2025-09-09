/**
 * Debug test to verify schema loading sequence
 */
import AppContainer from './src/dependencyInjection/appContainer.js';
import { configureContainer } from './src/dependencyInjection/containerConfig.js';

async function debugSchemaLoading() {
  console.log('=== Debug Schema Loading Test ===');
  
  const container = new AppContainer();
  await configureContainer(container);
  
  try {
    // Get the schema validator to check if rule schema is loaded
    const validator = container.resolve('ISchemaValidator');
    console.log('Schema validator resolved successfully');
    
    // Check if rule schema is initially loaded
    const ruleSchemaId = 'schema://living-narrative-engine/rule.schema.json';
    console.log(`Rule schema loaded initially: ${validator.isSchemaLoaded(ruleSchemaId)}`);
    
    // Get schema loader and try to load schemas
    const schemaLoader = container.resolve('SchemaLoader');
    console.log('Schema loader resolved successfully');
    
    // Load and compile all schemas
    console.log('Loading and compiling all schemas...');
    await schemaLoader.loadAndCompileAllSchemas();
    console.log('Schema loading completed');
    
    // Check if rule schema is now loaded
    console.log(`Rule schema loaded after loadAndCompileAllSchemas: ${validator.isSchemaLoaded(ruleSchemaId)}`);
    
    // Test validation of the failing rule
    const testRuleData = {
      "event_type": "core:handle_get_up_from_furniture",
      "priority": 100,
      "actions": [
        {"type": "LOG", "parameters": {"message": "Actor is getting up from furniture"}},
        {"macro": "core:logSuccessAndEndTurn"}
      ]
    };
    
    console.log('Testing rule validation...');
    const isValid = await validator.validateAgainstSchema(testRuleData, ruleSchemaId);
    console.log(`Rule validation result: ${isValid}`);
    
    if (!isValid) {
      const errors = validator.getLastValidationErrors();
      console.log('Validation errors:', JSON.stringify(errors, null, 2));
    }
    
  } catch (error) {
    console.error('Debug test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the debug test
debugSchemaLoading().catch(console.error);