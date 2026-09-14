/**
 * 16x16 pixel-art sprites rendered as SVG.
 * Each sprite is 16 strings of 16 chars; chars map to the PALETTE below,
 * '.' = transparent.
 */

export const PALETTE: Record<string, string> = {
	K: '#1a1c2c', // ink outline
	T: '#333c57', // dark steel
	S: '#566c86', // steel
	D: '#94b0c2', // light steel
	W: '#ffffff',
	P: '#f4f0e1', // paper
	Y: '#ffcd75', // gold
	A: '#b8860b', // dark gold
	O: '#ef7d57', // orange
	R: '#b13e53', // red
	B: '#3b5dc9', // blue
	N: '#29366f', // navy
	C: '#41a6f6', // cyan
	G: '#38b764', // green
	E: '#257179', // teal
	M: '#d94c8e' // magenta
};

export const SPRITES: Record<string, string[]> = {
	binderclip: [
		'................',
		'....SS....SS....',
		'...S..S..S..S...',
		'...S..S..S..S...',
		'...S..SSSS..S...',
		'....SS....SS....',
		'....S......S....',
		'...KKKKKKKKKK...',
		'...KTTTTTTTTK...',
		'..KTTTTTTTTTTK..',
		'..KTTTTTTTTTTK..',
		'.KTTTTTTTTTTTTK.',
		'.KTTTTTTTTTTTTK.',
		'KTTTTTTTTTTTTTTK',
		'KKKKKKKKKKKKKKKK',
		'................'
	],
	binder: [
		'................',
		'.KKKKKKKKKKKKK..',
		'.KNNKBBBBBBBBK..',
		'.KNNKBBBBBBBBK..',
		'.KDDKBBBBBBBBK..',
		'.KNNKBWWWWWBBK..',
		'.KNNKBWWWWWBBK..',
		'.KDDKBWWWWWBBK..',
		'.KNNKBWWWWWBBK..',
		'.KNNKBBBBBBBBK..',
		'.KDDKBBBBBBBBK..',
		'.KNNKBBBBBBBBK..',
		'.KNNKBBBBBBBBK..',
		'.KKKKKKKKKKKKK..',
		'................',
		'................'
	],
	toner: [
		'................',
		'..KKKKKKKKKKKK..',
		'..KTTTTTTTTTTK..',
		'..KTTTTTTTTTTK..',
		'..KKKKKKKKKKKK..',
		'..KTTMMCCYYTTK..',
		'..KTTMMCCYYTTK..',
		'..KTTTTTTTTTTK..',
		'..KTTWWWWWTTTK..',
		'..KTTTTTTTTTTK..',
		'...KTTTTTTTTK...',
		'...KTTTTTTTTK...',
		'...KKKKKKKKKK...',
		'................',
		'................',
		'................'
	],
	ream: [
		'................',
		'................',
		'...KKKKKKKKKK...',
		'..KPPPPPPPPPPK..',
		'.KPPPPPPPPPPPPK.',
		'.KPPPPPPPPPPPPK.',
		'.KCCCCCCCCCCCCK.',
		'.KCCWWWWWWWWCCK.',
		'.KCCWWWWWWWWCCK.',
		'.KCCCCCCCCCCCCK.',
		'.KPPPPPPPPPPPPK.',
		'.KPPPPPPPPPPPPK.',
		'.KKKKKKKKKKKKKK.',
		'................',
		'................',
		'................'
	],
	paperstack: [
		'................',
		'..KKKKKKKKKKK...',
		'..KWWWWWWWWWK...',
		'..KWSSSSSSSWK...',
		'..KWWWWWWWWWK...',
		'..KWSSSSSSSWK...',
		'..KWWWWWWWWWK...',
		'..KWSSSSSSSWK...',
		'..KWWWWWWWWWK...',
		'..KWSSSSWWWWK...',
		'..KWWWWWWWWWK...',
		'..KWWWWWWWWWK...',
		'..KKKKKKKKKKK...',
		'................',
		'................',
		'................'
	],
	receipt: [
		'................',
		'...KKKKKKKKKK...',
		'...KWWWWWWWWK...',
		'...KWSSSSSSWK...',
		'...KWWWWWWWWK...',
		'...KWSSSSSSWK...',
		'...KWWWWWWWWK...',
		'...KWSSSSSSWK...',
		'...KWWWWWWWWK...',
		'...KWWGGGWWWK...',
		'...KWWWWWWWWK...',
		'...KWKWWKWWKK...',
		'...KK.KK.KK.....',
		'................',
		'................',
		'................'
	],
	invoice: [
		'................',
		'...KKKKKKKKKK...',
		'...KPPPPPPPPK...',
		'...KPSSSSSSPK...',
		'...KPPPPPPPPK...',
		'...KPSSSSSSPK...',
		'...KPPPPPPPPK...',
		'...KPPGGGPPPK...',
		'...KPPGPPPPPK...',
		'...KPPGGGPPPK...',
		'...KPPPPGPPPK...',
		'...KPPGGGPPPK...',
		'...KKKKKKKKKK...',
		'................',
		'................',
		'................'
	],
	coin: [
		'................',
		'.....KKKKKK.....',
		'....KYYYYYYK....',
		'...KYYAAAAYYK...',
		'..KYYAYYYYAYYK..',
		'..KYAYYKKYYAYK..',
		'..KYAYKYYYYAYK..',
		'..KYAYYKKYYAYK..',
		'..KYAYYYYKYAYK..',
		'..KYAYKKYYYAYK..',
		'..KYYAYKKYAYYK..',
		'...KYYAAAAYYK...',
		'....KYYYYYYK....',
		'.....KKKKKK.....',
		'................',
		'................'
	],
	chart: [
		'................',
		'.K..............',
		'.K..........KKK.',
		'.K..........KGK.',
		'.K..........KGK.',
		'.K......KKK.KGK.',
		'.K......KCK.KGK.',
		'.K..KKK.KCK.KGK.',
		'.K..KYK.KCK.KGK.',
		'.K..KYK.KCK.KGK.',
		'.K..KYK.KCK.KGK.',
		'.K..KYK.KCK.KGK.',
		'.KKKKKKKKKKKKKKK',
		'.K..............',
		'................',
		'................'
	],
	trash: [
		'................',
		'......KKKK......',
		'..KKKKSSSSKKKK..',
		'..KSSSSSSSSSSK..',
		'..KKKKKKKKKKKK..',
		'...KSSDSSDSSK...',
		'...KSDKSSKDSK...',
		'...KSDKSSKDSK...',
		'...KSDKSSKDSK...',
		'...KSDKSSKDSK...',
		'...KSDKSSKDSK...',
		'...KSSDSSDSSK...',
		'...KKKKKKKKKK...',
		'................',
		'................',
		'................'
	],
	truck: [
		'................',
		'................',
		'..KKKKKKKKK.....',
		'..KPPPPPPPKKKK..',
		'..KPPPPPPPKCCK..',
		'..KPPPPPPPKCCK..',
		'..KPPPPPPPKKKKK.',
		'..KPPPPPPPKBBBK.',
		'.KKKKKKKKKKKKKK.',
		'.KKTKKKKKKKTKKK.',
		'..KTTK...KTTK...',
		'...KK.....KK....',
		'................',
		'................',
		'................',
		'................'
	],
	store: [
		'................',
		'....KKKKKKKK....',
		'..KKRRWWRRWWKK..',
		'.KRRWWRRWWRRWWK.',
		'.KKKKKKKKKKKKKK.',
		'..KPPPPPPPPPPK..',
		'..KPPPPPPPPPPK..',
		'..KPKKKPPKKKPK..',
		'..KPKCKPPKNKPK..',
		'..KPKCKPPKNKPK..',
		'..KPKKKPPKNKPK..',
		'..KPPPPPPKKKPK..',
		'..KKKKKKKKKKKK..',
		'................',
		'................',
		'................'
	],
	box: [
		'................',
		'................',
		'..KKKKKKKKKKKK..',
		'..KOOOOKKOOOOK..',
		'..KOOOOKKOOOOK..',
		'..KKKKKKKKKKKK..',
		'..KOOOOOOOOOOK..',
		'..KOOOOOOOOOOK..',
		'..KOOKOOOOKOOK..',
		'..KOOKOOOOKOOK..',
		'..KOOOOOOOOOOK..',
		'..KOOOOOOOOOOK..',
		'..KKKKKKKKKKKK..',
		'................',
		'................',
		'................'
	]
};

export const SPRITE_NAMES = Object.keys(SPRITES);
