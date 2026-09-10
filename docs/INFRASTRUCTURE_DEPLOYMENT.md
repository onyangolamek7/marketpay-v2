# 🏗️ Infrastructure Deployment Guide

## Overview

This guide covers deploying MarketPay to:
- **Local Development** - Docker Compose
- **Staging** - Kubernetes (any cloud)
- **Production** - Kubernetes + Terraform IaC

## Prerequisites

### Tools Required
```bash
# Docker & Docker Compose
docker --version
docker-compose --version

# Kubernetes
kubectl version --client

# Terraform
terraform -version

# Cloud CLI (choose one)
aws --version      # For AWS
az --version       # For Azure
gcloud --version   # For GCP
```

### Installation

**Mac:**
```bash
# Using Homebrew
brew install docker docker-compose kubernetes-cli terraform
brew install awscli  # or az-cli or google-cloud-sdk
```

**Windows:**
```bash
# Using Chocolatey
choco install docker-desktop kubernetes-cli terraform
choco install awscli  # or az-cli or gcloud-cli
```

**Linux:**
```bash
# Ubuntu/Debian
sudo apt-get install docker.io docker-compose kubectl terraform
sudo apt-get install awscli  # or azure-cli or google-cloud-cli
```

## 1. Local Development (Docker Compose)

### Quick Start
```bash
# Setup
cp .env.example .env
# Edit .env with your values

# Build & Start
docker-compose build
docker-compose up -d

# Verify
docker-compose ps
curl http://localhost:8000
```

### Development Workflow
```bash
# Start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose stop

# Full cleanup
docker-compose down -v
```

See [DOCKER_SETUP_GUIDE.md](DOCKER_SETUP_GUIDE.md) for details.

---

## 2. Staging Environment (Kubernetes)

### Prerequisites
- Kubernetes cluster (EKS, AKS, GKE, or local Kind)
- kubectl configured
- Docker images pushed to registry

### Deploy to Kubernetes

```bash
# 1. Configure kubectl
export KUBECONFIG=~/.kube/config
kubectl config use-context staging

# 2. Create namespace
kubectl create namespace marketpay

# 3. Create secrets
kubectl create secret generic app-secrets \
  --from-literal=SECRET_KEY=your-secret-key \
  --from-literal=DATABASE_URL=postgresql://user:pass@host/db \
  -n marketpay

# 4. Deploy application
kubectl apply -f infrastructure/kubernetes/deployment.yaml

# 5. Verify deployment
kubectl get pods -n marketpay
kubectl get svc -n marketpay

# 6. Check logs
kubectl logs -f deployment/django-api -n marketpay

# 7. Port forward for testing
kubectl port-forward svc/django-api 8000:8000 -n marketpay
```

### Scale Application
```bash
# Scale Django API
kubectl scale deployment django-api --replicas=3 -n marketpay

# Scale Wallet Service
kubectl scale deployment wallet-service --replicas=2 -n marketpay

# Enable autoscaling
kubectl apply -f infrastructure/kubernetes/hpa.yaml
```

### Update Application
```bash
# Update image
kubectl set image deployment/django-api \
  django-api=ghcr.io/marketpay/django-api:latest \
  -n marketpay

# Watch rollout
kubectl rollout status deployment/django-api -n marketpay

# Rollback if needed
kubectl rollout undo deployment/django-api -n marketpay
```

---

## 3. Production Environment (Terraform + Kubernetes)

### AWS Deployment

#### Step 1: Setup AWS Account
```bash
# Configure AWS CLI
aws configure
# Enter: Access Key, Secret Key, Region, Output format

# Verify
aws sts get-caller-identity
```

#### Step 2: Provision Infrastructure with Terraform
```bash
cd infrastructure/terraform

# Initialize
terraform init

# Review changes
terraform plan -out=tfplan

# Apply
terraform apply tfplan

# Get outputs
terraform output
```

#### Step 3: Deploy to EKS
```bash
# Update kubeconfig
aws eks update-kubeconfig --region us-east-1 --name marketpay-eks

# Verify connection
kubectl cluster-info

# Deploy application
kubectl apply -f ../kubernetes/deployment.yaml
```

### Azure Deployment

#### Step 1: Setup Azure Account
```bash
# Login to Azure
az login

# Verify
az account show
```

#### Step 2: Create Resource Group
```bash
az group create \
  --name marketpay-rg \
  --location eastus
```

#### Step 3: Create AKS Cluster
```bash
az aks create \
  --resource-group marketpay-rg \
  --name marketpay-aks \
  --node-count 3 \
  --vm-set-type VirtualMachineScaleSets \
  --load-balancer-sku standard

# Get credentials
az aks get-credentials \
  --resource-group marketpay-rg \
  --name marketpay-aks
```

#### Step 4: Deploy Application
```bash
# Deploy
kubectl apply -f infrastructure/kubernetes/deployment.yaml

# Verify
kubectl get svc -n marketpay
```

### GCP Deployment

#### Step 1: Setup GCP Account
```bash
# Login
gcloud auth login

# Set project
gcloud config set project PROJECT_ID

# Verify
gcloud projects list
```

#### Step 2: Create GKE Cluster
```bash
gcloud container clusters create marketpay-gke \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type n1-standard-1

# Get credentials
gcloud container clusters get-credentials marketpay-gke \
  --zone us-central1-a
```

#### Step 3: Deploy Application
```bash
# Deploy
kubectl apply -f infrastructure/kubernetes/deployment.yaml

# Verify
kubectl get services -n marketpay
```

---

## 4. Networking & Load Balancing

### Expose Services

