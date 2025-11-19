# Core Canonical Planning Tasks

This directory contains the canonical GOAP planning tasks that ship with the core mod:

- `consume_nourishing_item.task.json` – Demonstrates how to remove `core:hungry` by planning over the knowledge-limited scope `core:known_nourishing_items` and branching refinement methods (`consume_from_inventory` vs `collect_and_consume`).
- `arm_self.task.json` – Shows how to add the new `core:armed` component after retrieving a known weapon via `core:known_armament_items`.

Each task has matching refinement methods under `../refinement-methods/<task-id>/`. The samples intentionally reference real primitive actions (mostly from the `items` mod) so tests and docs can point to concrete assets instead of mocked payloads.
