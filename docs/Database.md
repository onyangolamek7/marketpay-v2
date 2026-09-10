# Database Overview

## Key Tables
- Users
- Products
- Orders
- Transactions
- Wallets
- Markets
- Sellers
- Reviews

## Notes
- Use PostgreSQL
- Relationships:
  - User → Orders → Products
  - Seller → Products → Markets
  - Wallet → Transactions