import { db, schema } from "../src/db/client.js";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error(
      'Usage: npx tsx scripts/create-client.ts "Client Name" "client-slug"'
    );
    process.exit(1);
  }

  const rawName = args[0];
  const rawSlug = args[1];

  const name = rawName.trim().slice(0, 200);
  const slug = rawSlug.trim().slice(0, 60).replace(/[^a-z0-9-]/g, "").toLowerCase();

  if (!name || !slug) {
    console.error("Name and slug are required (slug: a-z, 0-9, hyphens only).");
    process.exit(1);
  }

  const readToken = uuid();
  const writeToken = uuid();

  const existing = db
    .select()
    .from(schema.clients)
    .where(eq(schema.clients.slug, slug))
    .get();

  if (existing) {
    console.error(`Client with slug "${slug}" already exists.`);
    process.exit(1);
  }

  db.insert(schema.clients)
    .values({
      id: uuid(),
      name,
      slug,
      read_token: readToken,
      write_token: writeToken,
    })
    .run();

  console.log("");
  console.log(`  Client "${name}" created.`);
  console.log("");
  console.log("  \u2500\u2500 Tokens \u2500\u2500");
  console.log(
    `  Read token  (share with client):  ${readToken}`
  );
  console.log(
    `  Write token (paste into n8n):     ${writeToken}`
  );
  console.log("");
  console.log(
    `  Status page URL:  http://your-server:3000/${slug}?token=${readToken}`
  );
  console.log("");
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
