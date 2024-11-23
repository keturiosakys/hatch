# Application Overview
This application is a Goose Joke Generator API built on top of a Postgres database using Drizzle ORM, Cloudflare Workers for serverless execution, and capabilities like rate limiting and AI-powered joke generation. It employs Cloudflare Bindings such as KV, AI, and a Postgres database hosted on Neon using Drizzle for ORM.

# Code Snippets

## Database Seeding with Drizzle ORM
### Description
The seeding process populates the Postgres `jokes` table with initial data using Drizzle ORM's capabilities for handling Neon serverless databases.

### Required Imports
```typescript
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";
import { jokes } from "./src/db/schema";
```

### Code Example
```typescript
config({ path: ".dev.vars" });

// Initialize Drizzle with Neon database URL
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function seed() {
  await db.insert(jokes).values([
    {
      content: "Why don't geese like people? They're always giving them the cold shoulder!",
    },
    {
      content: "What do you call a goose that's always complaining? A grumpy gander!",
    },
    {
      content: "How do geese like their eggs? Goose-side up!",
    },
  ]);
}

async function main() {
  try {
    await seed();
    console.log("Seeding completed");
  } catch (error) {
    console.error("Error during seeding:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}
main();
```

### Tags
- Database
- Cloudflare Workers
- Drizzle ORM
- Neon Database

## Rate Limiting with Cloudflare KV
### Description
This snippet demonstrates how to implement a rate limiter for the Goose Jokes API using Cloudflare Workers and KV storage. It ensures fair usage by limiting requests per IP.

### Required Imports
```typescript
import { WorkersKVStore } from "@hono-rate-limiter/cloudflare";
import type { Context, Next } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { createFactory } from "hono/factory";
import type { Bindings } from "./types";
```

### Code Example
```typescript
const factory = createFactory<{ Bindings: Bindings }>();

export const gooseJokesRateLimiter = factory.createMiddleware(
  (c: Context, next: Next) =>
    rateLimiter({
      windowMs: 2 * 60 * 1000, // 2 minutes window
      limit: 3000, // 3000 requests per window
      standardHeaders: "draft-6",
      keyGenerator: (c) => c.req.header("cf-connecting-ip") ?? "",
      store: new WorkersKVStore({
        namespace: c.env.GOOSE_JOKES_CACHE,
      }),
    })(c, next),
);
```

### Tags
- Rate Limiting
- Cloudflare KV
- Hono Middleware

## AI-Powered Joke Generation
### Description
Uses Cloudflare's AI binding to generate new jokes about geese, leveraging recent joke data from the database to avoid repetition.

### Required Imports
```typescript
import { desc } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { jokes } from "./db/schema";
```

### Code Example
```typescript
export async function generateGooseJoke(
  db: NeonHttpDatabase,
  ai: Ai,
): Promise<string> {
  const recentJokes = await db
    .select()
    .from(jokes)
    .orderBy(desc(jokes.createdAt))
    .limit(5);

  const recentJokesContent = recentJokes.map((joke) => joke.content).join("
");
  const systemPrompt = `
    You are an kitschy stand-up comedian...
    Bad puns are allowed.

    Here are some recent jokes to avoid repeating:
    ${recentJokesContent}
  `;
  const userPrompt = `
    Generate me a funny joke about a goose...
    Do not repeat any of these recent jokes:
    ${recentJokesContent}
  `;

  const response: AiTextGenerationOutput = await ai.run(
    "@cf/meta/llama-3.1-8b-instruct-fast" as BaseAiTextGenerationModels,
    {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.72,
    },
  );

  let joke = "";
  if (response instanceof ReadableStream) {
    const textStream = response.pipeThrough(new TextDecoderStream());
    const text = await textStream.getReader().read();
    joke = text.value ?? "";
  } else {
    joke = response.response ?? "";
  }

  return joke;
}
```

### Tags
- AI
- Cloudflare Bindings
- Drizzle ORM
- Joke Generation