import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import RibbonExample from "@/components/ui/ribbons";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Next.js Ribbons | GInaTor - GInaTor",
  description:
    "This is Next.js Spinners page for GInaTor - GInaTor",
};

export default function Ribbons() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Ribbons" />
      <RibbonExample />
    </div>
  );
}
