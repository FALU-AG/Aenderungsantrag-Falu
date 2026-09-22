import { afterEach, describe, expect, it } from "vitest";
import { arrivedThroughRouter, wrongDoor } from "./edge-lock";

const lock = "b7f3a1c95e2d4086b7f3a1c95e2d4086b7f3a1c95e2d4086b7f3a1c95e2d4086";
const marked = (value: string) => new Headers({ "x-falu-edge": value });

afterEach(() => {
  delete process.env.FALU_ORIGIN_LOCK;
});

describe("Herkunftssperre", () => {
  it("lässt alles durch, solange sie nicht eingeschaltet ist", () => {
    expect(arrivedThroughRouter(new Headers())).toBe(true);
    expect(arrivedThroughRouter(marked("irgendetwas"))).toBe(true);
  });

  it("behandelt eine leere Einstellung wie keine Einstellung", () => {
    process.env.FALU_ORIGIN_LOCK = "   ";
    expect(arrivedThroughRouter(new Headers())).toBe(true);
  });

  it("lässt eingeschaltet nur die richtige Marke durch", () => {
    process.env.FALU_ORIGIN_LOCK = lock;
    expect(arrivedThroughRouter(marked(lock))).toBe(true);
  });

  it("weist eingeschaltet alles andere ab", () => {
    process.env.FALU_ORIGIN_LOCK = lock;
    for (const header of [new Headers(), marked(""), marked(lock.slice(0, -1)), marked(lock + "0"), marked(lock.replace("b", "c"))]) {
      expect(arrivedThroughRouter(header)).toBe(false);
    }
  });

  it("nennt beim Abweisen die richtige Adresse und lässt nichts zwischenspeichern", async () => {
    const response = wrongDoor();
    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toContain("admin.falu.com/aenderungsantrag");
  });
});
