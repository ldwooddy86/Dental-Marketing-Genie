#!/usr/bin/env bash
# Reckoning — user-run timing sweep (Autopsy lane). Runs on the client's or the operator's own machine,
# never from the audit workspace. Works in macOS Terminal, Linux, Git Bash or WSL on Windows (curl required).
#
# Presence: every request goes out as a current desktop Chrome — full browser header set, client hints,
# compressed transfer, a cookie jar that persists across the sweep, the previous URL as Referer, and a
# jittered pause between URLs (a fixed one-second cadence is a bot's signature). curl's own TLS hello is the
# residual tell; the sweep runs from the site owner's side with their blessing, so that is acceptable here.
#
# Usage:  ./timing_sweep.sh urls.txt https://example.com [label] [fast]
#   urls.txt  = 60–150 URLs sampled from the sitemap: homepage, top pages, deep blog posts,
#               date archives, pagination, and at least one URL that redirects.
#   label     = optional tag for the output filenames (e.g. cold, warm, evening).
#   fast      = optional 4th argument: shorter pauses (0.5–2 s) when the owner wants the sweep done quickly.
# Run it twice ~10 minutes apart (the second run reads the cache-warm state) and once at a
# different time of day, then send back timing_<label>.csv and headers_<label>.txt.
set -u
URLS="${1:?usage: timing_sweep.sh urls.txt https://example.com [label] [fast]}"
BASE="${2:?usage: timing_sweep.sh urls.txt https://example.com [label] [fast]}"
LABEL="${3:-run$(date +%H%M)}"
MODE="${4:-human}"
MAJOR="${CHROME_MAJOR:-$(( 131 + ( $(date +%s) - 1731369600 ) / 2721600 ))}"   # Chrome 131 shipped 2024-11-12; ~31.5 days per major
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${MAJOR}.0.0.0 Safari/537.36"
# Chrome's GREASE brand for this major (same algorithm Chrome uses: characters and order keyed on the version)
CHARS=(" " "(" ":" "-" "." "/" ")" ";" "=" "?" "_"); GVERS=("8" "99" "24")
GREASE="Not${CHARS[$((MAJOR % 11))]}A${CHARS[$(((MAJOR + 1) % 11))]}Brand"; GV="${GVERS[$((MAJOR % 3))]}"
B0="\"$GREASE\";v=\"$GV\""; B1="\"Chromium\";v=\"$MAJOR\""; B2="\"Google Chrome\";v=\"$MAJOR\""
case $((MAJOR % 6)) in 0) CHUA="$B0, $B1, $B2";; 1) CHUA="$B0, $B2, $B1";; 2) CHUA="$B1, $B0, $B2";; 3) CHUA="$B2, $B0, $B1";; 4) CHUA="$B1, $B2, $B0";; *) CHUA="$B2, $B1, $B0";; esac
JAR="$(mktemp -t sweepjar.XXXXXX)"; HF="$(mktemp -t sweephdr.XXXXXX)"
OUT_T="timing_${LABEL}.csv"; OUT_H="headers_${LABEL}.txt"
REF="https://www.google.com/"; SITE="cross-site"

hdrs() {  # writes Chrome's navigation header set to $HF (curl -H @file); $1 = referer (may be empty), $2 = sec-fetch-site
  {
    printf 'sec-ch-ua: %s\nsec-ch-ua-mobile: ?0\nsec-ch-ua-platform: "Windows"\nUpgrade-Insecure-Requests: 1\n' "$CHUA"
    printf 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7\n'
    printf 'Sec-Fetch-Site: %s\nSec-Fetch-Mode: navigate\nSec-Fetch-User: ?1\nSec-Fetch-Dest: document\n' "$2"
    [ -n "$1" ] && printf 'Referer: %s\n' "$1"
    printf 'Accept-Language: en-US,en;q=0.9\nPriority: u=0, i\n'
  } > "$HF"
}
pause() {
  if [ "$MODE" = "fast" ]; then awk -v s="$RANDOM" 'BEGIN{srand(s); printf "%.2f", 0.5 + rand()*1.5}'
  else awk -v s="$RANDOM" 'BEGIN{srand(s); x = exp(log(6) + 0.55 * (rand()+rand()+rand()+rand()+rand()+rand()-3)); if (x < 2) x = 2; if (x > 28) x = 28; printf "%.2f", x}'; fi
}

echo "url,http_code,num_redirects,ttfb_seconds,total_seconds,bytes" > "$OUT_T"
while read -r u; do
  [ -z "$u" ] && continue
  hdrs "$REF" "$SITE"
  curl -s -o /dev/null -L --compressed -A "$UA" -b "$JAR" -c "$JAR" -H @"$HF" \
    -w "$u,%{http_code},%{num_redirects},%{time_starttransfer},%{time_total},%{size_download}\n" "$u" >> "$OUT_T"
  REF="$u"; SITE="same-origin"
  sleep "$(pause)"
done < "$URLS"

# Response headers for three templates: homepage + the first two non-homepage URLs in the list.
{
  for u in "$BASE/" $(grep -v "^$BASE/\?$" "$URLS" | head -n 2); do
    hdrs "$REF" "same-origin"
    echo "== $u"; curl -s -D - -o /dev/null --compressed -A "$UA" -b "$JAR" -c "$JAR" -H @"$HF" "$u"; echo; sleep "$(pause)"
  done
} > "$OUT_H"
rm -f "$JAR" "$HF"

echo "wrote $OUT_T ($(($(wc -l < "$OUT_T") - 1)) URLs) and $OUT_H  (presented as Chrome $MAJOR on Windows)"
