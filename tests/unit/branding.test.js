import { describe, it, expect } from 'vitest'

// ─── Functions under test ────────────────────────────────────────────────────
// Copied from server/server.js. Pure color math functions with no Express or
// DB dependencies. When server.js is refactored to export these, replace with
// an import.

function hexToHsl(hex) {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return "#" + [f(0), f(8), f(4)]
        .map(x => Math.round(x * 255).toString(16).padStart(2, "0"))
        .join("");
}

function getLuminance(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const toLinear = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function buildPalette(hex) {
    if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) hex = "#111827";

    const [h, s, l] = hexToHsl(hex);
    const secondaryHex = hslToHex((h + 180) % 360, Math.min(s, 60), Math.max(l, 35));
    const onPrimary = getLuminance(hex) > 0.179 ? "#111827" : "#ffffff";
    const onSecondary = getLuminance(secondaryHex) > 0.179 ? "#111827" : "#ffffff";

    return {
        primary: hex,
        primaryHover: hslToHex(h, s, Math.max(l - 10, 10)),
        primaryLight: hslToHex(h, Math.min(s, 80), Math.min(l + 40, 96)),
        primaryDark: hslToHex(h, s, Math.max(l - 20, 5)),
        onPrimary,
        secondary: secondaryHex,
        secondaryHover: hslToHex((h + 180) % 360, Math.min(s, 60), Math.max(l - 10, 10)),
        secondaryLight: hslToHex((h + 180) % 360, Math.min(s, 60), Math.min(l + 40, 96)),
        onSecondary,
    };
}

// ─── hexToHsl ─────────────────────────────────────────────────────────────────

describe('hexToHsl', () => {
    it('converts pure red correctly', () => {
        const [h, s, l] = hexToHsl("#ff0000")
        expect(h).toBe(0)
        expect(s).toBe(100)
        expect(l).toBe(50)
    })

    it('converts pure green correctly', () => {
        const [h, s, l] = hexToHsl("#00ff00")
        expect(h).toBe(120)
        expect(s).toBe(100)
        expect(l).toBe(50)
    })

    it('converts pure blue correctly', () => {
        const [h, s, l] = hexToHsl("#0000ff")
        expect(h).toBe(240)
        expect(s).toBe(100)
        expect(l).toBe(50)
    })

    it('converts white correctly', () => {
        const [h, s, l] = hexToHsl("#ffffff")
        expect(s).toBe(0)
        expect(l).toBe(100)
    })

    it('converts black correctly', () => {
        const [h, s, l] = hexToHsl("#000000")
        expect(s).toBe(0)
        expect(l).toBe(0)
    })

    it('returns array of three numbers', () => {
        const result = hexToHsl("#7c3aed")
        expect(result).toHaveLength(3)
        result.forEach(v => expect(typeof v).toBe('number'))
    })

    it('returns values in valid ranges', () => {
        const [h, s, l] = hexToHsl("#7c3aed")
        expect(h).toBeGreaterThanOrEqual(0)
        expect(h).toBeLessThanOrEqual(360)
        expect(s).toBeGreaterThanOrEqual(0)
        expect(s).toBeLessThanOrEqual(100)
        expect(l).toBeGreaterThanOrEqual(0)
        expect(l).toBeLessThanOrEqual(100)
    })
})

// ─── hslToHex ─────────────────────────────────────────────────────────────────

