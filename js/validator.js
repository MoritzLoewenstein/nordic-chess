import { VARIANTS } from "./constants.js";

export function isValidSquareString(field) {
  return !!field.match(/^[a-h][1-8]$/);
}

export function isValidPieceString(figure, white) {
  if (white === undefined) return !!figure.match(/^[rnbqkpRNBQKP]$/);
  return white ? !!figure.match(/^[RNBQKP]$/) : !!figure.match(/^[rnbqkp]$/);
}

// https://regex101.com/r/ykc7s9/9
// https://chess.stackexchange.com/questions/1482/how-to-know-when-a-fen-position-is-legal
export function isValidFen(fen, variant = VARIANTS.UNKNOWN) {
  if (typeof fen !== "string")
    throw new ValidationError("FEN must be a string");

  fen = fen.trim();

  // rough regex check
  if (
    !fen.match(
      /^([rnbqkpRNBQKP1-8]+\/){7}([rnbqkpRNBQKP1-8]+) [bw] (-|KQ?k?q?|K?Qk?q?|K?Q?kq?|K?Q?k?q) (-|[a-h][36]) \d+ \d+$/
    )
  )
    throw new ValidationError("FEN did not pass RegEx");

  //** general format **//

  // split fen fields
  const fields = fen.split(" ");

  // 8 files
  if (fields[0].split("/").length !== 8)
    throw new ValidationError("FEN does not have 8 files");

  // sum of each row is 8
  if (
    fields[0].replace(/[1-8]/g, (str) => " ".repeat(parseInt(str, 10)))
      .length !== 71
  )
    throw new ValidationError("FEN has invalid row sum");

  // no consecutive empty numbers
  if (fields[0].match(/[1-8][1-8]/g))
    throw new ValidationError("FEN has consecutive 'empty' numbers");

  // early exit if positions can not be validated
  if (variant === VARIANTS.UNKNOWN) return true;

  return isValidBoard(variant, fields);
}

function isValidBoard(variant, fields) {
  if (variant !== VARIANTS.DEFAULT)
    throw new ValidationError("Chess Variant not supported");

  //* kings
  // 1 king of each color
  if (fields[0].match(/k/g).length !== 1 || fields[0].match(/K/g).length !== 1)
    throw new ValidationError("More than 1 king");

  // todo kings need to be 1 apart

  //* todo check
  /*
    Non-active color is not in check
    Active color is checked less than 3 times (triple check is impossible);
    in case of 2 that it is never pawn+(pawn, bishop, knight), bishop+bishop, knight+knight
  */

  //* pawns
  // not more than 8 pawns of each color
  if (!(fields[0].match(/p/g).length <= 8 && fields[0].match(/P/g).length <= 8))
    throw new ValidationError("More than 8 pawns");

  // no pawns in first or last rank
  if (
    fields[0].split("/")[0].match(/[pP]/) ||
    fields[0].split("/")[7].match(/[pP]/)
  )
    throw new ValidationError("Pawn in first or last rank");

  //* todo en passant
  /*
    In case of en passant square:
    see if it was legally created (e.g it must be on the x3 or x6 rank,
    there must be a pawn (from the correct color) in front of it,
    and the en passant and the one behind it are empty)
   */

  //* todo promotion
  /*
    Prevent having more promoted pieces than missing pawns
    (e.g extra_pieces = Math.max(0, num_queens-1) + Math.max(0, num_rooks-2)...
    and then extra_pieces <= (8-num_pawns)), also you should do special calculations for bishops,
    If you have two (or more) bishops from the same color,
    these can only be created through pawn promotion and you should include
    this information to the formula above somehow
  */

  //* todo pawn formation
  /*
    The pawn formation is possible to reach (e.g in case of multiple pawns in a single col,
    there must be enough enemy pieces missing to make that formation), here are some useful rules:
    1. it is impossible to have more than 6 pawns in a single file (column)
       (because pawns can't exist in the first and last ranks)
    2. the minimum number of enemy missing pieces to reach a multiple pawn in a
       single col B to G 2=1, 3=2, 4=4, 5=6, 6=9 ___ A and H 2=1, 3=3, 4=6, 5=10, 6=15,
       for example, if you see 5 pawns in A or H, the other player must be missing at least 10 pieces
       from his 15 captureable pieces
    3. if there are white pawns in a2 and a3, there can't legally be one in b2,
       and this idea can be further expanded to cover more possibilities
  */

  //* todo castling
  /*
    If the king or rooks are not in their starting position; the castling ability for that side is lost (in the case of king, both are lost)
  */

  //* todo bishops
  /*
    Look for bishops in the first and last ranks (rows) trapped by pawns that haven't moved, for example:
    1. a bishop (any color) trapped behind 3 pawns
    2. bishop trapped behind 2 non-enemy pawns (not by enemy pawns because we can reach that position by underpromoting pawns,
       however if we check the number of pawns and extra_pieces we could determine if this case is possible or not)
  */

  //* todo non-jumpers
  /*
    (Avoid this if you want to validate Fisher's Chess960) If there are non-jumpers enemy pieces in between the king and rook and
    there are still some pawns without moving; check if these enemy pieces could have legally gotten in there. Also, ask yourself:
    was the king or rook needed to move to generate that position? (if yes, we need to make sure the castling abilities reflect this)
    If all 8 pawns are still in the starting position, all the non-jumpers must not have left their initial rank (also non-jumpers enemy pieces can't possibly have entered legally),
    there are other similar ideas, like if the white h-pawn moved once, the rooks should still be trapped inside the pawn formation, etc.
  */

  //* Half/Full move Clocks
  //In case of an en passant square, the half move clock must equal to 0
  const halfMovesClock = parseInt(fields[4], 10);
  const fullMoves = parseInt(fields[5], 10);
  const blackIsNext = fields[1] === "b";
  if (fields[3] !== "-" && halfMovesClock !== 0)
    throw new ValidationError("Halfmove Clock must be 0 in case of en passant");

  //HalfMoves <= ((FullMoves-1)*2)+(if BlackToMove 1 else 0), the +1 or +0 depends on the side to move
  if (halfMovesClock > (fullMoves - 1) * 2 + (blackIsNext ? 1 : 0))
    throw new ValidationError("Invalid Halfmove Clock or Fullmoves Count");

  //The HalfMoves must be x >= 0 and the FullMoves x >= 1
  if (halfMovesClock < 0 || fullMoves < 1)
    throw new ValidationError("Invalid Halfmove Clock or Fullmoves Count");

  return true;
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}
