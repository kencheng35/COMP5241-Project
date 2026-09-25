import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	agentRules: false,
	experimental: { serverActions: { bodySizeLimit: "4.4mb" } },
	serverExternalPackages: ["pdfjs-dist"],
	outputFileTracingIncludes: { "/teaching": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"] },
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "images.unsplash.com",
			},
		],
	},
};

export default nextConfig;