# AGENTS.md

## Installation

- We have a sub-project inside this repository. It's in the folder "llm-proxy-server" from the root. You should navigate
  to that folder and run "npm install" to install its dependencies. Then you can run, inside that directory, "npm run
  test" to ensure all tests pass.

## Global dependencies

- You probably need to install jest globally in order to run tests.
- This repository also uses "http-server" when running the app with "npm run start". I tell you this in case running the
  app is necessary.

## Linting

- We currently don't use a linter.

## Testing

- You can run all the tests from the root by running "npm run test". If possible, try to ensure all the tests pass
  before finalizing your task.
- Remember that we have a sub-project inside this repository. It's in the folder "llm-proxy-server" from the root.
  Inside that directory, you can run "npm run test" to run those tests.

## PR Instructions

- Title format: [Fix] Short description
- Include a one-line summary and a "Testing Done" section