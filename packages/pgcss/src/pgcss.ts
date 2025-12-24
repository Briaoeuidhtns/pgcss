import type { Change, PGliteWithLive } from '@electric-sql/pglite/live'

export interface PgCssConfig {
	/** Name of the table storing selectors. Default: 'selectors' */
	selectorsTable?: string
	/** Name of the table storing style declarations. Default: 'declarations' */
	declarationsTable?: string
}

export interface StyleRow {
	key: string
	selector: string
	property: string
	value: string
	priority?: string
}

/** A target for CSS output. Can be a stylesheet or an element that has one. */
export type StyleTarget = CSSStyleSheet | HTMLStyleElement

export const DEFAULT_CONFIG: Required<PgCssConfig> = {
	selectorsTable: 'selectors',
	declarationsTable: 'declarations',
}

// the table names are trusted input, but it'll be nicer if we error on weird characters now rather than later
const checkTableName = (identifier: string) => {
	if (!/^[a-z_][a-z0-9_]*$/.test(identifier))
		throw new Error(
			`Invalid table name: "${identifier}". Use lowercase alphanumeric and underscores only.`,
		)

	return identifier
}

/**
 * Creates necessary css tables if they don't exist
 */
export const initSchema = async (
	db: PGliteWithLive,
	config: PgCssConfig = {},
): Promise<void> => {
	const finalConfig = { ...DEFAULT_CONFIG, ...config }

	const tblSelectors = checkTableName(finalConfig.selectorsTable)
	const tblDeclarations = checkTableName(finalConfig.declarationsTable)

	await db.exec(`
		CREATE TABLE IF NOT EXISTS ${tblSelectors} (
		id SERIAL PRIMARY KEY,
		name TEXT UNIQUE NOT NULL
		);

		CREATE TABLE IF NOT EXISTS ${tblDeclarations} (
		id SERIAL PRIMARY KEY,
		selector_id INTEGER REFERENCES ${tblSelectors}(id) ON DELETE CASCADE,
		property TEXT NOT NULL,
		value TEXT NOT NULL,
		priority TEXT DEFAULT NULL,
		CONSTRAINT unique_decl_${tblDeclarations} UNIQUE (selector_id, property)
		);

		CREATE INDEX IF NOT EXISTS idx_${tblDeclarations}_sel ON ${tblDeclarations}(selector_id);
  `)
}

const getStyleSheet = (target: StyleTarget): CSSStyleSheet => {
	const sheet = 'sheet' in target ? target.sheet : target
	if (!sheet) throw new Error('Target element has no sheet property')
	return sheet
}

const findCssRule = (
	sheet: CSSStyleSheet,
	selector: string,
): CSSStyleRule | undefined =>
	[...sheet.cssRules].find(
		(rule): rule is CSSStyleRule =>
			rule instanceof CSSStyleRule && rule.selectorText === selector,
	)

const getOrCreateCssRule = (
	sheet: CSSStyleSheet,
	selector: string,
): CSSStyleRule => {
	let rule = findCssRule(sheet, selector)
	if (rule) return rule

	const ruleIndex = sheet.insertRule(`${selector} {}`, sheet.cssRules.length)
	return sheet.cssRules[ruleIndex] as CSSStyleRule
}

const updateStyle = (sheet: CSSStyleSheet, change: Change<StyleRow>) => {
	const { selector, property, value, priority } = change
	const rule = getOrCreateCssRule(sheet, selector)
	rule.style.setProperty(
		property,
		value,
		priority != null ? priority : undefined,
	)
}

const removeStyle = (sheet: CSSStyleSheet, change: Change<StyleRow>) => {
	const { selector, property } = JSON.parse(change.key)
	const rule = findCssRule(sheet, selector)
	if (rule) {
		rule.style.removeProperty(property)
		if (rule.style.length === 0) {
			for (let i = 0; i < sheet.cssRules.length; i++) {
				if (sheet.cssRules[i] === rule) {
					sheet.deleteRule(i)
					break
				}
			}
		}
	}
}

export interface DisposableUnsub {
	(): Promise<void>
	[Symbol.asyncDispose]: () => Promise<void>
}

/**
 * Subscribes to style changes via PGlite Live Queries and updates a <style> tag in the DOM.
 * @param db - The PGlite instance (must have 'live' extension enabled).
 * @param config - Configuration object for table names.
 * @param target - An optional target to render styles to.
 * @returns A promise resolving to an unsubscribe function.
 */
export const subscribe = async (
	db: PGliteWithLive,
	config: PgCssConfig = {},
	target: StyleTarget,
): Promise<DisposableUnsub> => {
	const finalConfig = { ...DEFAULT_CONFIG, ...config }
	const tblSelectors = checkTableName(finalConfig.selectorsTable)
	const tblDeclarations = checkTableName(finalConfig.declarationsTable)
	const styleSheet = getStyleSheet(target)

	const query = `
		SELECT
		json_build_object('selector', s.name, 'property', d.property)::text as key,
		s.name as selector,
		d.property,
		d.value,
		d.priority
		FROM ${tblDeclarations} d
		JOIN ${tblSelectors} s ON d.selector_id = s.id
        ORDER BY d.id ASC, s.id ASC;
	`

	const initial = await db.exec(query)
	while (styleSheet.cssRules.length > 0) {
		styleSheet.deleteRule(0)
	}
	const initialStyles = initial[0].rows
	const ruleMap = new Map<string, CSSStyleRule>()

	for (const row of initialStyles) {
		let rule = ruleMap.get(row.selector)
		if (!rule) {
			rule = getOrCreateCssRule(styleSheet, row.selector)
			ruleMap.set(row.selector, rule)
		}
		rule.style.setProperty(
			row.property,
			row.value,
			row.priority === null ? undefined : row.priority,
		)
	}

	const { unsubscribe } = await db.live.changes<StyleRow>(
		query,
		[],
		'key',
		(changes) => {
			for (const change of changes) {
				switch (change.__op__) {
					case 'INSERT':
					case 'UPDATE':
						updateStyle(styleSheet, change)
						break
					case 'DELETE':
						removeStyle(styleSheet, change)
						break
				}
			}
		},
	)
	const unsubDispose = unsubscribe as DisposableUnsub
	if ('asyncDispose' in Symbol) unsubDispose[Symbol.asyncDispose] = unsubscribe

	return unsubDispose
}
