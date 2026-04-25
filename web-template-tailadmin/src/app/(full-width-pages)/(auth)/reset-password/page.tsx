import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { Metadata } from "next";


export const metadata: Metadata = {
  title: "Next.js Reset Password | GInaTor - GInaTor",
  description:
    "This is Next.js Password Reset page for GInaTor GInaTor",
  // other metadata
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
