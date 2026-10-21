export function bookSeriesSearchUrl(
  query: string,
  format?: 'ebook' | 'audiobook'
) {
  const name = query.trim();
  return name.length >= 2 && name.length <= 200
    ? `/api/v1/book-series/search?${new URLSearchParams({ query: name, ...(format ? { format } : {}) }).toString().replace(/\+/g, '%20')}`
    : null;
}
