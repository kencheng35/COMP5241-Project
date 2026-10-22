# Production testing reports

These reports record browser observations against the deployed Forge application. They are point-in-time evidence, not a claim that all workflows or account roles are covered.

| Date | Session and scope | Report |
| --- | --- | --- |
| 2026-10-22 | Administrator; read-only navigation, catalog filtering, and mobile keyboard checks | [Administrator read-only report](./2026-10-22-admin-read-only.md) |
| 2026-10-22 | Learner; explicitly authorized synthetic records and bounded AI requests | [Learner workflow report](./2026-10-22-learner-workflows.md) |

The learner report records test-owned fixtures, cleanup results, retained records, and AI usage. Do not replay write-capable reproduction steps against production without authorization. Existing learner records must not be used as disposable test fixtures.
