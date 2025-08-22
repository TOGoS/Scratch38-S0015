import Vec2D from "./Vec2D.ts";

export function vec2dsAreEqual<T>(a:Vec2D<T>, b:Vec2D<T>) {
	return a.x == b.x && a.y == b.y;
}
