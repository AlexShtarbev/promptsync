import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { splitByScope } from "./elements.js";
import type { Character } from "../api/client.js";

function char(name: string, scope?: string): Character {
  return { name, slug: name.toLowerCase(), meta: scope ? { scope } : {}, sections: {}, views: [] };
}

describe("splitByScope", () => {
  test("separates global from local, and treats missing scope as local", () => {
    const chars = [char("Hale", "global"), char("Monster", "local"), char("Prop")];
    const { global, local } = splitByScope(chars);
    assert.deepEqual(global.map((c) => c.name), ["Hale"]);
    assert.deepEqual(local.map((c) => c.name).sort(), ["Monster", "Prop"]);
  });

  test("empty input yields empty groups", () => {
    const { global, local } = splitByScope([]);
    assert.deepEqual(global, []);
    assert.deepEqual(local, []);
  });
});
