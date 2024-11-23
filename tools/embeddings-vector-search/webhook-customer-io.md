# Application Overview
This application is a Hono app designed to run on Cloudflare workers. It employs middleware for authentication and input validation and integrates with Drizzle ORM for database interactions. The app features an endpoint for user registration, where user details are stored in a PostgreSQL database hosted on Neon, and a notification is sent to Slack. It leverages Cloudflare's environment variables for configuration and uses a few key middlewares to manage authentication and data validation.

# Code Snippets

## Environment Configuration with Drizzle
### Description
A setup to define the configuration for Drizzle ORM, using environment variables to manage database connection settings.
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
- environment configuration
- database setup

## Middleware for Input Validation
### Description
Middleware to validate incoming JSON request data ensuring it contains the required fields of string type.
### Required Imports
```typescript
import { createMiddleware } from "hono/factory";
```
### Code Example
```typescript
export const validateInputMiddleware = createMiddleware(async (c, next) => {
    try {
        const { name, email, githubHandle } = await c.req.json();
        if (typeof name !== 'string' || typeof email !== 'string' || typeof githubHandle !== 'string') {
            return c.json({ error: 'Invalid input values' }, 400);
        }
        await next();
    } catch (error) {
        return c.json({ error: `Invalid request body ${error}` }, 400);
    }
});
```
### Tags
- middleware
- input validation

## Middleware for Basic Authentication
### Description
Middleware that checks for a custom "X-Custom-Auth" header to authenticate requests using Basic Authentication with username and password stored in environment variables.
### Required Imports
```typescript
import { createMiddleware } from "hono/factory";
```
### Code Example
```typescript
export const authenticationMiddleware = createMiddleware(async (c, next) => {
    const authHeader = c.req.header("X-Custom-Auth");
    if (!authHeader || !authHeader.startsWith("Basic ")) {
        return c.text("Unauthorized", 401);
    }
    
    const base64Credentials = authHeader.split(" ")[1];
    const credentials = Buffer.from(base64Credentials, "base64").toString("ascii");
    const [username, password] = credentials.split(":");

    const validUsername = c.env.USER;
    const validPassword = c.env.PASSWORD;

    if (username !== validUsername || password !== validPassword) {
        return c.text("Unauthorized", 401);
    }

    await next();
});
```
### Tags
- middleware
- authentication

## Database Seeding with Drizzle ORM
### Description
A script to seed a PostgreSQL database with initial user data using Drizzle ORM.
### Required Imports
```typescript
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";
import { users, type NewUser } from "./src/db/schema";
```
### Code Example
```typescript
config({ path: ".dev.vars" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

const seedData: NewUser[] = [
  { name: "Nikita Shamgunov", email: "nikita.shamgunov@example.com" },
  { name: "Heikki Linnakangas", email: "heikki.linnakangas@example.com" },
  { name: "Stas Kelvich", email: "stas.kelvich@example.com" },
];

async function seed() {
  await db.insert(users).values(seedData);
}

seed().then(() => {
  console.log("✅ Database seeded successfully!");
}).catch(error => {
  console.error("❌ Error during seeding:", error);
});
```
### Tags
- database
- seeding

## Hono App User Registration Endpoint
### Description
Defines an endpoint to handle user registration. It validates input, saves data to a database, and sends a notification via Slack after user registration.
### Required Imports
```typescript
import { Hono } from "hono";
import { validateInputMiddleware } from "./middleware/validate-input-middleware";
import { authenticationMiddleware } from "./middleware/authentication-middleware";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { users } from "./db/schema";
```
### Code Example
```typescript
const app = new Hono<{ Bindings: Bindings }>();

app.use("/api/signup", authenticationMiddleware, validateInputMiddleware);

app.post("/api/signup", async (c) => {
  const { name, email, githubHandle } = await c.req.json();

  c.executionCtx.waitUntil(sendSlackMessage(`New person registered: ${name}`, c.env.SLACK_URL));

  await insertDb(name, email, githubHandle, c.env.DATABASE_URL);
  return c.json(`new person registered ${name}`, 200);
});

async function insertDb(name: string, email: string, githubHandle: string, dbUrl: string) {
  const sql = neon(dbUrl);
  const db = drizzle(sql);

  await db.insert(users).values({
    name: name,
    email: email,
    githubHandle: githubHandle
  }).onConflictDoNothing();
}

async function sendSlackMessage(message: string, slackUrl: string) {
  await fetch(slackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: message,
    }),
  });
}
```
### Tags
- endpoint
- user registration
- notification