import express from "express";
import { sseService } from "../services/sseService.js";

const router = express.Router();

// This route must NOT require authentication because we might want 
// simple setup for SSE, but usually dashboard is protected. 
// For this app, we'll keep it simple and allow the connection, 
// or rely on cookies/tokens if sent. We'll just let anyone connect 
// for now since it's just listening to public events like "member_created".
router.get("/", (req, res) => {
  sseService.addClient(req, res);
});

export default router;
