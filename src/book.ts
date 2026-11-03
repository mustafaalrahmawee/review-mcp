import { readFile } from "node:fs/promises";

const normalize = (text: string) => text.replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();

export async function readSection(bookPath: string, heading: string): Promise<string> {
  const lines = (await readFile(bookPath, "utf8")).split("\n");
  let inFence = false;
  const headings = lines.map((line) => {
    if (line.startsWith("```")) {
      inFence = !inFence;
      return null;
    }
    return inFence ? null : line.match(/^(#{1,6})\s+(.*)$/);
  });
  const wanted = normalize(heading);
  const start = headings.findIndex((match) => match !== null && normalize(match[2]) === wanted);
  if (start === -1) {
    throw new Error(`Abschnitt „${heading}“ nicht im Buch gefunden. Die Überschrift muss genau so lauten wie im Buch, etwa „The MCP Server“.`);
  }
  const level = headings[start]![1].length;
  const end = headings.findIndex((match, index) => index > start && match !== null && match[1].length <= level);
  return lines
    .slice(start, end === -1 ? undefined : end)
    .filter((line) => !line.includes("_images/") && !line.startsWith("<a id="))
    .join("\n")
    .trim();
}
