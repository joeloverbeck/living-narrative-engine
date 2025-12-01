# Goal
Implement a reusable visibility helper that determines if an anatomy part should be described based on clothing coverage and part visibility rules.

# File list
- `src/anatomy/` (new helper module or addition near `BodyPartDescriptionBuilder`/`PartDescriptionGenerator`)
- `src/anatomy/bodyDescriptionComposer.js` (wiring point to call the helper during part evaluation, if needed)
- `tests/` (new unit tests covering the helper scenarios from the spec, including secondary coverage cases)

# Out of scope
- Changing description ordering or grouping behavior
- Modifying equipment/activity formatting
- Adding or editing anatomy entity data

# Acceptance criteria
- Tests
  - New unit test suite for the helper covers: empty slot visible, blocking base layer hides, underwear-only visible, mixed layers hides, secondary coverage hides, missing metadata defaults to visible
- Invariants
  - Parts without the visibility component default to visible
  - Helper does not throw when joint or slot metadata is absent; current behavior stays intact otherwise
