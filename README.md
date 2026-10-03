# SecretSentinel

> A developer security tool that detects exposed API keys, authentication tokens, passwords, database credentials, private keys, and other sensitive information before they reach production or public repositories.

---

## 📌 Overview

**Secret Leak Detector** is a security-focused developer tool designed to identify accidentally exposed secrets in source code and configuration files.

Developers can unintentionally commit:

- API keys
- Cloud credentials
- GitHub tokens
- JWT tokens
- Passwords
- Database connection strings
- Private keys
- Authentication tokens
- High-entropy secret-like strings

A leaked credential can potentially provide unauthorized access to databases, cloud services, APIs, repositories, and other systems.

This project provides two major ways to detect these leaks:

1. **Local repository scanning**
2. **Git pre-commit scanning**

It also provides a **web dashboard** for scanning repositories, viewing findings, analyzing severity and confidence, and tracking scan history.

---

# 🎯 Problem Statement

Developers accidentally leak sensitive API keys, database credentials, and secret tokens into source code repositories every day.

The system must provide a developer-friendly security layer that:

- scans source code for exposed secrets
- detects known secret patterns
- detects unknown secret-like strings using entropy analysis
- identifies severity and confidence
- provides immediate feedback
- prevents high-risk secrets from being committed
- maintains scan history
- provides a web-based security dashboard
- supports scanning public GitHub repositories

---

# 💡 Solution

Secret Leak Detector combines multiple detection techniques.

### 1. Regex Pattern Detection

Known secret formats are detected using regular expressions.

Examples include:

- AWS Access Keys
- GitHub Tokens
- JWT Tokens
- Private Keys
- Generic API Keys
- Generic Secret Keys
- Passwords
- Access Tokens
- Database URLs

### 2. Entropy Analysis

Regex cannot identify every possible secret.

For unknown secret-like strings, the system calculates **Shannon entropy**.

Higher entropy can indicate a randomly generated credential or token.

Example:

```text
Low entropy
aaaaaaaaaaaaaaaaaaaa

High entropy
A8fK29xP7mQ2vL91zX4c
```

Entropy findings are treated as **MEDIUM severity** in the current implementation because high entropy alone does not prove that a string is a secret.

### 3. Risk Engine

Each detection type is assigned:

- Severity
- Confidence

Example:

| Detection | Severity | Confidence |
|---|---:|---:|
| AWS Access Key | CRITICAL | 99% |
| GitHub Token | CRITICAL | 99% |
| Private Key | CRITICAL | 100% |
| Database URL | CRITICAL | 98% |
| JWT Token | HIGH | 95% |
| Generic API Key | HIGH | 90% |
| Password | HIGH | 88% |
| Access Token | HIGH | 90% |
| High Entropy String | MEDIUM | 70% |

---


# 🧰 Technology Stack

## Backend

- Python
- FastAPI
- SQLAlchemy
- SQLite
- Pydantic
- Uvicorn

## Security Scanner

- Python Regular Expressions
- Shannon Entropy Analysis
- Risk Classification
- Finding Deduplication
- Git staged-file scanning

## Frontend

- React
- Vite
- JavaScript
- CSS

## Version Control

- Git
- GitHub
- Git pre-commit hook

## Deployment

- Vercel — Frontend
- Render — Backend



# 🔍 Scanner Components

## `scanner/scanner.py`

Main repository scanning engine.

Responsibilities:

- recursively scan directories
- read files safely
- run regex detection
- run entropy detection
- calculate risk
- deduplicate findings
- print results

Ignored directories currently include:

```text
.git
venv
__pycache__
node_modules
dist
build
data
```

Ignored dependency lock files include:

```text
package-lock.json
yarn.lock
pnpm-lock.yaml
```

This prevents generated files, dependency metadata, databases, and virtual environments from producing unnecessary entropy findings.

---

## `scanner/regex_detector.py`

Contains the predefined secret patterns.

Currently detects:

```text
AWS Access Key
GitHub Token
JWT Token
Private Key
Generic API Key
Generic Secret Key
Password
Access Token
Database URL
```

