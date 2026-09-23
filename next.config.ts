import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	agentRules: false,
	experimental: { serverActions: { bodySizeLimit: "3mb" } },
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