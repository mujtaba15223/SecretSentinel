import shutil
import subprocess
import tempfile
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database.database import get_db
from backend.database.models import Scan, Finding

from scanner.scanner import scan_directory
from scanner.finding_deduplicator import deduplicate_findings


router = APIRouter(
    prefix="/scan",
    tags=["Scanning"],
)


class ScanRequest(BaseModel):
    directory: str


def is_github_url(value: str) -> bool:
    parsed_url = urlsplit(value)
    return (
        parsed_url.scheme in {"https", "http"}
        and parsed_url.hostname == "github.com"
        and parsed_url.username is None
        and parsed_url.password is None
        and len(parsed_url.path.strip("/").split("/")) >= 2
    )


def clone_github_repo(url: str) -> str | None:
    """
    Clone a GitHub repository into a temporary directory.
    """

    temp_dir = tempfile.mkdtemp(
        prefix="secret_scan_"
    )

    try:
        result = subprocess.run(
            [
                "git",
                "clone",
                "--depth",
                "1",
                url,
                temp_dir,
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            timeout=120,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(
            status_code=502,
            detail=f"Unable to clone GitHub repository: {error}",
        ) from error

    if result.returncode != 0:
        shutil.rmtree(
            temp_dir,
            ignore_errors=True,
        )
        detail = result.stderr.strip() or "Git clone failed."
        raise HTTPException(
            status_code=502,
            detail=f"Unable to clone GitHub repository: {detail}",
        )

    return temp_dir


@router.post("/")
def scan(
    request: ScanRequest,
    db: Session = Depends(get_db),
):
    """
    Scan a local directory or GitHub repository.
    """

    directory = request.directory.strip()
    if not directory:
        raise HTTPException(
            status_code=400,
            detail="Enter a directory path or GitHub repository URL.",
        )

    scan_directory_path = directory
    temporary_directory = None

    if is_github_url(directory):
        temporary_directory = clone_github_repo(directory)
        scan_directory_path = temporary_directory

    try:
        findings = deduplicate_findings(
            scan_directory(scan_directory_path)
        )

        scan_record = Scan(
            directory=directory,
            total_findings=len(findings),
        )
        db.add(scan_record)
        db.flush()

        for finding in findings:
            db.add(
                Finding(
                    scan_id=scan_record.id,
                    file=finding["file"],
                    line=finding["line"],
                    type=finding["type"],
                    severity=finding["severity"],
                    confidence=finding["confidence"],
                    detection=finding["detection"],
                    match=finding["match"],
                )
            )

        db.commit()
        db.refresh(scan_record)

        return {
            "scan_id": scan_record.id,
            "directory": directory,
            "total_findings": len(findings),
            "findings": findings,
        }
    except OSError as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Unable to scan directory on the backend: {error}",
        ) from error
    except Exception:
        db.rollback()
        raise
    finally:
        if temporary_directory:
            shutil.rmtree(
                temporary_directory,
                ignore_errors=True,
            )