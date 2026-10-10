#!/usr/bin/env bash
set -euo pipefail
# Hold one lock for the complete build/functional/benchmark command group.
here="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec flock -x /tmp/hallmark-c72-cpu.lock env HALLMARK_C72_CPU_LOCK_HELD=1 node "$here/run.mjs" "$@"
