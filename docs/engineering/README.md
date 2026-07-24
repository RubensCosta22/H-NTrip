# H&NTrip — Engineering Governance

H&NTrip follows the **RHC Tech Spec-Driven Development Standard v1.3**.

Corporate source of truth:

`https://github.com/RubensCosta22/RHC-Tech-Engineering`

The authoritative normative Standard, operational playbook, reusable templates and risk-tier checklist are maintained centrally. Product-local documentation may specialize product context, but it must not weaken or contradict the central Standard.

> **Specified. Reviewed. Implemented. Verified. Reliable.**

## Mandatory operating rules

- **No Risk Tier → No Ready.**
- **No Applicable Controls → No Ready.**
- **No Ready → No Code.**
- **No required independent review → No Approved.**
- **No evidence → No Done.**
- **No passed mandatory gates → No Release.**

## H&NTrip adoption rule

H&NTrip is an existing product, so adoption is **touch-driven and risk-driven**.

Untouched legacy code is not rewritten merely to satisfy the Standard. When a surface is materially changed, the changed behavior must follow the current SDD controls and newly discovered material risks must be recorded.

There is no grandfathering when touching or discovering meaningful defects in:

- authentication;
- authorization / RLS;
- cross-account data exposure;
- personal or sensitive data;
- secrets or credentials;
- destructive or high-risk migrations;
- irreversible data-loss paths;
- security-sensitive uploads, documents or photos.

## Risk tiers

Use the central `checklists/risk-tiers.md` as the operational index.

- **R0:** trivial, no runtime behavior change; lightweight change record.
- **R1:** isolated low-risk behavior; R1 Lite Spec and applicable controls.
- **R2:** meaningful product/API/database/workflow/UX behavior; normal Feature Spec.
- **R3:** authentication, authorization/RLS, sensitive data, critical migration/infrastructure or security boundary.
- **R4:** broad exposure, irreversible data loss, major compromise or systemic outage potential.

Risk measures potential impact, not implementation effort. `Conditional` controls are mandatory whenever the affected surface applies.

## Product-specific emphasis

Because H&NTrip manages travel plans, expenses, documents, photos and user data, Specs must explicitly assess when applicable:

- ownership and RLS isolation;
- private storage and signed-access behavior;
- upload MIME/size/path controls;
- document/photo exposure;
- financial-data correctness;
- deletion/export/retention behavior;
- logging redaction;
- offline/degraded behavior during travel;
- migration rollback/remediation;
- mobile and desktop journeys.

## Starting new work

Before the next material product change:

1. classify Risk Tier;
2. derive Applicable Controls from the central matrix;
3. create the engineering record required by the tier;
4. assess Legacy Touch and L0/L1 baseline triggers;
5. complete required reviews before implementation;
6. implement only after Ready;
7. collect evidence and pass mandatory gates before release.

The central Standard always wins if local guidance conflicts with it.
