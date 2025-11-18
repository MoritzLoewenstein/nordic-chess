const FILES = {
  A_: 0,
  B_: 1,
  C_: 2,
  D_: 3,
  E_: 4,
  F_: 5,
  G_: 6,
  H_: 7,
  NONE: 8,
};

const RANKS = {
  _1: 0,
  _2: 1,
  _3: 2,
  _4: 3,
  _5: 4,
  _6: 5,
  _7: 6,
  _8: 7,
  NONE: 8,
};

function Square2FileRank(sq) {
  sq = Sq120ToSq64[sq];
  if (sq === 65) throw Error(`Invalid ${sq}`);
  return [sq % 8, Math.floor(sq / 8)];
}

// file & rank to 120 board index
function FileRank2Square(f, r) {
  if (f === FILES.NONE || r === RANKS.NONE) throw Error("Invalid File or Rank");
  return 21 + f + r * 10;
}

// prettier-ignore
// 120 Board for easy offboard detection
const Sq120ToSq64 = [
    65, 65, 65, 65, 65, 65, 65, 65, 65, 65,
    65, 65, 65, 65, 65, 65, 65, 65, 65, 65,
    65,  0,  1,  2,  3,  4,  5,  6,  7, 65,
    65,  8,  9, 10, 11, 12, 13, 14, 15, 65,
    65, 16, 17, 18, 19, 20, 21, 22, 23, 65,
    65, 24, 25, 26, 27, 28, 29, 30, 31, 65,
    65, 32, 33, 34, 35, 36, 37, 38, 39, 65,
    65, 40, 41, 42, 43, 44, 45, 46, 47, 65,
    65, 48, 49, 50, 51, 52, 53, 54, 55, 65,
    65, 56, 57, 58, 59, 60, 61, 62, 63, 65,
    65, 65, 65, 65, 65, 65, 65, 65, 65, 65,
    65, 65, 65, 65, 65, 65, 65, 65, 65, 65,
  ];

for (let i = 21; i < 99; i++) {
  try {
    let fr = Square2FileRank(i);
    let sq = FileRank2Square(fr[0], fr[1]);
    console.log(i, fr, sq, i === sq);
  } catch (err) {
    console.log(`${i} false`);
  }
}
