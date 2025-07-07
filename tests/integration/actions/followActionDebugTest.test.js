/**
 * @file Debug test to understand the exact issue with the circular following bug
 */

import { describe, it, expect } from '@jest/globals';
import jsonLogic from 'json-logic-js';

describe('Follow Action Debug - Direct JsonLogic Testing', () => {
  it('tests the exact condition from the error logs with json-logic directly', () => {
    // Recreate the exact context structure that would be created by createEvaluationContext
    const context = {
      entity: {
        id: 'p_erotica:iker_aguirre_instance',
        components: {
          'core:following': {
            leaderId: 'p_erotica:amaia_castillo_instance'
          }
        }
      },
      actor: {
        id: 'p_erotica:amaia_castillo_instance',
        components: {
          'core:leading': {
            followers: ['p_erotica:iker_aguirre_instance']
          }
        }
      },
      location: {
        id: 'p_erotica:outside_tables_coffee_shop_instance'
      }
    };

    console.log('\n=== Direct JsonLogic Test ===');
    console.log('Context:', JSON.stringify(context, null, 2));

    // Test the exact condition: 
    // { "not": { "in": [{ "var": "entity.id" }, { "var": "actor.components.core:leading.followers" }] } }
    
    // First, let's test each part separately
    const entityId = jsonLogic.apply({ "var": "entity.id" }, context);
    console.log('\nentity.id:', entityId);
    
    const followers = jsonLogic.apply({ "var": "actor.components.core:leading.followers" }, context);
    console.log('actor.components.core:leading.followers:', followers);
    
    // Test the "in" operation directly
    const inResult = jsonLogic.apply({
      "in": [
        { "var": "entity.id" },
        { "var": "actor.components.core:leading.followers" }
      ]
    }, context);
    console.log('\n"in" operation result:', inResult);
    
    // Test the full condition using the "!" operator which is built-in to json-logic-js
    const fullCondition = {
      "!": {
        "in": [
          { "var": "entity.id" },
          { "var": "actor.components.core:leading.followers" }
        ]
      }
    };
    
    const fullResult = jsonLogic.apply(fullCondition, context);
    console.log('\nFull condition result:', fullResult);
    
    // The expected behavior:
    // - entity.id = 'p_erotica:iker_aguirre_instance' 
    // - followers = ['p_erotica:iker_aguirre_instance']
    // - "in" should return true (entity.id IS in followers)
    // - "not" should return false
    expect(inResult).toBe(true);
    expect(fullResult).toBe(false);
  });

  it('tests various path resolutions to debug the issue', () => {
    console.log('\n=== Path Resolution Debug ===');
    
    // Test different path structures
    const testCases = [
      {
        name: 'Direct nested object access',
        context: {
          actor: {
            components: {
              'core:leading': {
                followers: ['test1', 'test2']
              }
            }
          }
        },
        path: 'actor.components.core:leading.followers',
        expected: ['test1', 'test2']
      },
      {
        name: 'Access with special characters in key',
        context: {
          actor: {
            components: {
              'core:leading': {
                followers: ['test1']
              }
            }
          }
        },
        path: 'actor.components["core:leading"].followers',
        expected: null // This might fail due to bracket notation
      },
      {
        name: 'Step by step access',
        context: {
          data: {
            'core:leading': {
              followers: ['test1']
            }
          }
        },
        tests: [
          { path: 'data', desc: 'Get data object' },
          { path: 'data.core:leading', desc: 'Get core:leading (might fail)' },
          { path: 'data["core:leading"]', desc: 'Get core:leading with brackets' }
        ]
      }
    ];

    testCases.forEach(testCase => {
      console.log(`\nTest: ${testCase.name}`);
      console.log('Context:', JSON.stringify(testCase.context, null, 2));
      
      if (testCase.tests) {
        testCase.tests.forEach(test => {
          const result = jsonLogic.apply({ "var": test.path }, testCase.context);
          console.log(`  ${test.desc} (${test.path}):`, result);
        });
      } else {
        const result = jsonLogic.apply({ "var": testCase.path }, testCase.context);
        console.log(`  Result for "${testCase.path}":`, result);
        if (testCase.expected !== undefined) {
          expect(result).toEqual(testCase.expected);
        }
      }
    });
  });

  it('tests if colon in property name causes issues', () => {
    console.log('\n=== Colon in Property Name Test ===');
    
    // Test if the colon in "core:leading" causes any issues
    const context1 = {
      test: {
        'core:leading': {
          value: 'found'
        }
      }
    };
    
    const result1 = jsonLogic.apply({ "var": "test.core:leading.value" }, context1);
    console.log('Access with colon in path:', result1);
    
    // Try different ways to access it
    const context2 = {
      components: {
        'core:leading': {
          followers: ['follower1']
        }
      }
    };
    
    // Method 1: Direct dot notation
    const method1 = jsonLogic.apply({ "var": "components.core:leading.followers" }, context2);
    console.log('Method 1 (dot notation):', method1);
    
    // Method 2: Mixed notation (if supported)
    const method2 = jsonLogic.apply({ "var": 'components["core:leading"].followers' }, context2);
    console.log('Method 2 (mixed notation):', method2);
    
    // Method 3: Check if we can access the parent and then drill down
    const parent = jsonLogic.apply({ "var": "components" }, context2);
    console.log('Parent object:', parent);
    if (parent && parent['core:leading']) {
      console.log('Manual access to core:leading:', parent['core:leading']);
      console.log('Manual access to followers:', parent['core:leading'].followers);
    }
  });
});