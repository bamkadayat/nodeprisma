import bcrypt from "bcrypt";
import jwt, { JwtPayload } from "jsonwebtoken";

interface MyTokenPayload extends JwtPayload {
  role?: string;
}

export const generateToken = (user: any) => {
  const secretKey = process.env.JWT_SECRET_KEY || "MY_SECRET_KEY";
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
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
    ) as MyTokenPayload;
    return decoded ? decoded.role : null;
  } catch (error) {
    console.error("Token verification error:", error);
    return null;
  }
};

export const getUserFromToken = (token: string) => {
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET_KEY || "YOUR_SECRET_KEY"
    ) as JwtPayload;
    return decoded.id;
  } catch (error) {
    console.error("Token verification error:", error);
    return null;
  }
};
