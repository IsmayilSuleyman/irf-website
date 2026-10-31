import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/nextPath";

describe("safeNextPath", () => {
  it("keeps a same-origin path, query included", () => {
    expect(safeNextPath("/bank")).toBe("/bank");
    expect(safeNextPath("/market?tab=orders")).toBe("/market?tab=orders");
  });

  it("falls back to /portal for anything that could leave the site", () => {
    expect(safeNextPath(null)).toBe("/portal");
    expect(safeNextPath(undefined)).toBe("/portal");
    expect(safeNextPath("")).toBe("/portal");
    expect(safeNextPath("https://evil.example")).toBe("/portal");
    expect(safeNextPath("//evil.example/x")).toBe("/portal");
    expect(safeNextPath("/\\evil.example")).toBe("/portal");
    expect(safeNextPath("bank")).toBe("/portal");
  });
});