---

## `scanner/entropy_detector.py`

Calculates Shannon entropy for candidate strings.

The current implementation:

```text
Minimum candidate length: 16
Entropy threshold: 4.0
```

Strings above the threshold are reported as:

```text
High Entropy String
```

These findings receive:

```text
Severity: MEDIUM
Confidence: 70%
```

because entropy is a supporting signal rather than definitive proof of a secret.

---

## `scanner/risk_engine.py`

Maps detection types to risk levels.

Example:

```text
AWS Access Key
        ↓
CRITICAL
        ↓
99% confidence
```

High-risk findings are considered blocking findings by the Git pre-commit scanner.

---

## `scanner/finding_deduplicator.py`

Prevents duplicate findings from overwhelming the user.

The current implementation groups findings by:

```text
file + line
```

and keeps the highest severity finding for that location.

---

## `scanner/git_scanner.py`

Scans files that are currently staged for commit.

It uses Git to retrieve staged files and their staged contents.

This is important because the developer may have:

```text
Working file → safe
Staged version → contains secret
```

The scanner checks the **staged version**, not only the working copy.

---



### Blocking policy

```text
CRITICAL → Block
HIGH     → Block
MEDIUM   → Allow
LOW      → Allow
```

This prevents high-risk credentials from being committed accidentally.

---

# 🔗 Installing the Git Hook

From the project root:

```powershell
python githook/install_hook.py
```

The installer copies the pre-commit hook into:

```text
.git/hooks/pre-commit
```

After installation, every commit is automatically scanned.

---

# 🖥️ Running the Scanner Locally

Activate the virtual environment first.

### Windows PowerShell

```powershell
.\venv\Scripts\Activate.ps1
```

Then run:

```powershell
python -m scanner.scanner .
```

Example clean result:

```text
🔍 Scanning: .

✅ No secrets found.
```

---

# 🚨 Testing Secret Detection

The project can be tested using controlled fake credentials.

## AWS Access Key Test

Create a test value:

```python
API_KEY = "AKIA1234567890ABCDEF"
```

Run:

```powershell
python -m scanner.scanner tests\sample_secrets
```

Expected:

```text
Type: AWS Access Key
Detection: Regex
Severity: CRITICAL
Confidence: 99%
```

> The value above is a deliberately fake test credential and must never be replaced with a real credential.

---

# 🧪 Testing GitHub Token Detection

Example controlled test:

```python
TOKEN = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcd"
```

Run:

```powershell
python -m scanner.scanner tests\sample_secrets
```

Expected:

```text
Type: GitHub Token
Detection: Regex
Severity: CRITICAL
Confidence: 99%
```

After testing, always restore the test file to:

```python
# Safe test fixture. No real credentials.
```

---

# 🧹 Clean Scan Test

After removing the fake secret:

```powershell
python -m scanner.scanner tests\sample_secrets
```

Expected:

```text
✅ No secrets found.
```

---

# 🧪 Test Suite

Pytest is supported for automated tests.

Install:

```powershell
pip install pytest
```

Run:

```powershell
python -m pytest -q
```

The repository currently uses direct scanner verification for the implemented detection components. Additional automated unit tests can be added as the project expands.

---

# 🌐 FastAPI Backend

The backend provides REST API endpoints for scanning, findings, and metrics.

Start the backend:

```powershell
uvicorn backend.main:app --reload
```

Backend:

```text
http://127.0.0.1:8000
```

API documentation:

```text
http://127.0.0.1:8000/docs
```

Health endpoint:

```text
GET /health
```

Expected:

```json
{
  "status": "healthy"
}
```

---

# 🔌 API Endpoints

## Scan Repository

```http
POST /scan/
```

Request:

```json
{
  "directory": "tests/sample_secrets"
}
```

The `directory` value can be:

- local directory path
- public GitHub repository URL

Example:

```json
{
  "directory": "https://github.com/example/example-repository"
}
```

---

## Get Findings

```http
GET /findings/
```

Returns stored security findings.

---

## Get Metrics

```http
GET /metrics/
```

