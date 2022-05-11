/**
 * Escapes a string for use in XML tag contents and attribute values.
 */
export function xmlEscape (val: string) {
	return val
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}
