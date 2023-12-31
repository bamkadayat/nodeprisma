import express from "express";
import { PrismaClient } from "@prisma/client";
import {
  generateToken,
  hashPassword,
  getUserFromToken,
} from "../auth/authUtils";
import { isAdmin } from "../auth/authMiddleware";
import bcrypt from "bcrypt";
import * as Mailjet from "node-mailjet";
import Stripe from "stripe";
import multer from "multer";
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage });

const stripe = new Stripe(
  "sk_test_51OIFTEAYGh0z3iWqBrqrMVSH22uyKdF9tNsb1AuTjwqNPLqifibzoDarnLea9n2BqHf7uznjy6GiXBSV1eHVBjnS00nkcsxOiF"
);

const prisma = new PrismaClient();
const router = express.Router();
const app = express();
app.use("/uploads", express.static("uploads"));

const mailjet = new Mailjet.Client({
  apiKey: "faf56b76a3fad7223c71abbf7b3c2c26",
  apiSecret: "17c319943ab7af2f1360ce26c18cef68",
});

// Email endpoint
router.post("/send-email", async (req, res) => {
  try {
    const {
      senderEmail,
      senderName,
      receiverEmail,
      receiverName,
      subject,
      htmlPart,
    } = req.body;
    const body = {
      Messages: [
        {
          From: {
            Email: senderEmail,
            Name: senderName,
          },
          To: [
            {
              Email: receiverEmail,
              Name: receiverName,
            },
          ],
          Subject: subject,
          HTMLPart: htmlPart,
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
  const { email, fullname, password } = req.body;

  try {
    // Hash password before saving to the database
    const hashedPassword = await hashPassword(password);
    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      return res.status(400).json({ error: "Email already in use" });
    }

    const newUser = await prisma.user.create({
      data: {
        email,
        fullname,
        password: hashedPassword,
        isValid: false,
      },
    });
    const emailData = {
      From: {
        Email: "support@nodeprisma.com",
        Name: "NodePrisma",
      },
      Subject: "Verify your email",
      TextPart: "Please verify your email by clicking the following link:",
      HTMLPart: `<div style="font-family: Arial, sans-serif; color: #333;">
      <h2 style="color: #000B20;">Welcome to NodePrisma, ${fullname}!</h2>
      <p>Thank you for signing up. Please confirm your email address to complete your registration.</p>
      <a href="https://nodeprisma-front.vercel.app/verify/${newUser.id}" style="background-color: #0DDFCB; color: #000B20; padding: 14px 25px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px; margin: 10px 0;">Verify Email</a>
      <p>If you did not request this email, please ignore it.</p>
    </div>`,
      To: [
        {
          Email: newUser.email,
        },
      ],
    };

    await mailjet
      .post("send", { version: "v3.1" })
      .request({ Messages: [emailData] });

    // Return the new user, but don't send the password back
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json({ ...userWithoutPassword });
  } catch (error: any) {
    // Handle potential errors, such as unique constraint violation
    res.status(400).json({ error: error.message });
  }
});

// verify email
router.post("/verify", async (req, res) => {
  const userId = req.body.userID;

  try {
    // Ensure userId is a number or a string that can be converted to a number
    if (!userId || isNaN(Number(userId))) {
      throw new Error("userId must be a number");
    }

    await prisma.user.update({
      where: { id: parseInt(userId, 10) }, // Ensure the conversion is done in base 10
      data: {
        isValid: true,
        verifiedAt: new Date(),
      },
    });

    res.status(200).json({ message: "Email verified successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /forgot-password
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  try {
    // Find the user by email
    const user = await prisma.user.findUnique({
      where: { email: email },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Generate a password reset token
    const passwordResetToken = generateToken(user);

    // Send the password reset link to the user's email address
    const request = mailjet.post("send", { version: "v3.1" }).request({
      Messages: [
        {
          From: { Email: "bamkadayat@gmail.com", Name: "Node Prisma" },
          To: [{ Email: email }],
          Subject: "Password Reset",
          TextPart: "Please reset your password",
          HTMLPart: `<div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #000B20;">Please click the following link to reset your password</h2>
          <a href="https://nodeprisma-front.vercel.app/reset-password/${passwordResetToken}" style="background-color: #0DDFCB; color: #000B20; padding: 14px 25px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px; margin: 10px 0;">Click here</a>
          <p>If you did not request this email, please ignore it.</p>
        </div>`,
        },
      ],
    });

    request
      .then(() => {
        return res.status(200).json({ message: "Password reset link sent" });
      })
      .catch((err) => {
        return res.status(500).json({ error: err.message });
      });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /reset-password
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    // Get the user's ID from the token
    const userId = getUserFromToken(token);

    if (!userId) {
      return res.status(400).json({ error: "Invalid token" });
    }

    // Find the user in the database
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update the user's password in the database
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    // Find the user by email
    const user = await prisma.user.findUnique({
      where: { email: email },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check if the user's email is verified
    if (!user.verifiedAt) {
      return res.status(401).json({ error: "Email not verified" });
    }

    // Compare the provided password with the hashed password in the database
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password" });
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
  const { email, fullname, password, role } = req.body;

  try {
    let updateData: any = {
      email,
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
        email: true,
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
        email: true,
        fullname: true,
        isValid: true,
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
        email: true,
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
//inserting product
router.post(
  "/add-product",
  isAdmin,
  upload.single("file"),
  async (req, res) => {
    const { title, price, stock, additionalInfo } = req.body;

    let imageUrl = "";
    if (req.file) {
      imageUrl = `${req.protocol}://${req.get("host")}/uploads/${
        req.file.filename
      }`;
    }

    // Add a check for required fields
    if (!title || !price || !stock) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const product = await prisma.product.create({
        data: {
          title,
          price,
          stock,
          additionalInfo,
          imageUrl,
        },
      });
      res.json({ message: "Product added successfully", data: product });
    } catch (error: any) {
      console.error("Error adding product:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

router.post("/orders", async (req, res) => {
  const { userId, products } = req.body;
  // Calculate the total price of the order
  const total = products.reduce(
    (sum: any, product: any) => sum + product.price * product.quantity,
    0
  );

  const order = await prisma.order.create({
    data: {
      user: { connect: { id: userId } },
      status: "processing",
      total: total,
      orderDetails: {
        create: products.map((product: any) => ({
          quantity: product.quantity,
          price: product.price,
          product: { connect: { id: product.id } },
        })),
      },
    },
    include: {
      orderDetails: true,
    },
  });

  res.json(order);
});

router.post("/pay", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "nok",
            product_data: {
              name: "Addidas shoes",
            },
            unit_amount: 5 * 100, // Stripe expects the amount in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: "http://localhost:3000/users/paid",
      cancel_url: "http://localhost:3000/",
    });
    res.json({ urk: session.url });
  } catch (error) {
    res.status(500).json({ error });
  }
});

router.get("/paid", async (req, res) => {
  res.send("Thank you for purchasing");
});
export { router as userRouter };
