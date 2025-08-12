import { aiAnalyze } from "./ai";

(async () => {
  const { plan, token_usage } = await aiAnalyze({ ping: "hello" });
  console.log(JSON.stringify({ ok: true, plan, token_usage }, null, 2));
})();
