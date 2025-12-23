import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { initSchema, subscribe } from './index';
import { live, type PGliteWithLive } from "@electric-sql/pglite/live";

// Helper to enable live extension
async function getLiveDB(): Promise<PGliteWithLive> {
	const db = await PGlite.create({
		extensions: {
			live,
		},
	});
	return db;
}

describe('pgcss with real PGlite', () => {
  let db: PGliteWithLive;

  beforeEach(async () => {
    db = await getLiveDB();
  });

  describe('initSchema', () => {
    it('should create tables with default names', async () => {
      await initSchema(db);
      const tables = await db.exec(`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        AND (tablename = 'selectors' OR tablename = 'declarations');
      `);
      expect(tables[0].rows.map(r => r.tablename)).toEqual(expect.arrayContaining(['selectors', 'declarations']));
    });

    it('should create tables with custom names', async () => {
      const config = { selectorsTable: 'my_selectors', declarationsTable: 'my_declarations' };
      await initSchema(db, config);
      const tables = await db.exec(`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        AND (tablename = 'my_selectors' OR tablename = 'my_declarations');
      `);
      expect(tables[0].rows.map(r => r.tablename)).toEqual(expect.arrayContaining(['my_selectors', 'my_declarations']));
    });

    it('should throw an error for invalid table names', async () => {
      const invalidConfig = { selectorsTable: 'invalid-table' };
      await expect(initSchema(db, invalidConfig)).rejects.toThrow('Invalid table name');
    });
  });

  describe('subscribe', () => {
    let styleElement: HTMLStyleElement;
    let sheet: CSSStyleSheet;

    beforeEach(() => {
      styleElement = document.createElement('style');
      document.head.appendChild(styleElement);
      sheet = styleElement.sheet!;
    });

    it('should apply initial styles and subscribe to changes', async () => {
      await initSchema(db);
      await db.exec(`
        INSERT INTO selectors (name) VALUES ('body');
        INSERT INTO declarations (selector_id, property, value) VALUES (1, 'color', 'red');
      `);

      const unsubscribe = await subscribe(db, {}, styleElement);

      // Check initial styles
      expect(sheet.cssRules.length).toBe(1);
      const rule = sheet.cssRules[0] as CSSStyleRule;
      expect(rule.selectorText).toBe('body');
      expect(rule.style.getPropertyValue('color')).toBe('red');

      // Check for updates
      await db.exec(`INSERT INTO declarations (selector_id, property, value) VALUES (1, 'background', 'blue');`);
      
      // Allow time for live query to fire
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(rule.style.getPropertyValue('background')).toBe('blue');

      await unsubscribe();
    }, 10000);

    it('should handle deletions', async () => {
      await initSchema(db);
      await db.exec(`
        INSERT INTO selectors (name) VALUES ('body');
        INSERT INTO declarations (selector_id, property, value) VALUES (1, 'color', 'red');
      `);

      const unsubscribe = await subscribe(db, {}, styleElement);

      // Initial state
      expect(sheet.cssRules.length).toBe(1);
      const rule = sheet.cssRules[0] as CSSStyleRule;
      expect(rule.selectorText).toBe('body');

      // Delete the declaration
      await db.exec(`DELETE FROM declarations WHERE property = 'color';`);

      // Allow time for live query to fire
      await new Promise(resolve => setTimeout(resolve, 200));

      // Since the rule is now empty, it should be deleted
      expect(sheet.cssRules.length).toBe(0);

      await unsubscribe();
    }, 10000);
  });
});