```bash
# Port forward (temporary)
kubectl port-forward svc/django-api 8000:8000 -n marketpay

# Ingress (production)
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: marketpay-ingress
  namespace: marketpay
spec:
  rules:
  - host: api.marketpay.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: django-api
            port:
              number: 8000
  - host: app.marketpay.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: nextjs-frontend
            port:
              number: 3000
EOF
```

### SSL/TLS Certificates

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create certificate
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: marketpay-cert
  namespace: marketpay
spec:
  secretName: marketpay-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
  - api.marketpay.com
  - app.marketpay.com
EOF
```

---

## 5. Monitoring & Logging

### Prometheus & Grafana

```bash
# Add Helm repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install Prometheus
helm install prometheus prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace

# Access Grafana
kubectl port-forward svc/prometheus-grafana 3000:80 -n monitoring
# Username: admin
# Password: prom-operator
```

### Logging Stack (ELK)

```bash
# Install Elasticsearch, Logstash, Kibana
helm install elastic elastic/elasticsearch -n logging --create-namespace
helm install kibana elastic/kibana -n logging

# View logs
kubectl port-forward svc/kibana-kibana 5601:5601 -n logging
# Open: http://localhost:5601
```

---

## 6. Database Management

### PostgreSQL Backup

```bash
# Backup database
kubectl exec -n marketpay statefulset/postgres -- \
  pg_dump -U postgres marketpay > backup.sql

# Restore
kubectl exec -i -n marketpay statefulset/postgres -- \
  psql -U postgres marketpay < backup.sql
```

### Redis Persistence

```bash
# Get Redis shell
kubectl exec -it deployment/redis -n marketpay -- redis-cli

# Check persistence
INFO persistence
```

---

## 7. Scaling & Performance

### Horizontal Pod Autoscaler

```bash
# Check HPA status
kubectl get hpa -n marketpay

# Manual scaling
kubectl scale deployment django-api --replicas=5 -n marketpay

# HPA configuration (already in deployment.yaml)
kubectl apply -f - <<EOF
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: django-api-hpa
  namespace: marketpay
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: django-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
EOF
```

### Resource Limits

Resources are configured in `deployment.yaml`:
- Django API: 256Mi RAM, 250m CPU
- Wallet Service: 128Mi RAM, 100m CPU
- Frontend: 256Mi RAM, 100m CPU

Adjust based on load testing results.

---

## 8. Security Best Practices

### Network Policies

```bash
# Already configured in deployment.yaml
# Review with:
kubectl get networkpolicies -n marketpay
```

### Pod Security Policies

```bash
# Enable PSP in cluster
# All containers run as non-root user (UID 1000)
# Read-only filesystems where possible
```

### Secrets Management

```bash
# Encrypt secrets in etcd
kubectl create secret generic sensitive-data \
  --from-literal=key=value \
  -n marketpay

# Get secret
kubectl get secret sensitive-data -n marketpay -o yaml

# Update secret
kubectl delete secret sensitive-data -n marketpay
kubectl create secret generic sensitive-data \
  --from-literal=key=new-value \
  -n marketpay
```

---

## 9. Disaster Recovery

### Backup & Restore

```bash
# Backup entire namespace
kubectl get all -n marketpay -o yaml > marketpay-backup.yaml

# Restore
kubectl apply -f marketpay-backup.yaml

# Backup PersistentVolumes
kubectl get pv -A -o yaml > pv-backup.yaml
```

### Multi-Region Setup

```bash
# Deploy to multiple clusters
for context in staging production; do
  kubectl config use-context $context
  kubectl apply -f infrastructure/kubernetes/deployment.yaml
done
```

---

## 10. Cost Optimization

### Resource Requests

Currently configured for optimal cost:
- Min replicas: 2 (high availability)
- Resource limits: conservative CPU/memory
- Storage: 10Gi for database

Adjust based on actual usage.

### Reserved Instances (AWS/Azure/GCP)

```bash
# AWS: Purchase reserved instances for stable workloads
# Azure: Purchase reserved instances
# GCP: Committed use discounts
```

---

## Troubleshooting

### Pod won't start
```bash
kubectl describe pod <pod-name> -n marketpay
kubectl logs <pod-name> -n marketpay
```

### Service not accessible
```bash
# Check service
kubectl get svc -n marketpay
kubectl describe svc django-api -n marketpay

# Test connectivity
kubectl run -it --rm debug --image=busybox --restart=Never -- \
  sh -c "wget -O- http://django-api:8000"
```

### Database connection issues
```bash
# Check PostgreSQL pod
kubectl get pods -n marketpay | grep postgres
kubectl logs postgres-0 -n marketpay

# Test connection
kubectl exec -it postgres-0 -n marketpay -- psql -U postgres
```

---

## Checklists

### Pre-Production
- [ ] All tests passing
- [ ] Security scan completed
- [ ] Monitoring setup
- [ ] Backups configured
- [ ] High availability (3+ replicas)
- [ ] Load testing done
- [ ] Disaster recovery plan
- [ ] Documentation updated

### Deployment
- [ ] Secrets configured
- [ ] Resources allocated
- [ ] Networking setup
- [ ] DNS configured
- [ ] SSL/TLS enabled
- [ ] Monitoring active
- [ ] Alerts configured
- [ ] Runbooks prepared

---

## Next Steps

1. ✅ Choose cloud provider
2. ✅ Create infrastructure (Terraform)
3. ✅ Deploy to Kubernetes
4. ✅ Setup monitoring
5. ✅ Configure CI/CD
6. ✅ Run load tests
7. ✅ Perform security audit
8. ✅ Go live!

See [CI_CD_SETUP.md](CI_CD_SETUP.md) for continuous deployment.
