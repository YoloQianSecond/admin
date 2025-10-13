import { sendMailGraph } from "../lib/mail.graph";

const to = process.argv[2];
if (!to) {
  console.error("Usage: npx tsx scripts/testGraphMail.ts you@example.com");
  process.exit(1);
}

await sendMailGraph(to, "Graph mail test ✅", "<p>If you see this, Graph send works.</p>");
console.log("Done");
