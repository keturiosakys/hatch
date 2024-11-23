# Application Overview
This Hono application utilizes Cloudflare Workers, Durable Objects, D1 Database, and Drizzle ORM to monitor website uptime. It seeds website data into a local D1 SQL database and regularly checks each website's status and response time, storing this data in a database for further analysis.

# Code Snippets

## Seeding Data into D1 Database
### Description
This snippet demonstrates how to seed initial data into a D1 Database using Drizzle ORM. It includes the definitions of websites that need uptime monitoring and contains logic to identify the local SQLite database file to seed during development.

### Required Imports
```typescript
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./src/db/schema";
import type { NewWebsite } from "./src/db/schema";
```

### Code Example
```typescript
const seedWebsites: NewWebsite[] = [
  {
    url: "https://cloudflare.com",
    name: "Cloudflare Website",
    checkInterval: 60,
    createdAt: new Date().toISOString()
  },
  // More website definitions...
];

const seedDatabase = async () => {
  const pathToDb = getLocalD1DB();
  if (!pathToDb) {
    console.error("❌ Could not find local D1 database");
    process.exit(1);
  }
  
  const client = createClient({ url: `file:${pathToDb}` });
  const db = drizzle(client);
  console.log("Seeding database...");
  try {
    await db.insert(schema.websites).values(seedWebsites);
    console.log("✅ Database seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
  } finally {
    client.close();
  }
};

seedDatabase();

function getLocalD1DB() {
  try {
    const basePath = path.resolve(".wrangler");
    const files = fs.ratedsync(basePath, { encoding: "utf-8", recursive: true })
      .filter((f) => f.endsWith(".sqlite"));
    files.sort((a, b) => fs.statSync(path.join(basePath, b)).mtime.getTime() - fs.statSync(path.join(basePath, a)).mtime.getTime());
    return files.length ? path.resolve(basePath, files[0]) : null;
  } catch (err) {
    console.error("Error resolving local D1 DB:", err);
    return null;
  }
}
```

### Tags
- Database
- D1
- Drizzle ORM
- Seeding

## Defining Database Schema with Drizzle ORM
### Description
This snippet defines the database schema for storing website and uptime check data using Drizzle ORM for a SQLite database. The schema includes tables for websites and uptime checks with relevant fields and foreign key constraints.

### Required Imports
```typescript
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
});

export const uptimeChecks = sqliteTable('uptime_checks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  websiteId: integer('websiteId').notNull().references(() => websites.id),
  timestamp: text('timestamp').notNull(),
  status: integer('status'),
  responseTime: integer('responseTime'),
  isUp: integer('isUp', { mode: 'boolean' }).notNull()
});
```

### Tags
- Database Schema
- D1
- Drizzle ORM

## Cloudflare Workers' Durable Objects for Scheduling Website Checks
### Description
This snippet showcases implementing a Cloudflare Worker using Durable Objects to schedule and perform periodic checks on websites, storing the results in a D1 database. The Durable Object fetches requests to schedule monitoring and handles periodic checks using setInterval.

### Required Imports
```typescript
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from './db/schema';
```

### Code Example
```typescript
export class Monitor {
  private state: DurableObjectState;
  private env: Env;
  private checkTimer: ReturnType<typeof setInterval> | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    
    switch (url.pathname) {
      case '/schedule':
        const websiteId = url.searchParams.get('websiteId');
        if (!websiteId) {
          return new Response('Website ID is required', { status: 400 });
        }
        await this.scheduleChecks(parseInt(websiteId));
        return new Response('Monitoring scheduled');
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  async scheduleChecks(websiteId: number) {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }

    const db = drizzle(this.env.DB);
    const website = await db.select().from(schema.websites).where(eq(schema.websites.id, websiteId)).get();

    if (!website) {
      console.error(`Website ${websiteId} not found`);
      return;
    }

    this.checkTimer = setInterval(async () => {
      await this.performCheck(website).catch((error) => console.error('Error:', error));
    }, website.checkInterval * 1000);

    await this.performCheck(website).catch((error) => console.error('Error:', error));
  }

  async performCheck(website: typeof schema.websites.$inferSelect) {
    console.log(`Performing check for ${website.name} (${website.url})`);
    let isUp = false;
    let responseTime = 0;
    let status = 0;
    const db = drizzle(this.env.DB);

    const startTime = Date.now();

    try {
      const response = await fetch(website.url, {
        method: 'GET',
        redirect: 'follow',
        cf: { cacheTTL: 0, cacheEverything: false }
      });

      responseTime = Date.now() - startTime;
      status = response.status;
      isUp = response.status >= 200 && response.status < 400;
      console.log(`Check complete - Status: ${status}, Response Time: ${responseTime}ms, Up: ${isUp}`);
    } catch (error) {
      responseTime = Date.now() - startTime;
      isUp = false;
      console.error('Error:', error);
    }

    try {
      await db.insert(schema.uptimeChecks).values({
        websiteId: website.id,
        timestamp: new Date().toISOString(),
        status,
        responseTime,
        is