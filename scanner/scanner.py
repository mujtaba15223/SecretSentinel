from pathlib import Path

from scanner.regex_detector import detect_secrets
from scanner.entropy_detector import detect_high_entropy
from scanner.risk_engine import calculate_risk
from scanner.finding_deduplicator import deduplicate_findings


IGNORED_DIRECTORIES = {
    ".git",
    "venv",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    "data",
}

IGNORED_FILES = {
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
}


def scan_file(file_path: str) -> list[dict]:
    """Scan one file for regex and entropy based secrets."""

    findings = []
    path = Path(file_path)

    try:
        content = path.read_text(
            encoding="utf-8",
            errors="ignore",
        )
    except Exception as error:
        print(f"Could not read {file_path}: {error}")
        return findings

    for line_number, line in enumerate(
        content.splitlines(),
        start=1,
    ):

        # Regex detection
        for match in detect_secrets(line):

            finding = {
                "file": str(path),
                "line": line_number,
                "type": match["type"],
                "match": match["match"],
                "detection": "Regex",
            }

            findings.append(
                calculate_risk(finding)
            )

        # Entropy detection
        for match in detect_high_entropy(line):

            finding = {
                "file": str(path),
                "line": line_number,
                "type": match["type"],
                "match": match["match"],
                "entropy": match["entropy"],
                "detection": "Entropy",
            }

            findings.append(
                calculate_risk(finding)
            )

    return findings


def should_ignore(file_path: Path) -> bool:
    """Return True if the file should not be scanned."""

    if file_path.name in IGNORED_FILES:
        return True

    return any(
        directory in file_path.parts
        for directory in IGNORED_DIRECTORIES
    )


def scan_directory(directory: str) -> list[dict]:
    """Recursively scan a directory."""

    root = Path(directory)

    if not root.exists():
        raise FileNotFoundError(
            f"Directory not found: {directory}"
        )

    if not root.is_dir():
        raise NotADirectoryError(
            f"Not a directory: {directory}"
        )

    all_findings = []

    for file_path in root.rglob("*"):

        if not file_path.is_file():
            continue

        if should_ignore(file_path):
            continue

        all_findings.extend(
            scan_file(str(file_path))
        )

    return all_findings


def print_findings(findings: list[dict]) -> None:
    """Print scan results."""

    if not findings:
        print("\n✅ No secrets found.")
        return

    print(
        f"\n🚨 Found {len(findings)} "
        f"potential secret(s):\n"
    )

    for finding in findings:

        print(
            f"⚠️  {finding['file']} "
            f"(line {finding['line']})"
        )

        print(
            f"   Type: {finding['type']}"
        )

        print(
            f"   Detection: {finding['detection']}"
        )

        print(
            f"   Severity: {finding['severity']}"
        )

        print(
            f"   Confidence: "
            f"{finding['confidence'] * 100:.0f}%"
        )

        print(
            f"   Match: {finding['match']}"
        )

        if "entropy" in finding:
            print(
                f"   Entropy: {finding['entropy']}"
            )

        print()


if __name__ == "__main__":

    import sys

    directory = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "."
    )

    print(f"\n🔍 Scanning: {directory}")

    try:
        results = scan_directory(directory)
    except OSError as error:
        print(f"\n❌ Could not scan directory: {error}")
        sys.exit(1)

    results = deduplicate_findings(results)

    print_findings(results)