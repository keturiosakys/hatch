# Application Overview
This is a website uptime monitoring application built with Hono and Cloudflare Workers. It uses D1 for data storage, Drizzle ORM for database operations, and Durable Objects for scheduling periodic uptime checks.

# Code Snippets

## Database Schema Definition
### Description
Defines the database schema using Drizzle ORM with tables for websites and uptime checks.

### Required Imports
```typescript
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
```

### Code Example
```typescript
export const websites = sqliteTable('websites', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  url: text('url').notNull(),
  name: text('name').notNull(),
  checkInterval: integer('checkInterval').notNull(),
  createdAt: text('createdAt').notNull()
})

export const uptimeChecks = sqliteTable('uptime_checks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  websiteId: integer('websiteId')
    .notNull()
    .references(() => websites.id),
  timestamp: text('timestamp').notNull(),
  status: integer('status'),
  responseTime: integer('responseTime'),
  isUp: integer('isUp', { mode: 'boolean' }).notNull()
})
```

### Tags
- drizzle
- database-schema
- sqlite
- d1

## Durable Object Monitor
### Description
Implements a Durable Object that handles website monitoring with periodic checks.

### Required Imports
```typescript
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
```

### Code Example
```typescript
export class Monitor {
  private state: DurableObjectState
  private env: Env
  private checkTimer: ReturnType<typeof setInterval> | null = null

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
  }

  async performCheck(website: typeof schema.websites.$inferSelect) {
    const startTime = Date.now()
    const db = drizzle(this.env.DB)
    
    try {
      const response = await fetch(website.url, {
        method: 'GET',
        redirect: 'follow',
        cf: {
          cacheTTL: 0,
          cacheEverything: false
        }
      })

      const responseTime = Date.now() - startTime
      const status = response.status
      const isUp = response.status >= 200 && response.status < 400

      await db.insert(schema.uptimeChecks).values({
        websiteId: website.id,
        timestamp: new Date().toISOString(),
        status,
        responseTime,
        isUp
      })
    } catch (error) {
      console.error('Error performing check:', error)
    }
  }
}
```

### Tags
- durable-objects
- cloudflare-workers
- monitoring
- d1

## Database Configuration
### Description
Configures Drizzle ORM for both local development and production environments with D1.

### Required Imports
```typescript
import { defineConfig } from "drizzle-kit";
```

### Code Example
```typescript
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
    databaseId: process.env.CLOUDFLARE_DATABASE_ID ?? "",
    token: process.env.CLOUDFLARE_D1_TOKEN ?? "",
  },
});
```

### Tags
- drizzle
- configuration
- d1
- cloudflare

## Database Seeding
### Description
Seeds the D1 database with initial website data for monitoring.

### Required Imports
```typescript
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
```

### Code Example
```typescript
const seedWebsites = [
  {
    url: "https://cloudflare.com",
    name: "Cloudflare Website",
    checkInterval: 60,
    createdAt: new Date().toISOString()
  }
];

const seedDatabase = async () => {
  const client = createClient({
    url: `file:${pathToDb}`,
  });
  const db = drizzle(client);
  
  try {
    await db.insert(schema.websites).values(seedWebsites);
    console.log("✅ Database seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
  } finally {
    client.close();
  }
};
```

### Tags
- database
- seeding
- d1
- drizzle