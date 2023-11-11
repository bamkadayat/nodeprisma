import express from "express";
import { userRouter } from "./userRouter";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use("/users", userRouter);

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

export {};
