// Middleware to check if the user is an admin
import { Request, Response, NextFunction } from "express";
import { verifyTokenAndGetUserRole } from "./authUtils";
export const isAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const header = req.headers["authorization"] || "";
    const token = header.split(" ")[1]; // Assuming the header is "Bearer [token]"

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const role = await verifyTokenAndGetUserRole(token);

    if (role === "ADMIN") {
      next();
    } else {
      res.status(403).json({ error: "You need admin access to get data" });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
};
