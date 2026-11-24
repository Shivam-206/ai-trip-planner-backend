import "./config/loadEnv.js";
import app from "./app.js";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import { initFirebase } from "./config/firebase.js";

function describeStartupError(stage, error) {
  const errorType =
    typeof error?.name === "string" && /^[A-Za-z][A-Za-z0-9]*$/.test(error.name)
      ? error.name
      : "Error";
  const errorCode =
    typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code)
      ? ` (${error.code})`
      : "";

  if (stage === "PORT configuration") {
    return "PORT must be an integer between 1 and 65535.";
  }
  if (stage === "MongoDB connection") {
    if (error?.message === "MONGODB_URI is not set") {
      return error.message;
    }
    return `MongoDB connection failed (${errorType}${errorCode}). Check MONGODB_URI and Atlas network access.`;
  }
  if (stage === "Firebase Admin initialization") {
    if (error?.message?.startsWith("Missing Firebase Admin credentials.")) {
      return error.message;
    }
    return `Firebase Admin initialization failed (${errorType}). Check the FIREBASE_* settings.`;
  }
  return `HTTP server failed to listen (${errorType}${errorCode}). Check the Render port configuration.`;
}

function reportStartupFailure(stage, error) {
  console.error(`Server startup failed during ${stage}: ${describeStartupError(stage, error)}`);
}

async function exitAfterStartupFailure(stage, error) {
  reportStartupFailure(stage, error);
  try {
    await mongoose.disconnect();
  } catch {
    console.error("MongoDB cleanup failed after startup failure.");
  }
  process.exitCode = 1;
}

async function startServer() {
  let stage = "PORT configuration";

  try {
    const port = Number(process.env.PORT || 5000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("Invalid PORT");
    }

    stage = "MongoDB connection";
    await connectDB();

    stage = "Firebase Admin initialization";
    initFirebase();

    stage = "HTTP server startup";
    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`Server listening on port ${port}`);
    });

    server.on("error", (error) => {
      void exitAfterStartupFailure(stage, error);
    });
  } catch (error) {
    await exitAfterStartupFailure(stage, error);
  }
}

await startServer();
