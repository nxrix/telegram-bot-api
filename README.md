# Telegram Bot API

Tiny zero-dependency wrapper for the [Telegram Bot API](https://core.telegram.org/bots/api).

```js
// ESM
import { setBotToken, sendMessage } from "./dist/index.mjs";

// CommonJS
const { setBotToken, sendMessage } = require("./dist/index.js");

setBotToken(process.env.BOT_TOKEN);
sendMessage({ chat_id: 123456789, text: "Hello!" }).then(console.log);
```

Browser (script tag, exposes `window.TelegramBotAPI`):

```html
<script src="dist/index.global.js"></script>
<script>
  TelegramBotAPI.setBotToken("TOKEN");
  TelegramBotAPI.sendMessage({ chat_id: 123456789, text: "Hello!" });
</script>
```

| File | Format |
| --- | --- |
| `dist/index.js` / `dist/index.min.js` | CommonJS |
| `dist/index.mjs` / `dist/index.min.mjs` | ES module |
| `dist/index.global.js` | Browser script |
