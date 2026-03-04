/**
 * Normalize an address for comparison: strip punctuation, collapse spaces, lowercase.
 * @param {string} str
 * @returns {string}
 */
export function normalizeAddress(str) {
  if (typeof str !== 'string') return ''
  return str
    .trim()
    .toLowerCase()
    .replace(/[,.\-;:'"()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract US-style zip from end of string (5 digits or 5+4). Returns null if none.
 * @param {string} normalizedStr - already normalized (no punctuation)
 * @returns {string|null}
 */
export function extractZip(normalizedStr) {
  if (!normalizedStr) return null
  const match = normalizedStr.match(/\b(\d{5})(?:\s+(\d{4}))?\s*$/)
  return match ? (match[2] ? `${match[1]}-${match[2]}` : match[1]) : null
}

/**
 * Street part = normalized address with zip removed from end (for comparing number + name + city/state).
 * @param {string} normalizedStr
 * @returns {string}
 */
function streetPart(normalizedStr) {
  if (!normalizedStr) return ''
  return normalizedStr.replace(/\b\d{5}(?:\s+\d{4})?\s*$/, '').trim()
}

/**
 * Compare two addresses: strip punctuation, then compare zip (if both have one), then street part.
 * Treat as same address only if: (zips match or both lack zip) and street parts match.
 * @param {string} addr1
 * @param {string} addr2
 * @returns {boolean}
 */
export function addressesMatch(addr1, addr2) {
  const n1 = normalizeAddress(addr1)
  const n2 = normalizeAddress(addr2)
  if (!n1 || !n2) return n1 === n2

  const zip1 = extractZip(n1)
  const zip2 = extractZip(n2)
  if (zip1 != null && zip2 != null && zip1 !== zip2) return false

  return streetPart(n1) === streetPart(n2)
}
