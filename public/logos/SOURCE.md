# kali logo — source of truth

`kali-logo.png` is the **root node** for every brand asset. all derived images (favicon, mascot-only, app icon, social cards, sticker variants, mascot poses, etc.) should be generated as image-to-image off this file so the visual identity stays consistent.

## the canonical asset

- **file**: `public/logos/kali-logo.png`
- **selected from**: `public/logos/explore/v1-code-b.png` (round 2, code-snippet variant b)
- **picked**: 2026-05-10

## generation provenance

higgsfield nano-banana-pro, image-to-image off the round-1 v1 reference.

| field | value |
|---|---|
| job id | `e1fa23db-dfea-489b-960b-645da71873fb` |
| model | `nano_banana_2` |
| aspect ratio | `1:1` |
| resolution | `2k` (2048×2048) |
| reference image | round-1 v1 (`ad49c7e9-81e1-4cf9-9d27-fb1113f28b9d`) |
| cdn url | https://d8j0ntlcm91z4.cloudfront.net/user_3DHsPC6OCpyUmzAQPLHPaZStjet/hf_20260510_101946_e1fa23db-dfea-489b-960b-645da71873fb.png |

## the brand palette (locked)

| token | hex | role |
|---|---|---|
| cream blush | `#F9ECE5` | base background |
| pastel strawberry | `#FFCBC9` | soft accent |
| wine strawberry | `#9C3C4B` | deep accent |
| sage matcha | `#639067` | mid green |
| forest matcha | `#044B3A` | deep green / primary text |

## design dna (don't break)

- chunky rounded hand-drawn lowercase wordmark "kali" in forest matcha `#044B3A`
- thick cream-blush sticker outline + soft drop shadow
- strawberry-hat matcha-blob mascot perched on the "k"
- floating motifs: strawberry, leaf, heart, sparkle, chat bubble
- code-tag stickers: `<ai>`, `</agent>`, `<query/>`, `{ }` — each a mini standalone sticker
- letters and stickers tilted 2-5°, organic baseline jitter
- flat solid fills, zero gradients, zero photorealism
- aesthetic: SAWARATSUKI KawaiiLogos sticker style

## generating derived assets

when generating any new asset (favicon, mascot solo, app icon, etc.), pass `kali-logo.png` (or its cdn url above) as the reference image to higgsfield with `role: "image"`, and prompt for the new framing/crop while explicitly preserving the mascot, palette, and wordmark style.
