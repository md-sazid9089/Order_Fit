# OrderFit documentation

| Guide | Purpose |
|---|---|
| [Project overview](../README.md) | Capabilities, preview, and quick start |
| [Development](development.md) | Setup, configuration, verification, contribution |
| [Test cases](test-cases.md) | Checked-in synthetic cases, expected results, edge conditions, and commands |
| [Workflows](workflows.md) | Saved intake, review, evaluation, approval, recovery |
| [Architecture](architecture/orderfit/03-system-architecture.md) | Current runtime and authority boundaries |
| [Financial semantics](architecture/orderfit/04-decision-engine-and-data-contracts.md) | Exact money, dates, ranking, bounds, reference examples |
| [API contracts](contracts/README.md) | Types, generated artifacts, permissions, compatibility |
| [Security](security/README.md) | Controls, acceptance limits, dated security evidence |
| [Deployment](deployment/README.md) | Environment selection and controlled rollout |
| [AI evaluation](evaluation.md) | Synthetic corpus and replay/live distinctions |
| [Manual acceptance](manual_stress_testing_guide.md) | Synthetic workflow and recovery procedures |

The [architecture index](architecture/orderfit/README.md) links requirements, ADRs,
fixtures, and substantive design-review evidence. Do not move financial fixtures or
regenerate goldens as documentation cleanup.

## Evidence and unfinished work

[Dated reports](evidence/reports/) retain their tested revision, environment, failures,
and unverified gates. Raw experiment bundles remain at their original paths. Reports
are historical evidence, not current setup instructions or production acceptance.

The [original plan](initial_backend_implementation_plan.md) and
[implementation record](backend_implementation_progress.md) remain for requirement
traceability and unique evidence. Active account-access, duplicate-prevention, and
admin handoffs remain until consumer/deployment acceptance is reconciled. The
[AI plan](AI_WORKFLOW_PLAN.md) and [partner proposal](contracts/partner-integration.md)
distinguish future work. No blanket deletion of historical requirements is implied.

Agents follow [AGENTS.md](../AGENTS.md), scoped instructions, and the concise
[development context](../.agents/skills/orderfit-development-context/SKILL.md).
