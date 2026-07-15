---
name: seerrng-close-loop-delivery
description: "Close the loop on SeerrNG delivery after a fix or feature: verify locally, push a branch, merge to develop, wait for the Homelab Image workflow, deploy the immutable digest, and repeat implementation/deployment if live behavior verification fails. Use when the user asks to ship, deploy, roll out, or make sure a SeerrNG change is actually fixed in production."
---

# Close-Loop SeerrNG Delivery

Use this skill after a SeerrNG source change is ready to ship or when the user asks to deploy and verify a fix end to end.

## Required Loop

1. Inspect state:
   - `git status --short`
   - current branch, remotes, and recent commits
   - current Kubernetes context, namespace, deployment, container, strategy, and image
2. Verify before publishing:
   - run focused tests for changed files
   - run `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` unless scope is explicitly smaller and risk is low
   - do not publish a known-failing source state
3. Publish through reviewable Git flow:
   - create or use a named feature/fix branch
   - commit only intended files
   - push the branch
   - merge non-destructively into `develop`
   - verify remote `develop` head equals the intended merge/head SHA
4. Build image:
   - wait for the `Homelab Image` workflow for the exact `develop` SHA
   - require successful validation and publish jobs
   - extract the `Report immutable image` value; deploy only `ghcr.io/...@sha256:...`
5. Deploy:
   - set only the intended container image
   - annotate `kubernetes.io/change-cause`
   - wait for rollout status
6. Prove live behavior:
   - verify deployment image, ready replicas, pod restarts, and startup commit tag
   - run an authenticated internal request or other exact live probe that exercises the changed behavior
   - record status, content type, bytes or key JSON fields, and whether it proves the user-visible fix

## Failure Rule

If live verification fails, do not call the deployment done.

Instead:

1. Preserve the evidence.
2. Diagnose the failure without exposing secrets.
3. Implement the smallest fix needed.
4. Run focused and broad gates again.
5. Commit, push, merge/update `develop`, build a new image, deploy the new digest, and rerun live verification.

Repeat until the exact changed behavior passes live verification or report a concrete blocker.

## Reporting

Final reports must include:

- branch name
- delivered commit or merge SHA
- workflow URL and status
- deployed immutable digest
- rollout state
- live verification evidence
- remaining untracked files or unrelated dirty state
- confidence level
