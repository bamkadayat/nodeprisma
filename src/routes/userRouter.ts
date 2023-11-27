import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import {
  generateToken,
  hashPassword,
  getUserFromToken,
} from "../auth/authUtils";
import { isAdmin } from "../auth/authMiddleware";
import bcrypt from "bcrypt";
import * as Mailjet from "node-mailjet";

const prisma = new PrismaClient();
const router = Router();

const mailjet = new Mailjet.Client({
  apiKey: "faf56b76a3fad7223c71abbf7b3c2c26",
  apiSecret: "17c319943ab7af2f1360ce26c18cef68",
});

// Email endpoint
router.post("/send-email", async (req, res) => {
  try {
    const body = {
      Messages: [
        {
          From: {
            Email: "bamkadayat@gmail.com",
            Name: "Sender Name",
          },
          To: [
            {
              Email: "bk@oblinor.no",
              Name: "Receiver Name",
            },
          ],
          Subject: "Test",
          TextPart: "Test",
          HTMLPart: "<h3>This is a test email</h3>",
        },
      ],
    };

    const result = await mailjet
      .post("send", { version: "v3.1" })
      .request(body);

    res.status(200).json({ message: "Email sent successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while sending the email" });
  }
});

// Insert user
router.post("/", async (req, res) => {
  const { username, fullname, password, email } = req.body;

  try {
    // Hash password before saving to the database
    const hashedPassword = await hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        username,
        fullname,
        password: hashedPassword,
        isValid: false,
      },
    });

    // Return the new user, but don't send the password back
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json({ ...userWithoutPassword });
  } catch (error: any) {
    // Handle potential errors, such as unique constraint violation
    res.status(400).json({ error: error.message });
  }
});

// POST /login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    // Find the user by username
    const user = await prisma.user.findUnique({
      where: { username: username },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Compare the provided password with the hashed password in the database
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Generate a token for the user
    const token = generateToken(user);

    // Send the token to the client
    res.json({ token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Endpoint to update a user
router.patch("/:userId", async (req, res) => {
  const { userId } = req.params;
  const { username, fullname, password, role } = req.body;

  try {
    let updateData: any = {
      username,
      fullname,
      role,
    };
    if (password) {
      const hashedPassword = await hashPassword(password);
      updateData.password = hashedPassword;
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: updateData,
      select: {
        id: true,
        username: true,
        fullname: true,
        createdAt: true,
      },
    });

    res.status(200).json(updatedUser);
  } catch (error: any) {
    console.error("Update Error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Endpoint to delete a user
router.delete("/:userId", async (req, res) => {
  const userId = req.params.userId;

  try {
    await prisma.user.delete({
      where: { id: parseInt(userId) },
    });

    res
      .status(200)
      .json({ message: `User with ID ${userId} successfully deleted` });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// New endpoint to get all users
router.get("/", isAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        fullname: true,
        role: true,
        createdAt: true,
        // Exclude password and other sensitive fields from the result
      },
    });

    res.status(200).json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /me - Get the current user's data
router.get("/me", async (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.split(" ")[1]; // Assuming the header is "Bearer [token]"

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  const userId = getUserFromToken(token);
  if (!userId) {
    return res.status(403).json({ error: "Invalid token" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullname: true,
        role: true,
        createdAt: true,
        // Exclude password and other sensitive fields from the result
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(user);
  } catch (error: any) {
    console.error("Error fetching user data:", error);
    res.status(500).json({ error: error.message });
  }
});

export const userRouter = router;
