import mongoose from "mongoose";

const placeSchema = new mongoose.Schema(
  {
    time: String,
    placeName: String,
    placeDetails: String,
    placeImageUrl: String,
    geoCoordinates: String,
    ticketPricing: String,
    timeToTravel: String,
  },
  { _id: false, strict: false }
);

const itineraryDaySchema = new mongoose.Schema(
  {
    day: Number,
    places: [placeSchema],
  },
  { _id: false, strict: false }
);

const hotelSchema = new mongoose.Schema(
  {
    hotelName: String,
    hotelAddress: String,
    price: String,
    rating: String,
  },
  { _id: false, strict: false }
);

const userSelectionSchema = new mongoose.Schema(
  {
    destination: { type: String, required: true },
    days: { type: Number, required: true },
    budget: { type: String, required: true },
    travelers: { type: String, required: true },
  },
  { _id: false }
);

const tripDataSchema = new mongoose.Schema(
  {
    tripName: String,
    hotels: [hotelSchema],
    itinerary: [itineraryDaySchema],
  },
  { _id: false, strict: false }
);

const tripSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, required: true },
    userSelection: { type: userSelectionSchema, required: true },
    tripData: { type: tripDataSchema, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  {
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
      },
    },
  }
);

const Trip = mongoose.model("Trip", tripSchema);

export default Trip;
