import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "rag-evaluation-system",
    "openai",
    "langsmith",
    "@langchain/core",
  ],
};

export default nextConfig;
