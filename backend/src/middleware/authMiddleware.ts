import { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";

export const authMiddleware = (req: NextApiRequest, res: NextApiResponse, next: () => void) => {
  // Grab the token from the Authorization header
  const authHeader = req.headers.authorization; // may be undefined
  if (!authHeader) {
    return res.status(401).json({ message: "No token provided" });
  }

  // Usually the header is in the format "Bearer <token>"
  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Token missing" });
  }

  try {
    // TypeScript now knows token is a string
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    (req as any).user = decoded; // attach user info to request
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};
