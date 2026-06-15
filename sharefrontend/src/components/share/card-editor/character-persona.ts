import {
  characterPersonaProtocol,
  type CharacterPersonaContact,
  type CharacterPersonaMetadata,
} from "@/components/share/card-editor/constants";

export function createEmptyCharacterPersonaContact(): CharacterPersonaContact {
  return {
    name: "",
    phone: "",
    avatar: "",
    description: "",
    greeting: "",
    note: "",
  };
}

export function buildCharacterPersonaFile(metadata: CharacterPersonaMetadata): File {
  const payload = {
    version: metadata.version,
    protocol: characterPersonaProtocol,
    contacts: metadata.contacts.map((contact) => ({
      name: contact.name,
      phone: contact.phone,
      avatar: contact.avatar,
      description: contact.description,
      greeting: contact.greeting,
      note: contact.note,
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  return new File([blob], "character-persona.json", { type: "application/json" });
}

export async function parseCharacterPersonaFile(
  file: File | Blob,
): Promise<CharacterPersonaMetadata | null> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as Partial<CharacterPersonaMetadata>;
    if (!Array.isArray(parsed.contacts)) {
      return null;
    }

    const contacts: CharacterPersonaContact[] = parsed.contacts
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const raw = item as Partial<CharacterPersonaContact>;
        return {
          name: typeof raw.name === "string" ? raw.name : "",
          phone: typeof raw.phone === "string" ? raw.phone : "",
          avatar: typeof raw.avatar === "string" ? raw.avatar : "",
          description: typeof raw.description === "string" ? raw.description : "",
          greeting: typeof raw.greeting === "string" ? raw.greeting : "",
          note: typeof raw.note === "string" ? raw.note : "",
        };
      })
      .filter((item): item is CharacterPersonaContact => item !== null);

    return {
      version: typeof parsed.version === "number" ? parsed.version : 1,
      contacts,
    };
  } catch {
    return null;
  }
}
