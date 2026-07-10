import { describe, it, expect } from 'vitest'

// ─── Function under test ─────────────────────────────────────────────────────
// Copied from client/js/app.js — a pure function with no browser dependencies.
// Decides whether a highlighted code block should show a language badge and
// what label to use. When app.js is refactored to export a shared module,
// replace this copy with an import. Keep the two in sync.

const CODE_LANG_LABELS = {
    javascript: "JavaScript", typescript: "TypeScript", python: "Python",
    ruby: "Ruby", php: "PHP", java: "Java", c: "C", cpp: "C++",
    csharp: "C#", go: "Go", rust: "Rust", swift: "Swift", kotlin: "Kotlin",
    html: "HTML", xml: "XML", css: "CSS", scss: "SCSS", json: "JSON",
    yaml: "YAML", toml: "TOML", ini: "INI", bash: "Bash", shell: "Shell",
    powershell: "PowerShell", sql: "SQL", markdown: "Markdown",
    dockerfile: "Dockerfile", makefile: "Makefile", diff: "Diff",
    graphql: "GraphQL", lua: "Lua", perl: "Perl", scala: "Scala",
    objectivec: "Objective-C", dart: "Dart"
};

const MIN_BADGE_RELEVANCE = 5;

function codeBadgeLabel(language, relevance, explicit) {
    if (!language) return "";
    const lang = String(language).toLowerCase();
    if (lang === "plaintext" || lang === "plain" || lang === "text") return "";
    if (!explicit && (typeof relevance !== "number" || relevance < MIN_BADGE_RELEVANCE)) return "";
    if (lang in CODE_LANG_LABELS) return CODE_LANG_LABELS[lang];
    return lang.charAt(0).toUpperCase() + lang.slice(1);
}

// ─── codeBadgeLabel ──────────────────────────────────────────────────────────

describe('codeBadgeLabel', () => {
    it('returns a friendly label for a known, explicitly-declared language', () => {
        expect(codeBadgeLabel('javascript', 0, true)).toBe('JavaScript')
        expect(codeBadgeLabel('python', 0, true)).toBe('Python')
        expect(codeBadgeLabel('cpp', 0, true)).toBe('C++')
        expect(codeBadgeLabel('csharp', 0, true)).toBe('C#')
    })

    it('is case-insensitive on the language id', () => {
        expect(codeBadgeLabel('JavaScript', 0, true)).toBe('JavaScript')
        expect(codeBadgeLabel('SQL', 0, true)).toBe('SQL')
    })

    it('capitalises unknown-but-named languages instead of dropping them', () => {
        expect(codeBadgeLabel('elixir', 0, true)).toBe('Elixir')
    })

    it('returns "" when no language was resolved', () => {
        expect(codeBadgeLabel(undefined, 10, false)).toBe('')
        expect(codeBadgeLabel(null, 10, true)).toBe('')
        expect(codeBadgeLabel('', 10, true)).toBe('')
    })

    it('returns "" for plaintext / plain / text', () => {
        expect(codeBadgeLabel('plaintext', 99, true)).toBe('')
        expect(codeBadgeLabel('plain', 99, true)).toBe('')
        expect(codeBadgeLabel('text', 99, true)).toBe('')
    })

    it('suppresses the badge for low-confidence auto-detection', () => {
        // auto-detected (not explicit) with relevance below the threshold
        expect(codeBadgeLabel('javascript', 3, false)).toBe('')
        expect(codeBadgeLabel('ruby', 0, false)).toBe('')
    })

    it('shows the badge for confident auto-detection', () => {
        expect(codeBadgeLabel('javascript', 8, false)).toBe('JavaScript')
        expect(codeBadgeLabel('python', MIN_BADGE_RELEVANCE, false)).toBe('Python')
    })

    it('trusts an explicit language even at zero relevance', () => {
        // a declared ```js fence should badge regardless of relevance score
        expect(codeBadgeLabel('javascript', 0, true)).toBe('JavaScript')
    })

    it('treats a non-numeric relevance as low-confidence when auto-detected', () => {
        expect(codeBadgeLabel('go', undefined, false)).toBe('')
    })
})
