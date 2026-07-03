import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDbGet, mockDbSelect, mockDbInsert, mockOnConflictDoUpdate, mockRun } = vi.hoisted(
  () => {
    const mockDatabaseGet = vi.fn();
    const mockDatabaseSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ get: mockDatabaseGet }),
      }),
    });
    const mockDatabaseRun = vi.fn();
    const mockOnConflict = vi.fn().mockReturnValue({ run: mockDatabaseRun });
    const mockDatabaseInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflict }),
    });
    return {
      mockDbGet: mockDatabaseGet,
      mockDbSelect: mockDatabaseSelect,
      mockDbInsert: mockDatabaseInsert,
      mockOnConflictDoUpdate: mockOnConflict,
      mockRun: mockDatabaseRun,
    };
  },
);

vi.mock("../../db/db.js", () => ({ db: { select: mockDbSelect, insert: mockDbInsert } }));
vi.mock("../../shared/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const envMock = vi.hoisted(() => ({ TAVILY_API_KEY: "test-key" as string | undefined }));
vi.mock("../../shared/env.js", () => ({ env: envMock }));

import { searchWeb } from "./webSearch.tools.js";

describe("searchWeb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.TAVILY_API_KEY = "test-key";
    mockDbGet.mockReturnValue(undefined);
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns cached content and skips fetch on a cache hit", async () => {
    mockDbGet.mockReturnValue({ content: "cached result text" });

    const result = await searchWeb("RELIANCE", "Reliance news");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("cached result text");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns a graceful message and skips fetch when TAVILY_API_KEY is unset", async () => {
    envMock.TAVILY_API_KEY = undefined;

    const result = await searchWeb("RELIANCE", "Reliance news");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toContain("not configured");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches, parses, formats, and caches results on a cache miss", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        query: "Reliance news",
        answer: null,
        results: [
          { url: "https://example.com/a", title: "Article A", content: "Summary A", score: 0.9 },
        ],
      }),
    });

    const result = await searchWeb("RELIANCE", "Reliance news");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("Article A");
      expect(result.value).toContain("https://example.com/a");
      expect(result.value).toContain("Summary A");
    }
    expect(mockDbInsert).toHaveBeenCalledOnce();
    expect(mockOnConflictDoUpdate).toHaveBeenCalledOnce();
    expect(mockRun).toHaveBeenCalledOnce();
  });

  it("returns a Result error when the Tavily request fails", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      statusText: "Unauthorized",
    });

    const result = await searchWeb("RELIANCE", "Reliance news");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("Unauthorized");
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it("returns a Result error when the Tavily response fails schema validation", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ unexpected: "shape" }),
    });

    const result = await searchWeb("RELIANCE", "Reliance news");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("parse error");
  });

  it("returns a Result error when fetch throws", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network down"));

    const result = await searchWeb("RELIANCE", "Reliance news");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("network down");
  });

  it("returns a 'no results' message when Tavily returns an empty results array", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ query: "obscure query", answer: null, results: [] }),
    });

    const result = await searchWeb("OBSCURE", "obscure query");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toContain("No web search results found");
  });
});
