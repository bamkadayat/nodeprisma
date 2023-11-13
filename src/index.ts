import express from "express";
import { userRouter } from "./routes/userRouter";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.get("/", (req, res) => {
  res.send("Server is running on live");
});

app.use("/users", userRouter);

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

export {};
