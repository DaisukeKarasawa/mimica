import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseEnvBool } from "./envBool.js";

describe("parseEnvBool", () => {
  it("parses truthy and falsy env strings", () => {
    assert.equal(parseEnvBool("1"), true);
    assert.equal(parseEnvBool("true"), true);
    assert.equal(parseEnvBool("0"), false);
    assert.equal(parseEnvBool("off"), false);
    assert.equal(parseEnvBool(undefined), undefined);
    assert.equal(parseEnvBool(""), undefined);
    assert.equal(parseEnvBool("maybe"), undefined);
  });
});
