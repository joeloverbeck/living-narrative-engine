/**
 * Debug test to compare working vs failing IF operations
 */

async function debugIFOperationValidation() {
  console.log('=== IF Operation Validation Debug ===');

  try {
    // Import AJV directly
    const Ajv = (await import('ajv')).default;
    const addFormats = (await import('ajv-formats')).default;

    const ajv = new Ajv({
      strict: false,
      allErrors: true,
      validateFormats: false,
    });
    addFormats(ajv);

    console.log('AJV configured');

    // Load the schemas we need
    const fs = (await import('fs')).default;

    // Load all required schemas
    const schemas = [
      'rule.schema.json',
      'operation.schema.json',
      'nested-operation.schema.json',
      'operations/if.schema.json',
      'base-operation.schema.json',
      'common.schema.json',
      'json-logic.schema.json',
      'condition-container.schema.json',
    ];

    for (const schemaFile of schemas) {
      try {
        const schemaPath = `./data/schemas/${schemaFile}`;
        const schemaContent = fs.readFileSync(schemaPath, 'utf8');
        const schema = JSON.parse(schemaContent);
        ajv.addSchema(schema, schema.$id);
        console.log(`Loaded schema: ${schema.$id}`);
      } catch (error) {
        console.log(`Failed to load schema ${schemaFile}: ${error.message}`);
      }
    }

    console.log('\n--- Testing problematic rule ---');

    // Test the problematic rule
    const problematicRule = {
      $schema: 'schema://living-narrative-engine/rule.schema.json',
      rule_id: 'handle_get_up_from_furniture',
      event_type: 'core:attempt_action',
      actions: [
        {
          type: 'IF',
          comment: "Clear spot 0 if that's where actor was sitting",
          parameters: {
            condition: { '==': [{ var: 'context.sittingInfo.spot_index' }, 0] },
            then_actions: [
              {
                type: 'MODIFY_COMPONENT',
                comment: 'Clear spot 0',
                parameters: {
                  entity_ref: 'target',
                  component_type: 'positioning:allows_sitting',
                  field: 'spots.0',
                  mode: 'set',
                  value: null,
                },
              },
            ],
          },
        },
        {
          macro: 'core:logSuccessAndEndTurn',
        },
      ],
    };

    // Try to validate the problematic rule
    const ruleValidator = ajv.getSchema(
      'schema://living-narrative-engine/rule.schema.json'
    );
    if (!ruleValidator) {
      console.error('Could not get rule schema validator');
      return;
    }

    const isValid = ruleValidator(problematicRule);
    console.log(`Rule validation result: ${isValid}`);

    if (!isValid) {
      console.log('Validation errors:');
      ruleValidator.errors?.forEach((error, index) => {
        console.log(
          `${index + 1}. ${error.instancePath || 'root'}: ${error.message}`
        );
        if (error.data !== undefined) {
          console.log(`   Data: ${JSON.stringify(error.data)}`);
        }
        console.log(`   Schema path: ${error.schemaPath}`);
      });
    }
  } catch (error) {
    console.error('Debug test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the debug test
debugIFOperationValidation().catch(console.error);
