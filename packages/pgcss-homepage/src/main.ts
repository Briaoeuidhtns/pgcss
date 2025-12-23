import "./style.css";
import typescriptLogo from "./typescript.svg";
import viteLogo from "/vite.svg";
import { setupCounter } from "./counter.ts";
import { PGlite } from "@electric-sql/pglite";
import { initSchema, subscribe } from "pgcss";
import { live } from "@electric-sql/pglite/live";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <a href="https://vitejs.dev" target="_blank">
      <img src="${viteLogo}" class="logo" alt="Vite logo" />
    </a>
    <a href="https://www.typescriptlang.org/" target="_blank">
      <img src="${typescriptLogo}" class="logo vanilla" alt="TypeScript logo" />
    </a>
    <h1>Vite + TypeScript</h1>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
    <p class="read-the-docs">
      Click on the Vite and TypeScript logos to learn more
    </p>
    <button id="change-color">Change H1 Color</button>
    <button id="add-border">Add Border to H1</button>
    <button id="remove-border">Remove Border from H1</button>
  </div>
`;

setupCounter(document.querySelector<HTMLButtonElement>("#counter")!);

const run = async () => {
	const pg = await PGlite.create({
		extensions: {
			live,
		},
	});

	const styleEl = document.createElement("style");
	document.head.appendChild(styleEl);
	const config = {};
	await initSchema(pg, config);
	await subscribe(pg, config, styleEl);

	// Initial style
	await pg.exec(
		`INSERT INTO selectors (name) VALUES ('h1') ON CONFLICT (name) DO NOTHING;`,
	);
	await pg.exec(
		`INSERT INTO declarations (selector_id, property, value) VALUES ((SELECT id FROM selectors WHERE name = 'h1'), 'color', 'red') ON CONFLICT (selector_id, property) DO UPDATE SET value = EXCLUDED.value;`,
	);

	document
		.getElementById("change-color")
		?.addEventListener("click", async () => {
			const currentColor = (
				await pg.exec(
					`SELECT value FROM declarations WHERE selector_id = (SELECT id FROM selectors WHERE name = 'h1') AND property = 'color'`,
				)
			)[0].rows[0].value;
			const newColor = currentColor === "red" ? "blue" : "red";
			await pg.exec(
				`INSERT INTO declarations (selector_id, property, value) VALUES ((SELECT id FROM selectors WHERE name = 'h1'), 'color', '${newColor}') ON CONFLICT (selector_id, property) DO UPDATE SET value = EXCLUDED.value;`,
			);
		});

	document.getElementById("add-border")?.addEventListener("click", async () => {
		await pg.exec(
			`INSERT INTO declarations (selector_id, property, value) VALUES ((SELECT id FROM selectors WHERE name = 'h1'), 'border', '2px solid green') ON CONFLICT (selector_id, property) DO UPDATE SET value = EXCLUDED.value;`,
		);
	});

	document
		.getElementById("remove-border")
		?.addEventListener("click", async () => {
			await pg.exec(
				`DELETE FROM declarations WHERE selector_id = (SELECT id FROM selectors WHERE name = 'h1') AND property = 'border';`,
			);
		});
};

run();
