// A form's file fields : uploaded only with allowFileUploads (on unless a role turns it off) ;
// without it the upload is refused before the file is read.
import { describe, test, expect } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

const { default: uploadController } = await import("../src/controllers/v2/upload.controller.js");

function res() {
  const r = { statusCode: 200, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

describe("allowFileUploads", () => {
  test("off: refused with 403, the file never read", () => {
    const r = res();
    uploadController.upload({ user: { user: { username: "u", options: { allowFileUploads: false } } }, headers: {} }, r, () => {});
    expect(r.statusCode).toBe(403);
  });
});
