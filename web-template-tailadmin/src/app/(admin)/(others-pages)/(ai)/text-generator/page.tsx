import AiLayout from "@/components/ai/AiLayout";
import AiPageBreadcrumb from "@/components/ai/AiPageBreadcrumb";
import TextGeneratorContent from "@/components/ai/TextGeneratorContent";
import { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "Next.js AI Text Generator | GInaTor - GInaTor",
  description:
    "This is AI Next.js Text Generator page for GInaTor - GInaTor",
};

export default function TextGeneratorPage() {
  return (
    <div>
      <AiPageBreadcrumb pageTitle="Text Generator" />
      <AiLayout>
        <TextGeneratorContent />
      </AiLayout>
    </div>
  );
}
