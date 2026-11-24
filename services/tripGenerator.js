import { GoogleGenAI, Type } from "@google/genai";

const AI_PROMPT = `
Generate a detailed and practical travel plan.

Destination: {location}
Duration: {days} days
Travelers: {travelers}
Budget: {budget}

Return the following information:

1. Hotel Recommendations:
Recommend 3 hotels or accommodations suitable for the destination and selected budget.

For every hotel include:
- hotelName
- hotelAddress
- price
- rating

2. Day-wise Itinerary:
Create an itinerary for every day of the trip.
Include multiple places to visit each day.

For every place include:
- time
- placeName
- placeDetails
- placeImageUrl
- geoCoordinates
- ticketPricing
- timeToTravel

Important instructions:
- Recommend real places and accommodations.
- Keep recommendations relevant to the selected budget.
- Make the itinerary practical and geographically sensible.
- Do not invent exact hotel prices or ratings. If unavailable, mention that they are estimates or unavailable.
- Return only valid JSON matching the requested schema.
`;

const responseJsonSchema = {
  type: Type.OBJECT,
  properties: {
    tripName: {
      type: Type.STRING,
    },
    hotels: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          hotelName: { type: Type.STRING },
          hotelAddress: { type: Type.STRING },
          price: { type: Type.STRING },
          rating: { type: Type.STRING },
        },
        required: ["hotelName", "hotelAddress", "price", "rating"],
      },
    },
    itinerary: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.INTEGER },
          places: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                time: { type: Type.STRING },
                placeName: { type: Type.STRING },
                placeDetails: { type: Type.STRING },
                placeImageUrl: { type: Type.STRING },
                geoCoordinates: { type: Type.STRING },
                ticketPricing: { type: Type.STRING },
                timeToTravel: { type: Type.STRING },
              },
              required: [
                "time",
                "placeName",
                "placeDetails",
                "placeImageUrl",
                "geoCoordinates",
                "ticketPricing",
                "timeToTravel",
              ],
            },
          },
        },
        required: ["day", "places"],
      },
    },
  },
  required: ["tripName", "hotels", "itinerary"],
};

const MODELS = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-2.5-flash"];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryable(error) {
  const status = error?.status ?? error?.code;
  const text = String(error?.message || "");

  return (
    [429, 500, 503].includes(status) ||
    text.includes("UNAVAILABLE") ||
    text.includes("RESOURCE_EXHAUSTED")
  );
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  return new GoogleGenAI({ apiKey });
}

export async function generateTripData(selection) {
  const ai = getGeminiClient();
  const prompt = AI_PROMPT.replace("{location}", selection.destination)
    .replace("{days}", String(selection.days))
    .replace("{budget}", selection.budget)
    .replace("{travelers}", selection.travelers);
  let lastError;

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseJsonSchema,
          },
        });

        return JSON.parse(response.text);
      } catch (error) {
        lastError = error;
        if (!isRetryable(error)) {
          throw error;
        }
        await sleep(1500 * attempt);
      }
    }
  }

  throw lastError;
}
