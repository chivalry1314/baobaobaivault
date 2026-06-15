import {
  worldBookProtocol,
  type WorldBookEntry,
  type WorldBookMetadata,
  type WorldBookScope,
  type WorldBookTriggerMode,
} from "@/components/share/card-editor/constants";

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function createEmptyWorldBookEntry(order: number): WorldBookEntry {
  return {
    id: generateId(),
    name: `条目 ${order}`,
    keywords: [],
    content: "",
    triggerMode: "keyword",
    insertionOrder: order,
    scope: "global",
  };
}

export function buildWorldBookFile(metadata: WorldBookMetadata): File {
  const payload = {
    version: metadata.version,
    protocol: worldBookProtocol,
    worldBook: metadata.worldBook.map((entry) => ({
      id: entry.id,
      name: entry.name,
      keywords: entry.keywords,
      content: entry.content,
      triggerMode: entry.triggerMode,
      insertionOrder: entry.insertionOrder,
      scope: entry.scope,
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  return new File([blob], "worldbook.json", { type: "application/json" });
}

export async function parseWorldBookFile(file: File | Blob): Promise<WorldBookMetadata | null> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as Partial<WorldBookMetadata>;
    if (!Array.isArray(parsed.worldBook)) {
      return null;
    }
    const entries: WorldBookEntry[] = parsed.worldBook
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const raw = item as Partial<WorldBookEntry>;
        return {
          id: typeof raw.id === "string" && raw.id ? raw.id : generateId(),
          name: typeof raw.name === "string" ? raw.name : "",
          keywords: Array.isArray(raw.keywords)
            ? raw.keywords.filter((k): k is string => typeof k === "string")
            : [],
          content: typeof raw.content === "string" ? raw.content : "",
          triggerMode: ["keyword", "constant", "disabled"].includes(raw.triggerMode as string)
            ? (raw.triggerMode as WorldBookTriggerMode)
            : "keyword",
          insertionOrder: typeof raw.insertionOrder === "number" ? raw.insertionOrder : 1,
          scope: ["global", "character"].includes(raw.scope as string)
            ? (raw.scope as WorldBookScope)
            : "global",
        };
      })
      .filter((item): item is WorldBookEntry => item !== null);

    return {
      version: typeof parsed.version === "number" ? parsed.version : 1,
      worldBook: entries,
    };
  } catch {
    return null;
  }
}
