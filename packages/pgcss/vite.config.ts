/// <reference types="vitest" />
import dts from 'vite-plugin-dts'
import { resolve } from 'node:path'
import { defineConfig, UserConfig } from 'vite'

export default defineConfig({
	base: './',
	plugins: [dts({ rollupTypes: true })],
	build: {
		emptyOutDir: true,
		sourcemap: true,
		lib: {
			entry: resolve(__dirname, 'src/index.ts'),
			name: 'PGCSS',
		},
	},
	test: {
		environment: 'jsdom',
	},
} satisfies UserConfig)
