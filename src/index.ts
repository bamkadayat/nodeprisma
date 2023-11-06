import express from "express";

const app = express();
const port = 3000; // You can choose any port

app.get("/", (req, res) => {
  res.send("Hello, world! You are Live now");
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

export {}; // Add this if you don't have any other exports
