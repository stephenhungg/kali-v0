# strawberry matcha palette

Official kali brand palette, locked 2026-05-10 (sent by Nicole).

| token | hex | role |
|-------|-----|------|
| `--cream` | `#F9ECE5` | base background, page surface |
| `--strawberry-soft` | `#FFCBC9` | pastel strawberry accent (cards, highlights) |
| `--strawberry-deep` | `#9C3C4B` | wine strawberry accent (CTAs, ink for emphasis) |
| `--matcha-mid` | `#639067` | sage matcha (secondary accent, illustrations) |
| `--matcha-deep` | `#044B3A` | forest matcha (primary text, navigation, dark sections) |

## CSS variables

```css
:root {
  --cream: #F9ECE5;
  --strawberry-soft: #FFCBC9;
  --strawberry-deep: #9C3C4B;
  --matcha-mid: #639067;
  --matcha-deep: #044B3A;
}
```

## Tailwind theme extension

```ts
{
  cream: '#F9ECE5',
  strawberry: { soft: '#FFCBC9', deep: '#9C3C4B' },
  matcha:    { mid:  '#639067', deep: '#044B3A' },
}
```

## Usage notes

- `--cream` for the page background
- `--matcha-deep` for primary text (best contrast on cream)
- `--strawberry-deep` for CTA buttons, important links
- `--matcha-mid` for secondary text, dividers, illustration midtones
- `--strawberry-soft` for card backgrounds, badges, hover states, decorative accents
- never use pure white or pure black — always one of the five
