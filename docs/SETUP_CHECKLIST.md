# ✅ MarketPay Superapp - Complete Setup Checklist

## Phase 1: Local Development ✅

### Setup
- [ ] Clone repository
- [ ] Copy `.env.example` to `.env`
- [ ] Update `.env` with secure passwords:
  ```
  POSTGRES_PASSWORD=your_secure_password
  SECRET_KEY=your_django_secret_key
  DEBUG=False
  ```
- [ ] Install Docker Desktop / Docker Engine
- [ ] Verify: `docker --version` and `docker-compose --version`

### Build & Test Locally
- [ ] Run: `docker-compose build` (builds all 3 images)
- [ ] Run: `docker-compose up -d` (starts all services)
- [ ] Verify: `docker-compose ps` (all services running)
- [ ] Check Django migrations: `docker-compose exec django-api python manage.py migrate`
- [ ] Test endpoints:
  - `curl http://localhost:8000` (Django API)
  - `curl http://localhost:3001` (Rust service)
  - `curl http://localhost:3000` (Next.js frontend)
  - `curl http://localhost:5432` (PostgreSQL available)
- [ ] Run test script: `./test-containers.sh` (Mac/Linux) or `test-containers.bat` (Windows)
- [ ] Review logs: `docker-compose logs -f`
- [ ] Stop services: `docker-compose down -v`

### Reference Documentation
- See [DOCKER_SETUP_GUIDE.md](DOCKER_SETUP_GUIDE.md) for:
  - Docker concepts explained
  - Multi-stage build optimization
  - Volume and networking setup
  - Security best practices
  - Troubleshooting guide

---

## Phase 2: Testing & Quality ✅

### Automated Testing
- [ ] Backend tests: `docker-compose exec django-api python manage.py test`
- [ ] Rust tests: `docker-compose exec wallet-service cargo test`
- [ ] Frontend tests: `docker-compose exec nextjs-frontend npm test`
- [ ] Integration tests: All services communicate properly
- [ ] Health checks: All endpoints respond to health probes

### Reference Documentation
- See [TESTING_GUIDE.md](TESTING_GUIDE.md) for:
  - Manual testing procedures
  - Service-specific test steps
  - Health check validation
  - Performance monitoring
  - Log viewing and debugging

---

## Phase 3: CI/CD Pipeline Setup ✅

### GitHub Repository
- [ ] Push code to GitHub repository
- [ ] Create branches: `main` (production) and `develop` (staging)
- [ ] Enable GitHub Actions in repository settings

### Configure GitHub Actions Secrets
Navigate to: **Settings** → **Secrets and variables** → **Actions**

Add these secrets:
```
Name: REGISTRY_USERNAME
Value: your_docker_registry_username (ghcr.io use GitHub username)

Name: REGISTRY_PASSWORD  
Value: your_docker_registry_token (PAT with packages:write scope)

Name: KUBE_CONFIG
Value: base64 encoded kubeconfig file contents
  (Get with: cat ~/.kube/config | base64)

Name: SONAR_TOKEN
Value: your_sonarcloud_token (from https://sonarcloud.io)
```

### GitHub Configuration
- [ ] Add branch protection rules (Settings → Branches)
  - Require 1 approval before merge
  - Require status checks to pass (ci-cd.yml, code-quality.yml)
  - Require code quality review
- [ ] Enable auto-deployment on main branch merge
- [ ] Configure CODEOWNERS file (optional)

### Reference Documentation
- See [CI_CD_SETUP.md](CI_CD_SETUP.md) for:
  - Complete GitHub Actions workflows explanation
  - Branch strategy and deployment flow
  - Commit message conventions
  - Release tagging procedure
  - Rollback instructions

---

## Phase 4: Kubernetes Deployment ✅

### Prerequisites
- [ ] Kubernetes cluster available (EKS/AKS/GKE/Kind)
- [ ] kubectl installed: `kubectl version --client`
- [ ] Kubeconfig configured: `kubectl cluster-info`

### Deploy to Staging
```bash
# 1. Get kubeconfig and encode it
cat ~/.kube/config | base64 -w 0

# 2. Add to GitHub as KUBE_CONFIG secret (Phase 3)

# 3. Push code to develop branch
git checkout develop
git push origin develop

# 4. Monitor GitHub Actions
# GitHub automatically deploys to staging Kubernetes cluster

# 5. Verify deployment
kubectl get deployments -n marketpay
kubectl get pods -n marketpay
kubectl get svc -n marketpay
```

### Deploy to Production
```bash
# 1. Create pull request from develop → main
git checkout main
git pull origin main
git merge develop
git push origin main

# 2. Get approval from team

# 3. Merge to main branch
# GitHub Actions automatically deploys to production

# 4. Verify deployment
kubectl get pods -n marketpay
kubectl get svc -n marketpay
```

