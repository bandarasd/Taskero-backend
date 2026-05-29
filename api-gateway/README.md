# Taskero API Gateway

A centralized API Gateway for all Taskero microservices.

## Setup

```bash
cd api-gateway
npm install
```

## Run

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

## Configuration

Edit `.env` file to configure service URLs:

```env
PORT=3000
USER_SERVICE_URL=http://localhost:5000
TASK_SERVICE_URL=http://localhost:5002
# ... etc
```

## API Routes

All routes are prefixed with `/api`:

| Route                  | Service              | Description          |
| ---------------------- | -------------------- | -------------------- |
| `/api/users/*`         | user-service         | User management      |
| `/api/verifications/*` | user-service         | User verification    |
| `/api/tasks/*`         | task-service         | Task management      |
| `/api/gigs/*`          | task-service         | Gig management       |
| `/api/reviews/*`       | task-service         | Reviews              |
| `/api/chat/*`          | chat-service         | Chat/messaging       |
| `/api/payments/*`      | payment-service      | Payment processing   |
| `/api/search/*`        | search-service       | Search functionality |
| `/api/email/*`         | email-service        | Email sending        |
| `/api/notifications/*` | notification-service | Notifications        |

## Health Checks

- `GET /health` - Gateway health
- `GET /health/all` - All services health status

## For iOS App

Your iOS app only needs to connect to:

```
http://localhost:3000  (development)
http://your-server-ip:3000  (production)
```

Example API calls:

- Login: `POST http://localhost:3000/api/users/login`
- Get tasks: `GET http://localhost:3000/api/tasks`
- Search: `GET http://localhost:3000/api/search?q=keyword`
