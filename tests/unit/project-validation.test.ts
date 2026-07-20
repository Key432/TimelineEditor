import { describe, expect, it } from "vitest";

import {
  createProjectSchema,
  updateProjectSchema,
} from "@/features/projects/validation";

const validInput = {
  name: "日本近代文学史",
  description: "  作家と作品を整理する  ",
  template: "literature" as const,
  settings: {
    defaultUncertaintyYears: 5,
    initialStartYear: 1800,
    initialEndYear: 2026,
    initialZoomPreset: "fit-range" as const,
    timelineDensity: "comfortable" as const,
    minimumTimeUnit: "day" as const,
  },
};

describe("project validation", () => {
  it("normalizes a valid project and keeps the template selection", () => {
    const result = createProjectSchema.parse(validInput);

    expect(result.name).toBe("日本近代文学史");
    expect(result.description).toBe("作家と作品を整理する");
    expect(result.template).toBe("literature");
  });

  it("requires a non-empty project name", () => {
    const result = createProjectSchema.safeParse({
      ...validInput,
      name: "   ",
    });

    expect(result.success).toBe(false);
  });

  it("accepts the normalized null value when the description is empty", () => {
    const result = createProjectSchema.parse({
      ...validInput,
      description: null,
    });

    expect(result.description).toBeNull();
  });

  it("rejects a display range whose end precedes its start", () => {
    const result = createProjectSchema.safeParse({
      ...validInput,
      settings: {
        ...validInput.settings,
        initialStartYear: 2000,
        initialEndYear: 1900,
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual([
        "settings",
        "initialEndYear",
      ]);
    }
  });

  it("does not allow visibility or owner changes through settings updates", () => {
    const result = updateProjectSchema.parse({
      ...validInput,
      ownerId: crypto.randomUUID(),
      visibility: "public",
    });

    expect(result).not.toHaveProperty("ownerId");
    expect(result).not.toHaveProperty("visibility");
  });
});