### Manual Kubernetes Management (Optional)
```bash
# Deploy directly (without CI/CD)
kubectl apply -f infrastructure/kubernetes/deployment.yaml

# Scale services
kubectl scale deployment django-api --replicas=3 -n marketpay

# View logs
kubectl logs -f deployment/django-api -n marketpay

# Update image
kubectl set image deployment/django-api django-api=ghcr.io/marketpay/django-api:latest

# Rollback if needed
kubectl rollout undo deployment/django-api -n marketpay
```

### Reference Documentation
- See [INFRASTRUCTURE_DEPLOYMENT.md](INFRASTRUCTURE_DEPLOYMENT.md) for:
  - AWS/Azure/GCP deployment steps
  - Kubernetes manual operations
  - Networking and load balancing setup
  - Monitoring stack installation (Prometheus/Grafana)
  - Logging setup (ELK stack)
  - Database backup/restore procedures
  - Disaster recovery planning
  - Cost optimization tips

---

## Phase 5: Infrastructure as Code (Terraform) ✅

### AWS Deployment (Optional)
```bash
# 1. Setup AWS CLI
aws configure

# 2. Initialize Terraform
cd infrastructure/terraform
terraform init

# 3. Review infrastructure
terraform plan

# 4. Apply changes
terraform apply

# 5. Get outputs (VPC ID, subnet IDs, etc.)
terraform output
```

### Azure Deployment (Optional)
```bash
# 1. Login to Azure
az login

# 2. Create resource group
az group create --name marketpay-rg --location eastus

# 3. Create AKS cluster
az aks create \
  --resource-group marketpay-rg \
  --name marketpay-aks \
  --node-count 3

# 4. Get kubeconfig
az aks get-credentials \
  --resource-group marketpay-rg \
  --name marketpay-aks
```

### GCP Deployment (Optional)
```bash
# 1. Login to GCP
gcloud auth login

# 2. Set project
gcloud config set project PROJECT_ID

# 3. Create GKE cluster
gcloud container clusters create marketpay-gke \
  --zone us-central1-a \
  --num-nodes 3

# 4. Get credentials
gcloud container clusters get-credentials marketpay-gke \
  --zone us-central1-a
```

---

## Phase 6: Monitoring & Observability 🔍

### Application Monitoring
- [ ] Setup Prometheus: `helm install prometheus prometheus-community/kube-prometheus-stack`
- [ ] Setup Grafana: Access on `http://localhost:3000`
- [ ] Configure dashboards for:
  - Pod CPU/Memory usage
  - Request latency
  - Error rates
  - Database connections

### Logging Stack
- [ ] Setup ELK (Elasticsearch, Logstash, Kibana)
- [ ] Configure log aggregation
- [ ] Set up alerts for:
  - Error rates > 1%
  - Response time > 1s
  - Pod restarts
  - Disk space warnings

### Health Checks
- [ ] Verify liveness probes (auto-restart on failure)
- [ ] Verify readiness probes (exclude from load balancer)
- [ ] Test health endpoints manually

---

## Phase 7: Security Hardening 🔒

### Network Security
- [ ] Network policies enabled
- [ ] TLS/HTTPS configured
- [ ] SSL certificates installed (cert-manager)
- [ ] Firewall rules reviewed

### Container Security
- [ ] Run as non-root user (UID 1000)
- [ ] Read-only root filesystem enabled
- [ ] Resource limits set (CPU/Memory)
- [ ] Pod security policies enforced

### Secret Management
- [ ] Never commit secrets to git
- [ ] Use Kubernetes Secrets for sensitive data
- [ ] Rotate secrets periodically
- [ ] Use external secret managers (AWS Secrets Manager, etc.)

### Scanning
- [ ] Container images scanned for vulnerabilities (Trivy)
- [ ] Dependencies scanned for CVEs (npm audit, safety, cargo audit)
- [ ] SAST code scanning enabled (SonarQube)
- [ ] DAST testing performed (OWASP ZAP)

---

## Phase 8: Performance Tuning 📊

### Database Optimization
- [ ] Query performance analyzed
- [ ] Indexes created on frequently accessed columns
- [ ] Connection pooling configured
- [ ] Backup strategy verified

### Cache Optimization
- [ ] Redis cache strategy implemented
- [ ] Cache hit rates monitored
- [ ] TTL values optimized

### Container Optimization
- [ ] Resource limits reviewed based on metrics
- [ ] Replicas scaled appropriately
- [ ] Startup time optimized
- [ ] Image size minimized

---

## Phase 9: Disaster Recovery 🆘

### Backup Strategy
- [ ] Daily database backups configured
- [ ] Backup retention policy set (30 days minimum)
- [ ] Restore procedure tested
- [ ] Off-site backup storage verified

### High Availability
- [ ] Multi-region setup planned
- [ ] Database replication configured
- [ ] Load balancer health checks enabled
- [ ] Auto-scaling policies tuned

