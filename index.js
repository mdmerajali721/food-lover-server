import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import { body, validationResult } from "express-validator";

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

// VALIDATION ERROR HANDLER
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });
  next();
};

// GET /reviews?userEmail=&search=
app.get("/reviews", async (req, res) => {
  try {
    const { userEmail, search } = req.query;
    const query = {};

    if (userEmail) query.userEmail = userEmail;
    if (search && search.trim() !== "") {
      query.foodName = { $regex: search, $options: "i" };
    }

    const reviews = await reviewCollection.find(query).sort({ date: -1 }).toArray();
    res.json({ reviews: reviews.map(r => ({ ...r, rating: Number(r.rating) })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
});

// GET /reviews/top
app.get("/reviews/top", async (req, res) => {
  try {
    const topReviews = await reviewCollection
      .find()
      .sort({ rating: -1 })
      .limit(6)
      .toArray();
    res.json(topReviews.map(r => ({ ...r, rating: Number(r.rating) })));
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch top reviews" });
  }
});

// GET /reviews/:id
app.get("/reviews/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const review = await reviewCollection.findOne({ _id: new ObjectId(id) });
    if (!review) return res.status(404).json({ message: "Review not found" });
    res.json({ ...review, rating: Number(review.rating) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch review" });
  }
});

// POST /reviews
app.post(
  "/reviews",
  [
    body("foodName").notEmpty(),
    body("foodImage").notEmpty(),
    body("restaurantName").notEmpty(),
    body("rating").isInt({ min: 0, max: 5 }),
    body("userEmail").isEmail(),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const review = { ...req.body, date: new Date() };
      const result = await reviewCollection.insertOne(review);
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to add review" });
    }
  }
);

// PUT /reviews/:id
app.put(
  "/reviews/:id",
  [
    body("foodName").optional().notEmpty(),
    body("foodImage").optional().notEmpty(),
    body("restaurantName").optional().notEmpty(),
    body("rating").optional().isInt({ min: 0, max: 5 }),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const result = await reviewCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: req.body }
      );
      if (result.matchedCount === 0)
        return res.status(404).json({ message: "Review not found" });
      res.json({ message: "Review updated successfully" });
    } catch (err) {
      res.status(500).json({ message: "Failed to update review" });
    }
  }
);

// DELETE /reviews/:id
app.delete("/reviews/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await reviewCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0)
      return res.status(404).json({ message: "Review not found" });
    res.json({ message: "Review deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete review" });
  }
});



app.get("/", (req, res) => res.send("API running..."));
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));