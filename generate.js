const fs = require("fs");
const cheerio = require("cheerio");

const DOC_URL = "https://core.telegram.org/bots/api";
const OUT = process.argv[2] || "index.js";
const SRC = process.argv[3];

const clean = (s) => s.replace(/\s+/g, " ").trim();

// "Integer or String" -> "number|string", "Array of Integer" -> "number[]"
const jsType = (t) => {
  const one = (x) => {
    x = x.trim();
    const arr = x.match(/^Array of (.+)$/);
    if (arr) return `${one(arr[1])}[]`;
    if (/^(Integer|Float|Float number)$/.test(x)) return "number";
    if (x === "String") return "string";
    if (/^Boolean|True$/.test(x)) return "boolean";
    return x; // object types such as MessageEntity keep their Telegram name
  };
  return t.split(/,? or /).map(one).join("|");
};

async function main() {
  let html;
  if (SRC) {
    html = fs.readFileSync(SRC, "utf8");
  } else {
    const res = await fetch(DOC_URL);
    if (!res.ok) throw new Error(`Failed to fetch docs: ${res.status}`);
    html = await res.text();
  }
  const $ = cheerio.load(html);

  const methods = [];
  $("h4").each((_, el) => {
    const name = clean($(el).text());
    // methods are lowerCamelCase, types are UpperCamelCase, other h4s contain spaces
    if (!/^[a-z][A-Za-z]+$/.test(name)) return;

    const section = $(el).nextUntil("h4, h3");
    const description = section
      .filter("p")
      .map((_, p) => clean($(p).text()))
      .get()
      .join(" ");

    const params = [];
    section.filter("table").first().find("tbody tr").each((_, tr) => {
      const td = $(tr).find("td").map((_, c) => clean($(c).text())).get();
      if (td.length >= 4) {
        params.push({ name: td[0], type: td[1], required: td[2] === "Yes", desc: td[3] });
      }
    });

    methods.push({ name, description, params });
  });

  if (!methods.length) throw new Error("No methods found - page layout may have changed.");

  const HAND_WRITTEN = new Set(["setWebhook", "deleteWebhook"]);
  for (let i = methods.length - 1; i >= 0; i--) {
    if (HAND_WRITTEN.has(methods[i].name)) methods.splice(i, 1);
  }

  const header = `// generated from ${DOC_URL}

let botToken = "";

const setBotToken = (token) => {
  botToken = token;
};

const getBotToken = () => botToken;

const api = "https://api.telegram.org";

const request = async (token, method, params) => {
  const res = await fetch(\`\${api}/bot\${token}/\${method}\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params ?? {}),
  });
  return res.json();
};

const setWebhook = (token, url, extra = {}) => request(token, "setWebhook", { url, ...extra });
const getWebhook = (token) => request(token, "getWebhookInfo");
const deleteWebhook = (token, extra = {}) => request(token, "deleteWebhook", extra);

const call = (method, params) => request(botToken, method, params);
const tg = (method) => (params) => call(method, params);

const fileUrl = (filePath) => \`\${api}/file/bot\${botToken}/\${filePath}\`;

`;

  const body = methods
    .map((m) => {
      const lines = ["/**", ` * ${m.description || m.name}`];
      if (m.params.length) {
        lines.push(" * @param {Object} params");
        for (const p of m.params) {
          const n = p.required ? `params.${p.name}` : `[params.${p.name}]`;
          lines.push(` * @param {${jsType(p.type)}} ${n} - ${p.desc}`);
        }
      }
      lines.push(" */");
      return `${lines.join("\n")}\nconst ${m.name} = tg("${m.name}");`;
    })
    .join("\n\n");

  const exportsList = [
    "setBotToken", "getBotToken", "setWebhook", "getWebhook", "deleteWebhook", "call", "fileUrl",
    ...methods.map((m) => m.name),
  ];
  const list = exportsList.map((n) => `  ${n},`).join("\n");
  const cjsFooter = `\n\nmodule.exports = {\n${list}\n};\n`;
  const esmFooter = `\n\nexport {\n${list}\n};\n`;

  const minBody = body
    .replace(/\/\*\*[\s\S]*?\*\/\n?/g, "")
    .replace(/\n{2,}/g, "\n");

  const globalOut =
    `(function (root) {\n${header}${minBody}\n\nroot.TelegramBotAPI = {\n${list}\n};\n` +
    `})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this);\n`;

  const base = OUT.replace(/\.js$/, "");
  const files = {
    [`${base}.js`]: header + body + cjsFooter,
    [`${base}.min.js`]: header + minBody + cjsFooter,
    [`${base}.mjs`]: header + body + esmFooter,
    [`${base}.min.mjs`]: header + minBody + esmFooter,
    [`${base}.global.js`]: globalOut,
  };
  for (const [file, content] of Object.entries(files)) fs.writeFileSync(file, content);
  console.log(`Wrote ${methods.length} methods to ${Object.keys(files).join(", ")}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
