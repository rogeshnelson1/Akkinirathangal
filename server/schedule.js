// Builds the 122-day schedule (Sep 1 – Dec 31, 2026) exactly like the PDF.
const NT = "Matthew 28,Mark 16,Luke 24,John 21,Acts 28,Romans 16,1 Corinthians 16,2 Corinthians 13,Galatians 6,Ephesians 6,Philippians 4,Colossians 4,1 Thessalonians 5,2 Thessalonians 3,1 Timothy 6,2 Timothy 4,Titus 3,Philemon 1,Hebrews 13,James 5,1 Peter 5,2 Peter 3,1 John 5,2 John 1,3 John 1,Jude 1,Revelation 22";
const OT = "Genesis 50,Exodus 40,Leviticus 27,Numbers 36,Deuteronomy 34,Joshua 24,Judges 21,Ruth 4,1 Samuel 31,2 Samuel 24,1 Kings 22,2 Kings 25,1 Chronicles 29,2 Chronicles 36,Ezra 10,Nehemiah 13,Esther 10,Job 42,Psalms 150,Proverbs 31,Ecclesiastes 12,Song of Solomon 8,Isaiah 66,Jeremiah 52,Lamentations 5,Ezekiel 48,Daniel 12,Hosea 14,Joel 3,Amos 9,Obadiah 1,Jonah 4,Micah 7,Nahum 3,Habakkuk 3,Zephaniah 3,Haggai 2,Zechariah 14,Malachi 4";

const flatten = (s) => s.split(",").flatMap((b) => {
  const i = b.lastIndexOf(" "), name = b.slice(0, i), n = +b.slice(i + 1);
  return Array.from({ length: n }, (_, k) => [name, k + 1]);
});
const fmt = (chs) => {
  const parts = [];
  for (const [b, c] of chs) {
    const last = parts[parts.length - 1];
    if (last && last.b === b) last.e = c; else parts.push({ b, s: c, e: c });
  }
  return parts.map((p) => (p.s === p.e ? `${p.b} ${p.s}` : `${p.b} ${p.s}–${p.e}`)).join("; ");
};

const nt = flatten(NT), ot = flatten(OT);
export const SCHEDULE = Array.from({ length: 122 }, (_, i) => {
  const date = new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10);
  let morning = null, evening = null, testament = "New Testament";
  if (i < 52) {
    morning = fmt(nt.slice(i * 5, i * 5 + 5));
    evening = fmt(ot.slice(i * 5, i * 5 + 5));
  } else if (i < 119) {
    // Day 53 onwards: 10 OT chapters/day, split 5 morning + 5 evening
    testament = "Old Testament";
    const s = 260 + (i - 52) * 10;
    morning = fmt(ot.slice(s, s + 5));
    const rest = ot.slice(s + 5, s + 10);
    evening = rest.length ? fmt(rest) : null;
  } else {
    // Dec 29–31: revision, also split morning / evening
    testament = "Revision";
    morning = "Revision / missed chapters";
    evening = "Revision / prayer and thanksgiving";
  }
  return { day: i + 1, date, morning, evening, testament, revision: i >= 119 };
});
