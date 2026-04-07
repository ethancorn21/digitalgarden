2026-02-27 11:12
status: #baby 
tags: [[Technology]], [[process]]

---
# vim motions cheatsheet

---
## modes

| key | action                       |
| --- | ---------------------------- |
| `i` | insert mode (before cursor)  |
| `a` | insert mode (after cursor)   |
| `A` | insert mode (end of line)    |
| `o` | insert mode (new line below) |
| `O` | insert mode (new line above) |
| `v` | visual mode (character)      |
| `V` | visual mode (line)           |

---

## navigation

| key       | action                                          |
| --------- | ----------------------------------------------- |
| `h j k l` | left / down / up / right                        |
| `w`       | next word (start)                               |
| `b`       | previous word (start)                           |
| `e`       | next word (end)                                 |
| `0`       | *start* of line                                 |
| `$`       | end of line                                     |
| `gg`      | top of file                                     |
| `G`       | bottom of file                                  |
| `ctrl+d`  | half page down                                  |
| `ctrl+u`  | half page up                                    |
| `{` / `}` | jump up/down by paragraph                       |
| `%`       | jump to matching bracket                        |
| `gj`      | move down one visual line (use in wrapped text) |
| `gk`      | move up one visual line (use in wrapped text)   |
| `g0`      | start of visual line                            |
| `g$`      | end of visual line                              |

---

## editing

| key      | action                        |
| -------- | ----------------------------- |
| `x`      | delete character under cursor |
| `dd`     | delete entire line            |
| `yy`     | yank (copy) entire line       |
| `p`      | paste below/after             |
| `P`      | paste above/before            |
| `u`      | undo                          |
| `ctrl+r` | redo                          |
| `r`      | replace single character      |
| `.`      | repeat last action            |

---

## text objects (the good stuff)

These follow the pattern: `verb + modifier + object`

| key   | action                                 |
| ----- | -------------------------------------- |
| `ciw` | change inside word                     |
| `caw` | change around word (includes space)    |
| `ci"` | change inside quotes                   |
| `ca"` | change around quotes (includes quotes) |
| `ci(` | change inside parentheses              |
| `daw` | delete around word                     |
| `dap` | delete around paragraph                |
| `yap` | yank around paragraph                  |
| `vip` | visually select inside paragraph       |
| `das` | delete around sentence                 |

---

## search

| key     | action                   |
| ------- | ------------------------ |
| `/word` | search forward           |
| `?word` | search backward          |
| `n`     | next match               |
| `N`     | previous match           |
| `*`     | search word under cursor |

---

## useful combos to memorize

| key                | action                               |
| ------------------ | ------------------------------------ |
| `dap`              | delete a paragraph                   |
| `ciw`              | replace a word (drops you in insert) |
| `yap` then `p`     | duplicate a paragraph                |
| `ggVG`             | select entire file                   |
| `ggdG`             | delete entire file contents          |
| `V` then `>` / `<` | indent / unindent line               |
| `ea`               | append to end of current word        |
| `di"`              | delete text inside quotes            |

---
## in-line navigation

| key       | action                                 |
| --------- | -------------------------------------- |
| `f{char}` | find next occurrence of {char} on line |
| `F{char}` | find prev occurrence of {char} on line |
| `t{char}` | jump up to next occurrence of {char}   |
| `T{char}` | jump back to prev occurrence of {char} |
| `;`       | repeat last f, F, t, or T              |
| `,`       | repeat last f, F, t, or T (reverse)    |
| `^`       | first non-blank character of line      |
| `W`       | next WORD (space-separated)            |
| `B`       | prev WORD (space-separated)            |
| `E`       | next WORD end (space-separated)        |

---

## fast editing & deletion

| key | action                                 |
| --- | -------------------------------------- |
| `C` | change to end of line (same as c$)     |
| `D` | delete to end of line (same as d$)     |
| `s` | delete char under cursor & insert mode |
| `S` | clear line & insert mode (same as cc)  |
| `J` | join current line with line below      |
| `~` | toggle case of char under cursor       |

---

## visual modes

| key      | action                      |
| -------- | --------------------------- |
| `ctrl+v` | visual block mode (columns) |

---

## marks and jumps

| key          | action                              |
| ------------ | ----------------------------------- |
| `m{a-z}`     | set mark at current cursor position |
| `` `{a-z} `` | jump to exact position of mark      |
| `ctrl+o`     | jump back in jump list              |
| `ctrl+i`     | jump forward in jump list           |

---

## search & replace

| key              | action                                 |
| ---------------- | -------------------------------------- |
| `:%s/old/new/g`  | replace all 'old' with 'new' in file   |
| `:%s/old/new/gc` | replace all 'old' with 'new' (confirm) |

---

## macros

| key      | action                                    |
| -------- | ----------------------------------------- |
| `q{a-z}` | start recording macro into register {a-z} |
| `q`      | stop recording macro                      |
| `@{a-z}` | replay macro stored in register {a-z}     |
| `@@`     | replay last executed macro                |

---

## file operations

| key   | action                    |
| ----- | ------------------------- |
| `:w`  | save (write)              |
| `:q`  | quit                      |
| `:wq` | save and quit             |
| `ZZ`  | save and quit             |
| `:q!` | force quit without saving |
| `ZQ`  | force quit without saving |

---
## see also:


