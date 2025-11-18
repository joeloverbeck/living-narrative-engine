# Goal Fixtures

These fixtures back the GoalLoader suites. When `goal.schema.json` gains new required fields or defaulting behavior, update `minimalValidGoal.json` and `createGoalFixture.js`, then re-run the contract tests to refresh their snapshot. Tests must import `createGoalFixture` instead of crafting ad-hoc payloads so schema changes fan out deterministically.
