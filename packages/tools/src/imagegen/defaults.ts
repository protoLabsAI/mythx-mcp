/**
 * Shared defaults for image generation tools.
 * Aligned with pixelgen lab optimized settings.
 */

/** Style presets — prepended to user prompt */
export const STYLE_PRESETS: Record<string, string> = {
  "16-bit RPG": "16-bit pixel art, retro RPG style",
  "8-bit NES": "8-bit pixel art, NES retro style, limited palette, nostalgic",
  "32-bit PS1": "32-bit pixel art, PlayStation 1 era, low-poly aesthetic, detailed",
  "Game Boy": "pixel art, Game Boy green monochrome, 4-shade palette, retro handheld",
  Isometric: "isometric pixel art, detailed tileset style, clean edges, game asset",
  None: "",
};

/** Default style when none specified */
export const DEFAULT_STYLE = "16-bit RPG";

/** Resolution presets by image role */
export const RESOLUTION_PRESETS = {
  scene: { width: 1024, height: 768 },
  portrait: { width: 768, height: 768 },
  icon: { width: 768, height: 768 },
  wide: { width: 1024, height: 576 },
  square: { width: 1024, height: 1024 },
  banner: { width: 1024, height: 576 }, // same as wide — semantic alias for faction banners
} as const;

/** Resolve a style string to its prompt prefix, optionally layering a world aesthetic */
export function resolveStylePrefix(style?: string, worldAesthetic?: string): string {
  let prefix: string;
  if (!style) {
    prefix = STYLE_PRESETS[DEFAULT_STYLE];
  } else if (style in STYLE_PRESETS) {
    prefix = STYLE_PRESETS[style];
  } else {
    prefix = style;
  }

  if (worldAesthetic) {
    return prefix ? `${prefix}, ${worldAesthetic}` : worldAesthetic;
  }
  return prefix;
}
