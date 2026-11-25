import type { MetadataRoute } from "next";
import { SITE_URL } from "@/utils/site";
import { WORKFLOW_CONFIGS } from "@/utils/workflows";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "monthly",
      priority: 1,
    },
    ...WORKFLOW_CONFIGS.map((workflow) => ({
      url: `${SITE_URL}/${workflow.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    {
      url: `${SITE_URL}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
