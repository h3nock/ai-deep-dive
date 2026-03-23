---
title: The Byte Inspector
difficulty: Medium
---

Count the number of characters in a UTF-8 `byte_list` without decoding it.

In UTF-8, the first two bits of each byte tell you its role:
- `0xxxxxxx` or `11xxxxxx` → start of a character
- `10xxxxxx` → continuation of a previous character
