// The spoken name of every letter key, fully vowelled so the TTS reads it
// as the letter's name. Keys are the characters on the keyboard.
export const NAMES = {
  "ا": "أَلِف",
  "ب": "بَاء",
  "ت": "تَاء",
  "ث": "ثَاء",
  "ج": "جِيم",
  "ح": "حَاء",
  "خ": "خَاء",
  "د": "دَال",
  "ذ": "ذَال",
  "ر": "رَاء",
  "ز": "زَاي",
  "س": "سِين",
  "ش": "شِين",
  "ص": "صَاد",
  "ض": "ضَاد",
  "ط": "طَاء",
  "ظ": "حَرْفُ الظَّاء",
  "ع": "عَيْن",
  "غ": "غَيْن",
  "ف": "فَاء",
  "ق": "قَاف",
  "ك": "كَاف",
  "ل": "لَام",
  "م": "مِيم",
  "ن": "نُون",
  "ه": "هَاء",
  "و": "وَاو",
  "ي": "يَاء",
  "ة": "تَاء مَرْبُوطَة",
  "ى": "أَلِف مَقْصُورَة",
  "ء": "هَمْزَة",
};

// Clip file for a key: public/audio/<code point hex>.mp3 (ASCII-only names).
export const clipName = ch => `${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}.mp3`;
