import { NextRequest, NextResponse } from "next/server";
import type {
  MetadataCandidate,
  MetadataProvider,
  MetadataSearchResponse,
  ProviderStatus,
} from "../../../lib/metadata";

const headers = {
  "User-Agent": "Pagewise/0.1 (private reading library)",
  Accept: "application/json",
};
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 60;
const requestWindows = new Map<string, { startedAt: number; count: number }>();

function allowRequest(request: NextRequest) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const key = request.headers.get("cf-connecting-ip") || forwarded || "local";
  const now = Date.now();
  const current = requestWindows.get(key);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    if (requestWindows.size > 2_000) requestWindows.clear();
    requestWindows.set(key, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= RATE_LIMIT;
}

const safeSearchParam = (value: string | null, limit: number) =>
  (value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, limit);
const clean = (value: string | null | undefined) =>
  value
    ?.trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim() ?? "";
const firstYear = (value?: string) => {
  const year = value?.match(/\b(\d{4})\b/)?.[1];
  return year ? Number(year) : null;
};

type SearchMode = "all" | "title" | "author" | "isbn";
type SearchSignals = {
  title: string;
  author: string;
  isbn: string | null;
  year: number | null;
  genre: string;
  mode: SearchMode;
};

function score(candidate: MetadataCandidate, signals: SearchSignals) {
  const { title: query, author, isbn, year, genre } = signals;
  if (isbn && candidate.isbn?.replace(/[^0-9X]/gi, "") === isbn) return 100;
  const normalizedQuery = clean(query);
  const title = clean(candidate.title);
  let value =
    signals.mode === "author"
      ? 20
      : title === normalizedQuery
        ? 62
        : normalizedQuery.includes(title) || title.includes(normalizedQuery)
          ? 48
          : 24;
  const normalizedAuthor = clean(author);
  if (
    normalizedAuthor &&
    candidate.authors.some(
      (item) =>
        clean(item).includes(normalizedAuthor) ||
        normalizedAuthor.includes(clean(item)),
    )
  )
    value += 22;
  if (year && candidate.publicationYear)
    value +=
      candidate.publicationYear === year
        ? 12
        : Math.abs(candidate.publicationYear - year) <= 2
          ? 5
          : -4;
  const normalizedGenre = clean(genre);
  if (
    normalizedGenre &&
    candidate.genres.some(
      (item) =>
        clean(item).includes(normalizedGenre) ||
        normalizedGenre.includes(clean(item)),
    )
  )
    value += 10;
  if (candidate.coverUrl) value += 4;
  if (candidate.pageCount) value += 3;
  return value;
}

async function openLibrary(
  signals: SearchSignals,
  language: string,
  limit: number,
): Promise<MetadataCandidate[]> {
  const params = new URLSearchParams({
    lang: language,
    limit: String(limit),
    fields:
      "key,title,author_name,first_publish_year,cover_i,number_of_pages_median,isbn,edition_key,language,subject",
  });
  if (signals.isbn) params.set("isbn", signals.isbn);
  else if (signals.mode === "all") params.set("q", signals.title);
  else {
    if (signals.title) params.set("title", signals.title);
    if (signals.author) params.set("author", signals.author);
  }
  const response = await fetch(
    `https://openlibrary.org/search.json?${params}`,
    { headers, signal: AbortSignal.timeout(8000) },
  );
  if (!response.ok) throw new Error("Open Library unavailable");
  const payload = (await response.json()) as {
    docs?: Array<Record<string, unknown>>;
  };
  return (payload.docs ?? []).flatMap((row) =>
    typeof row.title === "string"
      ? [
          {
            id: `ol:${String(row.key ?? row.title)}`,
            title: row.title,
            authors: Array.isArray(row.author_name)
              ? row.author_name.filter(
                  (item): item is string => typeof item === "string",
                )
              : [],
            publicationYear:
              typeof row.first_publish_year === "number"
                ? row.first_publish_year
                : null,
            pageCount:
              typeof row.number_of_pages_median === "number"
                ? row.number_of_pages_median
                : null,
            isbn:
              Array.isArray(row.isbn) && typeof row.isbn[0] === "string"
                ? row.isbn[0]
                : null,
            coverUrl:
              typeof row.cover_i === "number"
                ? `https://covers.openlibrary.org/b/id/${row.cover_i}-L.jpg`
                : null,
            description: null,
            genres: Array.isArray(row.subject)
              ? row.subject
                  .filter((item): item is string => typeof item === "string")
                  .slice(0, 6)
              : [],
            language:
              Array.isArray(row.language) && typeof row.language[0] === "string"
                ? row.language[0]
                : null,
            workKey: typeof row.key === "string" ? row.key : null,
            editionKey:
              Array.isArray(row.edition_key) &&
              typeof row.edition_key[0] === "string"
                ? row.edition_key[0]
                : null,
            providers: ["open_library" as const],
            score: 0,
          },
        ]
      : [],
  );
}

