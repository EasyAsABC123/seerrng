# Local Test Scratch Retention

Tests and development tools can leave temporary configuration, database, and
build workspaces behind when a run is interrupted.

On the configured Linux development host, a separate daily host task removes
top-level `/tmp/seerrng-*` entries after every item beneath them has been
unmodified for at least 48 hours. It retains paths referenced by a live
process's command line, working directory, executable, environment, or open
file descriptor, and skips paths used as a mount source or mount point in a
live mount namespace.

This host policy is a final cleanup path for abandoned scratch. Tooling that
leaves disposable workspaces or worktrees in `/tmp` should use a unique
top-level `seerrng-*` name. Keep evidence that must survive the 48-hour scratch
window in a persistent location.
