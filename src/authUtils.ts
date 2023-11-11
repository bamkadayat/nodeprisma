import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const generateToken = (user: any) => {
  const secretKey = process.env.JWT_SECRET_KEY || "YOUR_SECRET_KEY";
  const payload = {
    id: user.id,
    username: user.username,
  };
  const options = { expiresIn: "2h" };
  return jwt.sign(payload, secretKey, options);
};

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const verifyTokenAndGetUserRole = async (token: string) => {
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET_KEY || "YOUR_SECRET_KEY"
    );
    return decoded ? decoded.role : null;
  } catch (error) {
    console.error("Token verification error:", error);
    return null;
  }
};