async function googleBooks(
  signals: SearchSignals,
  language: string,
  limit: number,
): Promise<MetadataCandidate[]> {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (!key) return [];
  const request = async (langRestrict?: string) => {
    const terms = signals.isbn
      ? [`isbn:${signals.isbn}`]
      : signals.mode === "all"
        ? [signals.title]
        : [
            signals.title ? `intitle:${signals.title}` : "",
            signals.author ? `inauthor:${signals.author}` : "",
            signals.genre ? `subject:${signals.genre}` : "",
          ].filter(Boolean);
    const params = new URLSearchParams({
      q: terms.join(" "),
      maxResults: String(limit),
      printType: "books",
      projection: "full",
      key,
    });
    if (langRestrict) params.set("langRestrict", langRestrict);
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?${params}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!response.ok) throw new Error("Google Books unavailable");
    return response.json() as Promise<{
      items?: Array<{ id: string; volumeInfo?: Record<string, unknown> }>;
    }>;
  };
  const payloads = await Promise.all(
    language === "bn" ? [request("bn"), request()] : [request()],
  );
  const unique = new Map(
    payloads
      .flatMap((payload) => payload.items ?? [])
      .map((item) => [item.id, item]),
  );
  return [...unique.values()].flatMap(({ id, volumeInfo: info }) =>
    info && typeof info.title === "string"
      ? [
          {
            id: `gb:${id}`,
            title: info.title,
            authors: Array.isArray(info.authors)
              ? info.authors.filter(
                  (item): item is string => typeof item === "string",
                )
              : [],
            publicationYear:
              typeof info.publishedDate === "string"
                ? firstYear(info.publishedDate)
                : null,
            pageCount:
              typeof info.pageCount === "number" ? info.pageCount : null,
            isbn: Array.isArray(info.industryIdentifiers)
              ? ((
                  info.industryIdentifiers as Array<{ identifier?: string }>
                ).find((item) => item.identifier)?.identifier ?? null)
              : null,
            coverUrl:
              typeof info.imageLinks === "object" && info.imageLinks
                ? String(
                    (info.imageLinks as Record<string, unknown>).thumbnail ??
                      "",
                  ).replace("http://", "https://") || null
                : null,
            description:
              typeof info.description === "string" ? info.description : null,
            genres: Array.isArray(info.categories)
              ? info.categories.filter(
                  (item): item is string => typeof item === "string",
                )
              : [],
            language: typeof info.language === "string" ? info.language : null,
            workKey: null,
            editionKey: id,
            providers: ["google_books" as const],
            score: 0,
          },
        ]
      : [],
  );
}