Returns dashboard metrics such as:

```text
Total scans
Total findings
Critical findings
High findings
Medium findings
Clean scans
```

---

## Clear Scan History

```http
DELETE /metrics/clear
```

Clears stored scan and finding history from the application database.

---

# 🗄️ Database

The backend uses:

```text
SQLite
```

Database location:

```text
data/secret_leak_detector.db
```

SQLAlchemy models include:

### Scan

Stores:

- scan ID
- scanned directory/repository
- total findings
- creation time

### Finding

Stores:

- finding ID
- scan ID
- file
- line
- type
- severity
- confidence
- detection method
- matched value

The `data` directory is excluded from repository scanning so the scanner does not scan its own historical database.

---

# ⚛️ React Dashboard

The frontend provides a security dashboard containing:

### Dashboard Metrics

```text
Total Scans
Total Findings
Critical
High
Clean Scans
```

### Repository Scanner

Users can enter:

```text
Local directory
```

or:

```text
Public GitHub repository URL
```

### Security Findings

The dashboard displays:

- File
- Line
- Detection type
- Severity
- Detection method
- Confidence

### Scan History

Historical scan results are stored in the backend database.

### Clear History

The dashboard provides a control to clear scan history.

---

# ▶️ Running the Frontend

Open another terminal.

Go to:

```powershell
cd frontend
```

Install dependencies:

```powershell
npm install
```

Start development server:

```powershell
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:5173
```

---

# 🏗️ Production Frontend Build

To create a production build:

```powershell
npm run build
```

Vite generates:

```text
frontend/dist/
```

The production build should complete with output similar to:

```text
✓ built in ...
```

---


## Frontend

Deployed using:

```text
Vercel
```

Live application:

```text
https://secret-leak-detector.vercel.app/
```

## Backend

Deployed using:

```text
Render
```

The frontend communicates with the deployed FastAPI backend rather than the local development server.

---


# 🔐 Security Design

The project uses multiple layers of detection instead of depending on a single technique.

```text
Layer 1
Known secret patterns
        ↓
Layer 2
Entropy analysis
        ↓
Layer 3
Risk classification
        ↓
Layer 4
Finding deduplication
        ↓
Layer 5
Git pre-commit protection
        ↓
Layer 6
Security dashboard
```

This layered approach helps detect both known credential formats and previously unknown secret-like strings.

---

# 📊 Risk Analysis

The system distinguishes between **severity** and **confidence**.

### Severity

Indicates the potential security impact.

```text
CRITICAL
HIGH
MEDIUM
LOW
```

### Confidence

Indicates how strongly the detector believes the finding matches the detection rule.

Example:

```text
AWS Access Key
Severity: CRITICAL
Confidence: 99%
```

An entropy result may instead be:

```text
High Entropy String
Severity: MEDIUM
Confidence: 70%
```

This distinction helps developers understand that not every detection has the same certainty.

---

# 🧠 Why Regex + Entropy?

Regex is highly effective when a secret follows a recognizable structure.

For example:

```text
AKIA................
```

However, custom application secrets may not follow known formats.

Entropy helps identify strings that look random and potentially credential-like.

Therefore:

```text
Regex
+
Entropy
=
Broader secret detection
```

The two methods complement each other.

---

# 🧪 Demonstrated Detection

The implementation has been manually verified with controlled test values including:

| Test | Result |
|---|---|
| Clean repository | ✅ No secrets |
| AWS Access Key | ✅ CRITICAL |
| GitHub Token | ✅ CRITICAL |
| Entropy-based strings | ✅ MEDIUM |
| Dependency lockfile noise | ✅ Excluded |
| Build output noise | ✅ Excluded |
| Local database noise | ✅ Excluded |

---

# ⚠️ Current Limitations

This project is a security-focused prototype and should not be considered a complete replacement for enterprise secret-management systems.

Current limitations include:

