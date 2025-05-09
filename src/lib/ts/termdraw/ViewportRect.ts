// Three coordinate spaces:
// - World
// - Screen
// - View rect

export default interface ViewportRect {
  // World X/Y position corresponding to ViewRect 0,0
  worldX: number;
  worldY: number;
  // X/Y position on screen of top left of view rect (i.e. ViewRect's 0,0)
  screenX: number;
  screenY: number;
  // Width and height of the region (in any space, because scale is always 1:1)
  width: number;
  height: number;
}
