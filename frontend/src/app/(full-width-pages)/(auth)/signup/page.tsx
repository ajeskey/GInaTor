import SignUpForm from "@/components/auth/SignUpForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up | GInaTor",
  description: "Create a GInaTor account",
};

export default function SignUp() {
  return <SignUpForm />;
}
