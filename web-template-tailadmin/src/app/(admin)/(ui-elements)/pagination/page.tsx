import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PaginationExample from "@/components/ui/pagination/PaginationExample";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Next.js Pagination | GInaTor - GInaTor",
  description:
    "This is Next.js Pagination page for GInaTor - GInaTor",
};

export default function Pagination() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Pagination" />
      <PaginationExample />
    </div>
  );
}
