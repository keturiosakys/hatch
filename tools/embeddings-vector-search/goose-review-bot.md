# Application Overview
This Hono application serves as an API for managing pull requests and reviews, particularly integrating with GitHub to automate code reviews using Claude from Anthropic AI. It uses Drizzle ORM for Postgres database operations, and is designed to run on Cloudflare Workers. The app also provides CRUD operations for `pull_requests` and `reviews` tables in a database configured with Neon serverless.

# Code Snippets

## Seeding the Database
### Description
This snippet illustrates how to seed the database with initial data for `pull_requests` and `reviews` tables using Drizzle ORM and Neon with environment variables configuration.

### Required Imports
```typescript
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./src/db/schema";
```

### Code Example
```typescript
config({ path: ".dev.vars" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

const seedPullRequests = [
  {
    title: "Add new feature",
    description: "This pull request adds a new feature.",
    authorId: 1,
  },
  {
    title: "Fix bug",
    description: "This pull request fixes a bug.",
    authorId: 2,
  },
];

const seedReviews = [
  {
    pullRequestId: 1,
    reviewerId: 3,
    comments: "Looks good to me.",
    status: "approved",
  },
  {
    pullRequestId: 2,
    reviewerId: 1,
    comments: "Needs some changes.",
    status: "changes_requested",
  },
];

async function seed() {
  await db.insert(schema.pullRequests).values(seedPullRequests);
  await db.insert(schema.reviews).values(seedReviews);
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
- Database
- Seeding
- Drizzle ORM

## GitHub Webhook Handler
### Description
This snippet demonstrates handling a GitHub webhook for pull requests, integrating with both Anthropic AI for review generation and Octokit for interacting with GitHub.

### Required Imports
```typescript
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { Hono } from "hono";
import { pullRequests, reviews } from "./db/schema";
import { Octokit } from "@octokit/rest";
import { Anthropic } from "@anthropic-ai/sdk";
```

### Code Example
```typescript
type Bindings = {
  DATABASE_URL: string;
  GITHUB_TOKEN: string;
  ANTHROPIC_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.post("/api/pull-requests", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const db = drizzle(sql);

  const payload = await c.req.json();

  if (payload?.repository) {
    const newPullRequest = {
      title: payload.pull_request.title,
      description: `Branch: ${payload.pull_request.head.ref}
Commit: ${payload.pull_request.url}`,
      authorId: payload.pull_request.user.id,
      githubPrId: payload.number,
      githubRepoId: payload.repository.id,
      githubBranch: payload.pull_request.head.ref,
      githubCommitSha: payload.pull_request.head.sha,
      githubRepoFullName: payload.repository.full_name,
    };

    const insertedPullRequest = await db.insert(pullRequests).values(newPullRequest).returning();

    try {
      const octokit = new Octokit({ auth: c.env.GITHUB_TOKEN });
      const anthropic = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY, fetch: globalThis.fetch });
      const owner = payload.repository.owner.login;
      const repo = payload.repository.name;
      const pullNumber = payload.number;

      const diffContent = await getDiffContent(octokit, owner, repo, pullNumber);
      const review = await generateCodeReview(anthropic, diffContent);

      await octokit.issues.createComment({
        owner, repo, issue_number: pullNumber, body: review,
      });
    } catch (error) {
      console.error("Error posting review comment:", error);
    }

    return c.json(insertedPullRequest);
  }

  return c.json({ message: "No repository found in payload" }, 500);
});
```

### Tags
- GitHub
- Webhooks
- API
- Anthropic AI

## Drizzle ORM Schema Definition
### Description
This snippet demonstrates defining a database schema for `pull_requests` and `reviews` using Drizzle ORM.

### Required Imports
```typescript
import {
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
```

### Code Example
```typescript
export const pullRequests = pgTable("pull_requests", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  authorId: integer("author_id").notNull(),
  githubPrId: integer("github_pr_id").unique(),
  githubRepoId: integer("github_repo_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  pullRequestId: integer("pull_request_id").notNull().references(() => pullRequests.githubPrId),
  reviewerId: integer("reviewer_id").notNull(),
  comments: text("comments"),
  status: text("status").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### Tags
- Database Schema
- Drizzle ORM
- PostgreSQL