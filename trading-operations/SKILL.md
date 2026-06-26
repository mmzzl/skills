---
name: trading-operations
description: Use when buying or selling stocks, querying holdings/portfolio, or managing stock trades through the local trading API. Triggered by "buy X shares", "sell X shares", "show holdings", "portfolio summary", "stock price".
---

# Trading Operations

## Overview
API toolkit for stock trading operations: login, buy/sell holdings, query portfolio and real-time prices. Backend runs at `http://localhost:8000`.

## Quick Reference

| Operation | Method | Endpoint | Auth |
|-----------|--------|----------|------|
| Login | POST | /auth/login | No |
| Buy | POST | /holdings/{user_id} | Yes |
| Sell | POST | /holdings/{user_id}/{code}/sell | Yes |
| List Holdings | GET | /holdings/{user_id} | Yes |
| Portfolio | GET | /holdings/portfolio/{user_id} | Yes |
| Prices | POST | /holdings/prices | Yes |

## Workflows

### 1. Login → Get Token + user_id
**Agent must ask user for their username and password first.** Do not assume credentials.

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "在线用户输入", "password": "在线用户输入"}'
```
Response includes `access_token`, `user_id`, `role`.

Save token for all subsequent requests: `Authorization: Bearer {token}`. Token expires in **30 minutes** — re-login if getting 401.

### 2. Buy Stocks
```bash
curl -X POST http://localhost:8000/holdings/{user_id} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"code": "000001", "name": "平安银行", "quantity": 1000, "average_cost": 11.50}'
```
- `code`: exactly 6-digit stock code
- `name`: optional (API auto-fetches if omitted)
- `quantity`: positive integer (shares)
- `average_cost`: buy price per share

### 3. Sell Stocks
```bash
curl -X POST http://localhost:8000/holdings/{user_id}/{code}/sell \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"quantity": 500, "price": 12.00}'
```
- `code` is part of URL path
- Can't sell more than current holdings quantity

### 4. List Holdings
```bash
curl -s "http://localhost:8000/holdings/{user_id}?page=1&page_size=20" \
  -H "Authorization: Bearer {token}"
```

### 5. Portfolio Summary
```bash
curl -s "http://localhost:8000/holdings/portfolio/{user_id}" \
  -H "Authorization: Bearer {token}"
```
Returns aggregated data: holdings_count, total_cost, market_value, unrealized_pnl, realized_pnl, profit_rate.

### 6. Real-time Prices
```bash
curl -X POST http://localhost:8000/holdings/prices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"codes": ["000001", "600519"]}'
```
Data source: Sina Finance real-time API.

## Common Mistakes
- **Stock code must be exactly 6 characters** (e.g. `"000001"`, not `"1"` or `"00001"`)
- **quantity must be integer > 0** (not decimal like `100.5`)
- **price/cost must be positive number** (float OK: `11.50`)
- **Token expires in 30 minutes** — re-login if getting 401
- **Wrong user_id** → 403 Forbidden (must use the user_id from your own login)
- **Selling more than owned** → 400 error
- **No current holdings** → portfolio returns `holdings_count: 0` and empty array

## Common HTTP Status Codes

| Code | Meaning | Likely Cause |
|------|---------|-------------|
| 200 | Success | Request processed |
| 201 | Created | Buy order placed successfully |
| 400 | Bad Request | Wrong field type, missing field, or quantity > holdings |
| 401 | Unauthorized | Token missing, expired, or invalid |
| 403 | Forbidden | user_id in URL doesn't match token's user |
| 404 | Not Found | Stock code or holding not found |
