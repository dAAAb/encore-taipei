/**
 * Short links (/3d/) and retired channel numbers (/2037/) that open a channel. Keyed by the channel's id,
 * so they follow it when an admin renumbers it; a live channel on a number always wins over a retired one.
 */
export const CHANNEL_ALIASES: Record<string, string> = {
  // 台北安可 3D · 即時 3D 重建 (was channel 2037, renumbered to 2077 on 2026-10-28)
  '3d': '4fca3513-a047-41f0-b4d5-1b2cd4567962',
  '2037': '4fca3513-a047-41f0-b4d5-1b2cd4567962',
}