### Incident Response
- [ ] Runbook created for common issues
- [ ] Rollback procedure tested
- [ ] Communication plan established
- [ ] Post-incident review process defined

---

## Phase 10: Documentation & Handoff 📚

### Documentation Checklist
- [ ] README.md updated with setup instructions
- [ ] API documentation complete (docs/API.md)
- [ ] Architecture diagram created (docs/Architecture.md)
- [ ] Database schema documented (docs/Database.md)
- [ ] Deployment procedures documented (INFRASTRUCTURE_DEPLOYMENT.md)
- [ ] Troubleshooting guide created
- [ ] Team wiki/confluence pages created
- [ ] Video walkthrough recorded (optional)

### Team Handoff
- [ ] Team trained on deployment process
- [ ] On-call rotation established
- [ ] Escalation procedures defined
- [ ] Access controls configured
- [ ] Production access granted to authorized personnel

---

## Quick Reference Commands

### Local Development
```bash
docker-compose up -d              # Start services
docker-compose logs -f            # View logs
docker-compose exec django-api python manage.py migrate  # Run migrations
docker-compose down -v            # Stop and clean
```

### Testing
```bash
./test-containers.sh              # Run full test suite (Mac/Linux)
test-containers.bat               # Run full test suite (Windows)
docker-compose exec django-api python manage.py test    # Python tests
docker-compose exec wallet-service cargo test           # Rust tests
```

### Kubernetes
```bash
kubectl apply -f infrastructure/kubernetes/deployment.yaml   # Deploy
kubectl get pods -n marketpay                                # Check pods
kubectl logs -f deployment/django-api -n marketpay           # View logs
kubectl scale deployment django-api --replicas=3 -n marketpay  # Scale
```

### CI/CD
```bash
git checkout develop              # Create feature branch
git commit -m "feat: add feature" # Follow commit conventions
git push origin develop           # Push to trigger CI/CD
# Monitor: GitHub Actions tab
```

### Infrastructure
```bash
cd infrastructure/terraform
terraform init                    # Initialize
terraform plan                    # Review changes
terraform apply                   # Apply changes
terraform destroy                 # Cleanup (careful!)
```

---

## Status Summary

| Phase | Status | Files |
|-------|--------|-------|
| Docker Setup | ✅ Complete | Dockerfiles, docker-compose.yml |
| Local Testing | ✅ Complete | test-containers.sh/bat |
| CI/CD Pipeline | ✅ Complete | .github/workflows/ |
| Kubernetes | ✅ Complete | infrastructure/kubernetes/deployment.yaml |
| Terraform IaC | ✅ Complete | infrastructure/terraform/main.tf |
| Documentation | ✅ Complete | 5 comprehensive guides |
| Monitoring | 📋 Ready | Setup instructions in guide |
| Security | 🔒 Built-in | Network policies, non-root, secrets |
| Performance | ⚙️ Tunable | HPA, resource limits configured |
| DR/HA | 📋 Ready | Backup/restore procedures documented |

---

## Next Immediate Steps

1. **This Week:**
   - [ ] Complete Phase 1 (Local Development)
   - [ ] Complete Phase 2 (Testing)
   - [ ] Complete Phase 3 (GitHub Actions Secrets)

2. **Next Week:**
   - [ ] Complete Phase 4 (Kubernetes Deployment)
   - [ ] Complete Phase 6 (Monitoring)

3. **Following Week:**
   - [ ] Complete Phase 5 (Terraform)
   - [ ] Complete Phase 7 (Security Hardening)
   - [ ] Complete Phase 8 (Performance Tuning)

4. **Before Production:**
   - [ ] Complete Phase 9 (Disaster Recovery)
   - [ ] Complete Phase 10 (Documentation & Handoff)
   - [ ] Security audit complete
   - [ ] Load testing successful
   - [ ] Team training complete

---

## Support & Resources

**Documentation:**
- [DOCKER_SETUP_GUIDE.md](DOCKER_SETUP_GUIDE.md) - Docker concepts & setup
- [TESTING_GUIDE.md](TESTING_GUIDE.md) - Testing procedures
- [CI_CD_SETUP.md](CI_CD_SETUP.md) - GitHub Actions workflows
- [INFRASTRUCTURE_DEPLOYMENT.md](INFRASTRUCTURE_DEPLOYMENT.md) - Production deployment

**Official Resources:**
- Docker: https://docs.docker.com
- Kubernetes: https://kubernetes.io/docs
- Terraform: https://www.terraform.io/docs
- GitHub Actions: https://docs.github.com/en/actions

**Architecture Documentation:**
- [docs/API.md](docs/API.md) - API endpoints
- [docs/Architecture.md](docs/Architecture.md) - System architecture
- [docs/Database.md](docs/Database.md) - Database schema

---

**Last Updated:** Today
**Status:** Ready for Production
**Questions?** Check the relevant guide or docs/ folder
