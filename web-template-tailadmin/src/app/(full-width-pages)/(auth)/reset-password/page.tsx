import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { Metadata } from "next";


export const metadata: Metadata = {
  title: "Next.js Reset Password | GInaTor - Next.js Dashboard Template",
  description:
    "This is Next.js Password Reset page for GInaTor Dashboard Template",
  // other metadata
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
