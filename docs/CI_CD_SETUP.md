# 🚀 CI/CD Pipeline Setup Guide

## Overview

The project includes 3 GitHub Actions workflows:

1. **ci-cd.yml** - Main CI/CD pipeline (build, test, security, deploy)
2. **code-quality.yml** - Code quality checks (linting, dependencies)
3. **build-images.yml** - Docker image building (daily schedule)

## Prerequisites

### GitHub Secrets

Add these secrets to your GitHub repository:

1. **KUBE_CONFIG** (for Kubernetes deployment)
   ```bash
   # Base64 encode your kubeconfig
   cat ~/.kube/config | base64
   # Copy output to GitHub Secrets
   ```

2. **SONAR_TOKEN** (for SonarQube code quality)
   - Get from: https://sonarcloud.io/account/security

3. **REGISTRY_USERNAME** (for Docker Registry)
   - Your Docker Hub username or GitHub username

4. **REGISTRY_PASSWORD** (for Docker Registry)
   - Docker Hub password or GitHub Personal Access Token

## Setting Up Secrets

### In GitHub UI:
1. Go to Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each secret

### Or via GitHub CLI:
```bash
gh secret set KUBE_CONFIG -b @kubeconfig.yaml
gh secret set SONAR_TOKEN -b "your-token"
gh secret set REGISTRY_USERNAME -b "username"
gh secret set REGISTRY_PASSWORD -b "password"
```

## Workflow Details

### 1. CI/CD Pipeline (`.github/workflows/ci-cd.yml`)

**Triggers:** Push to main/develop, Pull requests

**Jobs:**
- ✅ Build Backend (Python tests, linting)
- ✅ Build Frontend (ESLint, Next.js build)
- ✅ Build Rust (cargo build & tests)
- ✅ Security Scanning (Trivy)
- ✅ Build Docker Images (multi-stage)
- ✅ Deploy to Staging (on develop)
- ✅ Deploy to Production (on main)

**How it works:**
1. Code is pushed to main/develop
2. All tests run in parallel
3. Security scanning checks for vulnerabilities
4. Docker images are built and pushed
5. Automatic deployment to Kubernetes

### 2. Code Quality Workflow (`.github/workflows/code-quality.yml`)

**Triggers:** Pull requests, pushes to main/develop

**Jobs:**
- ✅ SonarQube Analysis
- ✅ Dependency Updates Check
- ✅ Documentation Validation

### 3. Build Images Workflow (`.github/workflows/build-images.yml`)

**Triggers:** Manual (workflow_dispatch), Daily at 2 AM

**Jobs:**
- ✅ Build & Push Django API
- ✅ Build & Push Wallet Service
- ✅ Build & Push Frontend

## Deployment Environments

### Staging (Automatic on `develop`)
```
develop branch → Build → Test → Security Scan → Deploy to Staging
```

### Production (Automatic on `main`)
```
main branch → Build → Test → Security Scan → Deploy to Production
```

## GitHub Actions Configuration

### Enable Required Status Checks

1. Go to Settings → Branches
2. Under Branch protection rules, click "Add rule"
3. Set Branch name: `main`
4. Enable:
   - ✅ Require status checks to pass before merging
   - ✅ Build Backend
   - ✅ Build Frontend
   - ✅ Build Rust
   - ✅ Security Scanning
   - ✅ Code Quality

### Set Up Environments

1. Go to Settings → Environments
2. Create `staging` environment
3. Create `production` environment
4. Add required reviewers for production

## Local Testing

### Run locally with act
```bash
# Install act
brew install act  # Mac
# or choco install act  # Windows
# or download from: https://github.com/nektos/act

# Run workflow locally
act push -j build-backend
```

## Troubleshooting

### Jobs failing

1. Check workflow logs in GitHub Actions tab
2. Look for error messages
3. Common issues:

```yaml
# Issue: Docker build fails
# Solution: Check Dockerfile syntax, ensure all dependencies are listed

# Issue: Tests fail
# Solution: Check if tests pass locally first

# Issue: Deployment fails
# Solution: Verify KUBE_CONFIG secret is set correctly
```

### Deployment issues

```bash
# Check Kubernetes status
kubectl get deployments -n marketpay
kubectl describe pod <pod-name> -n marketpay
kubectl logs <pod-name> -n marketpay

# Rollback deployment
kubectl rollout undo deployment/django-api -n marketpay
```

## Monitoring Deployments

### View GitHub Actions
1. Go to repository Actions tab
2. Click on workflow run
3. Expand job to see details

### View Kubernetes
```bash
# List running pods
kubectl get pods -n marketpay

# Watch deployment progress
kubectl rollout status deployment/django-api -n marketpay

# View pod logs
kubectl logs <pod-name> -n marketpay -f
```

## Best Practices

### Branch Strategy
```
main (production)
  ├─ develop (staging)
  │   ├─ feature/feature-name
  │   ├─ bugfix/bug-name
  │   └─ hotfix/issue-name
```

### Pull Request Process
1. Create feature branch from develop
2. Make changes and commit
3. Push to GitHub
4. Create Pull Request
5. Wait for CI/CD checks to pass
6. Get code review
7. Merge when approved

### Commit Messages
```
feat: add user authentication
fix: resolve database connection issue
docs: update setup instructions
test: add unit tests for wallet service
chore: update dependencies
refactor: simplify API response handling
```

### Tagging Releases
```bash
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

## Performance Optimization

### Docker Build Cache
- Images are cached in GitHub Actions
- Layered Dockerfiles speed up rebuilds
- Cache is shared across workflows

### Parallel Testing
- Tests run in parallel for speed
- Python, Node.js, and Rust test independently
- Reduces overall pipeline time

## Security Practices

### Scanning
- Trivy scans for container vulnerabilities
- Dependency checks for known CVEs
- SonarQube analyzes code quality

### Secrets Management
- Never commit `.env` files
- Use GitHub Secrets for sensitive data
- Rotate secrets regularly

## Scaling the Pipeline

As the project grows:

1. **Add more services** - Duplicate job configs
2. **Add more test stages** - E2E tests, integration tests
3. **Add approval gates** - Require manual approval for production
4. **Add notifications** - Slack, email for failures
5. **Add metrics** - Track deployment frequency, lead time

## Cost Optimization

### GitHub Actions
- Free tier: 2,000 minutes/month
- Monitor usage in Settings → Billing
- Optimize by:
  - Using Ubuntu runners (cheapest)
  - Caching dependencies
  - Running jobs in parallel
  - Canceling redundant runs

## Next Steps

1. ✅ Add secrets to GitHub
2. ✅ Push code to main branch
3. ✅ Monitor first pipeline run
4. ✅ Fix any issues
5. ✅ Enable branch protection
6. ✅ Set up notifications

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [SonarQube Documentation](https://docs.sonarqube.org/)

## Support

- Check GitHub Actions logs for errors
- Review workflow YAML syntax
- Test locally with act
- Check service logs in Kubernetes
