// Box char props
const BDC_PROP_SHIFT  = 4;

export const BDC_PROP_MASK   = (1<<BDC_PROP_SHIFT)-1;
export const BDC_PROP_SHIFTS = {
	UP    : BDC_PROP_SHIFT*0,
	LEFT  : BDC_PROP_SHIFT*1,
	DOWN  : BDC_PROP_SHIFT*2,
	RIGHT : BDC_PROP_SHIFT*3,
};
export const BDC_PROP_VALUES = {
	NONE   : 0,
	LIGHT  : 1,
	DOUBLE : 2,
	HEAVY  : 3,
	LIGHT_DOTTED : 4,
	LIGHT_DASHED : 5,
	HEAVY_DOTTED : 6,
	HEAVY_DASHED : 7,
};

const { UP, LEFT, DOWN, RIGHT } = BDC_PROP_SHIFTS;
const { NONE, LIGHT,  DOUBLE, HEAVY, LIGHT_DOTTED, LIGHT_DASHED } = BDC_PROP_VALUES;

export const BOX_DRAWING_CHAR_PROPS : {[char:string]: number} = {
	" ": 0,
	"─": (LIGHT << LEFT) | (LIGHT << RIGHT),
	"━": (HEAVY << LEFT) | (HEAVY << RIGHT),
	"│": (LIGHT << UP  ) | (LIGHT << DOWN ),
	"┃": (HEAVY << UP  ) | (HEAVY << DOWN ),
	"┄": (LIGHT_DOTTED << LEFT) | (LIGHT_DOTTED << RIGHT),
	// yaddah yaddah yaddah
	"└": (LIGHT << UP  ) | (LIGHT << RIGHT),
	// ...
	"┘": (LIGHT << UP  ) | (LIGHT << LEFT),
	// ...
	"┌": (LIGHT << DOWN) | (LIGHT << RIGHT),
	"┍": (LIGHT << DOWN) | (HEAVY << RIGHT),
	// ...
	"┐": (LIGHT << DOWN) | (LIGHT << LEFT),
	// ...
	"├": (LIGHT << UP) | (LIGHT << DOWN) | (LIGHT << RIGHT),
	"┤": (LIGHT << UP) | (LIGHT << DOWN) | (LIGHT << LEFT),
	"┬": (LIGHT << LEFT) | (LIGHT << RIGHT) | (LIGHT << DOWN),
	"┴": (LIGHT << LEFT) | (LIGHT << RIGHT) | (LIGHT << UP),
	"┼": (LIGHT << UP) | (LIGHT << DOWN) | (LIGHT << LEFT) | (LIGHT << RIGHT),
	//
	"╔": (DOUBLE << DOWN) | (DOUBLE << RIGHT),
	"╗": (DOUBLE << DOWN) | (DOUBLE << LEFT),
	"╚": (DOUBLE << UP) | (DOUBLE << RIGHT),
	"╝": (DOUBLE << UP) | (DOUBLE << LEFT),
	"╠": (DOUBLE << UP) | (DOUBLE << DOWN) | (DOUBLE << RIGHT),
	"╣": (DOUBLE << UP) | (DOUBLE << DOWN) | (DOUBLE << LEFT),
	"╦": (DOUBLE << DOWN) | (DOUBLE << LEFT) | (DOUBLE << RIGHT),
	"╩": (DOUBLE << UP) | (DOUBLE << LEFT) | (DOUBLE << RIGHT),
	"╬": (DOUBLE << UP) | (DOUBLE << DOWN) | (DOUBLE << LEFT) | (DOUBLE << RIGHT),
	//
	"╴": (LIGHT << LEFT),
	"╵": (LIGHT << UP),
	"╶": (LIGHT << RIGHT),
	"╷": (LIGHT << DOWN),
	// TODO: All the rest of them lmao.
};
