#!/bin/bash
# Convert all SEN55 PDF docs to markdown-friendly text files
# Requires: pdftotext (from poppler-utils)
# Usage: ./convert.sh

set -euo pipefail
cd "$(dirname "$0")"

for pdf in *.pdf; do
    base="${pdf%.pdf}"
    md="${base}.md"
    echo "Converting: $pdf -> $md"

    # Convert with layout preservation for tables
    raw=$(pdftotext -layout "$pdf" -)

    # Write with YAML frontmatter, stripping excessive blank lines
    {
        echo "---"
        echo "source: $pdf"
        echo "generated: $(date -I)"
        echo "---"
        echo ""
        echo "$raw"
    } | sed '/^$/N;/^\n$/d' > "$md"
done

echo "Done. Converted $(ls -1 *.md | grep -cv CLAUDE) files."
