# Git Workflow & Environment Guidelines

Welcome to the team! To maintain high code quality, prevent merge conflicts, and keep our deployments stable across Railway, all developers must strictly follow this workflow.

---

## 🌐 Environments & Live URLs

Every environment runs as an isolated ecosystem on Railway with its **own dedicated PostgreSQL database, Redis cache, and storage bucket configuration**. Data created in `dev` or `qa` will **never** affect production.

| Environment | Branch | Service | Live URL | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Development** | `dev` | **Storefront**<br>**Seller Portal**<br>**Backend API** | [Storefront Dev](https://storefront-dev-d709.up.railway.app/gb)<br>[Seller Dev](https://sellers-dev.up.railway.app/login)<br>[Backend Dev](https://backend-dev-a27c.up.railway.app/) | Active development, feature integration & developer testing. |
| **QA / Staging** | `qa` | **Storefront**<br>**Seller Portal**<br>**Backend API** | [Storefront QA](https://storefront-qa-0a27.up.railway.app/gb)<br>[Seller QA](https://sellers-qa.up.railway.app/login)<br>[Backend QA](https://backend-qa-bbe9.up.railway.app/) | Internal QA testing, regression checks, bug verification & client review. |
| **Production** | `main` | **Storefront**<br>**Seller Portal**<br>**Backend API** | [Storefront Prod](https://storefront-production-9b45.up.railway.app/gb)<br>[Seller Prod](https://sellers-production-da07.up.railway.app/login)<br>[Backend Prod](https://backend-production-76c9.up.railway.app/) | Live production store serving real customers and sellers. |

> [!CAUTION]
> **Database & Storage Isolation**:
> Do not be confused if your test products, users, or orders do not appear across environments. `dev`, `qa`, and `production` have completely separate databases, Redis instances, and bucket configs.

---

## 🔄 Release & Promotion Lifecycle

All changes strictly follow this 3-stage promotion pipeline. **No exceptions.**

```
[Developer Feature Branch]
         │
         ▼ (PR + Review Approval)
┌─────────────────────────────────┐
│     1. DEV Environment          │  ──> Test your changes thoroughly on Dev URLs
└─────────────────────────────────┘
         │
         ▼ (PR from dev to qa)
┌─────────────────────────────────┐
│     2. QA Environment           │  ──> QA team runs regression and acceptance tests
└─────────────────────────────────┘
         │
         ▼ (PR from qa to main)
┌─────────────────────────────────┐
│  3. PRODUCTION Environment      │  ──> Live for real users and merchants
└─────────────────────────────────┘
```

1. **Step A (Dev Testing):** Once your PR is approved and merged into `dev`, test your feature thoroughly on the [Dev Storefront](https://storefront-dev-d709.up.railway.app/gb) and [Dev Seller Portal](https://sellers-dev.up.railway.app/login).
2. **Step B (Promote to QA):** When everything works as expected on Dev, a PR is raised from `dev` into `qa`. QA verifies everything on the QA URLs.
3. **Step C (Promote to Prod):** After QA gives final sign-off, a PR is raised from `qa` into `main` (Production).

---

## 🚀 Step-by-Step Developer Guide

### Step 1: Always Get a Fresh Pull First
Before starting any new task, make sure your local `dev` branch has the latest changes to avoid conflicts.

```bash
# Switch to dev branch
git checkout dev

# Pull latest commits
git pull origin dev
```

---

### Step 2: Create a Feature Branch Off `dev`
Never commit directly to `dev` or `main`. Always create a new branch from `dev`.

Branch naming conventions:
- `feature/<name>` (e.g. `feature/seller-kyc-upload`, `feature/cart-discount`)
- `fix/<name>` (e.g. `fix/price-display-rounding`, `fix/navbar-mobile-toggle`)
- `chore/<name>` (e.g. `chore/dependency-upgrade`)

```bash
git checkout -b feature/your-feature-name
```

---

### Step 3: Work, Test Locally & Commit
Make your changes, test them locally, and write clean, descriptive commit messages.

```bash
git add .
git commit -m "feat(sellers): add document upload to kyc step"
```

---

### Step 4: Sync with Latest `dev` Before Pushing (Conflict Check)
Ensure you resolve any potential merge conflicts locally before creating a pull request.

```bash
# Fetch latest dev
git checkout dev
git pull origin dev

# Merge dev into your feature branch
git checkout feature/your-feature-name
git merge dev
```
*(If any conflicts arise, resolve them locally, test, and commit the resolution).*

---

### Step 5: Push Branch to GitHub

```bash
git push -u origin feature/your-feature-name
```

---

### Step 6: Open a Pull Request (PR) & Assign Reviewer

1. Go to GitHub and click **"Compare & pull request"**.
2. **Set Target Branch:**
   - **Base:** `dev` *(CRITICAL: Always target `dev`, NEVER `main`)*
   - **Compare:** `feature/your-feature-name`
3. **PR Description:**
   - Summarize what changed.
   - List steps for the reviewer to test.
4. **Assign Reviewer:**
   - Add the **Project Lead** as a Reviewer in the right sidebar.
5. Click **"Create pull request"**.

---

### Step 7: Review & Merge
1. The merge button is locked by GitHub protection rules.
2. The Project Lead will review your code and approve it.
3. Once approved, the PR is merged into `dev`, triggering the automatic Railway deployment for the Dev environment.

---

## 🛡️ Golden Rules

| Rule | Details |
| :--- | :--- |
| 🚫 **No Direct Pushes** | Direct push to `main` (Production), `qa`, or `dev` is strictly prohibited and blocked by GitHub rules. |
| 🚫 **No Direct PRs to Main** | Never raise a feature PR directly against `main`. All feature work must land in `dev` first. |
| 🚫 **No Self-Merging** | PRs cannot be merged without at least one formal approval from the Project Lead. |
| ✅ **Always Pull Before Branching** | Always run `git pull origin dev` before creating a new branch to keep merge conflicts at zero. |
| ✅ **Verify on Dev First** | Always test your changes on the [Dev URL](https://storefront-dev-d709.up.railway.app/gb) immediately after merge. |

---

## ⚡ Quick Cheatsheet

```bash
# 1. Start a new task
git checkout dev
git pull origin dev
git checkout -b feature/my-feature

# 2. Do your work & commit
git add .
git commit -m "feat: description of work"

# 3. Pull latest dev & merge to verify no conflicts
git checkout dev
git pull origin dev
git checkout feature/my-feature
git merge dev

# 4. Push to remote
git push -u origin feature/my-feature

# 5. Open PR on GitHub:
#    Base: dev  <--  Compare: feature/my-feature
#    Assign Project Lead as Reviewer!
```
