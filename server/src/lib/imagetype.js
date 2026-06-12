// minimal magic-byte sniffing for the custom logo upload ; we never trust the
// client-declared content type and we deliberately support only raster image
// formats (svg can embed scripts, so it is not allowed)

const SIGNATURES = [
  {
    mime: "image/png",
    check: (b) => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  },
  {
    mime: "image/jpeg",
    check: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
  },
  {
    mime: "image/gif",
    check: (b) => b.length >= 6 && ["GIF87a", "GIF89a"].includes(b.toString("latin1", 0, 6))
  },
  {
    mime: "image/webp",
    check: (b) => b.length >= 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP"
  }
];

// returns the sniffed mime type, or null when the buffer is not a supported image
export function sniffImageMime(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  const match = SIGNATURES.find((s) => s.check(buffer));
  return match ? match.mime : null;
}
