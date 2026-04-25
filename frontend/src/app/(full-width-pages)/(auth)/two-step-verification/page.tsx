import OtpForm from "@/components/auth/OtpForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "Next.js Two Step Verification Page | GInaTor - GInaTor",
  description: "This is Next.js SignUp Page GInaTor GInaTor",
  // other metadata
};

export default function OtpVerification() {
  return <OtpForm />;
}
