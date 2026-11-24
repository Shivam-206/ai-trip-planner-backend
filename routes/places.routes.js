import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getPlacePhoto } from "../services/places.js";

const router = Router();

router.get("/photo", requireAuth, async (req, res) => {
  const query = typeof req.query.query === "string" ? req.query.query.trim() : "";
  if (!query) {
    return res.status(400).json({ error: "Place query is required" });
  }
  if (query.length > 200) {
    return res.status(400).json({ error: "Place query is too long" });
  }

  try {
    const photo = await getPlacePhoto(query);
    if (!photo) {
      return res.status(404).json({ error: "No photo found for this place" });
    }

    res.set("Content-Type", photo.contentType);
    res.set("Cache-Control", "private, max-age=3600");
    return res.send(photo.data);
  } catch (error) {
    console.error("Place photo lookup failed:", error);
    return res.status(error.status || 502).json({ error: "Place photo is unavailable" });
  }
});

export default router;
