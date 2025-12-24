import { describe, it, expect, vi } from 'vitest'
import { cssToPgcss } from './converter'
import { PGlite } from '@electric-sql/pglite'
import { initSchema, subscribe } from './pgcss'
import { JSDOM } from 'jsdom'
import { live } from '@electric-sql/pglite/live'

describe('cssToPgcss', () => {
	it('should convert a simple css rule to pgcss insert statements', () => {
		const css = 'body { color: red; }'
		const expectedPgcss = `INSERT INTO selectors (name) VALUES ('body') ON CONFLICT (name) DO NOTHING;
INSERT INTO declarations (selector_id, property, value) VALUES ((SELECT id FROM selectors WHERE name = 'body'), 'color', 'red');
`
		expect(cssToPgcss(css)).toBe(expectedPgcss)
	})

	it('should convert a css rule with multiple declarations to pgcss insert statements', () => {
		const css = 'body { color: red; font-size: 16px; }'
		const expectedPgcss = `INSERT INTO selectors (name) VALUES ('body') ON CONFLICT (name) DO NOTHING;
INSERT INTO declarations (selector_id, property, value) VALUES ((SELECT id FROM selectors WHERE name = 'body'), 'color', 'red');
INSERT INTO declarations (selector_id, property, value) VALUES ((SELECT id FROM selectors WHERE name = 'body'), 'font-size', '16px');
`
		expect(cssToPgcss(css)).toBe(expectedPgcss)
	})

	it('should convert multiple css rules to multiple pgcss insert statements', () => {
		const css = 'body { color: red; } h1 { font-size: 2em; }'
		const expectedPgcss = `INSERT INTO selectors (name) VALUES ('body') ON CONFLICT (name) DO NOTHING;
INSERT INTO declarations (selector_id, property, value) VALUES ((SELECT id FROM selectors WHERE name = 'body'), 'color', 'red');
INSERT INTO selectors (name) VALUES ('h1') ON CONFLICT (name) DO NOTHING;
INSERT INTO declarations (selector_id, property, value) VALUES ((SELECT id FROM selectors WHERE name = 'h1'), 'font-size', '2em');
`
		expect(cssToPgcss(css)).toBe(expectedPgcss)
	})

	it('should round-trip the css', async () => {
		const css = 'body { color: red; } h1 { font-size: 2em; }'
		const pgcss = cssToPgcss(css)

		const db = await PGlite.create({
			extensions: {
				live,
			},
		})
		await initSchema(db)
		await db.exec(pgcss)

		const dom = new JSDOM()
		const style = dom.window.document.createElement('style')
		dom.window.document.head.appendChild(style)

		await using _unsubscribe = await subscribe(db, {}, style)
		await vi.waitFor(() => {
			const roundTrippedCss =
				style.sheet!.cssRules[0].cssText +
				' ' +
				style.sheet!.cssRules[1].cssText
			expect(roundTrippedCss.replace(/\\s/g, '')).toBe(css.replace(/\\s/g, ''))
		})
	})
})
