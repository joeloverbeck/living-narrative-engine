#!/bin/bash

echo "Running Clothing Removal Blocking System Tests..."
echo "=================================================="

echo ""
echo "Unit Tests:"
echo "-----------"
NODE_ENV=test npm run test:unit -- \
  tests/unit/logic/operators/isRemovalBlockedOperator.test.js \
  tests/unit/scopeDsl/nodes/slotAccessResolverBlocking.test.js \
  tests/unit/mods/clothing/components/blocksRemoval.test.js \
  tests/unit/mods/clothing/conditions/canRemoveItem.test.js

echo ""
echo "Integration Tests:"
echo "------------------"
NODE_ENV=test npm run test:integration -- \
  tests/integration/logic/operators/isRemovalBlockedOperatorDI.integration.test.js \
  tests/integration/clothing/topmostClothingBlocking.integration.test.js \
  tests/integration/clothing/removeClothingActionBlocking.integration.test.js \
  tests/integration/clothing/beltBlockingEntities.integration.test.js \
  tests/integration/clothing/complexBlockingScenarios.integration.test.js \
  tests/integration/clothing/blockingEdgeCases.integration.test.js

echo ""
echo "E2E Tests:"
echo "----------"
NODE_ENV=test npm run test:e2e -- \
  tests/e2e/clothing/completeRemovalWorkflow.e2e.test.js

echo ""
echo "Test Summary:"
echo "-------------"
echo "All blocking system tests completed."
