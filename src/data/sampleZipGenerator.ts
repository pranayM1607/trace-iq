import JSZip from 'jszip';

export async function generateSampleCodebaseZip(): Promise<Blob> {
  const zip = new JSZip();

  // 1. Root Docker Compose
  zip.file(
    'docker-compose.yml',
    `version: '3.8'
services:
  api-gateway:
    build: ./services/gateway
    ports:
      - "8080:8080"
    depends_on:
      - auth-service
      - order-service
      - user-service

  auth-service:
    build: ./services/auth
    environment:
      - DATABASE_URL=postgres-db
      - REDIS_HOST=redis-cache

  user-service:
    build: ./services/user
    environment:
      - DB_HOST=postgres-db
      - REDIS_HOST=redis-cache

  order-service:
    build: ./services/order
    environment:
      - POSTGRES_HOST=postgres-db
    depends_on:
      - payment-service
      - inventory-service

  payment-service:
    build: ./services/payment
    environment:
      - DATABASE_URL=postgres-db

  inventory-service:
    build: ./services/inventory
    environment:
      - DB_HOST=postgres-db

  postgres-db:
    image: postgres:16
    ports:
      - "5432:5432"

  redis-cache:
    image: redis:7-alpine
    ports:
      - "6379:6379"
`
  );

  // 2. Gateway Service (Node / Express)
  zip.file(
    'services/gateway/package.json',
    JSON.stringify(
      {
        name: 'api-gateway',
        version: '1.0.0',
        dependencies: {
          express: '^4.19.2',
          axios: '^1.6.8',
          'http-proxy-middleware': '^3.0.0',
          jsonwebtoken: '^9.0.2',
        },
      },
      null,
      2
    )
  );

  zip.file(
    'services/gateway/src/routes.ts',
    `import express from 'express';
import axios from 'axios';

const router = express.Router();

router.get('/api/v1/users/profile', async (req, res) => {
  const user = await axios.get('http://user-service:5002/api/users/me');
  res.json(user.data);
});

router.post('/api/v1/orders/checkout', async (req, res) => {
  const order = await axios.post('http://order-service:8081/api/orders', req.body);
  res.json(order.data);
});

export default router;
`
  );

  // 3. User Service (Node / TypeORM / Redis / Postgres)
  zip.file(
    'services/user/package.json',
    JSON.stringify(
      {
        name: 'user-service',
        version: '1.0.0',
        dependencies: {
          express: '^4.19.2',
          typeorm: '^0.3.20',
          pg: '^8.11.5',
          redis: '^4.6.13',
          bcrypt: '^5.1.1',
        },
      },
      null,
      2
    )
  );

  zip.file(
    'services/user/src/app.ts',
    `import express from 'express';
const app = express();

app.get('/api/users/me', (req, res) => {
  res.json({ id: 'usr-100', name: 'Alex Johnson', email: 'alex@traceiq.internal' });
});

app.listen(5002);
`
  );

  // 4. Order Service (Java / Spring Boot / PostgreSQL)
  zip.file(
    'services/order/pom.xml',
    `<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.traceiq</groupId>
  <artifactId>order-service</artifactId>
  <version>1.0.0</version>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
      <groupId>org.postgresql</groupId>
      <artifactId>postgresql</artifactId>
    </dependency>
  </dependencies>
</project>
`
  );

  zip.file(
    'services/order/src/main/java/OrderController.java',
    `package com.traceiq.order;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final RestTemplate restTemplate = new RestTemplate();

    @PostMapping
    public String createOrder(@RequestBody String orderRequest) {
        String payment = restTemplate.postForObject("http://payment-service:8000/pay/charge", orderRequest, String.class);
        return "Order confirmed. Payment: " + payment;
    }
}
`
  );

  // 5. Payment Service (Python / FastAPI / Stripe / asyncpg)
  zip.file(
    'services/payment/requirements.txt',
    `fastapi==0.110.0
uvicorn==0.29.0
sqlalchemy==2.0.29
asyncpg==0.29.0
stripe==8.8.0
httpx==0.27.0
`
  );

  zip.file(
    'services/payment/app/main.py',
    `from fastapi import FastAPI
import stripe

app = FastAPI()

@app.post("/api/payment/charge")
def process_charge(amount: float):
    # Stripe integration call
    return {"status": "success", "charge_id": "ch_982482348"}
`
  );

  // 6. Inventory Service (Go / Gin / PostgreSQL)
  zip.file(
    'services/inventory/go.mod',
    `module traceiq/inventory-service

go 1.22

require (
    github.com/gin-gonic/gin v1.9.1
    gorm.io/driver/postgres v1.5.7
    gorm.io/gorm v1.25.9
    github.com/go-redis/redis/v8 v8.11.5
)
`
  );

  return await zip.generateAsync({ type: 'blob' });
}
