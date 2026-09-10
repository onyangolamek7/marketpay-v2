# 🧪 Docker Testing & Deployment Guide

## Quick Testing

### Step 1: Prepare Environment
```bash
# Create .env file
cp .env.example .env

# Update .env with your values (CRITICAL!)
# - Change POSTGRES_PASSWORD
# - Change DJANGO_SECRET_KEY
# - Set DEBUG=False for testing
```

### Step 2: Run Tests (Linux/Mac)
```bash
chmod +x test-containers.sh
./test-containers.sh
```

### Step 3: Run Tests (Windows)
```bash
test-containers.bat
```

## Manual Testing

### Build
```bash
docker-compose build
```

### Start
```bash
docker-compose up -d
```

### Check Status
```bash
docker-compose ps
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f django-api
docker-compose logs -f wallet-service
docker-compose logs -f nextjs-frontend
```

## Testing Each Service

### 1. PostgreSQL
```bash
# Test connection
docker-compose exec postgres psql -U postgres -d marketpay -c "SELECT 1"

# Access shell
docker-compose exec postgres psql -U postgres -d marketpay
```

### 2. Redis
```bash
# Test connection
docker-compose exec redis redis-cli ping

# View keys
docker-compose exec redis redis-cli keys '*'
```

### 3. Django API
```bash
# Run migrations
docker-compose exec django-api python manage.py migrate

# Create superuser
docker-compose exec django-api python manage.py createsuperuser

# Run tests
docker-compose exec django-api python manage.py test

# Test endpoint
curl http://localhost:8000/api/
```

### 4. Wallet Service (Rust)
```bash
# Check if service is running
curl -v http://localhost:3001/

# View logs
docker-compose logs wallet-service
```

### 5. Next.js Frontend
```bash
# Open in browser
open http://localhost:3000

# Check status
curl -I http://localhost:3000
```

## Health Checks

```bash
# All health endpoints
echo "=== PostgreSQL ==="
docker-compose exec -T postgres pg_isready -U postgres

echo "=== Redis ==="
docker-compose exec -T redis redis-cli ping

echo "=== Django API ==="
curl http://localhost:8000/api/health/ 2>/dev/null || echo "Not ready yet"

echo "=== Frontend ==="
curl -I http://localhost:3000 2>/dev/null | head -1
```

## Troubleshooting

### Service won't start
```bash
# Check logs
docker-compose logs <service-name>

# Rebuild service
docker-compose build <service-name>
docker-compose up -d <service-name>

# Full restart
docker-compose down
docker-compose up -d
```

### Database connection error
```bash
# Wait for database to be ready
docker-compose exec postgres pg_isready -U postgres

# Check database exists
docker-compose exec postgres psql -U postgres -l

# Create database manually
docker-compose exec postgres createdb -U postgres marketpay
```

### Port already in use
```bash
# Find process using port (Mac/Linux)
lsof -i :8000
kill -9 <PID>

# Or change port in docker-compose.yml
# Change "8000:8000" to "8001:8000"
```

### Clean rebuild
```bash
# Remove everything including volumes
docker-compose down -v

# Rebuild
docker-compose build --no-cache

# Restart
docker-compose up -d
```

## Stopping Services

```bash
# Stop without removing
docker-compose stop

# Stop and remove containers
docker-compose down

# Stop and remove everything including volumes
docker-compose down -v
```

## Performance Monitoring

### View resource usage
```bash
docker stats
```

### Check container details
```bash
docker inspect marketpay-django
docker inspect marketpay-postgres
```

### View network
```bash
docker network ls
docker network inspect superapp-network
```

## Debugging

### Connect to running container
```bash
# Django
docker-compose exec django-api bash

# Postgres
docker-compose exec postgres bash

# Frontend
docker-compose exec nextjs-frontend bash
```

### View environment variables
```bash
docker-compose exec django-api env
```

### Test Django admin
```bash
# Access at http://localhost:8000/admin
# Username: your_username
# Password: your_password
```

## Next Steps

After successful testing:

1. ✅ Run production builds
2. ✅ Set up CI/CD pipeline (GitHub Actions)
3. ✅ Deploy to staging/production
4. ✅ Set up monitoring & alerts
5. ✅ Configure backups

See [CI_CD_SETUP.md](CI_CD_SETUP.md) for pipeline setup.
