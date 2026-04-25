import InvoiceMain from "@/components/invoice/InvoiceMain";
import { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "Next.js E-commerce Single Invoice | GInaTor - GInaTor",
  description:
    "This is Next.js E-commerce  Single Invoice GInaTor GInaTor",
};

export default function SingleInvoicePage() {
  return (
    <div>
      <InvoiceMain />
    </div>
  );
}
