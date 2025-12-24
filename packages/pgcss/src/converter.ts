import * as csstree from 'css-tree'
import { DEFAULT_CONFIG, type PgCssConfig } from './pgcss'

export function cssToPgcss(css: string, config: PgCssConfig = {}): string {
	const { selectorsTable, declarationsTable } = { ...DEFAULT_CONFIG, ...config }

	const ast = csstree.parse(css)
	let result = ''
	csstree.walk(ast, (node) => {
		if (node.type === 'Rule') {
			const selector = csstree.generate(node.prelude)
			result += `INSERT INTO ${selectorsTable} (name) VALUES ('${selector}') ON CONFLICT (name) DO NOTHING;\n`
			node.block.children.forEach((declaration) => {
				if (declaration.type === 'Declaration') {
					const property = declaration.property
					const value = csstree.generate(declaration.value)
					result += `INSERT INTO ${declarationsTable} (selector_id, property, value) VALUES ((SELECT id FROM ${selectorsTable} WHERE name = '${selector}'), '${property}', '${value}');\n`
				}
			})
		}
	})
	return result
}