describe('hslToHex', () => {
    it('converts pure red correctly', () => {
        expect(hslToHex(0, 100, 50)).toBe("#ff0000")
    })

    it('converts pure green correctly', () => {
        expect(hslToHex(120, 100, 50)).toBe("#00ff00")
    })

    it('converts pure blue correctly', () => {
        expect(hslToHex(240, 100, 50)).toBe("#0000ff")
    })

    it('converts white correctly', () => {
        expect(hslToHex(0, 0, 100)).toBe("#ffffff")
    })

    it('converts black correctly', () => {
        expect(hslToHex(0, 0, 0)).toBe("#000000")
    })

    it('returns a valid hex string', () => {
        const result = hslToHex(270, 70, 50)
        expect(result).toMatch(/^#[0-9a-f]{6}$/)
    })

    it('round-trips with hexToHsl within rounding tolerance', () => {
        // hex → hsl → hex will not be bit-perfect because hexToHsl uses
        // Math.round(), which loses a small amount of precision. We verify
        // the result is visually close (each channel within +-2/255).
        const original = "#7c3aed"
        const [h, s, l] = hexToHsl(original)
        const result = hslToHex(h, s, l)

        const toChannels = hex => [
            parseInt(hex.slice(1, 3), 16),
            parseInt(hex.slice(3, 5), 16),
            parseInt(hex.slice(5, 7), 16)
        ]
        const [r1, g1, b1] = toChannels(original)
        const [r2, g2, b2] = toChannels(result)

        expect(Math.abs(r1 - r2)).toBeLessThanOrEqual(2)
        expect(Math.abs(g1 - g2)).toBeLessThanOrEqual(2)
        expect(Math.abs(b1 - b2)).toBeLessThanOrEqual(2)
    })
})

// ─── getLuminance ─────────────────────────────────────────────────────────────

describe('getLuminance', () => {
    it('returns 1 for white', () => {
        expect(getLuminance("#ffffff")).toBeCloseTo(1, 2)
    })

    it('returns 0 for black', () => {
        expect(getLuminance("#000000")).toBeCloseTo(0, 2)
    })

    it('returns value between 0 and 1', () => {
        const l = getLuminance("#7c3aed")
        expect(l).toBeGreaterThan(0)
        expect(l).toBeLessThan(1)
    })

    it('dark colors have lower luminance than light colors', () => {
        const dark = getLuminance("#111827")
        const light = getLuminance("#f3f4f6")
        expect(dark).toBeLessThan(light)
    })

    it('white has higher luminance than any color', () => {
        expect(getLuminance("#ffffff")).toBeGreaterThan(getLuminance("#ff0000"))
        expect(getLuminance("#ffffff")).toBeGreaterThan(getLuminance("#7c3aed"))
    })
})

// ─── buildPalette ─────────────────────────────────────────────────────────────

describe('buildPalette', () => {
    it('returns all required keys', () => {
        const palette = buildPalette("#7c3aed")
        const requiredKeys = [
            'primary', 'primaryHover', 'primaryLight', 'primaryDark',
            'onPrimary', 'secondary', 'secondaryHover', 'secondaryLight',
            'onSecondary'
        ]
        requiredKeys.forEach(key => {
            expect(palette).toHaveProperty(key)
        })
    })

    it('all color values are valid hex strings', () => {
        const palette = buildPalette("#7c3aed")
        const hexPattern = /^#[0-9a-f]{6}$/i
        Object.values(palette).forEach(val => {
            expect(val).toMatch(hexPattern)
        })
    })

    it('primary matches the input color', () => {
        expect(buildPalette("#7c3aed").primary).toBe("#7c3aed")
        expect(buildPalette("#111827").primary).toBe("#111827")
    })

    it('falls back to default on invalid hex', () => {
        expect(buildPalette("notacolor").primary).toBe("#111827")
        expect(buildPalette("").primary).toBe("#111827")
        expect(buildPalette(null).primary).toBe("#111827")
    })

    it('onPrimary is white for dark primary colors', () => {
        // #111827 is very dark — text on it should be white
        expect(buildPalette("#111827").onPrimary).toBe("#ffffff")
    })

    it('onPrimary is dark for light primary colors', () => {
        // #f3f4f6 is very light — text on it should be dark
        expect(buildPalette("#f3f4f6").onPrimary).toBe("#111827")
    })

    it('works with uppercase hex', () => {
        const palette = buildPalette("#7C3AED")
        expect(palette.primary).toBe("#7C3AED")
        expect(palette).toHaveProperty('secondary')
    })
})
