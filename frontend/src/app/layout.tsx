export const metadata = {
	title: "Dealer Lead Stressor",
	description: "Sorted Leads and Explain",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
				<div style={{ maxWidth: 1000, margin: "0 auto", padding: 20 }}>
					<h1>Dealer Lead Stressor</h1>
					{children}
				</div>
			</body>
		</html>
	);
}


