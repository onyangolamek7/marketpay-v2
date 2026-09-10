# 🐳 Docker Setup & Deployment Guide for MarketPay Superapp

## ✅ Files Created

- ✓ `backend/django-api/Dockerfile`
- ✓ `backend/django-api/.dockerignore`
- ✓ `backend/django-api/requirements.txt`
- ✓ `backend/rust-services/wallet-service/Dockerfile`
- ✓ `backend/rust-services/wallet-service/.dockerignore`
- ✓ `frontend/web-nextjs/Dockerfile`
- ✓ `frontend/web-nextjs/.dockerignore`
- ✓ `docker-compose.yml` (at project root)
- ✓ `.env.example` (template for environment variables)

---

## 🔧 Environment Variables Setup

### Step 1: Create `.env` file from template

```bash
# Copy the example file
cp .env.example .env

# Edit with your settings
# On Windows (PowerShell)
notepad .env

# On Mac/Linux
nano .env
```

### Step 2: Configure your `.env` file

```env
# ===== DATABASE =====
POSTGRES_DB=marketpay
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-secure-password-here

# ===== DJANGO =====
DEBUG=False                              # Set to True only in development
SECRET_KEY=your-secret-key-change-this-in-production
ALLOWED_HOSTS=localhost,127.0.0.1,yourdomain.com

# ===== RUST WALLET SERVICE =====
RUST_LOG=info                            # Options: debug, info, warn, error

# ===== FRONTEND =====
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WALLET_API=http://localhost:3001
NODE_ENV=production                      # Set to development for dev
```

### Key Environment Variables Explained

| Variable | Purpose | Example | When to Change |
|----------|---------|---------|-----------------|
| `POSTGRES_PASSWORD` | Database password | `MySecurePass123!` | **ALWAYS** - Never use default |
| `SECRET_KEY` | Django security key | Generate with `python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'` | Before production |
| `DEBUG` | Django debug mode | `False` for production, `True` for dev | When deploying |
| `RUST_LOG` | Rust logging level | `info` for production, `debug` for troubleshooting | When debugging |
| `NEXT_PUBLIC_API_URL` | Frontend API endpoint | `http://localhost:8000` (dev), `https://api.yourdomain.com` (prod) | Per environment |

---

## 🚀 Quick Start Commands

### Build all services

```bash
# Navigate to project root
cd c:\Users\ADMIN\Desktop\marketpay-superapp

# Build all Docker images
docker-compose build
```

### Start all services

```bash
# Start in background (detached mode)
docker-compose up -d

# View startup logs
docker-compose logs -f
```

### Stop all services

```bash
docker-compose down

# Also remove volumes (WARNING: deletes database data)
docker-compose down -v
```

### View logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f django-api
docker-compose logs -f wallet-service
docker-compose logs -f nextjs-frontend
```

---

## 📋 Accessing Services

After running `docker-compose up -d`:

| Service | URL | Purpose |
|---------|-----|---------|
| **Next.js Frontend** | http://localhost:3000 | Web application UI |
| **Django API** | http://localhost:8000 | REST API endpoints |
| **Wallet Service** | http://localhost:3001 | Rust microservice |
| **PostgreSQL** | localhost:5432 | Database (not directly accessible from browser) |

---

## 🔐 Security Best Practices

### 1. Never commit `.env` to git

```bash
# .gitignore should contain:
.env
.env.local
.env.*.local
```

### 2. Use strong passwords

```bash
# Generate a strong password (PowerShell)
-join ((33..126) | Get-Random -Count 32 | % {[char]$_})

# Or online: https://passwordsgenerator.net/
```

### 3. Use secrets in production

For production, use a secrets management service instead of `.env`:
- **Azure**: Azure Key Vault
- **AWS**: AWS Secrets Manager
- **Docker Swarm**: Docker Secrets
- **Kubernetes**: Kubernetes Secrets

### 4. Rotate secrets regularly

```bash
# Update PostgreSQL password
docker-compose down
# Edit .env with new password
docker-compose up -d
```

---

## 🐛 Troubleshooting

### Database connection failed

```bash
# Check PostgreSQL is running
docker-compose ps

# Check logs
docker-compose logs postgres

# Verify DATABASE_URL is correct in .env
```

### Port already in use

```bash
# Find process using port 8000 (Windows PowerShell)
netstat -ano | findstr :8000

# Kill process
taskkill /PID <PID> /F

# Or change port in docker-compose.yml
# Change "8000:8000" to "8001:8000"
```

### Rebuild service

```bash
# Rebuild specific service
docker-compose build django-api

