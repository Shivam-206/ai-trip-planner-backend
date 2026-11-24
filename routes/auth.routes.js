import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/verify", requireAuth, (req, res) => {
  res.json({
    uid: req.user.uid,
    email: req.user.email,
    name: req.user.name,
  });
});

export default router;
