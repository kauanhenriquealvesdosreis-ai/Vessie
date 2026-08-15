function createMemory(seed = []) {
  const items = [...seed];
  return { add(value) { const text = String(value || '').trim(); if (text && !items.includes(text)) items.push(text); }, search(query) { const words = String(query || '').toLowerCase().split(/\s+/).filter(word => word.length > 3); return items.filter(item => words.some(word => item.toLowerCase().includes(word))).slice(-5); }, list() { return [...items]; }, size() { return items.length; }, clear() { items.length = 0; } };
}
module.exports = { createMemory };