- Entropy detection can still produce false positives for unusual strings.
- Detection patterns are limited to the currently implemented rules.
- Public GitHub repository scanning is supported; private repositories require authentication support.
- SQLite is suitable for the current application but may not be ideal for large multi-user deployments.
- The current Git hook focuses on staged-file scanning.
- Automated unit-test coverage can be expanded.
- Secret remediation/rotation is not automatically performed.

---

# 🚀 Future Improvements

Potential future improvements include:

### Detection

- More cloud-provider secret patterns
- Slack tokens
- Stripe keys
- Google API keys
- Azure credentials
- Docker credentials
- npm tokens
- Additional database credentials

### Intelligent Detection

- Context-aware entropy analysis
- Secret allowlists
- False-positive suppression
- Machine-learning-based classification
- Repository-specific detection rules

### GitHub Integration

- Private repository authentication
- GitHub App integration
- Pull-request scanning
- Branch protection integration
- Continuous repository monitoring

### Security

- Secret redaction in dashboard output
- Credential rotation workflows
- Secret expiration detection
- Security alerts
- Audit logs

### Enterprise

- Multi-user authentication
- Role-based access control
- PostgreSQL support
- Team compliance dashboards
- Organization-wide metrics
- CI/CD integration

---

# 🏆 Hackathon Demonstration Flow

A simple demonstration can be performed in this order:

## 1. Show the dashboard

Open the deployed application.

## 2. Demonstrate a clean scan

Scan:

```text
tests/sample_secrets
```

Show:

```text
No secrets detected
```

## 3. Introduce a controlled fake AWS key

Add:

```python
API_KEY = "AKIA1234567890ABCDEF"
```

Scan again.

Show:

```text
AWS Access Key
CRITICAL
99%
Regex
```

## 4. Demonstrate Git protection

Stage the test file:

```powershell
git add tests/sample_secrets/test_secret.py
```

Commit:

```powershell
git commit -m "test secret detection"
```

The pre-commit hook should detect the secret and block the commit.

## 5. Remove the fake secret

Restore:

```python
# Safe test fixture. No real credentials.
```

Then commit again.

The commit should pass.

## 6. Demonstrate GitHub scanning

Enter a public GitHub repository URL in the dashboard and run a scan.

## 7. Explain the architecture

Explain:

```text
Regex
+
Entropy
+
Risk Engine
+
Git Hook
+
FastAPI
+
React
+
Database
```

---

# 🔒 Important Security Notice

This project should only be tested with **fake credentials or credentials that are intentionally created for security testing**.

Never place real production credentials into the repository for testing.

If a real secret is accidentally exposed:

1. Revoke it immediately.
2. Rotate the credential.
3. Remove it from the source code.
4. Check repository history.
5. Investigate possible unauthorized access.

Removing a secret from the latest commit does not necessarily remove it from Git history.

---

# 📦 Installation

Clone the repository:

```powershell
git clone https://github.com/mujtaba15223/secret-leak-detector.git
```

Enter the project:

```powershell
cd secret-leak-detector
```

Create a virtual environment:

```powershell
python -m venv venv
```

Activate it:

```powershell
.\venv\Scripts\Activate.ps1
```

Install backend dependencies:

```powershell
pip install fastapi uvicorn sqlalchemy pydantic
```

Install testing dependency:

```powershell
pip install pytest
```

Install frontend dependencies:

```powershell
cd frontend
npm install
```

---

# ▶️ Quick Start

## Terminal 1 — Backend

From project root:

```powershell
uvicorn backend.main:app --reload
```

## Terminal 2 — Frontend

```powershell
cd frontend
npm run dev
```

Open:

```text
http://localhost:5173
```

---

# 📚 API Documentation

FastAPI automatically provides interactive API documentation.

Open:

```text
http://127.0.0.1:8000/docs
```





---

# 👨‍💻 Project

**Secret Leak Detector**

Built as a developer security and repository scanning project.

Repository:

```text
https://github.com/mujtaba15223/secret-leak-detector
```

Live Dashboard:

```text
https://secret-leak-detector.vercel.app/
```

---

# 📄 License

This project is released under the MIT License.

---

## ⭐ If you find this project useful

Consider starring the repository and sharing the project with other developers interested in application security.
