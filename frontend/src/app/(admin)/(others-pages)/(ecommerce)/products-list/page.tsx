import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ProductListTable from "@/components/ecommerce/ProductListTable";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Next.js E-commerce Products | GInaTor - GInaTor",
  description:
    "This is Next.js E-commerce Products GInaTor GInaTor",
};

export default function ProductPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Products" />
      <ProductListTable />
    </div>
  );
}
