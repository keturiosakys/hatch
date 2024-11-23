import { instrument } from "@fiberplane/hono-otel";
import { drizzle } from "drizzle-orm/postgres-js";
import { Hono } from "hono";
import postgres from "postgres";
import { NewPrompt, prompts } from "./db/schema"

import { eq } from 'drizzle-orm';

type Bindings = {
  DATABASE_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
  return c.text("Supa Honc! 📯🪿📯🪿📯🪿📯");
});


//TODO take the prompt and vectorize it
//TODO do cosine similarity search on the vector database
//TODO return the most similar template/markdown snippet
//TODO create a hatch project with the prompt
//TODO also return a hatch project id
app.post("/api/prompts", async (c) => {
  const sql = postgres(c.env.DATABASE_URL);
  const db = drizzle(sql);
  
  const body = await c.req.json();
  const prompt = body.prompt;

  if (!prompt || typeof prompt !== "string") {
    return c.json({ error: "Invalid prompt" }, 400);
  }

  const [newPrompt] = await db
    .insert(prompts)
    .values({ prompt })
    .returning();

  return c.json(newPrompt);
});

app.get("/api/prompts/:id", async (c) => {
  const sql = postgres(c.env.DATABASE_URL);
  const db = drizzle(sql);
  
  const id = Number(c.req.param("id"));
  if (isNaN(id)) {
    return c.json({ error: "Invalid ID" }, 400);
  }

  const prompt = await db
    .select()
    .from(prompts)
    .where(eq(prompts.id, id))
    .limit(1);

  if (!prompt.length) {
    return c.json({ error: "Prompt not found" }, 404);
  }

  return c.json(prompt[0]);
});

app.put("/api/prompts/:id", async (c) => {
  const sql = postgres(c.env.DATABASE_URL);
  const db = drizzle(sql);
  
  const id = Number(c.req.param("id"));
  if (isNaN(id)) {
    return c.json({ error: "Invalid ID" }, 400);
  }

  const body = await c.req.json();
  const promptText = body.prompt;

  if (!promptText || typeof promptText !== "string") {
    return c.json({ error: "Invalid prompt" }, 400);
  }

  const [updatedPrompt] = await db
    .update(prompts)
    .set({ prompt: promptText })
    .where(eq(prompts.id, id))
    .returning();

  if (!updatedPrompt) {
    return c.json({ error: "Prompt not found" }, 404);
  }

  return c.json(updatedPrompt);
});

app.delete("/api/prompts/:id", async (c) => {
  const sql = postgres(c.env.DATABASE_URL);
  const db = drizzle(sql);
  
  const id = Number(c.req.param("id"));
  if (isNaN(id)) {
    return c.json({ error: "Invalid ID" }, 400);
  }

  const [deletedPrompt] = await db
    .delete(prompts)
    .where(eq(prompts.id, id))
    .returning();

  if (!deletedPrompt) {
    return c.json({ error: "Prompt not found" }, 404);
  }

  return c.json({ message: "Prompt deleted successfully" });
});

app.get("/api/prompts", async (c) => {
  const sql = postgres(c.env.DATABASE_URL);
  const db = drizzle(sql);

  return c.json({
    prompts: await db.select().from(prompts),
  });
});

export default instrument(app);