# Rebuild and restart
docker-compose up -d --build django-api
```

### View running containers

```bash
docker ps
docker-compose ps
```

---

## 📚 Docker Concepts Explained

### 1. **Dockerfile**
A text file with instructions to build a Docker image. Think of it as a recipe:
- `FROM` - Start with a base image
- `WORKDIR` - Set working directory
- `COPY` - Copy files into container
- `RUN` - Execute commands
- `EXPOSE` - Expose ports
- `CMD` - Default command to run

### 2. **Docker Image**
A blueprint for creating containers. Built from a Dockerfile.
```bash
docker build -t myimage:latest .
```

### 3. **Docker Container**
A running instance of an image. Like a virtual machine but lightweight.
```bash
docker run -d myimage
```

### 4. **.dockerignore**
Like `.gitignore` but for Docker. Excludes files from the build context to reduce image size:
```
node_modules      # Skip npm packages (they'll be installed in container)
.git              # Skip version control
.env              # Skip secrets
```

### 5. **Multi-stage Build** (Used in Rust & Next.js)
Reduces final image size by using multiple build stages:

```dockerfile
# Stage 1: Build
FROM rust:1.75 AS builder
RUN cargo build --release

# Stage 2: Runtime (smaller)
FROM debian:bookworm-slim
COPY --from=builder /app/target/release/app .
```

**Result**: Only the final binary is included, not build tools (~800MB saved!)

### 6. **docker-compose.yml**
Orchestrates multiple containers:
- Defines services (containers)
- Network communication
- Environment variables
- Volumes (persistent storage)
- Dependencies between services

### 7. **Volumes**
Persistent storage that survives container restart:
```yaml
volumes:
  postgres_data:/var/lib/postgresql/data
```

### 8. **Networks**
Allows containers to communicate by hostname:
```yaml
networks:
  superapp-network:
```
Now `django-api` can access `postgres` at hostname `postgres:5432`

### 9. **Health Checks**
Monitors if a service is healthy:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:3000 || exit 1
```

### 10. **Non-root User**
Runs container as non-root for security:
```dockerfile
RUN useradd -m -u 1000 appuser
USER appuser
```

---

## 📊 Container Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Docker Compose Network                  │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────┐     ┌──────────────────┐           │
│  │  Next.js Frontend│────→│   Django API     │           │
│  │  :3000           │     │   :8000          │           │
│  └──────────────────┘     └──────────────────┘           │
│           │                        │                      │
│           └────────────┬───────────┘                      │
│                        ↓                                   │
│  ┌──────────────────────────────────────┐                │
│  │       PostgreSQL Database            │                │
│  │       :5432                          │                │
│  │       (postgres_data volume)         │                │
│  └──────────────────────────────────────┘                │
│           ↑                                               │
│           │                                               │
│  ┌──────────────────┐                                    │
│  │ Wallet Service   │────────────────────────────────────┤
│  │ (Rust)           │                                    │
│  │ :3001            │                                    │
│  └──────────────────┘                                    │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 Development Workflow

### Local Development (Without Docker)

```bash
# Django
cd backend/django-api
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Frontend (separate terminal)
cd frontend/web-nextjs
npm install
npm run dev
```

### Production Deployment (With Docker)

```bash
# Use docker-compose
docker-compose up -d

# Or use Kubernetes/Swarm for orchestration
docker stack deploy -c docker-compose.yml marketpay
```

---

## 🧹 Cleaning Up

```bash
# Remove all containers and networks (keeps data)
docker-compose down

# Remove everything including volumes (WARNING: deletes data!)
docker-compose down -v

# Remove all unused Docker resources
docker system prune -a
```

---

## 📱 Testing Services

### Test Django API

```bash
# Get health status
curl http://localhost:8000/api/health/

# Create user (example)
curl -X POST http://localhost:8000/api/users/ \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com"}'
```

### Test Frontend

```bash
# Open in browser
open http://localhost:3000
```

### Test Database Connection

```bash
# From inside django container
docker-compose exec django-api python manage.py dbshell
```

---

## 📝 Next Steps

1. ✅ Create `.env` file from `.env.example`
2. ✅ Update environment variables with your values
3. ✅ Run `docker-compose build`
4. ✅ Run `docker-compose up -d`
5. ✅ Check logs: `docker-compose logs -f`
6. ✅ Access services at localhost ports
7. ✅ Run Django migrations: `docker-compose exec django-api python manage.py migrate`
8. ✅ Create superuser: `docker-compose exec django-api python manage.py createsuperuser`

---

## 🎯 Common Commands Cheat Sheet

```bash
# Build & Start
docker-compose build          # Build all images
docker-compose up -d          # Start all services
docker-compose down           # Stop all services

# Logs & Status
docker-compose logs -f        # View all logs
docker-compose logs -f <service>  # View specific service logs
docker-compose ps             # Show running containers

# Execution
docker-compose exec <service> <command>  # Run command in service
docker-compose run <service> <command>   # Run one-off command

# Database
docker-compose exec postgres psql -U postgres  # Access PostgreSQL
docker-compose exec django-api python manage.py migrate  # Run migrations
docker-compose exec django-api python manage.py createsuperuser  # Create admin user

# Cleanup
docker-compose down -v        # Remove everything including volumes
docker system prune -a        # Clean up all unused resources
```

---

## 🆘 Need Help?

- **Docker Docs**: https://docs.docker.com/
- **Docker Compose**: https://docs.docker.com/compose/
- **Django Docker**: https://docs.djangoproject.com/en/stable/
- **Next.js Docker**: https://nextjs.org/docs/deployment/docker

**Created**: 2026-07-26
**Project**: MarketPay Superapp
