import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";


dotenv.config();
const app = express();
const port = process.env.PORT || 5000;

// MIDDLEWARES
app.use(cors());
app.use(helmet());
app.use(express.json());

//  DATABASE 
const client = new MongoClient(process.env.MONGO_URI);
let reviewCollection, favoritesCollection;

async function connectDB() {
  try {
    await client.connect();
    const db = client.db(process.env.DB_NAME || "foodLoversDB");
    reviewCollection = db.collection("reviews");
    favoritesCollection = db.collection("favorites");

    // Optional text index for faster search
    await reviewCollection.createIndex({ foodName: "text" });

    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  }
}
connectDB();

app.get("/", (req, res) => res.send("API running..."));
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));