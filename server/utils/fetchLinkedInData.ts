type LinkedInData = {
  rawText: string;
  sourceUrl: string;
};

export async function fetchLinkedInData(linkedinUrl: string): Promise<LinkedInData | null> {
  try {
    if (!linkedinUrl || !linkedinUrl.trim()) {
      return null;
    }

    let normalizedUrl = linkedinUrl.trim();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const rawText = text.slice(0, 1500).trim();

    if (rawText.length < 200) {
      return null;
    }

    const lower = rawText.toLowerCase();
    if (rawText.length < 500 && (lower.includes('authwall') || lower.includes('log in'))) {
      return null;
    }

    return { rawText, sourceUrl: normalizedUrl };
  } catch {
    return null;
  }
}
