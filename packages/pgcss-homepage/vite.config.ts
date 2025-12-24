import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
	resolve: {
		alias: {
			pgcss: path.resolve(__dirname, '../pgcss/src/index.ts'),
		},
	},
	optimizeDeps: {
		exclude: ['@electric-sql/pglite'],
	},
})
