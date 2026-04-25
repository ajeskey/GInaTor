import AiLayout from "@/components/ai/AiLayout";
import AiPageBreadcrumb from "@/components/ai/AiPageBreadcrumb";
import ImageGeneratorContent from "@/components/ai/ImageGeneratorContent";
import { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "Next.js AI Image Generator | GInaTor - Next.js Admin Dashboard Template",
  description:
    "This is  Next.js AI Image Generator page for GInaTor - Next.js Tailwind CSS Admin Dashboard Template",
};

export default function page() {
  return (
    <div>
      <AiPageBreadcrumb pageTitle="Image Generator" />
      <AiLayout>
        <ImageGeneratorContent />
      </AiLayout>
    </div>
  );
}
