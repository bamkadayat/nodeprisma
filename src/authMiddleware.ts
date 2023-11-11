// Middleware to check if the user is an admin
import { Request, Response, NextFunction } from "express";
import { verifyTokenAndGetUserRole } from "./authUtils";

export const isAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers["authorization"] || "";
  const role = await verifyTokenAndGetUserRole(token);

  if (role === "admin") {
    next();
  } else {
    res.status(403).json({ error: "You need admin access to get data" });
  }
};
