# System Architecture

## Overview
The app is a monorepo with three main layers:

1. **Frontend**
   - Next.js (Web dashboard)
   - Flutter (Mobile app)
2. **Backend**
   - Django (Authentication, Admin)
   - Rust services (Wallet, Marketplace, Pricing Engine, Order)
3. **Infrastructure**
   - PostgreSQL, Redis
   - Docker / Docker Compose
   - Optional: Kubernetes, Terraform for cloud

## Flow Diagram
Frontend → API Gateway → Django (Auth/Admin)
                           → Rust Services (Business logic)
                           → Database (PostgreSQL/Redis)