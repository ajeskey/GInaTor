import InvoiceMain from "@/components/invoice/InvoiceMain";
import { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "Next.js E-commerce Single Invoice | GInaTor - Next.js Dashboard Template",
  description:
    "This is Next.js E-commerce  Single Invoice GInaTor Dashboard Template",
};

export default function SingleInvoicePage() {
  return (
    <div>
      <InvoiceMain />
    </div>
  );
}
