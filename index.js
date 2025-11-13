import express from "express";
import cors from "cors";

tenv.config();
const app = express();
const port = process.env.PORT || 5000;

// MIDDLEWARES
app.use(cors());
app.use(helmet());
app.use(express.json());

app.get("/", (req, res) => res.send("API running..."));
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));