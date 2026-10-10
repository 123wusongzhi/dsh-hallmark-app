#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE="$(realpath "$1")"; PATCH="$(realpath "$2")"; OUT="$(realpath -m "$3")"; mkdir -p "$OUT"
for shape in small product posting; do
 if [[ "$shape" = small ]];then grain=product;n=1;legacy=0;noise=0;else grain="$shape";n=267;legacy=1000;noise=100;fi
 for cycle in 1 2 3 4 5;do
  step=0
  for arm in baseline integration integration baseline;do
   step=$((step+1)); root="$BASE";[[ "$arm" = integration ]] && root="$PATCH"
   node --expose-gc "$SCRIPT_DIR/coupled-backend.mjs" "$root" "$grain" "$n" "$legacy" "$noise" timing "$OUT/$shape-c$cycle-s$step-$arm.json" > "$OUT/$shape-c$cycle-s$step-$arm.log" 2>&1
  done
 done
 done
