import { pgTable, serial, text, vector, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export type NewPrompt = typeof prompts.$inferInsert;


// Define the incoming prompt to create a hatch project from
export const prompts = pgTable("prompts", {
  id: serial("id").primaryKey(),
  prompt: text("prompt").notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

export const hatchProjects = pgTable("hatch_projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  promptId: serial("prompt_id").references(() => prompts.id),
});

export const hatchProjectsRelations = relations(hatchProjects, ({ one }) => ({
  prompt: one(prompts, {
    fields: [hatchProjects.promptId],
    references: [prompts.id],
  }),
}));


