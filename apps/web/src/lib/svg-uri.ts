// Kept dependency-free on purpose: components that only display a stored
// avatar SVG don't need the renderer behind the editor.
export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
