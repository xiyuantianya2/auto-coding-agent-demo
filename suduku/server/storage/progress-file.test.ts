import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createEmptyProgressPayload, type ProgressPayload } from "../progress-types";

import { getUserProgressPath } from "./paths";
import {
  ProgressFileParseError,
  readUserProgressFile,
  writeUserProgressFileAtomic,
} from "./progress-file";
import { ProgressPayloadValidationError } from "./progress-payload";

function tmpDataRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "suduku-storage-"));
}

describe("readUserProgressFile / writeUserProgressFileAtomic", () => {
  it("returns empty default on first read (missing file)", async () => {
    const root = tmpDataRoot();
    const data = await readUserProgressFile(root, "user-a");
    expect(data).toEqual(createEmptyProgressPayload());
  });

  it("first write creates users/<id>/progress.json and second read returns payload", async () => {
    const root = tmpDataRoot();
    const userId = "u1";
    const payload: ProgressPayload = {
      endless: {
        easy: { currentLevel: 2, bestTimesMs: { 0: 1200 } },
      },
      practice: {
        "mode-x": { unlocked: true, streak: 1, bestTimeMs: 900 },
      },
      tutorial: { chap1: true },
    };
    await writeUserProgressFileAtomic(root, userId, payload);
    const filePath = getUserProgressPath(root, userId);
    expect(fs.existsSync(filePath)).toBe(true);

    const roundTrip = await readUserProgressFile(root, userId);
    expect(roundTrip).toEqual(payload);
  });

  it("second write replaces file (full update)", async () => {
    const root = tmpDataRoot();
    const userId = "u2";
    const first: ProgressPayload = {
      endless: { normal: { currentLevel: 1, bestTimesMs: {} } },
      practice: {},
      tutorial: {},
    };
    const second: ProgressPayload = {
      endless: {
        normal: { currentLevel: 5, bestTimesMs: { 1: 3000, 2: 2800 } },
      },
      practice: { m1: { unlocked: false, streak: 0 } },
      tutorial: { t1: false },
    };
    await writeUserProgressFileAtomic(root, userId, first);
    await writeUserProgressFileAtomic(root, userId, second);
    await expect(readUserProgressFile(root, userId)).resolves.toEqual(second);
  });

  it("rejects invalid JSON on read with ProgressFileParseError", async () => {
    const root = tmpDataRoot();
    const userId = "bad-json";
    const filePath = getUserProgressPath(root, userId);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, "{ not json", "utf8");
    await expect(readUserProgressFile(root, userId)).rejects.toBeInstanceOf(ProgressFileParseError);
  });

  it("rejects valid JSON that fails ProgressPayload validation on read", async () => {
    const root = tmpDataRoot();
    const userId = "bad-shape";
    const filePath = getUserProgressPath(root, userId);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(
      filePath,
      JSON.stringify({ endless: {}, practice: {}, tutorial: "oops" }),
      "utf8",
    );
    await expect(readUserProgressFile(root, userId)).rejects.toBeInstanceOf(ProgressFileParseError);
  });

  it("rejects save with invalid payload", async () => {
    const root = tmpDataRoot();
    await expect(
      writeUserProgressFileAtomic(root, "u3", {
        endless: {},
        practice: {},
      } as unknown as ProgressPayload),
    ).rejects.toBeInstanceOf(ProgressPayloadValidationError);
  });

  it("rejects unsafe userId for write", async () => {
    const root = tmpDataRoot();
    await expect(
      writeUserProgressFileAtomic(root, "../escape", createEmptyProgressPayload()),
    ).rejects.toThrow();
  });
});
