export type AiMetadataFields = {
  title: string | null;
  author: string | null;
  genre: string | null;
  total_pages: number | null;
  publication_year: number | null;
  isbn: string | null;
  description: string | null;
  tags: string[];
};

export type AiMetadataSuggestion = {
  fields: AiMetadataFields;
  confidence: "low" | "medium" | "high";
  explanation: string;
};

export type AiMetadataRequest = {
  fields: Partial<AiMetadataFields>;
  providerCandidates: Array<Record<string, unknown>>;
};

const cleanString = (value: unknown, maximum = 500) =>
  typeof value === "string" ? value.trim().slice(0, maximum) || null : null;

function cleanNumber(value: unknown, minimum: number, maximum: number) {
  return Number.isInteger(value) &&
    Number(value) >= minimum &&
    Number(value) <= maximum
    ? Number(value)
    : null;
}

function cleanStringList(value: unknown, limit = 8) {
  return Array.isArray(value)
    ? value
        .map((item) => cleanString(item, 100))
        .filter((item): item is string => Boolean(item))
        .slice(0, limit)
    : [];
}

export function prepareAiMetadataRequest(
  value: unknown,
): AiMetadataRequest | null {
  if (!value || typeof value !== "object") return null;
  const input = value as { fields?: unknown; providerCandidates?: unknown };
  if (!input.fields || typeof input.fields !== "object") return null;
  const raw = input.fields as Record<string, unknown>;
  const fields: Partial<AiMetadataFields> = {
    title: cleanString(raw.title, 300),
    author: cleanString(raw.author, 300),
    genre: cleanString(raw.genre, 150),
    total_pages: cleanNumber(raw.total_pages, 1, 100_000),
    publication_year: cleanNumber(raw.publication_year, 1, 2200),
    isbn: cleanString(raw.isbn, 32),
    description: cleanString(raw.description, 4_000),
    tags: cleanStringList(raw.tags),
  };
  if (!fields.title && !fields.author && !fields.isbn) return null;
  const providerCandidates = Array.isArray(input.providerCandidates)
    ? input.providerCandidates.slice(0, 6).flatMap((candidate) => {
        if (!candidate || typeof candidate !== "object") return [];
        const item = candidate as Record<string, unknown>;
        return [
          {
            title: cleanString(item.title, 300),
            author: cleanString(item.author, 300),
            authors: cleanStringList(item.authors, 4),
            genre: cleanString(item.genre, 150),
            genres: cleanStringList(item.genres, 6),
            publicationYear: cleanNumber(
              item.publicationYear ?? item.publication_year,
              1,
              2200,
            ),
            pageCount: cleanNumber(
              item.pageCount ?? item.total_pages,
              1,
              100_000,
            ),
            isbn: cleanString(item.isbn, 32),
            description: cleanString(item.description, 2_000),
            providers: cleanStringList(item.providers, 4),
          },
        ];
      })
    : [];
  return { fields, providerCandidates };
}

export const aiMetadataJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    fields: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: ["string", "null"] },
        author: { type: ["string", "null"] },
        genre: { type: ["string", "null"] },
        total_pages: { type: ["integer", "null"] },
        publication_year: { type: ["integer", "null"] },
        isbn: { type: ["string", "null"] },
        description: { type: ["string", "null"] },
        tags: { type: "array", items: { type: "string" }, maxItems: 8 },
      },
      required: [
        "title",
        "author",
        "genre",
        "total_pages",
        "publication_year",
        "isbn",
        "description",
        "tags",
      ],
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    explanation: { type: "string" },
  },
  required: ["fields", "confidence", "explanation"],
} as const;

export function isAiMetadataSuggestion(
  value: unknown,
): value is AiMetadataSuggestion {
  if (!value || typeof value !== "object") return false;
  const suggestion = value as Partial<AiMetadataSuggestion>;
  if (
    !suggestion.fields ||
    typeof suggestion.fields !== "object" ||
    !["low", "medium", "high"].includes(suggestion.confidence ?? "") ||
    typeof suggestion.explanation !== "string"
  )
    return false;
  const fields = suggestion.fields as Partial<AiMetadataFields>;
  const nullableStrings = [
    fields.title,
    fields.author,
    fields.genre,
    fields.isbn,
    fields.description,
  ];
  const nullableNumbers = [fields.total_pages, fields.publication_year];
  return (
    nullableStrings.every(
      (field) => field === null || typeof field === "string",
    ) &&
    nullableNumbers.every(
      (field) => field === null || Number.isInteger(field),
    ) &&
    Array.isArray(fields.tags) &&
    fields.tags.length <= 8 &&
    fields.tags.every((tag) => typeof tag === "string")
  );
}
