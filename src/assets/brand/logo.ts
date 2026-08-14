// The MADERABLE wordmark: "MADERA" in the body colour, "BLE" in the brand coral, with the tagline
// underneath — the horizontal half of the official lockup, which is what a 48px-tall sidebar header
// can actually show. The isotype that sits above it on the letterhead lives in `sygnet.ts`.
//
// "MADERA" stays `currentColor` so the same file serves the dark sidebar and the light login page,
// and the tagline is the same colour dimmed rather than the letterhead's TEXT_GREY — a fixed grey
// reads on white but disappears against the dark sidebar. The coral is #E8564B, the exact
// BRAND_CORAL the backend samples for the proforma; it is also a CSS token (`--brand-coral`), but an
// icon definition is inlined into an <svg> outside any stylesheet, so the literal is needed here.
export const logo = [
  '380 110',
  `<text font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-weight="900" font-size="60" x="190" y="56" text-anchor="middle"><tspan fill="currentColor">MADERA</tspan><tspan fill="#E8564B">BLE</tspan></text><text font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-weight="400" font-size="36" x="190" y="100" text-anchor="middle" fill="currentColor" opacity="0.65">tableros + accesorios</text>`,
]
