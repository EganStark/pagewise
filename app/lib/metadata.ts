export type MetadataProvider =
  "open_library" | "google_books" | "wikidata" | "internet_archive";

export type MetadataCandidate = {
  id: string;
  title: string;
  authors: string[];
  publicationYear: number | null;
  pageCount: number | null;
  isbn: string | null;
  coverUrl: string | null;
  description: string | null;
  genres: string[];
  language: string | null;
  workKey: string | null;
  editionKey: string | null;
  providers: MetadataProvider[];
  score: number;
};

export type ProviderStatus = {
  provider: MetadataProvider;
  status: "connected" | "skipped" | "unavailable";
  detail?: string;
};
export type MetadataSearchResponse = {
  candidates: MetadataCandidate[];
  providers: ProviderStatus[];
};
