# GitHub Actions runner retirement

Status: completed 2026-10-16. This supersedes the 2026-10-14 trusted-main pool rollout plan.

All SeerrNG workflows now use GitHub-hosted runners. The unit-test shards run on `ubuntu-latest` with up to four shards in parallel. The organization `trusted-main` group and repository readiness variables are no longer used.

The former preflight and live-deployment jobs required direct access to the `kspls0` filesystem and Docker daemon. Those jobs were removed because GitHub-hosted runners cannot deploy to that host without a configured remote deployment channel. Main image publishing remains automated; live deployment must be performed manually on the deployment host until a remote channel is configured. `scripts/verify-live-deployment.sh` remains available for checking a deployment.
