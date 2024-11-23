# Application Overview
The application provides a mechanism for seeding a PostgreSQL database using Drizzle ORM and interacting with embeddings and OpenAI for vectorization of document content. It is set up to work with Hono apps running on Cloudflare Workers, utilizing various Cloudflare bindings such as Neon for serverless databases and ai-sdk for OpenAI model integration.

# Code Snippets

## Database Connection with Neon and Drizzle ORM
### Description
This snippet demonstrates how to connect to a Neon serverless PostgreSQL database using the Drizzle ORM with Cloudflare Workers, facilitated by environment variables loaded through dotenv.

### Required Imports
```typescript
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";
```

### Code Example
```typescript
config({ path: ".dev.vars" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set - check .dev.vars file");
}

// Initializing the database connection
const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);
```

### Tags
- database
- neon

## Seeding the Database with Drizzle ORM
### Description
This code snippet walks through the process of seeding a PostgreSQL database with initial user data using the Drizzle ORM methods.

### Required Imports
```typescript
import { type NewUser, users } from "./src/db/schema";
```

### Code Example
```typescript
const seedData: NewUser[] = [
  { name: "Nikita Shamgunov", email: "nikita.shamgunov@example.com" },
  { name: "Heikki Linnakangas", email: "heikki.linnakangas@example.com" },
  { name: "Stas Kelvich", email: "stas.kelvich@example.com" },
];

async function seed() {
  await db.insert(users).values(seedData);
}

async function main() {
  try {
    await seed();
    console.log("✅ Database seeded successfully!");
  } catch (error) {
    console.error("❌ Error during seeding:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
```

### Tags
- seeding
- drizzle-orm

## Drizzle ORM Schema Definition for PostgreSQL
### Description
Defines the database schema using Drizzle ORM's Postgres-specific features, setting up document and chunk tables for storing text data and embeddings.

### Required Imports
```typescript
import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp, uuid, vector } from "drizzle-orm/pg-core";
```

### Code Example
```typescript
export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  url: text("url"),
  content: text("content"),
  hash: text("hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`now()`),
});

export const chunks = pgTable("chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .references(() => documents.id)
    .notNull(),
  chunkNumber: integer("chunk_number").notNull(),
  text: text("text").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),
  metadata: jsonb("metadata").$type<Array<string>>(),
  hash: text("hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### Tags
- schema
- drizzle-orm

## Configuring Drizzle ORM with Environment Variables
### Description
This snippet shows how to configure and export Drizzle configuration dynamically using environment variables, specific for Postgres dialect.

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
- configuration
- drizzle-orm

## Processing and Vectorizing Content for Database Storage
### Description
Illustrates how to use OpenAI through ai-sdk and embedMany for processing HTML content and creating embeddings for storage in a database with Drizzle ORM.

### Required Imports
```typescript
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { openai } from "@ai-sdk/openai";
import { embedMany, generateObject } from "ai";
import { z } from "zod";
```

### Code Example
```typescript
async function processDoc(path: string) {
  const SYSTEM_PROMPT = `...`; // System instructions for processing
  
  const content = fs.readFileSync(path, "utf-8");

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: DocumentSchema,
    system: SYSTEM_PROMPT,
    prompt: content,
  });

  const chunks = await processChunks(object.chunks);

  return {
    ...object,
    url: docsPath,
    chunks,
  };
}

async function processChunks(chunks: Array<BaseChunk>) {
  const { embeddings } = await embedMany({
    model: openai.embedding("text-embedding-3-small"),
    values: chunks.map((chunk) => chunk.content),
  });

  const result = chunks.map((chunk, index) => ({
    ...chunk,
    embedding: embeddings[index],
  }));

  return result;
}

async function saveToDatabase(doc: {
  url: string;
  title: string;
  chunks: Array<VectorizedChunk>;
}) {
  const documentHash = crypto.createHash("md5").update(doc.url).digest("hex");

  const [savedDoc] = await db
    .insert(documents)
    .values({
      title: doc.title,
      url: doc.url,
      content: doc.chunks.map((c) => c.content).join("
"),
      hash: documentHash,
    })
    .returning();

  await db.insert(chunks).values(
    doc.chunks.map((chunk, index) => ({
      documentId: savedDoc.id,
      chunkNumber: index,
      text: chunk.content,
      embedding: chunk.embedding,
      metadata: chunk.tags,
      hash: crypto.createHash("md5").update(chunk.content).digest("hex"),
    })),
  );
}
```

### Tags
- openai
- embeddings