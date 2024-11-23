import fs from "fs";
import { marked } from "marked";
import { OpenAI } from "openai";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { markdownChunks } from "./db/schema";
import { sql } from 'drizzle-orm';

// Initialize OpenAI API
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize PostgreSQL connection and Drizzle ORM
const pool = new Pool({
  user: "postgres.xxiswscaxmkxatwpycjg",
  host: "aws-0-us-west-1.pooler.supabase.com",
  database: "postgres",
  password: process.env.DB_PASSWORD,
  port: 5432,
});

// Enable vector extension if not already enabled
const enableVectorExtension = async () => {
  await pool.query('CREATE EXTENSION IF NOT EXISTS vector;');
};

const db = drizzle(pool);

// Helper function to chunk markdown by major sections
const chunkMarkdownBySections = (markdownContent: string): string[] => {
  const sections = markdownContent.split(/(?=^## )/m).filter(Boolean);
  return !sections[0].startsWith('## ') ? sections : sections;
};

// Process markdown file and generate embeddings for each section
const processMarkdownFile = async (filePath: string) => {
  try {
    const markdownContent = fs.readFileSync(filePath, "utf-8");
    const sections = chunkMarkdownBySections(markdownContent);
    
    console.log(`Found ${sections.length} sections to process\n`);

    for (const [index, section] of sections.entries()) {
      console.log(`\n--- Processing Section ${index + 1} ---`);
      
      const plainText = marked.parse(section, { 
        mangle: false, 
        headerIds: false,
      }).replace(/<[^>]*>/g, ' ');
      
      const embedding = await client.embeddings.create({
        model: "text-embedding-ada-002",
        input: plainText,
      });

      // Convert embedding array to a properly formatted PostgreSQL array string
      const embeddingString = `[${embedding.data[0].embedding.join(',')}]`;

      // Use a raw SQL query to insert with proper vector casting
      await pool.query(
        'INSERT INTO markdown_chunks (chunk_text, embedding) VALUES ($1, $2::vector)',
        [plainText, embeddingString]
      );

      console.log("Successfully stored in database");
    }

    console.log(`\n✅ Successfully processed all ${sections.length} sections`);
  } catch (error) {
    console.error("❌ Error processing Markdown file:", error);
    throw error;
  }
};

// Function to perform similarity search
const performSimilaritySearch = async (prompt: string, limit: number = 3) => {
  try {
    const promptEmbedding = await client.embeddings.create({
      model: "text-embedding-ada-002",
      input: prompt,
    });

    // Convert embedding array to a properly formatted PostgreSQL array string
    const embeddingString = `[${promptEmbedding.data[0].embedding.join(',')}]`;

    // Use raw query with proper vector casting
    const results = await pool.query(
      `
      SELECT 
        chunk_text,
        1 - (embedding <=> $1::vector) as similarity
      FROM markdown_chunks
      ORDER BY embedding <=> $1::vector
      LIMIT $2
      `,
      [embeddingString, limit]
    );

    return results.rows.map(row => ({
      text: row.chunk_text,
      similarity: row.similarity
    }));
  } catch (error) {
    console.error("Error performing similarity search:", error);
    throw error;
  }
};

// Example usage of similarity search
const testSimilaritySearch = async (prompt: string) => {
  console.log(`\n🔍 Searching for: "${prompt}"`);
  
  try {
    const results = await performSimilaritySearch(prompt);
    
    console.log("\nSearch Results:");
    results.forEach((result, index) => {
      // Prints a header showing the match number and similarity score (as a percentage)
      console.log(`\n--- Match ${index + 1} (Similarity: ${(result.similarity * 100).toFixed(2)}%) ---`);
      // Prints the first 200 characters of the matched text followed by "..."
      console.log(result.text.substring(0, 200) + "...");
    });
  } catch (error) {
    console.error("❌ Search failed:", error);
  }
};

// Initialize the database and run the search
(async () => {
  try {
    // Enable vector extension first
    await enableVectorExtension();
    
    // Test the search
    await testSimilaritySearch("Write me an api for a hot or not polling api");
  } catch (error) {
    console.error("Error initializing or running search:", error);
  } finally {
    await pool.end();
  }
})();