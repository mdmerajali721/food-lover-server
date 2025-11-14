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

// DATABASE
const client = new MongoClient(process.env.MONGO_URI);
let reviewCollection, favoritesCollection;

function connectDB() {
  client
    .connect()
    .then(() => {
      const db = client.db(process.env.DB_NAME || "foodLoversDB");
      reviewCollection = db.collection("reviews");
      favoritesCollection = db.collection("favorites");

      return reviewCollection.createIndex({ foodName: "text" });
    })
    .then(() => {
      console.log("MongoDB connected");
    })
    .catch((err) => {
      console.error("MongoDB connection failed:", err);
      process.exit(1);
    });
}
connectDB();

// VALIDATION HANDLER
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });
  next();
};

// GET /reviews
app.get("/reviews", (req, res) => {
  const { userEmail, search } = req.query;
  const query = {};

  if (userEmail) query.userEmail = userEmail;
  if (search && search.trim() !== "") {
    query.foodName = { $regex: search, $options: "i" };
  }

  reviewCollection
    .find(query)
    .sort({ date: -1 })
    .toArray()
    .then((reviews) =>
      res.json({
        reviews: reviews.map((r) => ({ ...r, rating: Number(r.rating) })),
      })
    )
    .catch(() => res.status(500).json({ message: "Failed to fetch reviews" }));
});

// GET /reviews/top
app.get("/reviews/top", (req, res) => {
  reviewCollection
    .find()
    .sort({ rating: -1 })
    .limit(6)
    .toArray()
    .then((topReviews) =>
      res.json(topReviews.map((r) => ({ ...r, rating: Number(r.rating) })))
    )
    .catch(() => res.status(500).json({ message: "Failed to fetch top reviews" }));
});

// GET /reviews/:id
app.get("/reviews/:id", (req, res) => {
  reviewCollection
    .findOne({ _id: new ObjectId(req.params.id) })
    .then((review) => {
      if (!review) return res.status(404).json({ message: "Review not found" });
      res.json({ ...review, rating: Number(review.rating) });
    })
    .catch(() => res.status(500).json({ message: "Failed to fetch review" }));
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
  (req, res) => {
    const review = { ...req.body, date: new Date() };

    reviewCollection
      .insertOne(review)
      .then((result) => res.status(201).json(result))
      .catch(() => res.status(500).json({ message: "Failed to add review" }));
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
  (req, res) => {
    reviewCollection
      .updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: req.body }
      )
      .then((result) => {
        if (result.matchedCount === 0)
          return res.status(404).json({ message: "Review not found" });
        res.json({ message: "Review updated successfully" });
      })
      .catch(() => res.status(500).json({ message: "Failed to update review" }));
  }
);

// DELETE /reviews/:id
app.delete("/reviews/:id", (req, res) => {
  reviewCollection
    .deleteOne({ _id: new ObjectId(req.params.id) })
    .then((result) => {
      if (result.deletedCount === 0)
        return res.status(404).json({ message: "Review not found" });
      res.json({ message: "Review deleted" });
    })
    .catch(() => res.status(500).json({ message: "Failed to delete review" }));
});

// POST /favorites
app.post(
  "/favorites",
  [
    body("userEmail").isEmail(),
    body("reviewId").notEmpty(),
    handleValidationErrors,
  ],
  (req, res) => {
    const { userEmail, reviewId } = req.body;

    favoritesCollection
      .findOne({ userEmail, reviewId })
      .then((exists) => {
        if (exists)
          return res.status(400).json({ message: "Already favorited" });

        return favoritesCollection.insertOne({
          userEmail,
          reviewId,
          date: new Date(),
        });
      })
      .then((result) => result && res.status(201).json(result))
      .catch(() => res.status(500).json({ message: "Failed to add favorite" }));
  }
);

// GET /favorites/:email
app.get("/favorites/:email", (req, res) => {
  favoritesCollection
    .find({ userEmail: req.params.email })
    .toArray()
    .then((favorites) =>
      Promise.all(
        favorites.map((fav) =>
          reviewCollection
            .findOne({ _id: new ObjectId(fav.reviewId) })
            .then((review) => ({ ...fav, review }))
        )
      )
    )
    .then((populated) => res.json(populated))
    .catch(() => res.status(500).json({ message: "Failed to fetch favorites" }));
});

// DELETE /favorites/:id
app.delete("/favorites/:id", (req, res) => {
  favoritesCollection
    .deleteOne({ _id: new ObjectId(req.params.id) })
    .then((result) => {
      if (result.deletedCount === 0)
        return res.status(404).json({ message: "Favorite not found" });
      res.json({ message: "Favorite removed" });
    })
    .catch(() => res.status(500).json({ message: "Failed to delete favorite" }));
});

// ROOT
app.get("/", (req, res) => res.send("API running..."));

// START SERVER
app.listen(port, () =>
  console.log(`Server running on http://localhost:${port}`)
);