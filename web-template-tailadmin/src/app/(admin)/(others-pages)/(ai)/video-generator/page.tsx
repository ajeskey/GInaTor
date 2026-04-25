import AiLayout from "@/components/ai/AiLayout";
import AiPageBreadcrumb from "@/components/ai/AiPageBreadcrumb";
import VideoGeneratorContent from "@/components/ai/VideoGeneratorContent";
import { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "Next.js AI Video Generator | GInaTor - GInaTor",
  description:
    "This is Next.js AI Video Generator page for GInaTor - GInaTor",
};

export default function page() {
  return (
    <div>
      <AiPageBreadcrumb pageTitle="Video Generator" />
      <AiLayout>
        <VideoGeneratorContent />
      </AiLayout>
    </div>
  );
}