async function wikidata(
  query: string,
  language: string,
  limit: number,
): Promise<MetadataCandidate[]> {
  const params = new URLSearchParams({
    action: "wbsearchentities",
    search: query,
    language,
    uselang: language,
    type: "item",
    limit: String(Math.min(limit, 50)),
    format: "json",
    origin: "*",
  });
  const response = await fetch(`https://www.wikidata.org/w/api.php?${params}`, {
    headers,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Wikidata unavailable");
  const payload = (await response.json()) as {
    search?: Array<{ id: string; label?: string; description?: string }>;
  };
  return (payload.search ?? []).flatMap((item) =>
    item.label &&
    /book|novel|poem|উপন্যাস|বই|কাব্য/i.test(item.description ?? "")
      ? [
          {
            id: `wd:${item.id}`,
            title: item.label,
            authors: [],
            publicationYear: null,
            pageCount: null,
            isbn: null,
            coverUrl: null,
            description: item.description ?? null,
            genres: [],
            language,
            workKey: item.id,
            editionKey: null,
            providers: ["wikidata" as const],
            score: 0,
          },
        ]
      : [],
  );
}

async function internetArchive(
  query: string,
  language: string,
  limit: number,
): Promise<MetadataCandidate[]> {
  const search = `title:("${query.replace(/["()]/g, " ")}") AND mediatype:texts`;
  const params = new URLSearchParams({
    q: search,
    output: "json",
    rows: String(limit),
    "fl[]": ["identifier", "title", "creator", "date", "language"].join(","),
  });
  const response = await fetch(
    `https://archive.org/advancedsearch.php?${params}`,
    { headers, signal: AbortSignal.timeout(1600) },
  );
  if (!response.ok) throw new Error("Internet Archive unavailable");
  const payload = (await response.json()) as {
    response?: { docs?: Array<Record<string, unknown>> };
  };
  return (payload.response?.docs ?? []).flatMap((row) =>
    typeof row.title === "string" && typeof row.identifier === "string"
      ? [
          {
            id: `ia:${row.identifier}`,
            title: row.title,
            authors:
              typeof row.creator === "string"
                ? [row.creator]
                : Array.isArray(row.creator)
                  ? row.creator.filter(
                      (item): item is string => typeof item === "string",
                    )
                  : [],
            publicationYear:
              typeof row.date === "string" ? firstYear(row.date) : null,
            pageCount: null,
            isbn: null,
            coverUrl: `https://archive.org/services/img/${row.identifier}`,
            description: "Digitized edition indexed by Internet Archive",
            genres: [],
            language:
              typeof row.language === "string" ? row.language : language,
            workKey: row.identifier,
            editionKey: null,
            providers: ["internet_archive" as const],
            score: 0,
          },
        ]
      : [],
  );
}

export async function GET(request: NextRequest) {
  if (!allowRequest(request))
    return NextResponse.json(
      { error: "Too many metadata searches. Please wait a minute." },
      {
        status: 429,
        headers: { "Retry-After": "60", "Cache-Control": "no-store" },
      },
    );
  const query = safeSearchParam(request.nextUrl.searchParams.get("q"), 200);
  const author = safeSearchParam(
    request.nextUrl.searchParams.get("author"),
    120,
  );
  const genre = safeSearchParam(request.nextUrl.searchParams.get("genre"), 80);
  const yearValue = Number(request.nextUrl.searchParams.get("year"));
  const requestedYear =
    Number.isInteger(yearValue) &&
    yearValue >= 1000 &&
    yearValue <= new Date().getFullYear() + 2
      ? yearValue
      : null;
  const requestedMode = request.nextUrl.searchParams.get("type");
  const mode: SearchMode =
    requestedMode === "title" ||
    requestedMode === "author" ||
    requestedMode === "isbn"
      ? requestedMode
      : "all";
  const limit = Math.min(
    40,
    Math.max(5, Number(request.nextUrl.searchParams.get("limit")) || 8),
  );
  if (!query)
    return NextResponse.json(
      { error: "A search query is required." },
      { status: 400 },
    );
  const language = /[\u0980-\u09ff]/.test(`${query} ${author}`) ? "bn" : "en";
  const looksLikeIsbn = /^(?:97[89][\s-]?)?[0-9X][0-9X\s-]{8,16}$/i.test(query);
  const isbn =
    (
      request.nextUrl.searchParams.get("isbn") ??
      /^isbn:(.+)$/i.exec(query)?.[1] ??
      (mode === "isbn" || looksLikeIsbn ? query : "")
    ).replace(/[^0-9X]/gi, "") || null;
  const title =
    mode === "author" ? "" : query.replace(/^isbn:.+$/i, "").trim() || query;
  const signals = {
    title,
    author: mode === "author" ? query : author,
    isbn,
    year: requestedYear,
    genre,
    mode,
  };
  const providers: Array<
    [MetadataProvider, () => Promise<MetadataCandidate[]>]
  > = [
    ["open_library", () => openLibrary(signals, language, limit)],
    ["google_books", () => googleBooks(signals, language, limit)],
    [
      "wikidata",
      () => (title ? wikidata(title, language, limit) : Promise.resolve([])),
    ],
    [
      "internet_archive",
      () =>
        title ? internetArchive(title, language, limit) : Promise.resolve([]),
    ],
  ];
  const settled = await Promise.all(
    providers.map(async ([provider, run]) => {
      try {
        const rows = await run();
        const skipped =
          provider === "google_books" && !process.env.GOOGLE_BOOKS_API_KEY;
        return {
          provider,
          rows,
          status: {
            provider,
            status: skipped ? "skipped" : "connected",
            detail: skipped ? "API key not configured" : undefined,
          } as ProviderStatus,
        };
      } catch {
        return {
          provider,
          rows: [],
          status: { provider, status: "unavailable" } as ProviderStatus,
        };
      }
    }),
  );
  const merged = new Map<string, MetadataCandidate>();
  settled
    .flatMap((result) => result.rows)
    .forEach((candidate) => {
      candidate.score = score(candidate, signals);
      const key = candidate.isbn
        ? `isbn:${candidate.isbn.replace(/[^0-9X]/gi, "")}`
        : `${clean(candidate.title)}:${clean(candidate.authors[0])}`;
      const existing = merged.get(key);
      if (!existing) merged.set(key, candidate);
      else
        merged.set(key, {
          ...existing,
          publicationYear:
            existing.publicationYear ?? candidate.publicationYear,
          pageCount: existing.pageCount ?? candidate.pageCount,
          coverUrl: existing.coverUrl ?? candidate.coverUrl,
          description: existing.description ?? candidate.description,
          isbn: existing.isbn ?? candidate.isbn,
          genres: [...new Set([...existing.genres, ...candidate.genres])],
          language: existing.language ?? candidate.language,
          providers: [
            ...new Set([...existing.providers, ...candidate.providers]),
          ],
          score: Math.max(existing.score, candidate.score) + 3,
        });
    });
  const body: MetadataSearchResponse = {
    candidates: [...merged.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit),
    providers: settled.map((result) => result.status),
  };
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
