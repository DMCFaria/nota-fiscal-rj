// src/utils/normalizacao_textual.js

const REPLACEMENTS = [
  [/��O/g, "ÇÃO"],
  [/��A/g, "ÇÃO"],
  [/��E/g, "ÇE"],
  [/��I/g, "ÇI"],
  [/��U/g, "ÇU"],
  [/��/g, "Ç"],
  [/�A/g, "Á"],
  [/�E/g, "É"],
  [/�I/g, "Í"],
  [/�O/g, "Ó"],
  [/�U/g, "Ú"],
  [/�a/g, "á"],
  [/�e/g, "é"],
  [/�i/g, "í"],
  [/�o/g, "ó"],
  [/�u/g, "ú"],
  [/�u/g, "ç"],
  [/�/g, ""], // fallback final
];

export function fixBrokenLatin(text = "") {
  let result = text;

  for (const [regex, value] of REPLACEMENTS) {
    result = result.replace(regex, value);
  }

  return result;
}
