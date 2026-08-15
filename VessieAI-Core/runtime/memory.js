function createMemory(seed = []) {
  const items = [...seed].map((item) => typeof item === 'string' ? { value: item, category: 'context', createdAt: Date.now() } : item)
  return {
    add(value, category = 'context') { const text = String(value || '').trim(); if (!text || items.some((item) => item.value === text)) return false; items.push({ value: text, category, createdAt: Date.now() }); return true },
    search(query, category) { const words = String(query || '').toLowerCase().split(/\s+/).filter((word) => word.length > 3); return items.filter((item) => (!category || item.category === category) && words.some((word) => item.value.toLowerCase().includes(word))).slice(-8).map((item) => item.value) },
    list(category) { return items.filter((item) => !category || item.category === category).map((item) => ({ ...item })) },
    remove(value) { const index = items.findIndex((item) => item.value === value); if (index < 0) return false; items.splice(index, 1); return true },
    size() { return items.length },
    clear(category) { if (!category) items.length = 0; else for (let index = items.length - 1; index >= 0; index -= 1) if (items[index].category === category) items.splice(index, 1) },
  }
}
module.exports = { createMemory }
