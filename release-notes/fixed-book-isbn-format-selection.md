### Fixed

- Book requests keep automatic matching when applying a language preference or requesting a catalogue selection in bulk. These actions no longer silently pin an Open Library ISBN that may represent an incompatible edition in Chaptarr. Explicit ISBN choices show only editions with a known compatible digital format, and changing between books and audiobooks clears the previous ISBN choice.

- Automatic Bookshelf requests explicitly permit compatible editions at import, while explicit edition requests retain strict matching. This avoids blocking a correctly matched ebook because its publisher edition differs from the edition guessed at grab time.
