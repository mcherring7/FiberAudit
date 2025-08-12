import { Router } from "express";
import { aiAnalyze } from "../ai";

const r = Router();
r.use((req, _res, next) => { if (!req.is('application/json')) req.headers['content-type'] = 'application/json'; next(); });

r.post("/advisor/run", async (req, res) => {
  try {
    const { plan, token_usage } = await aiAnalyze(req.body ?? {});
    console.log(JSON.stringify({ ts: Date.now(), endpoint: "/advisor/run", token_usage }));
    res.json({ ok: true, plan, token_usage });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "AI failed" });
  }
});

export default r;
