import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | GInaTor",
  description: "Sign in to your GInaTor dashboard",
};

export default function SignIn() {
  return <SignInForm />;
}
