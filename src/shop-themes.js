// Each shop's trade window has its own look (docs/DESIGN.md, 2026-11-06): its
// colours, a sign with its name, and a picture of the keeper with the tools of
// the trade. Pure data and SVG — trade.js puts it on the window.
//
//   paper / ink / accent   the window's background, text and highlight colours
//   cloak                  the keeper's hood
//   eye                    the glow of a cyborg keeper's eye (null: a human)
//   tool                   what is drawn beside them

export const THEMES = {
  forge: { paper: '#d9cbb4', ink: '#2a1d14', accent: '#a8401c', cloak: '#3d3a36', eye: '#ff3a1a', tool: 'anvil' },
  tavern: { paper: '#e6d2ae', ink: '#3a2414', accent: '#8a4a1a', cloak: '#6b3a22', eye: null, tool: 'mug' },
  bakery: { paper: '#f2e4c6', ink: '#4a3018', accent: '#c07a2a', cloak: '#e8dcc8', eye: null, tool: 'loaf' },
  books: { paper: '#d8dcc8', ink: '#1e2a22', accent: '#2f5a3c', cloak: '#3f4f5f', eye: '#5fe3ff', tool: 'book' },
  wood: { paper: '#e2d3b4', ink: '#33261a', accent: '#7a5a2a', cloak: '#6d4e3a', eye: null, tool: 'saw' },
  fish: { paper: '#d6dde0', ink: '#1c2a32', accent: '#3a6a82', cloak: '#55606a', eye: null, tool: 'fish' },
  meat: { paper: '#e4d0c4', ink: '#3a1a14', accent: '#8a2a22', cloak: '#7a2a20', eye: '#ff3a1a', tool: 'cleaver' },
  potions: { paper: '#ddd0e2', ink: '#2a1a32', accent: '#6a3a8a', cloak: '#3a2a4a', eye: null, tool: 'flask' },
  cloth: { paper: '#efdcd8', ink: '#3a2028', accent: '#a04a62', cloak: '#a04a62', eye: null, tool: 'needle' },
  tech: { paper: '#c9d0d4', ink: '#141c22', accent: '#1f8aa8', cloak: '#2c343a', eye: '#5fe3ff', tool: 'gear' },
  market: { paper: '#e8dcc0', ink: '#2a1d14', accent: '#7a5a10', cloak: '#7d97b8', eye: '#ff3a1a', tool: 'coin' },
  farm: { paper: '#ece2bc', ink: '#33301a', accent: '#6a7a2a', cloak: '#7a6a52', eye: null, tool: 'wheat' },
};

// Which look each shop (shops.js key) has.
export const THEME_OF = {
  blacksmith: 'forge', tavern: 'tavern', baker: 'bakery', librarian: 'books', carpenter: 'wood',
  fishmonger: 'fish', butcher: 'meat', apothecary: 'potions', tailor: 'cloth',
  gadgets: 'tech', bodyParts: 'tech', vehicleParts: 'tech', weapons: 'market', general: 'market', farmstore: 'farm',
};

const TOOLS = {
  anvil: '<path d="M8 20h22l-4 5h-4v5h6v3H10v-3h6v-5h-4z" fill="#2e3033"/>',
  mug: '<rect x="10" y="14" width="14" height="18" rx="2" fill="#8a5a2a"/><path d="M24 18h4a3 3 0 0 1 0 8h-4" stroke="#8a5a2a" stroke-width="3" fill="none"/><rect x="10" y="12" width="14" height="4" rx="2" fill="#f2ead8"/>',
  loaf: '<ellipse cx="20" cy="24" rx="12" ry="7" fill="#b07a3c"/><path d="M13 21l3 5M19 19l3 6M25 20l2 5" stroke="#7a4a1c" stroke-width="1.5"/>',
  book: '<rect x="9" y="13" width="20" height="16" fill="#284a2c"/><rect x="11" y="15" width="16" height="12" fill="#e6dccb"/><path d="M19 15v12" stroke="#284a2c"/>',
  saw: '<path d="M8 26l20-8 2 4-20 8z" fill="#9aa0a6"/><path d="M8 26l2 4 2-2 2 3 2-2 2 3" stroke="#555" fill="none"/><rect x="27" y="14" width="6" height="9" rx="2" fill="#6b4a2c"/>',
  fish: '<path d="M8 24c6-8 16-8 22 0-6 8-16 8-22 0z" fill="#8a9aa3"/><path d="M30 24l5-5v10z" fill="#8a9aa3"/><circle cx="13" cy="23" r="1.4" fill="#1c2a32"/>',
  cleaver: '<rect x="10" y="14" width="16" height="11" fill="#b8bcc2"/><rect x="25" y="18" width="10" height="3" fill="#5a3a22"/>',
  flask: '<path d="M17 11h6v7l6 11a3 3 0 0 1-3 4H14a3 3 0 0 1-3-4l6-11z" fill="#6a3a8a" opacity="0.85"/><rect x="16" y="9" width="8" height="3" fill="#8a6a3a"/>',
  needle: '<path d="M10 30L30 10" stroke="#9aa0a6" stroke-width="2"/><path d="M30 10c-6 2-14 6-12 12s10 4 10 10" stroke="#a04a62" stroke-width="1.5" fill="none"/>',
  gear: '<circle cx="20" cy="22" r="8" fill="none" stroke="#1f8aa8" stroke-width="5" stroke-dasharray="3 2.3"/><circle cx="20" cy="22" r="3" fill="#5fe3ff"/>',
  coin: '<circle cx="20" cy="22" r="9" fill="#c9a227"/><circle cx="20" cy="22" r="6" fill="none" stroke="#7a5a10"/>',
  wheat: '<path d="M20 34V12" stroke="#a88a3a" stroke-width="2"/><path d="M20 14l-4-3M20 14l4-3M20 19l-5-3M20 19l5-3M20 24l-5-3M20 24l5-3" stroke="#c9a54a" stroke-width="3" stroke-linecap="round"/>',
};

// A small picture of the keeper: a hooded head (a red or blue eye if they are a
// cyborg), and the tool of the trade beside them.
export function keeperSVG(theme) {
  const t = THEMES[theme] ?? THEMES.market;
  const eye = t.eye
    ? `<circle cx="30" cy="27" r="2.2" fill="${t.eye}"/><circle cx="30" cy="27" r="4" fill="${t.eye}" opacity="0.25"/>`
    : '<circle cx="30" cy="27" r="1.4" fill="#1a1410"/>';
  return `<svg viewBox="0 0 80 48" width="80" height="48" aria-hidden="true">
    <rect width="80" height="48" rx="4" fill="${t.accent}" opacity="0.18"/>
    <path d="M10 48c0-14 8-22 18-22s18 8 18 22z" fill="${t.cloak}"/>
    <path d="M16 30c0-12 6-20 12-20s12 8 12 20c-2 3-22 3-24 0z" fill="${t.cloak}"/>
    <ellipse cx="28" cy="27" rx="7" ry="8" fill="#e0b896"/>
    <path d="M28 19a7 8 0 0 1 7 8h-7z" fill="${t.eye ? '#8f969e' : '#e0b896'}"/>
    <circle cx="25" cy="27" r="1.4" fill="#1a1410"/>${eye}
    <g transform="translate(40 2)">${TOOLS[t.tool] ?? ''}</g>
  </svg>`;
}
