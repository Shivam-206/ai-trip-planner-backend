import { Router } from "express";
import mongoose from "mongoose";
import Trip from "../models/Trip.js";
import { requireAuth } from "../middleware/auth.js";
import { generateTripData } from "../services/tripGenerator.js";

const router = Router();
const VALID_BUDGETS = new Set(["Cheap", "Moderate", "Luxury"]);
const VALID_TRAVELERS = new Set(["Just Me", "A Couple", "Family", "Friends"]);
const MAX_DESTINATION_LENGTH = 200;

router.get("/", requireAuth, async (req, res) => {
  try {
    const trips = await Trip.find({ userId: req.user.uid }).sort({ createdAt: -1 });
    return res.json(trips.map((trip) => trip.toJSON()));
  } catch (error) {
    console.error("Fetching user trips failed:", error);
    return res.status(500).json({ error: "Trips could not be loaded." });
  }
});

router.get("/:tripId", requireAuth, async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.tripId)) {
    return res.status(400).json({ error: "Invalid trip ID" });
  }

  try {
    const trip = await Trip.findOne({
      _id: req.params.tripId,
      userId: req.user.uid,
    });

    if (!trip) {
      return res.status(404).json({ error: "Trip not found" });
    }

    return res.json(trip.toJSON());
  } catch (error) {
    console.error("Fetching trip failed:", error);
    return res.status(500).json({ error: "Trip could not be loaded." });
  }
});

router.post("/", requireAuth, async (req, res) => {
  const { destination, days, budget, travelers } = req.body || {};
  const userSelection = {
    destination: typeof destination === "string" ? destination.trim() : "",
    days,
    budget: typeof budget === "string" ? budget.trim() : "",
    travelers: typeof travelers === "string" ? travelers.trim() : "",
  };

  if (!userSelection.destination) {
    return res.status(400).json({ error: "Destination is required" });
  }
  if (userSelection.destination.length > MAX_DESTINATION_LENGTH) {
    return res.status(400).json({ error: "Destination must be 200 characters or fewer" });
  }
  if (!Number.isInteger(userSelection.days) || userSelection.days < 1 || userSelection.days > 5) {
    return res.status(400).json({ error: "Days must be an integer between 1 and 5" });
  }
  if (!VALID_BUDGETS.has(userSelection.budget)) {
    return res.status(400).json({ error: "A valid budget is required" });
  }
  if (!VALID_TRAVELERS.has(userSelection.travelers)) {
    return res.status(400).json({ error: "A valid traveler selection is required" });
  }
  if (!req.user.email) {
    return res.status(400).json({ error: "Verified account email is required" });
  }

  let tripData;
  try {
    tripData = await generateTripData(userSelection);
  } catch (error) {
    console.error("Trip generation failed:", error);
    return res.status(502).json({ error: "Trip generation failed. Please try again." });
  }

  try {
    const savedTrip = await Trip.create({
      userId: req.user.uid,
      userEmail: req.user.email,
      userSelection,
      tripData,
      createdAt: new Date(),
    });
    const trip = savedTrip.toJSON();

    return res.status(201).json({
      id: trip.id,
      userSelection: trip.userSelection,
      tripData: trip.tripData,
      createdAt: trip.createdAt,
    });
  } catch (error) {
    console.error("Saving generated trip failed:", error);
    return res.status(500).json({ error: "Generated trip could not be saved." });
  }
});

export default router;
