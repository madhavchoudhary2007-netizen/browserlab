/** Label for the command modifier: the shortcuts accept Cmd or Ctrl everywhere, the hints show the one the platform uses. */
export const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";
