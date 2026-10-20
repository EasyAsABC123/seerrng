---
category: fixed
audience: users, operators
area: images
action: none
breaking: false
---

Pages no longer rate-limit their own image requests. Poster cache warming now shares one paced queue that backs off when asked, the warm limit is higher, and posters that fail briefly are retried before the placeholder is shown.
