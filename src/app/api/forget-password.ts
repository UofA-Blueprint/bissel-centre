import type { NextApiRequest, NextApiResponse } from "next";
import * as admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";
import nodemailer from "nodemailer";

// Initialize Admin SDK once (check if not already initialized)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      // Replace with your Firebase Admin service account credentials
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      privateKey: process.env.NEXT_PUBLIC_FIREBASE_ADMIN_PRIVATE_KEY?.replace(
        /\\n/g,
        "\n"
      ),
    }),
  });
}

type Data = {
  success: boolean;
  message: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  try {
    const { email } = req.body;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    // Generate a random 8-character password
    const randomPassword = uuidv4().slice(0, 8);

    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(email);

    // Update user's password in Firebase
    await admin.auth().updateUser(userRecord.uid, {
      password: randomPassword,
    });

    // Create nodemailer transporter using SMTP credentials from environment variables
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, // e.g., smtp.gmail.com
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true", // true for port 465, false for others
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Email options
    const mailOptions = {
      from: process.env.SMTP_FROM || "no-reply@example.com", // sender address
      to: email, // recipient's email
      subject: "Your New Password",
      text: `Your password has been reset. Your new password is: ${randomPassword}`,
      html: `<p>Your password has been reset. Your new password is: <strong>${randomPassword}</strong></p>`,
    };

    // Send the email with the new password
    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      message:
        "Password reset successfully. Check your email for the new password.",
    });
  } catch (error: any) {
    console.error(error);
    return res.status(400).json({
      success: false,
      message: error.message || "Something went wrong.",
    });
  }
}
