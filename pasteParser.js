/**
 * Parses unstructured contact text into actionable fields using heuristics.
 */
export function parseContactString(text) {
    const result = {
        name: '',
        email: '',
        phone: '',
        company: ''
    };

    if (!text) return result;

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // 1. Regex for Email (simple heuristic)
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/;
    // 2. Regex for Phone (international or US format loosely)
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Find email
        if (!result.email) {
            const emailMatch = line.match(emailRegex);
            if (emailMatch) {
                result.email = emailMatch[1];
                // If email is found, could the rest of the line be a name? Or skip
                continue;
            }
        }

        // Find phone
        if (!result.phone) {
            const phoneMatch = line.match(phoneRegex);
            if (phoneMatch) {
                result.phone = phoneMatch[0];
                continue;
            }
        }

        // If neither email nor phone, heuristic for Name/Company
        // First non-contact line is usually Name, second is Company
        if (!result.name) {
            // Very basic check: short string, title cased
            if (line.split(' ').length <= 4) {
                result.name = line;
            }
        } else if (!result.company) {
            result.company = line;
        }
    }

    return result;
}
