import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ChatAttachment } from "@mimica/shared";
import { assertAttachmentRef, ImageAttachmentError } from "./imageAttachments.js";

const VALID_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeAttachment(overrides: Partial<ChatAttachment> = {}): ChatAttachment {
  return {
    id: VALID_ID,
    fileName: "test.png",
    mimeType: "image/png",
    storagePath: `${VALID_ID}.png`,
    ...overrides,
  };
}

describe("assertAttachmentRef", () => {
  it("accepts a valid attachment reference", () => {
    assert.doesNotThrow(() => assertAttachmentRef(makeAttachment()));
  });

  it("rejects non-UUID attachment ids", () => {
    assert.throws(
      () => assertAttachmentRef(makeAttachment({ id: "../../x", storagePath: "../../x.png" })),
      ImageAttachmentError,
    );
  });

  it("rejects unsupported mime types", () => {
    assert.throws(
      () =>
        assertAttachmentRef(
          makeAttachment({
            mimeType: "application/pdf",
            storagePath: `${VALID_ID}.bin`,
          }),
        ),
      ImageAttachmentError,
    );
  });

  it("rejects storagePath mismatches", () => {
    assert.throws(
      () => assertAttachmentRef(makeAttachment({ storagePath: `${VALID_ID}.jpg` })),
      ImageAttachmentError,
    );
  });
});
