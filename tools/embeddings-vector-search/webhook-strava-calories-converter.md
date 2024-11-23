# Application Overview
This Hono application is designed to run on Cloudflare workers, providing basic endpoints for a webhook integration with a service like Strava. It features a schema for a PostgreSQL database, using Drizzle ORM, and includes basic endpoint routing among incoming GET and POST HTTP requests.

# Code Snippets

## Setting Up Drizzle Config for PostgreSQL
### Description
This snippet sets up the configuration for Drizzle ORM to work with a PostgreSQL database. It uses environment variables for database credentials and specifies the schema file location.

### Required Imports
```typescript
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
```

### Code Example
```typescript
config({ path: "./.dev.vars" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
```

### Tags
- Drizzle
- PostgreSQL

## Database Schema Definition with Drizzle ORM
### Description
This snippet demonstrates how to define a database schema using Drizzle ORM's PostgreSQL core functions. It shows the structure of a `users` table, complete with several fields and their respective types.

### Required Imports
```typescript
import { jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
```

### Code Example
```typescript
export type NewUser = typeof users.$inferInsert;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
  email: text("email"),
  settings: jsonb("settings"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### Tags
- Drizzle
- Database Schema

## Simple Hono Route for JSON Response
### Description
This snippet illustrates defining a simple GET route in a Hono application that returns a static JSON response.

### Required Imports
```typescript
import { Hono } from "hono";
```

### Code Example
```typescript
const app = new Hono();

app.get("/", (c) => {
  return c.json({ "Honc!": "🪿" });
});
```

### Tags
- Hono
- Cloudflare Workers

## Handling Webhook Verification with Strava using Hono
### Description
This snippet handles the verification of webhook challenge requests from Strava, responding appropriately based on the provided verification token.

### Required Imports
```typescript
import { Hono } from "hono";
```

### Code Example
```typescript
app.get("/api/strava", (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  const VERIFY_TOKEN = "HONC";

  if (token === VERIFY_TOKEN) {
    if (mode === "subscribe") {
      console.log("WEBHOOK_VERIFIED");
    }
    return new Response(JSON.stringify({ "hub.challenge": challenge }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return c.json("Verification failed", 403);
});
```

### Tags
- Hono
- Webhook

## Processing Incoming Webhook POST Requests
### Description
This code snippet handles incoming POST requests, logs the body for processing, and echoes it back as a JSON response.

### Required Imports
```typescript
import { Hono } from "hono";
```

### Code Example
```typescript
app.post("/api/strava", async (c) => {
  const body = await c.req.json();
  console.log(body);
  return c.json(body, 200);
});
```

### Tags
- Hono
- Webhook
- Cloudflare Workers