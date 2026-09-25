// Shared inline style for bordered Ace editor inputs. The border uses the
// emphasis color at low opacity so it tracks light/dark/color themes.
export function editorStyle(height) {
  return `width: 100%; height: ${height}; font-size: 1rem; border: 1px solid rgba(var(--bs-emphasis-color-rgb), 0.25); border-radius: 0.375rem; overflow: hidden`;
}
