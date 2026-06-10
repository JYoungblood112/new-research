function getGitHubHeaders() {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
  };
}

export async function fetchGitHubData(githubUrl) {
  try {
    if (!githubUrl || !String(githubUrl).trim()) {
      return null;
    }

    let normalizedUrl = String(githubUrl).trim();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const username = normalizedUrl
      .replace(/https?:\/\/(www\.)?github\.com\//, '')
      .split('/')[0]
      .split('?')[0]
      .split('#')[0]
      .replace(/[^\w-]+$/g, '')
      .trim();

    if (!username) {
      return null;
    }

    const profileResponse = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers: getGitHubHeaders(),
    });

    if (!profileResponse.ok) {
      return null;
    }

    const profileJson = await profileResponse.json();

    const reposResponse = await fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=5`,
      {
        headers: getGitHubHeaders(),
      }
    );

    if (!reposResponse.ok) {
      return null;
    }

    const reposJson = await reposResponse.json();
    if (!Array.isArray(reposJson)) {
      return null;
    }

    const nonForkedRepos = reposJson.filter((repo) => repo && repo.fork === false);

    const topRepos = nonForkedRepos.map((repo) => ({
      name: String(repo?.name ?? ''),
      description: typeof repo?.description === 'string' ? repo.description : null,
      language: typeof repo?.language === 'string' ? repo.language : null,
      url: typeof repo?.html_url === 'string' ? repo.html_url : null,
      stars: Number.isFinite(Number(repo?.stargazers_count)) ? Number(repo.stargazers_count) : 0,
      topics: Array.isArray(repo?.topics)
        ? repo.topics.filter((topic) => typeof topic === 'string')
        : [],
    }));

    const languageSet = new Set();
    for (const repo of topRepos) {
      if (repo.language && repo.language.trim()) {
        languageSet.add(repo.language.trim());
      }
    }

    const totalStars = topRepos.reduce((sum, repo) => sum + (Number.isFinite(repo.stars) ? repo.stars : 0), 0);

    return {
      username,
      profile_url: `https://github.com/${username}`,
      bio: typeof profileJson?.bio === 'string' ? profileJson.bio : null,
      public_repos: Number.isFinite(Number(profileJson?.public_repos)) ? Number(profileJson.public_repos) : 0,
      followers: Number.isFinite(Number(profileJson?.followers)) ? Number(profileJson.followers) : 0,
      original_repo_count: nonForkedRepos.length,
      top_languages: Array.from(languageSet),
      top_repos: topRepos,
      total_stars: totalStars,
    };
  } catch {
    return null;
  }
}
