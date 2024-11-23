import { pgTable, serial, text, vector } from "drizzle-orm/pg-core";

// Define the markdown_chunks table schema
export const markdownChunks = pgTable("markdown_chunks", {
  id: serial("id").primaryKey(),
  chunkText: text("chunk_text").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(), // Adjust dimensions based on your model
});