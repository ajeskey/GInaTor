import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import VideosExample from "@/components/ui/video/VideosExample";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Next.js Videos | GInaTor - Next.js Dashboard Template",
  description:
    "This is Next.js Videos page for GInaTor - Next.js Tailwind CSS Admin Dashboard Template",
};

export default function VideoPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Videos" />

      <VideosExample />
    </div>
  );
}
