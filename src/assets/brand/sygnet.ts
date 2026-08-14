// The MADERABLE isotype: three nested boards, each drawn as an outline with an extruded right edge
// that gives the stack its depth, all anchored to a shared bottom edge with a rounded bottom-left
// corner. It replaces the placeholder "M" and is what the narrow sidebar and the favicon show.
//
// This is a vector reconstruction of the official mark: the backend only keeps it rasterised
// (`opticutter-api/src/modules/optimizations/assets/header.jpg`, opaque white JPEG) and serves no
// static files, so there is nothing to fetch. Proportions follow the letterhead — face widths in a
// 1 : 0.76 : 0.56 ratio, tops stepping down, right edges stepping in — with the extrusions widened
// slightly so they still read at 32px. Swap this file if the original SVG ever turns up.
//
// Strokes and fills are `currentColor` on purpose: the sidebar renders it white on dark, the login
// dark on white, from the same source.
export const sygnet = [
  '72 72',
  `<g fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round">
    <path d="M5,5 H57 V67 H17 A12,12 0 0 1 5,55 Z"/>
    <path d="M6,17 H46 V67 H15 A9,9 0 0 1 6,58 Z"/>
    <path d="M7,29 H35 V67 H13 A6,6 0 0 1 7,61 Z"/>
  </g>
  <g fill="currentColor">
    <path d="M57,5 L62,10 V67 H57 Z"/>
    <path d="M46,17 L51,22 V67 H46 Z"/>
    <path d="M35,29 L40,34 V67 H35 Z"/>
  </g>`,
]
