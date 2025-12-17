export function maskVin(vin: string): string {
	if (!vin) return "";
	const last4 = vin.slice(-4);
	return `*************${last4}`;
}


